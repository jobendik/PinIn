# PinIn

A neon, synthwave **vertical pinball runner** for the browser — an original HTML5/WebGL
homage to the design paradigm of Mediocre AB's *PinOut*: an infinitely-extending
vertical playfield where the only currency is **time**. Built with **Vite +
TypeScript + Three.js** and a hand-rolled, continuous-collision 2D physics engine.

> All art, audio, level layouts, biome/rank names, and code are original to this
> project. The game is inspired by *PinOut*'s mechanics, not a copy of its assets.

---

## Gameplay

- Start with **60 seconds**. The clock never stops.
- **Tap the left/right half** of the screen to fire all left/right flippers.
- Collect glowing **Time Dots** (+1s) and cross **checkpoints** every 1,000 m (+25s).
- Grab **power-up orbs** for a binary choice of run-altering modifiers.
- Pass 8,000 m to enter **Overtime** — the canyons loop forever, but dots and
  power-ups are gone. Pure attrition on your banked time.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production bundle to dist/
npm run preview   # serve the production build
```

Requires Node 18+.

---

## Architecture

The codebase is organised by responsibility, communicating through a typed
`EventBus` so systems stay decoupled.

```
src/
├─ main.ts                 Entry point
├─ config/                 Tunable constants & the biome/rank progression table
│  ├─ GameConfig.ts        Physics, flipper, time, camera, bloom, pool sizes
│  └─ Biomes.ts            8 canyons + Overtime, palettes & difficulty knobs
├─ core/                   Engine plumbing
│  ├─ Game.ts              Top-level orchestrator + state wiring
│  ├─ GameLoop.ts          Fixed-timestep loop, decoupled from rendering
│  ├─ StateMachine.ts      Menu → Playing → GameOver
│  ├─ EventBus.ts          Typed pub/sub
│  └─ ObjectPool.ts        Fixed-capacity pooling (no mid-run GC)
├─ math/                   Vec2 + scalar helpers (seeded RNG, damping)
├─ physics/                Custom 2D solver
│  ├─ PhysicsWorld.ts      Fixed step, iterative swept CCD, auto-nudge
│  ├─ collision.ts         Swept circle-vs-capsule + restitution/friction
│  ├─ Ball.ts / Flipper.ts / Segment.ts
├─ rendering/              Three.js
│  ├─ Renderer.ts          Composer: bloom → mist → ACES tone-map
│  ├─ MistPass.ts          Screen-space edge-blur depth fake
│  ├─ CameraRig.ts         Damped forced-perspective follow camera
│  ├─ BallTrail.ts         Ribbon trail in a single dynamic buffer
│  └─ materials.ts         Emissive neon vs dark structural materials
├─ entities/               Physics body + mesh, all poolable
│  ├─ BallEntity.ts / FlipperEntity.ts / FlipperPair.ts
│  └─ WallEntity.ts / DotEntity.ts / PowerUpEntity.ts
├─ level/                  Infinite vertical streaming
│  ├─ ChunkGenerator.ts    Deterministic, seeded chunk specs
│  └─ LevelStreamer.ts     Pool-backed instantiate/recycle
├─ powerups/               Slow-Mo, Time Freeze, Motion Link, Push,
│  │                        Warp Drive, Time Doubler, Random
│  ├─ PowerUpManager.ts    The single source of truth for global overrides
│  ├─ definitions.ts / types.ts
├─ timer/TimeEconomy.ts    Master clock, dots, checkpoints, distance/rank
├─ input/InputManager.ts   Split-screen flippers + swipe-to-Push
├─ ui/                     DOM HUD, overlays, power-up modal (above the canvas)
├─ audio/AudioEngine.ts    Web Audio: synth SFX + generative per-biome music
├─ persistence/SaveManager Best distance + checkpoint resume (localStorage)
└─ minigames/MiniGame.ts   "Video mode" framework + descriptors (extension point)
```

### Why these choices map to the design

| Design requirement                       | Implementation                                                        |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Reliable fast-ball / fast-flipper hits   | Swept circle-vs-capsule **CCD** in `collision.ts` (no tunneling)      |
| Deterministic trajectories at any FPS    | **Fixed 120 Hz** sim with sub-step catch-up in `GameLoop`             |
| Snappy flippers, cradling                | Torque-style angular snap, restitution ≈ 0.88, friction ≈ 0.9         |
| No GC stutter                            | Pre-allocated **object pools**; recycle, never destroy                |
| Neon "selective" glow                    | Luminance-thresholded **UnrealBloom** + emissive materials + ACES     |
| Atmospheric depth without volumetrics    | Cheap screen-space vertical **MistPass**                              |
| Auto-nudge stuck balls                   | 3.0s near-zero-motion detector applies a random impulse               |
| Checkpoint continue keeps the clock      | `SaveManager` snapshots exact remaining time at each 1,000 boundary   |

### Extension points

- **Mini-games** (`minigames/`): the four canonical "video modes" are described
  and stubbed behind a `MiniGame` interface; implement `run()` per mode and have
  the `Game` suspend the sim while one plays.
- **Dynamic obstacles**: the Neon Isles "Ball Releaser" red balls slot in as a
  second dynamic body on its own collision layer in `PhysicsWorld`.
- **Shooters**: add a sensor that zeroes ball velocity and fires on tap.
