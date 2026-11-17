// Every tuning number and colour for Starfall Defender in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on the
// screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  width: 46,
  height: 40,
  speed: 520,
  invulnerable: 1.6,
  fireInterval: 0.16,
  rapidInterval: 0.08,
  rapidSeconds: 10,
  shieldSeconds: 9,
  spreadSeconds: 10,
  bulletSpeed: 760,
  spreadSideVx: 175,
  spreadVy: 735,
};

/** Kill chains: kills landed within the window keep the chain alive; every step kills in the
 * chain raise the score multiplier by one, to the cap. Taking a hit resets the chain. */
export const COMBO = { window: 2.5, step: 5, max: 5 };

export const LIVES = 3;

export const BULLET = { width: 6, height: 16, pool: 160 };
export const EBULLET = { radius: 6, speed: 265, pool: 160 };

export const ENEMY = {
  pool: 96,
  // Asteroid: a slow tumbling rock, 3 hits. A big one splits into two fast minis when it breaks.
  asteroid: { size: 64, hp: 3, speed: 92, score: 20, miniSize: 34, miniHp: 1, miniSpeed: 175, miniScore: 10 },
  // Drone: sine-drifts down the field and shoots back from wave 2 on, 1 hit.
  drone: { size: 40, hp: 1, speed: 138, score: 50, fireInterval: 2.6 },
  // Weaver: fast zigzag, 2 hits, from wave 3 on.
  weaver: { size: 44, hp: 2, speed: 196, score: 80 },
  // Stinger: drifts in, locks on, then dives at the player's position, 2 hits, from wave 4 on.
  stinger: { size: 36, hp: 2, speed: 150, diveSpeed: 430, lockSeconds: 1.05, score: 120 },
  // Carrier: the wave-5 boss. Parks near the top, strafes, bursts and sheds drones.
  // Every later boss wave adds hull and tightens the burst timer (see world.js).
  carrier: { width: 220, height: 84, hp: 42, hpPerTier: 18, score: 500, burstInterval: 2.3, burstPerTier: 0.25, burstMin: 1.35, droneInterval: 3.6 },
};

export const POWER = {
  size: 30,
  speed: 150,
  pool: 12,
  droneDropChance: 0.16,
  weaverDropChance: 0.22,
  magnetRadius: 200,
  magnetPull: 360,
};

/** Carrier-kill upgrades: each one the player takes moves its dial by one step. */
export const UPGRADE = { fireStep: 0.12, fireMax: 1.6, scoreBonus: 500 };

export const PARTICLE = { pool: 320 };

export const STAR = { count: 110 };

/** Wave shape: how many enemies a wave sends, and how the mix opens up as waves climb. */
export const WAVE = {
  baseCount: 9,
  perWave: 3,
  spawnStart: 1.05,
  spawnPerWave: 0.07,
  spawnMin: 0.34,
  speedPerWave: 0.06,
  bannerSeconds: 2.0,
  clearBonus: 100,
};

export const PALETTE = {
  backdrop: '#05070f',
  spaceTop: '#0a1030',
  spaceBottom: '#04050c',
  nebulaA: 'rgba(64, 44, 140, 0.20)',
  nebulaB: 'rgba(16, 92, 120, 0.16)',
  player: '#57e6ff',
  playerCore: '#e8fbff',
  flame: '#ffb347',
  bullet: '#aefcff',
  ebullet: '#ff5d7a',
  asteroid: '#8d7d6b',
  asteroidDark: '#5d5245',
  drone: '#ff7a59',
  droneCore: '#ffd166',
  weaver: '#c77dff',
  carrier: '#ff4d6d',
  carrierCore: '#ffe66d',
  stinger: '#ff9100',
  shield: '#6ef2c1',
  rapid: '#ffd166',
  spread: '#40c4ff',
  life: '#ff8fab',
  particle: '#ffd9a0',
  panel: 'rgba(10, 16, 34, 0.88)',
  panelEdge: '#2de2e6',
  text: '#eef6ff',
  muted: '#93a5c4',
  accent: '#2de2e6',
  danger: '#ff5d7a',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'starfall-defender.best';
