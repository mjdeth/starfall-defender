// Starfall Defender's rules and state, with no drawing and no browser in it: the player's ship,
// pooled bullets, enemies, enemy bullets, power-ups, particles and the starfield, plus waves,
// collisions, score and lives. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react (sound, announcements) without the world knowing about either.
// All randomness comes from the seeded generator handed in, so a seed always replays the same
// game. Pools are allocated once at createWorld; nothing allocates per frame after that.
import { BULLET, COMBO, EBULLET, ENEMY, FIELD, LIVES, PARTICLE, PLAYER, POWER, STAR, UPGRADE, WAVE } from './config.js';

export const KIND_ASTEROID = 0;
export const KIND_DRONE = 1;
export const KIND_WEAVER = 2;
export const KIND_CARRIER = 3;
export const KIND_STINGER = 4;
export const KIND_KAMIKAZE = 5;

export const POW_SHIELD = 0;
export const POW_RAPID = 1;
export const POW_LIFE = 2;
export const POW_SPREAD = 3;

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_OVER = 4;
export const EVENT_POWER = 8;
export const EVENT_WAVE = 16;
export const EVENT_SHOOT = 32;
export const EVENT_BOSS = 64;
export const EVENT_MULT = 128;
export const EVENT_BOOM = 256;

/** The upgrades offered after a carrier kill; applyUpgrade below gives them effect. */
export const UP_FIRE = 0;
export const UP_LIFE = 1;
export const UP_MAGNET = 2;
export const UP_SCORE = 3;

function overlaps(a, b, shrink) {
  return a.x + shrink < b.x + b.width - shrink && a.x + a.width - shrink > b.x + shrink &&
         a.y + shrink < b.y + b.height - shrink && a.y + a.height - shrink > b.y + shrink;
}

export function createWorld(random) {
  const player = {
    x: 0, y: 0, width: PLAYER.width, height: PLAYER.height,
    invulnerable: 0, shield: 0, rapid: 0, spread: 0, fireTimer: 0, alive: true, bank: 0,
  };
  const bullets = [];
  for (let i = 0; i < BULLET.pool; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, width: BULLET.width, height: BULLET.height });
  const ebullets = [];
  for (let i = 0; i < EBULLET.pool; i += 1) ebullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, width: EBULLET.radius * 2, height: EBULLET.radius * 2 });
  const enemies = [];
  for (let i = 0; i < ENEMY.pool; i += 1) {
    enemies.push({
      active: false, kind: KIND_ASTEROID, x: 0, y: 0, width: 0, height: 0, hp: 1, maxHp: 1,
      vx: 0, vy: 0, t: 0, phase: 0, fireTimer: 0, burstTimer: 0, droneTimer: 0, dir: 1,
      shape: [1, 1, 1, 1, 1, 1, 1, 1], spin: 0, rot: 0,
      dive: 0, dvx: 0, dvy: 0, tier: 1, burstEvery: 0, strafe: 120, mini: false, bursts: 0,
    });
  }
  const powerups = [];
  for (let i = 0; i < POWER.pool; i += 1) powerups.push({ active: false, kind: POW_SHIELD, x: 0, y: 0, width: POWER.size, height: POWER.size, t: 0 });
  const particles = [];
  for (let i = 0; i < PARTICLE.pool; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, hue: 0, ring: 0 });
  const stars = [];
  for (let i = 0; i < STAR.count; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, layer: i % 3, size: 1 + (i % 3) });
  }

  const state = {
    player, bullets, ebullets, enemies, powerups, particles, stars,
    score: 0, lives: LIVES, wave: 0, elapsed: 0,
    toSpawn: 0, spawnTimer: 0, waveTimer: WAVE.bannerSeconds, bossAlive: false, shake: 0,
    combo: 0, comboTimer: 0, multiplier: 1, trailTick: 0,
    fireScale: 1, magnet: false, formation: 0, formationPhase: 0,
  };

  function reset() {
    player.x = (FIELD.width - player.width) / 2;
    player.y = FIELD.height - 120;
    player.invulnerable = 0;
    player.shield = 0;
    player.rapid = 0;
    player.spread = 0;
    player.fireTimer = 0;
    player.alive = true;
    for (const pool of [bullets, ebullets, enemies, powerups, particles]) {
      for (const item of pool) item.active = false;
    }
    state.score = 0;
    state.lives = LIVES;
    state.wave = 0;
    state.elapsed = 0;
    state.toSpawn = 0;
    state.spawnTimer = 0;
    state.waveTimer = 0.6;
    state.bossAlive = false;
    state.shake = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.trailTick = 0;
    state.fireScale = 1;
    state.magnet = false;
    state.formation = 0;
    state.formationPhase = 0;
    player.bank = 0;
  }

  function freeOf(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function explode(x, y, count, hue) {
    // Sparks in two tempers: a fast bright third that streaks out, the rest drifting slower,
    // every hue jittered a little so no two bursts share exactly one colour.
    for (let n = 0; n < count; n += 1) {
      const p = freeOf(particles);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const speed = n % 3 === 0 ? 240 + random() * 240 : 50 + random() * 220;
      p.active = true;
      p.ring = 0;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = 0.35 + random() * 0.55;
      p.life = p.maxLife;
      p.size = 1.5 + random() * 4.5;
      p.hue = hue + (random() * 28 - 14);
    }
    // Embers: a slower third as many again, hanging in the air after the flash is gone.
    const embers = Math.round(count / 3);
    for (let n = 0; n < embers; n += 1) {
      const p = freeOf(particles);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const speed = 20 + random() * 70;
      p.active = true;
      p.ring = 0;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = 0.8 + random() * 0.8;
      p.life = p.maxLife;
      p.size = 2 + random() * 1.5;
      p.hue = hue + (random() * 20 - 10);
    }
    // A real bang (a boss, a bomb, the ship) also throws a shockwave ring that expands and fades.
    if (count >= 14) {
      const p = freeOf(particles);
      if (p !== null) {
        p.active = true;
        p.ring = Math.min(150, 44 + count * 2.2);
        p.x = x; p.y = y;
        p.vx = 0; p.vy = 0;
        p.maxLife = 0.38;
        p.life = p.maxLife;
        p.size = 3;
        p.hue = hue;
      }
    }
  }

  function spawnInterval() {
    return Math.max(WAVE.spawnMin, WAVE.spawnStart - WAVE.spawnPerWave * (state.wave - 1));
  }

  function speedScale() {
    return 1 + WAVE.speedPerWave * (state.wave - 1);
  }

  function spawnEnemy(kind) {
    const e = freeOf(enemies);
    if (e === null) return null;
    const scale = speedScale();
    e.active = true;
    e.kind = kind;
    e.t = 0;
    e.dive = 0;
    e.bursts = 0;
    e.mini = false;
    e.phase = random() * Math.PI * 2;
    e.fireTimer = ENEMY.drone.fireInterval * (0.6 + random() * 0.8);
    if (kind === KIND_ASTEROID) {
      const s = ENEMY.asteroid;
      e.width = s.size * (0.75 + random() * 0.6);
      e.height = e.width;
      e.hp = e.maxHp = s.hp;
      e.x = random() * (FIELD.width - e.width);
      e.y = -e.height;
      e.vx = (random() - 0.5) * 46;
      e.vy = s.speed * scale * (0.8 + random() * 0.5);
      e.spin = (random() - 0.5) * 1.6;
      e.rot = random() * Math.PI * 2;
      for (let k = 0; k < 8; k += 1) e.shape[k] = 0.78 + random() * 0.34;
    } else if (kind === KIND_DRONE) {
      const s = ENEMY.drone;
      e.width = s.size; e.height = s.size;
      e.hp = e.maxHp = s.hp;
      e.x = random() * (FIELD.width - e.width);
      e.y = -e.height;
      e.vx = 0;
      e.vy = s.speed * scale;
    } else if (kind === KIND_WEAVER) {
      const s = ENEMY.weaver;
      e.width = s.size; e.height = s.size;
      e.hp = e.maxHp = s.hp;
      e.x = random() * (FIELD.width - e.width);
      e.y = -e.height;
      e.vx = 0;
      e.vy = s.speed * scale;
    } else if (kind === KIND_STINGER) {
      const s = ENEMY.stinger;
      e.width = s.size; e.height = s.size;
      e.hp = e.maxHp = s.hp;
      e.x = random() * (FIELD.width - e.width);
      e.y = -e.height;
      e.vx = 0;
      e.vy = s.speed * scale;
    } else if (kind === KIND_KAMIKAZE) {
      const s = ENEMY.kamikaze;
      e.width = s.size; e.height = s.size;
      e.hp = e.maxHp = s.hp;
      e.x = random() * (FIELD.width - e.width);
      e.y = -e.height;
      e.vx = 0;
      e.vy = s.speed * scale;
      // Its real velocity lives in dvx/dvy: it starts as the fall above and steers from there.
      e.dvx = 0;
      e.dvy = e.vy;
    } else {
      const s = ENEMY.carrier;
      // Boss tier: wave 5 is tier 1, wave 10 tier 2, and so on. Each tier adds hull,
      // a faster strafe and a tighter burst timer; tier 2 up also aims a spread at the player.
      e.tier = Math.max(1, Math.round(state.wave / 5));
      e.width = s.width; e.height = s.height;
      e.hp = e.maxHp = s.hp + (e.tier - 1) * s.hpPerTier;
      e.x = (FIELD.width - e.width) / 2;
      e.y = -e.height - 10;
      e.vx = 0; e.vy = 62;
      e.dir = random() < 0.5 ? -1 : 1;
      e.burstEvery = Math.max(s.burstMin, s.burstInterval - (e.tier - 1) * s.burstPerTier);
      e.burstTimer = e.burstEvery;
      e.strafe = 120 + (e.tier - 1) * 22;
      e.droneTimer = s.droneInterval;
      state.bossAlive = true;
    }
    return e;
  }

  /** One half of a split asteroid: small, quick, worth less, and it does not split again. */
  function spawnMini(cx, cy, dirSign) {
    const e = freeOf(enemies);
    if (e === null) return;
    const s = ENEMY.asteroid;
    e.active = true;
    e.kind = KIND_ASTEROID;
    e.mini = true;
    e.t = 0;
    e.dive = 0;
    e.width = s.miniSize;
    e.height = s.miniSize;
    e.hp = e.maxHp = s.miniHp;
    e.x = cx - s.miniSize / 2;
    e.y = cy - s.miniSize / 2;
    e.vx = dirSign * (70 + random() * 60);
    e.vy = s.miniSpeed * (0.85 + random() * 0.4);
    e.spin = (random() - 0.5) * 3.2;
    e.rot = random() * Math.PI * 2;
    for (let k = 0; k < 8; k += 1) e.shape[k] = 0.78 + random() * 0.34;
  }

  function startWave() {
    state.wave += 1;
    state.waveTimer = 0;
    if (state.wave % 5 === 0) {
      spawnEnemy(KIND_CARRIER);
      state.toSpawn = 0;
      state.formation = 0;
    } else {
      state.toSpawn = WAVE.baseCount + WAVE.perWave * (state.wave - 1);
      state.spawnTimer = 0.2;
      // Every third wave opens with five drones in a V, one shared drift phase so the
      // formation holds together as it crosses the field.
      state.formation = state.wave % 3 === 0 ? 5 : 0;
      state.formationPhase = random() * Math.PI * 2;
    }
  }

  function pickKind() {
    const roll = random();
    if (state.wave >= 4 && roll < 0.13) return KIND_STINGER;
    if (state.wave >= 3 && roll < 0.32) return KIND_WEAVER;
    if (roll < 0.58) return KIND_DRONE;
    // Kamikazes take their share out of the asteroids', so the early mix is unchanged.
    if (state.wave >= 5 && roll < 0.67) return KIND_KAMIKAZE;
    return KIND_ASTEROID;
  }

  function fireBullet(vx, vy) {
    const b = freeOf(bullets);
    if (b === null) return false;
    b.active = true;
    b.x = player.x + player.width / 2 - BULLET.width / 2;
    b.y = player.y - BULLET.height;
    b.vx = vx;
    b.vy = vy;
    return true;
  }

  function fireEbullet(x, y, angle, speed) {
    const b = freeOf(ebullets);
    if (b === null) return;
    b.active = true;
    b.x = x - EBULLET.radius;
    b.y = y - EBULLET.radius;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
  }

  function dropPower(x, y, forceKind) {
    const p = freeOf(powerups);
    if (p === null) return;
    p.active = true;
    if (forceKind !== undefined) p.kind = forceKind;
    else {
      const roll = random();
      p.kind = roll < 0.36 ? POW_SHIELD : roll < 0.66 ? POW_RAPID : POW_SPREAD;
    }
    p.x = x - POWER.size / 2;
    p.y = y - POWER.size / 2;
    p.t = 0;
  }

  function killEnemy(e, events) {
    e.active = false;
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    let base = 0;
    if (e.kind === KIND_ASTEROID) {
      base = e.mini ? ENEMY.asteroid.miniScore : ENEMY.asteroid.score;
      explode(cx, cy, e.mini ? 8 : 12, 30);
      if (!e.mini) {
        spawnMini(cx, cy, -1);
        spawnMini(cx, cy, 1);
      }
    } else if (e.kind === KIND_DRONE) {
      base = ENEMY.drone.score;
      explode(cx, cy, 14, 18);
      if (random() < POWER.droneDropChance) dropPower(cx, cy);
    } else if (e.kind === KIND_WEAVER) {
      base = ENEMY.weaver.score;
      explode(cx, cy, 16, 275);
      if (random() < POWER.weaverDropChance) dropPower(cx, cy);
    } else if (e.kind === KIND_STINGER) {
      base = ENEMY.stinger.score;
      explode(cx, cy, 16, 36);
      if (random() < POWER.weaverDropChance) dropPower(cx, cy);
    } else if (e.kind === KIND_KAMIKAZE) {
      // Shot down, it never goes off: the reward for popping it early is the score and safety.
      base = ENEMY.kamikaze.score;
      explode(cx, cy, 18, 8);
      if (random() < POWER.droneDropChance) dropPower(cx, cy);
    } else {
      base = ENEMY.carrier.score;
      explode(cx, cy, 46, 350);
      state.bossAlive = false;
      state.shake = 0.45;
      dropPower(cx, cy, POW_LIFE);
      events |= EVENT_BOSS;
    }
    // Chain scoring: the kill extends the chain, and every COMBO.step kills in it
    // raise the multiplier applied to this and later kills until the chain lapses.
    state.combo += 1;
    state.comboTimer = COMBO.window;
    const raised = Math.min(COMBO.max, 1 + Math.floor(state.combo / COMBO.step));
    if (raised > state.multiplier) {
      state.multiplier = raised;
      events |= EVENT_MULT;
    }
    state.score += base * state.multiplier;
    return events | EVENT_KILL;
  }

  /**
   * A kamikaze goes off: a big burst and a shockwave, every enemy bullet inside the blast
   * radius scattered, and the player hurt if caught inside it (and not already flashing from
   * an earlier hit). Returns the events with EVENT_BOOM (and any hit) folded in.
   */
  function detonate(e, events) {
    const s = ENEMY.kamikaze;
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    e.active = false;
    explode(cx, cy, 30, 8);
    state.shake = Math.max(state.shake, 0.28);
    for (const b of ebullets) {
      if (!b.active) continue;
      const dx = b.x + 6 - cx;
      const dy = b.y + 6 - cy;
      if (dx * dx + dy * dy < s.blastRadius * s.blastRadius) b.active = false;
    }
    events |= EVENT_BOOM;
    if (player.alive && player.invulnerable === 0) {
      const dx = player.x + player.width / 2 - cx;
      const dy = player.y + player.height / 2 - cy;
      if (dx * dx + dy * dy < s.blastRadius * s.blastRadius) events = hitPlayer(events);
    }
    return events;
  }

  function hitPlayer(events) {
    // Any hit breaks the kill chain, shield or not.
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    if (player.shield > 0) {
      player.shield = 0;
      player.invulnerable = 1.0;
      explode(player.x + player.width / 2, player.y + player.height / 2, 12, 160);
      return events | EVENT_HIT;
    }
    state.lives -= 1;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = Math.max(state.shake, 0.3);
    explode(player.x + player.width / 2, player.y + player.height / 2, 22, 200);
    // Mercy: clear the bullets nearest the ship so a hit never chains into a second one.
    for (const b of ebullets) {
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      if (dx * dx + dy * dy < 210 * 210) b.active = false;
    }
    if (state.lives <= 0) {
      player.alive = false;
      explode(player.x + player.width / 2, player.y + player.height / 2, 40, 200);
      return events | EVENT_HIT | EVENT_OVER;
    }
    return events | EVENT_HIT;
  }

  /**
   * One fixed step. `controls` is {x, y, fire} with x/y in -1..1. With `harmless` set (the title
   * screen's backdrop) things drift and fall but nothing shoots, collides or scores.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);

    // Starfield always drifts, even behind the title screen.
    for (const star of stars) {
      star.y += (14 + star.layer * 22) * dt;
      if (star.y > FIELD.height) {
        star.y = -2;
        star.x = random() * FIELD.width;
      }
    }

    // Particles always settle.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }

    if (harmless) {
      // Title backdrop: a few asteroids tumble past, nothing else happens.
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(KIND_ASTEROID);
        state.spawnTimer = 1.4;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot += e.spin * dt;
        if (e.y > FIELD.height + 90) e.active = false;
      }
      return events;
    }

    // Wave flow: banner pause, then spawn the budget, boss waves spawn the carrier at once.
    if (state.waveTimer > 0) {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        startWave();
        events |= EVENT_WAVE;
      }
    } else if (state.toSpawn > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        if (state.formation > 0) {
          // Formation drones enter together in a V: centre lowest, wings higher.
          const slot = 5 - state.formation;
          const e = spawnEnemy(KIND_DRONE);
          if (e !== null) {
            e.phase = state.formationPhase;
            e.x = FIELD.width / 2 + (slot - 2) * 96 - e.width / 2;
            e.y = -e.height - 8 - Math.abs(slot - 2) * 34;
          }
          state.formation -= 1;
          state.toSpawn -= 1;
          state.spawnTimer = 0.14;
        } else {
          spawnEnemy(pickKind());
          state.toSpawn -= 1;
          state.spawnTimer = spawnInterval() * (0.7 + random() * 0.6);
        }
      }
    } else if (!state.bossAlive) {
      let anyEnemy = false;
      for (const e of enemies) if (e.active) { anyEnemy = true; break; }
      if (!anyEnemy) {
        state.score += WAVE.clearBonus * state.wave;
        state.waveTimer = WAVE.bannerSeconds;
      }
    }

    // Player movement and timers.
    player.x = Math.min(FIELD.width - player.width, Math.max(0, player.x + controls.x * PLAYER.speed * dt));
    player.y = Math.min(FIELD.height - player.height - 8, Math.max(FIELD.height * 0.35, player.y + controls.y * PLAYER.speed * dt));
    player.bank += (controls.x - player.bank) * Math.min(1, dt * 9);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.shield > 0) player.shield = Math.max(0, player.shield - dt);
    if (player.rapid > 0) player.rapid = Math.max(0, player.rapid - dt);
    if (player.spread > 0) player.spread = Math.max(0, player.spread - dt);
    if (state.comboTimer > 0) {
      state.comboTimer = Math.max(0, state.comboTimer - dt);
      if (state.comboTimer === 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }
    // Engine trail: one exhaust mote every few steps, placed from the run's clock rather
    // than the seeded generator, so replays keep the same spawn pattern.
    state.trailTick += 1;
    if (player.alive && state.trailTick % 3 === 0) {
      const p = freeOf(particles);
      if (p !== null) {
        p.active = true;
        p.ring = 0;
        p.x = player.x + player.width / 2 + Math.sin(state.elapsed * 23) * 4;
        p.y = player.y + player.height + 4;
        p.vx = 0;
        p.vy = 130;
        p.maxLife = 0.3;
        p.life = 0.3;
        p.size = 3;
        p.hue = 32;
      }
    }

    // Player fire: one bolt, or three in a fan while the spread-shot lasts.
    player.fireTimer -= dt;
    if (controls.fire && player.fireTimer <= 0) {
      let fired = fireBullet(0, -PLAYER.bulletSpeed);
      if (player.spread > 0) {
        fired = fireBullet(-PLAYER.spreadSideVx, -PLAYER.spreadVy) || fired;
        fired = fireBullet(PLAYER.spreadSideVx, -PLAYER.spreadVy) || fired;
      }
      if (fired) {
        const baseInterval = player.rapid > 0 ? PLAYER.rapidInterval : PLAYER.fireInterval;
        player.fireTimer = baseInterval / state.fireScale;
        events |= EVENT_SHOOT;
      }
    }
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y + b.height < 0 || b.x + b.width < 0 || b.x > FIELD.width) b.active = false;
    }

    // Enemies.
    for (const e of enemies) {
      if (!e.active) continue;
      e.t += dt;
      if (e.kind === KIND_ASTEROID) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.rot += e.spin * dt;
        if (e.x < -e.width) e.x = FIELD.width;
        if (e.x > FIELD.width) e.x = -e.width;
      } else if (e.kind === KIND_DRONE) {
        e.y += e.vy * dt;
        e.x += Math.sin(e.t * 2.2 + e.phase) * 130 * dt;
        if (state.wave >= 2 && e.y > 10 && e.y < FIELD.height * 0.6) {
          e.fireTimer -= dt;
          if (e.fireTimer <= 0) {
            const cx = e.x + e.width / 2;
            const cy = e.y + e.height;
            const angle = Math.atan2(player.y - cy, player.x + player.width / 2 - cx);
            fireEbullet(cx, cy, angle, EBULLET.speed);
            e.fireTimer = ENEMY.drone.fireInterval * (0.75 + random() * 0.6);
          }
        }
      } else if (e.kind === KIND_WEAVER) {
        e.y += e.vy * dt;
        e.x += Math.sin(e.t * 5.2 + e.phase) * 330 * dt;
      } else if (e.kind === KIND_STINGER) {
        if (e.dive === 0) {
          e.y += e.vy * dt;
          e.x += Math.sin(e.t * 3.1 + e.phase) * 90 * dt;
          if (e.t >= ENEMY.stinger.lockSeconds && player.alive) {
            // Lock-on: the dive aims at where the player is right now and never tracks again,
            // so a quick sidestep beats it.
            const cx = e.x + e.width / 2;
            const cy = e.y + e.height / 2;
            const angle = Math.atan2(player.y + player.height / 2 - cy, player.x + player.width / 2 - cx);
            e.dvx = Math.cos(angle) * ENEMY.stinger.diveSpeed;
            e.dvy = Math.sin(angle) * ENEMY.stinger.diveSpeed;
            e.dive = 1;
          }
        } else {
          e.x += e.dvx * dt;
          e.y += e.dvy * dt;
          if (e.x < -90 || e.x > FIELD.width + 90) { e.active = false; continue; }
        }
      } else if (e.kind === KIND_KAMIKAZE) {
        // Homing: bend the velocity toward the player by at most the turn rate, and keep
        // accelerating. The turn cap is the fairness: a hard sidestep makes it overshoot,
        // and the fuse caps how long it can hunt at all.
        const s = ENEMY.kamikaze;
        const cx = e.x + e.width / 2;
        const cy = e.y + e.height / 2;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const current = Math.atan2(e.dvy, e.dvx);
        let diff = Math.atan2(dy, dx) - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = s.turn * dt;
        const angle = current + Math.max(-maxTurn, Math.min(maxTurn, diff));
        const speed = Math.min(s.maxSpeed, Math.hypot(e.dvx, e.dvy) + s.thrust * dt);
        e.dvx = Math.cos(angle) * speed;
        e.dvy = Math.sin(angle) * speed;
        e.x += e.dvx * dt;
        e.y += e.dvy * dt;
        // Mirrored into vx/vy so the screenshot pilot's danger math sees the real heading.
        e.vx = e.dvx;
        e.vy = e.dvy;
        if (e.t >= s.fuse || (player.alive && dist < s.blastTrigger)) {
          events = detonate(e, events);
          if (events & EVENT_OVER) return events;
          continue;
        }
      } else {
        // Carrier: descends to its park line, then strafes; bursts and sheds drones on timers.
        if (e.y < 64) e.y += e.vy * dt;
        else {
          e.x += e.dir * e.strafe * dt;
          if (e.x < 30) { e.x = 30; e.dir = 1; }
          if (e.x > FIELD.width - e.width - 30) { e.x = FIELD.width - e.width - 30; e.dir = -1; }
          e.burstTimer -= dt;
          if (e.burstTimer <= 0) {
            const cx = e.x + e.width / 2;
            const cy = e.y + e.height;
            // The carrier rotates its shot pattern burst by burst, so standing in one
            // rhythm stops working: a wide radial fan, then a fan aimed at the player,
            // then a split fan with a safe lane down the middle. Under half hull it is
            // enraged and every pattern carries extra shot. Tier 2 up adds its aimed
            // spread on top of the radial fan, as before.
            const pattern = e.bursts % 3;
            e.bursts += 1;
            const enraged = e.hp <= e.maxHp / 2;
            const toPlayer = Math.atan2(player.y - cy, player.x + player.width / 2 - cx);
            if (pattern === 0) {
              for (let k = 0; k < 10; k += 1) {
                fireEbullet(cx, cy, Math.PI / 2 + (k - 4.5) * 0.22, EBULLET.speed * 0.92);
              }
              if (e.tier >= 2) {
                for (let k = -1; k <= 1; k += 1) {
                  fireEbullet(cx, cy, toPlayer + k * 0.18, EBULLET.speed * 1.05);
                }
              }
              if (enraged) {
                fireEbullet(cx, cy, toPlayer - 0.42, EBULLET.speed * 1.05);
                fireEbullet(cx, cy, toPlayer + 0.42, EBULLET.speed * 1.05);
              }
            } else if (pattern === 1) {
              const shots = e.tier >= 2 ? 7 : 5;
              for (let k = 0; k < shots; k += 1) {
                fireEbullet(cx, cy, toPlayer + (k - (shots - 1) / 2) * 0.16, EBULLET.speed * 1.03);
              }
              if (enraged) {
                fireEbullet(cx, cy, toPlayer - 0.55, EBULLET.speed);
                fireEbullet(cx, cy, toPlayer + 0.55, EBULLET.speed);
              }
            } else {
              for (const k of [-3, -2, -1, 1, 2, 3]) {
                fireEbullet(cx, cy, Math.PI / 2 + k * 0.23, EBULLET.speed * 0.95);
              }
              if (enraged) fireEbullet(cx, cy, toPlayer, EBULLET.speed * 1.08);
            }
            e.burstTimer = e.burstEvery;
          }
          e.droneTimer -= dt;
          if (e.droneTimer <= 0) {
            const before = state.bossAlive;
            spawnEnemy(KIND_DRONE);
            state.bossAlive = before;
            e.droneTimer = ENEMY.carrier.droneInterval;
          }
        }
      }
      if (e.y > FIELD.height + 100) {
        e.active = false;
        if (e.kind === KIND_CARRIER) state.bossAlive = false;
        continue;
      }
      // Ram collision with the player.
      if (player.alive && player.invulnerable === 0 && overlaps(e, player, 8)) {
        e.active = false;
        if (e.kind === KIND_CARRIER) state.bossAlive = false;
        if (e.kind === KIND_KAMIKAZE) explode(e.x + e.width / 2, e.y + e.height / 2, 26, 8);
        else explode(e.x + e.width / 2, e.y + e.height / 2, 14, 30);
        events = hitPlayer(events);
        if (events & EVENT_OVER) return events;
      }
    }

    // Enemy bullets.
    for (const b of ebullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > FIELD.height + 20 || b.y < -20 || b.x < -20 || b.x > FIELD.width + 20) { b.active = false; continue; }
      if (player.alive && player.invulnerable === 0 && overlaps(b, player, 10)) {
        b.active = false;
        events = hitPlayer(events);
        if (events & EVENT_OVER) return events;
      }
    }

    // Player bullets vs enemies.
    for (const b of bullets) {
      if (!b.active) continue;
      for (const e of enemies) {
        if (!e.active) continue;
        if (overlaps(b, e, 2)) {
          b.active = false;
          e.hp -= 1;
          explode(b.x + b.width / 2, b.y, 3, 45);
          if (e.hp <= 0) events = killEnemy(e, events);
          break;
        }
      }
    }

    // Power-ups drift down; the player collects by touch. With the magnet upgrade they
    // also bend toward the ship once they fall within reach.
    for (const p of powerups) {
      if (!p.active) continue;
      p.t += dt;
      if (state.magnet && player.alive) {
        const dx = player.x + player.width / 2 - (p.x + p.width / 2);
        const dy = player.y + player.height / 2 - (p.y + p.height / 2);
        const dist = Math.hypot(dx, dy);
        if (dist > 1 && dist < POWER.magnetRadius) {
          p.x += (dx / dist) * POWER.magnetPull * dt;
          p.y += (dy / dist) * POWER.magnetPull * dt;
        }
      }
      p.y += POWER.speed * dt;
      if (p.y > FIELD.height + 40) { p.active = false; continue; }
      if (player.alive && overlaps(p, player, 4)) {
        p.active = false;
        if (p.kind === POW_SHIELD) player.shield = PLAYER.shieldSeconds;
        else if (p.kind === POW_RAPID) player.rapid = PLAYER.rapidSeconds;
        else if (p.kind === POW_SPREAD) player.spread = PLAYER.spreadSeconds;
        else state.lives = Math.min(6, state.lives + 1);
        events |= EVENT_POWER;
      }
    }

    return events;
  }

  /** Apply one carrier-kill upgrade (UP_FIRE / UP_LIFE / UP_MAGNET / UP_SCORE). */
  function applyUpgrade(kind) {
    if (kind === UP_FIRE) state.fireScale = Math.min(UPGRADE.fireMax, state.fireScale + UPGRADE.fireStep);
    else if (kind === UP_LIFE) state.lives = Math.min(6, state.lives + 1);
    else if (kind === UP_MAGNET) state.magnet = true;
    else state.score += UPGRADE.scoreBonus;
  }

  reset();
  return { state, reset, step, applyUpgrade };
}
