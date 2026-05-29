import { GameLoop } from './GameLoop';
import { StateMachine, type State } from './StateMachine';
import { bus } from './EventBus';
import { Config } from '@/config/GameConfig';
import { biomeForDistance } from '@/config/Biomes';

import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { Renderer } from '@/rendering/Renderer';
import { LevelStreamer } from '@/level/LevelStreamer';
import { PowerUpManager } from '@/powerups/PowerUpManager';
import { POWERUP_BY_ID } from '@/powerups/definitions';
import { TimeEconomy } from '@/timer/TimeEconomy';
import { BallEntity } from '@/entities/BallEntity';
import { InputManager } from '@/input/InputManager';
import { HUD } from '@/ui/HUD';
import { Overlays } from '@/ui/Overlays';
import { PowerUpModal } from '@/ui/PowerUpModal';
import { AudioEngine } from '@/audio/AudioEngine';
import { SaveManager, type CheckpointSnapshot } from '@/persistence/SaveManager';

/** World-Y the ball launches from; distance is measured relative to it. */
const SPAWN = { x: 1.5, y: 8 };
const PUSH_IMPULSE = 34;

/**
 * The top-level orchestrator. Owns every subsystem, the fixed-timestep loop,
 * and the Menu → Playing → GameOver state machine. Subsystems communicate via
 * the EventBus; the Game only wires their lifecycles and the few cross-cutting
 * actions (power-up modal pause, Warp Drive teleport, Push swipes).
 */
export class Game {
  private readonly renderer: Renderer;
  private readonly world = new PhysicsWorld();
  private readonly streamer: LevelStreamer;
  private readonly powerups = new PowerUpManager();
  private readonly economy: TimeEconomy;
  private readonly ballEntity: BallEntity;
  private readonly audio = new AudioEngine();
  private readonly hud: HUD;
  private readonly overlays: Overlays;
  private readonly modal: PowerUpModal;
  private readonly input: InputManager;
  private readonly loop: GameLoop;
  private readonly fsm: StateMachine<Game>;

  /** Suspends the sim while the power-up modal is open. */
  private paused = false;
  private best: number = SaveManager.getBest();

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.renderer = new Renderer(canvas);
    const startBiome = biomeForDistance(0);
    this.ballEntity = new BallEntity(this.renderer.scene, startBiome.accent);
    this.streamer = new LevelStreamer(this.renderer.scene, this.world);
    this.economy = new TimeEconomy(this.world, this.streamer, this.powerups);

    this.hud = new HUD(uiRoot);
    this.modal = new PowerUpModal(uiRoot);
    this.overlays = new Overlays(uiRoot, {
      onStart: () => this.beginRun(),
      onRestart: () => this.beginRun(),
      onContinue: () => this.continueRun(),
    });

    this.input = new InputManager(canvas, {
      onFlipper: (side, down) => this.onFlipper(side, down),
      onSwipe: (dx, dy, strength) => this.onSwipe(dx, dy, strength),
      isPushMode: () => this.powerups.pushMode && this.fsm.is('playing'),
    });

    this.powerups.warpHandler = (dy) => this.warp(dy);

    this.fsm = new StateMachine<Game>(this)
      .register(this.menuState())
      .register(this.playingState())
      .register(this.gameOverState());

    this.loop = new GameLoop({
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      render: (alpha, dt) => this.render(alpha, dt),
    });

    this.bindEvents();
  }

  // ------------------------------------------------------------- boot --- //

  start(): void {
    this.resetRun();
    this.fsm.transition('menu');
    this.input.enable();
    this.loop.start();
  }

  private bindEvents(): void {
    bus.on('powerup:offered', ({ choices }) => this.onPowerupOffered(choices));
    bus.on('biome:changed', () => this.applyBiome());
    bus.on('checkpoint:crossed', ({ distance }) => {
      // Snapshot exact remaining time so a "continue" can't refill the clock.
      const snapshot: CheckpointSnapshot = {
        distance,
        remaining: this.economy.remaining,
        spawnY: distance + SPAWN.y,
      };
      SaveManager.saveCheckpoint(snapshot);
    });
  }

  // --------------------------------------------------------- run flow --- //

  private resetRun(snapshot?: CheckpointSnapshot): void {
    const spawnY = snapshot ? snapshot.spawnY : SPAWN.y;
    this.paused = false;
    this.powerups.reset();
    this.world.timeScale = 1;
    this.world.ball.reset(SPAWN.x, spawnY);
    this.world.resetNudge();
    this.streamer.reset(spawnY);
    this.economy.reset(snapshot?.remaining ?? Config.time.start, snapshot?.distance ?? 0, SPAWN.y);
    this.ballEntity.reset(SPAWN.x, spawnY);
    this.renderer.cameraRig.snapTo(spawnY);
    this.applyBiome();
  }

  private beginRun(): void {
    this.audio.resume();
    this.audio.startMusic();
    this.resetRun();
    this.hud.show();
    this.fsm.transition('playing');
  }

  private continueRun(): void {
    const snapshot = SaveManager.getCheckpoint();
    if (!snapshot) {
      this.beginRun();
      return;
    }
    this.audio.resume();
    this.audio.startMusic();
    this.resetRun(snapshot);
    this.hud.show();
    this.fsm.transition('playing');
  }

  private endRun(): void {
    this.best = SaveManager.setBest(this.economy.distance);
    this.audio.stopMusic();
    this.audio.gameOver();
    this.input.releaseAll();
    this.fsm.transition('gameover');
  }

  // ----------------------------------------------------- frame update --- //

  private fixedUpdate(dt: number): void {
    if (!this.fsm.is('playing') || this.paused) return;
    this.world.timeScale = this.powerups.physicsTimeScale;
    this.world.step(dt);
    this.powerups.fixedUpdate(dt);
    this.economy.fixedUpdate(dt);
    if (this.economy.isOver) this.endRun();
  }

  private render(alpha: number, dt: number): void {
    const ball = this.world.ball;
    this.ballEntity.sync(ball, alpha);
    for (const pair of this.streamer.allFlipperPairs) pair.sync();
    this.streamer.animate(dt);
    this.streamer.update(ball.position.y);
    this.renderer.cameraRig.setTarget(ball.position.y);
    this.hud.setActivePowerups(this.powerups.activeIds);
    this.renderer.render(dt);
  }

  // --------------------------------------------------------- actions --- //

  private onFlipper(side: 'left' | 'right', down: boolean): void {
    if (!this.fsm.is('playing') || this.paused) return;
    for (const pair of this.streamer.allFlipperPairs) pair.press(side, down);
    if (down) {
      bus.emit('flipper:actuate', { side });
      this.powerups.notifyFlip();
    }
  }

  private onSwipe(dx: number, dy: number, strength: number): void {
    if (!this.fsm.is('playing') || this.paused) return;
    const ball = this.world.ball;
    ball.velocity.x += dx * PUSH_IMPULSE * strength;
    ball.velocity.y += dy * PUSH_IMPULSE * strength;
    ball.clampSpeed();
  }

  private warp(dy: number): void {
    const ball = this.world.ball;
    ball.position.y += dy;
    ball.prevPosition.y += dy;
    ball.maxY = Math.max(ball.maxY, ball.position.y);
    ball.velocity.y = Math.max(ball.velocity.y, 0);
    this.world.resetNudge();
    this.renderer.cameraRig.snapTo(ball.position.y);
    this.ballEntity.reset(ball.position.x, ball.position.y);
    this.streamer.update(ball.position.y, true);
  }

  private onPowerupOffered(choices: string[]): void {
    const a = POWERUP_BY_ID.get(choices[0]);
    const b = POWERUP_BY_ID.get(choices[1]);
    if (!a || !b) return;
    this.paused = true;
    this.input.releaseAll();
    void this.modal.present(a, b).then((id) => {
      this.powerups.activate(id);
      this.paused = false;
    });
  }

  private applyBiome(): void {
    const biome = biomeForDistance(this.economy.distance);
    this.renderer.setBackground(biome.background);
    this.ballEntity.setColor(biome.accent);
    this.audio.setBiome(Math.floor(this.economy.distance / 1000));
  }

  // ---------------------------------------------------------- states --- //

  private menuState(): State<Game> {
    return {
      name: 'menu',
      onEnter: (ctx) => {
        ctx.hud.hide();
        ctx.overlays.showMenu();
      },
    };
  }

  private playingState(): State<Game> {
    return {
      name: 'playing',
      onEnter: (ctx) => ctx.hud.show(),
    };
  }

  private gameOverState(): State<Game> {
    return {
      name: 'gameover',
      onEnter: (ctx) => {
        ctx.hud.hide();
        const canContinue = SaveManager.getCheckpoint() !== null;
        ctx.overlays.showGameOver(ctx.economy.distance, ctx.best, canContinue);
        bus.emit('game:over', { distance: ctx.economy.distance, best: ctx.best });
      },
    };
  }
}
