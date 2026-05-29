import './styles/main.css';
import { Game } from '@/core/Game';

/**
 * Bootstraps PinIn: grabs the WebGL canvas and UI root from index.html, then
 * hands them to the Game orchestrator, which owns everything else.
 */
function boot(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root');
  if (!canvas || !uiRoot) {
    throw new Error('PinIn: missing #game-canvas or #ui-root in the document.');
  }

  // Prevent the page from scrolling / zooming on touch devices.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  const game = new Game(canvas, uiRoot);
  game.start();

  // Expose for debugging in dev only.
  if (import.meta.env.DEV) {
    (window as unknown as { __game: Game }).__game = game;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
