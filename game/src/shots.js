// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the real rules forward from
// a fresh world for a fixed number of steps, steered by an autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame. The play pilot
// aims at the lowest enemy and sidesteps whatever is about to hit it; the end pilot aims badly
// and never dodges, so the swarm eventually takes it, as happens to a careless player. The boss
// scene flies the careful pilot through the early waves and stops inside the carrier fight.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, KIND_CARRIER, KIND_KAMIKAZE } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 900;
const BOSS_LIMIT_SECONDS = 360;
const HORIZON = 0.4;
const SAMPLE = 1 / 30;

/** Would the player box at (x, y) touch anything dangerous within the next `horizon` seconds? */
function inDanger(state, x, y, horizon) {
  const player = state.player;
  for (let t = 0; t <= horizon; t += SAMPLE) {
    for (const b of state.ebullets) {
      if (!b.active) continue;
      const bx = b.x + b.vx * t;
      const by = b.y + b.vy * t;
      if (bx < x + player.width - 8 && bx + 12 > x + 8 && by < y + player.height - 8 && by + 12 > y + 8) return true;
    }
    for (const e of state.enemies) {
      if (!e.active) continue;
      const ex = e.x + e.vx * t;
      const ey = e.y + e.vy * t;
      if (ex < x + player.width - 10 && ex + e.width > x + 10 && ey < y + player.height - 10 && ey + e.height > y + 10) return true;
    }
  }
  return false;
}

/** Steer under the lowest enemy (or the carrier), sidestepping danger; always firing. */
function pilot(state, careless) {
  const player = state.player;
  let target = null;
  for (const e of state.enemies) {
    if (!e.active) continue;
    if (e.kind === KIND_CARRIER) { target = e; break; }
    if (target === null || e.y > target.y) target = e;
  }
  let wanted = FIELD.width / 2;
  if (target !== null) wanted = target.x + target.width / 2 + (careless ? 190 : 0);
  const centre = player.x + player.width / 2;
  let move = wanted > centre + 10 ? 1 : wanted < centre - 10 ? -1 : 0;
  if (!careless) {
    const stepX = 520 * HORIZON;
    const here = inDanger(state, player.x, player.y, HORIZON);
    if (here || inDanger(state, player.x + move * stepX, player.y, HORIZON)) {
      for (const candidate of [0, -1, 1]) {
        if (!inDanger(state, player.x + candidate * stepX, player.y, HORIZON)) {
          move = candidate;
          break;
        }
      }
    }
  }
  return { x: move, y: 0, fire: true };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'boss') {
    let bossSteps = 0;
    for (let index = 0; index < BOSS_LIMIT_SECONDS / STEP; index += 1) {
      if (world.step(STEP, pilot(world.state, false), false) & EVENT_OVER) break;
      if (world.state.bossAlive) {
        bossSteps += 1;
        // Settle into the fight: stop once the carrier's fan is in the air and the pilot
        // is answering it, or after ten seconds of boss time either way.
        let airborne = 0;
        for (const b of world.state.ebullets) if (b.active) airborne += 1;
        if (bossSteps > 5 / STEP && airborne >= 4) break;
        if (bossSteps > 10 / STEP) break;
      }
    }
    const over = world.state.lives <= 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'kami') {
    // Jump straight to a wave-6 field and fly a pilot that dodges but never fires, so the
    // kamikaze lives out its fuse: stop in its last second, blast ring on show.
    world.state.wave = 5;
    world.state.waveTimer = 0.01;
    for (let index = 0; index < BOSS_LIMIT_SECONDS / STEP; index += 1) {
      const controls = pilot(world.state, false);
      controls.fire = false;
      if (world.step(STEP, controls, false) & EVENT_OVER) break;
      let hunter = null;
      for (const e of world.state.enemies) {
        if (e.active && e.kind === KIND_KAMIKAZE) { hunter = e; break; }
      }
      if (hunter !== null && hunter.t > 2.7) break;
    }
    const over = world.state.lives <= 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0, fire: false }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const careless = name === 'end';
  for (let index = 0; index < limit / STEP; index += 1) {
    if (world.step(STEP, pilot(world.state, careless), false) & EVENT_OVER) break;
    // The play scene should land mid-fight, not in the lull between waves: once past 20 s,
    // keep going until at least 4 enemies share the field (or the scene's cap runs out).
    if (!careless && index > 20 / STEP) {
      let active = 0;
      for (const e of world.state.enemies) if (e.active) active += 1;
      if (active >= 4) break;
    }
  }
  const over = world.state.lives <= 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
