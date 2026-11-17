// Starfall Defender's rules and state, with no drawing and no browser in it: the player's ship,
// pooled bullets, enemies, enemy bullets, power-ups, particles and the starfield, plus waves,
// collisions, score and lives. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react (sound, announcements) without the world knowing about either.
// All randomness comes from the seeded generator handed in, so a seed always replays the same
// game. Pools are allocated once at createWorld; nothing allocates per frame after that.
import { BULLET, EBULLET, ENEMY, FIELD, LIVES, PARTICLE, PLAYER, POWER, STAR, WAVE } from './config.js';

export const KIND_ASTEROID = 0;
export const KIND_DRONE = 1;
export const KIND_WEAVER = 2;
export const KIND_CARRIER = 3;

export const POW_SHIELD = 0;
export const POW_RAPID = 1;
export const POW_LIFE = 2;

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_OVER = 4;
export const EVENT_POWER = 8;
export const EVENT_WAVE = 16;
export const EVENT_SHOOT = 32;
export const EVENT_BOSS = 64;

function overlaps(a, b, shrink) {
  return a.x + shrink < b.x + b.width - shrink && a.x + a.width - shrink > b.x + shrink &&
         a.y + shrink < b.y + b.height - shrink && a.y + a.height - shrink > b.y + shrink;
}

export function createWorld(random) {
  const player = {
    x: 0, y: 0, width: PLAYER.width, height: PLAYER.height,
    invulnerable: 0, shield: 0, rapid: 0, fireTimer: 0, alive: true,
  };
  const bullets = [];
  for (let i = 0; i < BULLET.pool; i += 1) bullets.push({ active: false, x: 0, y: 0, width: BULLET.width, height: BULLET.height });
  const ebullets = [];
  for (let i = 0; i < EBULLET.pool; i += 1) ebullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, width: EBULLET.radius * 2, height: EBULLET.radius * 2 });
  const enemies = [];
  for (let i = 0; i < ENEMY.pool; i += 1) {
    enemies.push({
      active: false, kind: KIND_ASTEROID, x: 0, y: 0, width: 0, height: 0, hp: 1, maxHp: 1,
      vx: 0, vy: 0, t: 0, phase: 0, fireTimer: 0, burstTimer: 0, droneTimer: 0, dir: 1,
      shape: [1, 1, 1, 1, 1, 1, 1, 1], spin: 0, rot: 0,
    });
  }
  const powerups = [];
  for (let i = 0; i < POWER.pool; i += 1) powerups.push({ active: false, kind: POW_SHIELD, x: 0, y: 0, width: POWER.size, height: POWER.size, t: 0 });
  const particles = [];
  for (let i = 0; i < PARTICLE.pool; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, hue: 0 });
  const stars = [];
  for (let i = 0; i < STAR.count; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, layer: i % 3, size: 1 + (i % 3) });
  }

  const state = {
    player, bullets, ebullets, enemies, powerups, particles, stars,
    score: 0, lives: LIVES, wave: 0, elapsed: 0,
    toSpawn: 0, spawnTimer: 0, waveTimer: WAVE.bannerSeconds, bossAlive: false, shake: 0,
  };

  function reset() {
    player.x = (FIELD.width - player.width) / 2;
    player.y = FIELD.height - 120;
    player.invulnerable = 0;
    player.shield = 0;
    player.rapid = 0;
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
  }

  function freeOf(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function explode(x, y, count, hue) {
    for (let n = 0; n < count; n += 1) {
      const p = freeOf(particles);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const speed = 60 + random() * 320;
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = 0.35 + random() * 0.55;
      p.life = p.maxLife;
      p.size = 2 + random() * 4;
      p.hue = hue;
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
    if (e === null) return;
    const scale = speedScale();
    e.active = true;
    e.kind = kind;
    e.t = 0;
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
    } else {
      const s = ENEMY.carrier;
      e.width = s.width; e.height = s.height;
      e.hp = e.maxHp = s.hp;
      e.x = (FIELD.width - e.width) / 2;
      e.y = -e.height - 10;
      e.vx = 0; e.vy = 62;
      e.dir = random() < 0.5 ? -1 : 1;
      e.burstTimer = s.burstInterval;
      e.droneTimer = s.droneInterval;
      state.bossAlive = true;
    }
  }

  function startWave() {
    state.wave += 1;
    state.waveTimer = 0;
    if (state.wave % 5 === 0) {
      spawnEnemy(KIND_CARRIER);
      state.toSpawn = 0;
    } else {
      state.toSpawn = WAVE.baseCount + WAVE.perWave * (state.wave - 1);
      state.spawnTimer = 0.2;
    }
  }

  function pickKind() {
    const roll = random();
    if (state.wave >= 3 && roll < 0.22) return KIND_WEAVER;
    if (roll < 0.55) return KIND_DRONE;
    return KIND_ASTEROID;
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
    p.kind = forceKind !== undefined ? forceKind : (random() < 0.55 ? POW_SHIELD : POW_RAPID);
    p.x = x - POWER.size / 2;
    p.y = y - POWER.size / 2;
    p.t = 0;
  }

  function killEnemy(e, events) {
    e.active = false;
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    if (e.kind === KIND_ASTEROID) {
      state.score += ENEMY.asteroid.score;
      explode(cx, cy, 12, 30);
    } else if (e.kind === KIND_DRONE) {
      state.score += ENEMY.drone.score;
      explode(cx, cy, 14, 18);
      if (random() < POWER.droneDropChance) dropPower(cx, cy);
    } else if (e.kind === KIND_WEAVER) {
      state.score += ENEMY.weaver.score;
      explode(cx, cy, 16, 275);
      if (random() < POWER.weaverDropChance) dropPower(cx, cy);
    } else {
      state.score += ENEMY.carrier.score;
      explode(cx, cy, 46, 350);
      state.bossAlive = false;
      state.shake = 0.45;
      dropPower(cx, cy, POW_LIFE);
      events |= EVENT_BOSS;
    }
    return events | EVENT_KILL;
  }

  function hitPlayer(events) {
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
        spawnEnemy(pickKind());
        state.toSpawn -= 1;
        state.spawnTimer = spawnInterval() * (0.7 + random() * 0.6);
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
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.shield > 0) player.shield = Math.max(0, player.shield - dt);
    if (player.rapid > 0) player.rapid = Math.max(0, player.rapid - dt);

    // Player fire.
    player.fireTimer -= dt;
    if (controls.fire && player.fireTimer <= 0) {
      const b = freeOf(bullets);
      if (b !== null) {
        b.active = true;
        b.x = player.x + player.width / 2 - BULLET.width / 2;
        b.y = player.y - BULLET.height;
        player.fireTimer = player.rapid > 0 ? PLAYER.rapidInterval : PLAYER.fireInterval;
        events |= EVENT_SHOOT;
      }
    }
    for (const b of bullets) {
      if (!b.active) continue;
      b.y -= PLAYER.bulletSpeed * dt;
      if (b.y + b.height < 0) b.active = false;
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
      } else {
        // Carrier: descends to its park line, then strafes; bursts and sheds drones on timers.
        if (e.y < 64) e.y += e.vy * dt;
        else {
          e.x += e.dir * 120 * dt;
          if (e.x < 30) { e.x = 30; e.dir = 1; }
          if (e.x > FIELD.width - e.width - 30) { e.x = FIELD.width - e.width - 30; e.dir = -1; }
          e.burstTimer -= dt;
          if (e.burstTimer <= 0) {
            const cx = e.x + e.width / 2;
            const cy = e.y + e.height;
            for (let k = 0; k < 10; k += 1) {
              fireEbullet(cx, cy, Math.PI / 2 + (k - 4.5) * 0.22, EBULLET.speed * 0.92);
            }
            e.burstTimer = ENEMY.carrier.burstInterval;
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
        explode(e.x + e.width / 2, e.y + e.height / 2, 14, 30);
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

    // Power-ups drift down; the player collects by touch.
    for (const p of powerups) {
      if (!p.active) continue;
      p.t += dt;
      p.y += POWER.speed * dt;
      if (p.y > FIELD.height + 40) { p.active = false; continue; }
      if (player.alive && overlaps(p, player, 4)) {
        p.active = false;
        if (p.kind === POW_SHIELD) player.shield = PLAYER.shieldSeconds;
        else if (p.kind === POW_RAPID) player.rapid = PLAYER.rapidSeconds;
        else state.lives = Math.min(6, state.lives + 1);
        events |= EVENT_POWER;
      }
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
