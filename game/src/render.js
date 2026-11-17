// Drawing only for Starfall Defender: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. Neon vector art throughout: a parallax starfield over a deep-space gradient,
// a sleek fighter with a flickering engine flame, tumbling asteroids, drones, weavers and the
// carrier, glowing bullets and explosion particles. Text that holds a number is rebuilt only
// when the number changes, so a frame allocates nothing.
import { COMBO, FIELD, FONT, PALETTE, PLAYER } from './config.js';
import { KIND_ASTEROID, KIND_CARRIER, KIND_DRONE, KIND_STINGER, KIND_WEAVER, POW_LIFE, POW_RAPID, POW_SHIELD, POW_SPREAD } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_CHOICE = 'choice';

const PANEL = { width: 680, top: 150, line: 36, bottom: 76 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = size + '|' + (weight || '');
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(state) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.spaceTop);
    gradient.addColorStop(1, PALETTE.spaceBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.nebulaA;
    context.beginPath();
    context.ellipse(300, 190, 330, 150, 0.4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.nebulaB;
    context.beginPath();
    context.ellipse(1010, 500, 380, 170, -0.3, 0, Math.PI * 2);
    context.fill();
    for (const star of state.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(state.elapsed * (1 + star.layer) + star.x);
      context.globalAlpha = (0.35 + star.layer * 0.3) * twinkle;
      context.fillStyle = '#dfe9ff';
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;
  }

  function drawAsteroid(e) {
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    const r = e.width / 2;
    context.save();
    context.translate(cx, cy);
    context.rotate(e.rot);
    context.beginPath();
    for (let k = 0; k < 8; k += 1) {
      const angle = (k / 8) * Math.PI * 2;
      const rad = r * e.shape[k];
      if (k === 0) context.moveTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
      else context.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
    }
    context.closePath();
    context.fillStyle = PALETTE.asteroid;
    context.fill();
    context.strokeStyle = PALETTE.asteroidDark;
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = PALETTE.asteroidDark;
    context.beginPath();
    context.arc(r * 0.3 * e.shape[1], -r * 0.2, r * 0.16, 0, Math.PI * 2);
    context.arc(-r * 0.35, r * 0.3 * e.shape[5], r * 0.12, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (e.hp < e.maxHp) drawMiniBar(cx, e.y - 12, e.width, e.hp / e.maxHp);
  }

  function drawMiniBar(cx, y, width, frac) {
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(cx - width / 2, y, width, 5);
    context.fillStyle = PALETTE.danger;
    context.fillRect(cx - width / 2, y, width * Math.max(0, frac), 5);
  }

  function drawDrone(e, elapsed) {
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    context.save();
    context.translate(cx, cy);
    context.beginPath();
    context.moveTo(0, e.height / 2);
    context.lineTo(e.width / 2, -e.height / 4);
    context.lineTo(e.width / 4, -e.height / 2);
    context.lineTo(-e.width / 4, -e.height / 2);
    context.lineTo(-e.width / 2, -e.height / 4);
    context.closePath();
    context.fillStyle = PALETTE.drone;
    context.fill();
    const pulse = 0.7 + 0.3 * Math.sin(elapsed * 6 + e.phase);
    context.fillStyle = PALETTE.droneCore;
    context.globalAlpha = pulse;
    context.beginPath();
    context.arc(0, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.restore();
  }

  function drawWeaver(e) {
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    context.save();
    context.translate(cx, cy);
    context.beginPath();
    context.moveTo(0, e.height / 2);
    context.lineTo(e.width / 2, -e.height / 2);
    context.lineTo(0, -e.height / 4);
    context.lineTo(-e.width / 2, -e.height / 2);
    context.closePath();
    context.fillStyle = PALETTE.weaver;
    context.fill();
    context.fillStyle = '#f3e8ff';
    context.fillRect(-2, -4, 4, 12);
    context.restore();
    if (e.hp < e.maxHp) drawMiniBar(cx, e.y - 12, e.width, e.hp / e.maxHp);
  }

  function drawStinger(e, elapsed) {
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    context.save();
    context.translate(cx, cy);
    if (e.dive === 1) context.rotate(Math.atan2(e.dvy, e.dvx) - Math.PI / 2);
    context.beginPath();
    context.moveTo(0, e.height / 2);
    context.lineTo(e.width / 2, -e.height / 6);
    context.lineTo(e.width / 5, -e.height / 2);
    context.lineTo(-e.width / 5, -e.height / 2);
    context.lineTo(-e.width / 2, -e.height / 6);
    context.closePath();
    context.fillStyle = PALETTE.stinger;
    context.fill();
    // About to dive, the eye strobes: the one warning the player gets.
    const strobe = e.dive === 0 && e.t > 0.7 && Math.floor(elapsed * 10) % 2 === 0;
    context.fillStyle = strobe ? '#ffffff' : '#3d1e00';
    context.beginPath();
    context.arc(0, 2, 5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (e.hp < e.maxHp) drawMiniBar(cx, e.y - 12, e.width, e.hp / e.maxHp);
  }

  function drawCarrier(e, elapsed) {
    context.save();
    context.translate(e.x, e.y);
    context.fillStyle = '#3d0f1e';
    context.fillRect(0, 10, e.width, e.height - 20);
    context.fillStyle = PALETTE.carrier;
    context.beginPath();
    context.moveTo(14, e.height);
    context.lineTo(40, e.height - 26);
    context.lineTo(e.width - 40, e.height - 26);
    context.lineTo(e.width - 14, e.height);
    context.closePath();
    context.fill();
    context.fillStyle = '#7a1f33';
    context.fillRect(e.width / 2 - 44, 0, 88, 30);
    const pulse = 0.65 + 0.35 * Math.sin(elapsed * 4);
    context.fillStyle = PALETTE.carrierCore;
    context.globalAlpha = pulse;
    context.beginPath();
    context.arc(e.width / 2, e.height - 34, 13, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.carrierCore;
    for (let k = 0; k < 5; k += 1) context.fillRect(24 + k * 44, e.height - 14, 16, 6);
    context.restore();
    // Boss health bar, pinned under the HUD, labelled with the carrier's mark.
    const frac = Math.max(0, e.hp / e.maxHp);
    context.fillStyle = 'rgba(255,255,255,0.15)';
    context.fillRect(FIELD.width / 2 - 260, 58, 520, 10);
    context.fillStyle = PALETTE.carrier;
    context.fillRect(FIELD.width / 2 - 260, 58, 520 * frac, 10);
    text(e.tier > 1 ? `CARRIER MK ${e.tier}` : 'CARRIER', FIELD.width / 2 + 268, 56, 14, PALETTE.carrier, 'left', '700');
  }

  function drawShip(state) {
    const player = state.player;
    if (!player.alive) return;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 1) return;
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    const bottom = player.y + player.height;
    // Hull and flame lean into the turn: the bank angle the world eased toward the input.
    context.save();
    context.translate(cx, cy);
    context.rotate(player.bank * 0.26);
    context.translate(-cx, -cy);
    // Engine flame, flickering with the run's own clock so replays match.
    const flame = 12 + 7 * Math.sin(state.elapsed * 41) + 4 * Math.sin(state.elapsed * 97);
    context.beginPath();
    context.moveTo(cx - 7, bottom);
    context.lineTo(cx, bottom + flame);
    context.lineTo(cx + 7, bottom);
    context.closePath();
    context.fillStyle = PALETTE.flame;
    context.fill();
    // Hull: swept wings and a pointed nose.
    context.beginPath();
    context.moveTo(cx, player.y);
    context.lineTo(cx + 10, player.y + 22);
    context.lineTo(cx + player.width / 2, player.y + player.height);
    context.lineTo(cx + 12, player.y + player.height - 8);
    context.lineTo(cx - 12, player.y + player.height - 8);
    context.lineTo(cx - player.width / 2, player.y + player.height);
    context.lineTo(cx - 10, player.y + 22);
    context.closePath();
    context.fillStyle = PALETTE.player;
    context.fill();
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.ellipse(cx, player.y + 16, 5, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (player.rapid > 0) {
      context.fillStyle = PALETTE.rapid;
      context.fillRect(cx - player.width / 2 - 3, player.y + 24, 5, 10);
      context.fillRect(cx + player.width / 2 - 2, player.y + 24, 5, 10);
    }
    if (player.spread > 0) {
      context.fillStyle = PALETTE.spread;
      context.fillRect(cx - player.width / 2 - 3, player.y + 12, 5, 10);
      context.fillRect(cx + player.width / 2 - 2, player.y + 12, 5, 10);
    }
    if (player.shield > 0) {
      const pulse = 0.55 + 0.25 * Math.sin(state.elapsed * 5);
      context.strokeStyle = PALETTE.shield;
      context.globalAlpha = pulse;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(cx, player.y + player.height / 2, 40, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  function drawPowerup(p, elapsed) {
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2 + Math.sin(p.t * 4) * 3;
    const color = p.kind === POW_SHIELD ? PALETTE.shield : p.kind === POW_RAPID ? PALETTE.rapid : p.kind === POW_SPREAD ? PALETTE.spread : PALETTE.life;
    context.save();
    context.translate(cx, cy);
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 19 + 2 * Math.sin(elapsed * 5 + p.t), 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(6, 10, 22, 0.9)';
    context.beginPath();
    context.arc(0, 0, 15, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = color;
    if (p.kind === POW_SHIELD) {
      context.beginPath();
      context.moveTo(0, -9);
      context.lineTo(8, -5);
      context.lineTo(8, 3);
      context.quadraticCurveTo(8, 9, 0, 11);
      context.quadraticCurveTo(-8, 9, -8, 3);
      context.lineTo(-8, -5);
      context.closePath();
      context.fill();
    } else if (p.kind === POW_RAPID) {
      context.beginPath();
      context.moveTo(2, -10);
      context.lineTo(-6, 2);
      context.lineTo(-1, 2);
      context.lineTo(-2, 10);
      context.lineTo(6, -2);
      context.lineTo(1, -2);
      context.closePath();
      context.fill();
    } else if (p.kind === POW_SPREAD) {
      // A three-pronged fan for the triple shot.
      context.beginPath();
      context.moveTo(0, 10);
      context.lineTo(-3, -2);
      context.lineTo(-10, -9);
      context.lineTo(-5, -10);
      context.lineTo(0, -4);
      context.lineTo(5, -10);
      context.lineTo(10, -9);
      context.lineTo(3, -2);
      context.closePath();
      context.fill();
    } else {
      context.fillRect(-2.5, -9, 5, 18);
      context.fillRect(-9, -2.5, 18, 5);
    }
    context.restore();
  }

  function drawField(state) {
    drawBackground(state);
    for (const p of state.powerups) if (p.active) drawPowerup(p, state.elapsed);
    for (const e of state.enemies) {
      if (!e.active) continue;
      if (e.kind === KIND_ASTEROID) drawAsteroid(e);
      else if (e.kind === KIND_DRONE) drawDrone(e, state.elapsed);
      else if (e.kind === KIND_WEAVER) drawWeaver(e);
      else if (e.kind === KIND_STINGER) drawStinger(e, state.elapsed);
      else drawCarrier(e, state.elapsed);
    }
    // Bullets and particles glow: draw them additively.
    context.globalCompositeOperation = 'lighter';
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.fillStyle = 'rgba(80, 200, 255, 0.35)';
      context.fillRect(b.x - 3, b.y - 2, b.width + 6, b.height + 4);
      context.fillStyle = PALETTE.bullet;
      context.fillRect(b.x, b.y, b.width, b.height);
    }
    for (const b of state.ebullets) {
      if (!b.active) continue;
      context.fillStyle = 'rgba(255, 93, 122, 0.35)';
      context.beginPath();
      context.arc(b.x + 6, b.y + 6, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.ebullet;
      context.beginPath();
      context.arc(b.x + 6, b.y + 6, 5.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const p of state.particles) {
      if (!p.active) continue;
      const frac = p.life / p.maxLife;
      context.globalAlpha = frac;
      context.fillStyle = `hsl(${p.hue}, 95%, ${55 + frac * 25}%)`;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    drawShip(state);
  }

  function drawPowerTimers(state) {
    let y = 58;
    const player = state.player;
    if (player.shield > 0) {
      text('SHIELD', 24, y, 15, PALETTE.shield, 'left', '700');
      context.fillStyle = PALETTE.shield;
      context.fillRect(96, y + 2, 110 * (player.shield / PLAYER.shieldSeconds), 8);
      y += 24;
    }
    if (player.rapid > 0) {
      text('RAPID', 24, y, 15, PALETTE.rapid, 'left', '700');
      context.fillStyle = PALETTE.rapid;
      context.fillRect(96, y + 2, 110 * (player.rapid / PLAYER.rapidSeconds), 8);
      y += 24;
    }
    if (player.spread > 0) {
      text('SPREAD', 24, y, 15, PALETTE.spread, 'left', '700');
      context.fillStyle = PALETTE.spread;
      context.fillRect(96, y + 2, 110 * (player.spread / PLAYER.spreadSeconds), 8);
      y += 24;
    }
    if (state.multiplier > 1) {
      // The chain readout: multiplier, kills banked in the chain, and the time left to extend it.
      text(`COMBO x${state.multiplier}`, 24, y, 17, PALETTE.accent, 'left', '800');
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.fillRect(24, y + 22, 110, 6);
      context.fillStyle = PALETTE.accent;
      context.fillRect(24, y + 22, 110 * Math.max(0, state.comboTimer / COMBO.window), 6);
    }
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left', '700');
    text(waveLabel(Math.max(1, state.wave)), FIELD.width / 2, 18, 30, PALETTE.accent, 'center', '700');
    // Lives as little ships, right-aligned.
    for (let life = 0; life < Math.max(state.lives, 0); life += 1) {
      const x = FIELD.width - 34 - life * 34;
      context.fillStyle = life < state.lives ? PALETTE.player : PALETTE.muted;
      context.beginPath();
      context.moveTo(x, 20);
      context.lineTo(x + 9, 38);
      context.lineTo(x - 9, 38);
      context.closePath();
      context.fill();
    }
    drawPowerTimers(state);
    if (state.waveTimer > 0 && state.wave >= 0) {
      const label = state.wave === 0 ? 'GET READY' : `WAVE ${state.wave + 1}`;
      context.globalAlpha = Math.min(1, state.waveTimer);
      text(state.wave > 0 && (state.wave + 1) % 5 === 0 ? '⚠ CARRIER INBOUND ⚠' : label,
        FIELD.width / 2, 300, 54, PALETTE.accent, 'center', '800');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, titleColor) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 92, 52, titleColor || PALETTE.text, 'center', '800');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 42, 24, PALETTE.accent, 'center', '700');
  }

  const TITLE_LINES = [
    'Blast the swarm. Dodge the rocks. Survive the carrier.',
    'Move: ← ↑ ↓ → or WASD · Fire: hold Space · Pause: P · Sound: M',
    'Catch shield, rapid-fire, spread-shot and spare hulls as they fall.',
    'Chain kills to raise your multiplier. A hit resets it.',
    'Fell the carrier and choose an upgrade for the run.',
    '',
  ];
  const PAUSED_LINES = ['The swarm will wait for you.'];
  const OVER_LINES = ['', ''];

  function drawChoice(choice) {
    const width = 760;
    const height = 340;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text('CARRIER DOWN', FIELD.width / 2, y + 74, 44, PALETTE.accent, 'center', '800');
    text('Choose an upgrade for this run', FIELD.width / 2, y + 112, 20, PALETTE.muted, 'center');
    for (let i = 0; i < 2; i += 1) {
      const option = choice.options[i];
      const boxW = 320;
      const boxH = 118;
      const boxX = x + 36 + i * (boxW + 48);
      const boxY = y + 140;
      const picked = choice.selected === i;
      context.fillStyle = picked ? 'rgba(45, 226, 230, 0.14)' : 'rgba(255, 255, 255, 0.04)';
      context.fillRect(boxX, boxY, boxW, boxH);
      context.strokeStyle = picked ? PALETTE.accent : PALETTE.muted;
      context.lineWidth = picked ? 3 : 1;
      context.strokeRect(boxX, boxY, boxW, boxH);
      text(`${i + 1} · ${option.name}`, boxX + boxW / 2, boxY + 48, 23, PALETTE.text, 'center', '700');
      text(option.desc, boxX + boxW / 2, boxY + 84, 17, PALETTE.muted, 'center');
    }
    text('← → choose · Space to take it', FIELD.width / 2, y + height - 30, 19, PALETTE.accent, 'center', '700');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on.
   * `choice` carries the upgrade offer ({options, selected}) on the choice screen only. */
  function draw(state, screen, best, choice) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    let shakeX = 0;
    let shakeY = 0;
    if (state.shake > 0) {
      shakeX = Math.sin(state.elapsed * 91) * 9 * state.shake;
      shakeY = Math.cos(state.elapsed * 113) * 7 * state.shake;
    }
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('STARFALL DEFENDER', TITLE_LINES, 'Press Space or tap to launch', PALETTE.accent);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('PAUSED', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_CHOICE && choice) drawChoice(choice);
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      drawPanel('GAME OVER', OVER_LINES, 'Press Space or tap to fly again', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
