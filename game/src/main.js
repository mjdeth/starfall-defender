// Boot and the one loop for Starfall Defender: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints what
// is there. The game moves between four screens: title, play, paused and game over. Sound is a
// tiny WebAudio synth (no audio files): shots, explosions, power-ups and UI cues, mutable with M.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_POWER, EVENT_SHOOT, EVENT_WAVE } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

// ------------------------------------------------------------- sound
// Created on the first user gesture (browsers refuse audio before one). Every cue is a short
// oscillator or noise burst; the master gain keeps the whole mix quiet.
const sound = {
  ctx: null,
  muted: false,
  lastShot: 0,
  ensure() {
    if (this.ctx !== null) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this.ctx = null;
    }
  },
  tone(freq, endFreq, seconds, type, gain) {
    if (this.ctx === null || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + seconds);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + seconds);
  },
  noise(seconds, gain) {
    if (this.ctx === null || this.muted) return;
    const now = this.ctx.currentTime;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    src.connect(amp).connect(this.ctx.destination);
    src.start(now);
  },
  shoot(nowMs) {
    if (nowMs - this.lastShot < 70) return;
    this.lastShot = nowMs;
    this.tone(880, 320, 0.07, 'square', 0.05);
  },
  kill(big) {
    this.noise(big ? 0.5 : 0.22, big ? 0.30 : 0.16);
    this.tone(big ? 160 : 220, 40, big ? 0.5 : 0.2, 'sawtooth', 0.10);
  },
  hit() {
    this.tone(140, 50, 0.3, 'sawtooth', 0.22);
    this.noise(0.25, 0.2);
  },
  power() {
    this.tone(520, 780, 0.09, 'sine', 0.14);
    setTimeout(() => this.tone(780, 1180, 0.12, 'sine', 0.14), 70);
  },
  wave() {
    this.tone(392, 392, 0.09, 'triangle', 0.14);
    setTimeout(() => this.tone(587, 587, 0.12, 'triangle', 0.14), 90);
  },
};

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    sound.ensure();
    if (sound.ctx !== null && sound.ctx.state === 'suspended') sound.ctx.resume();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Blast the swarm, dodge the rocks.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      sound.muted = !sound.muted;
      announce(sound.muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, fire: false }, true);
      return;
    }
    const events = world.step(STEP, input.controls(), false);
    if (events & EVENT_SHOOT) sound.shoot(performance.now());
    if (events & EVENT_KILL) sound.kill(events & EVENT_BOSS ? true : false);
    if (events & EVENT_POWER) sound.power();
    if (events & EVENT_WAVE) sound.wave();
    if (events & EVENT_OVER) {
      sound.hit();
      endGame();
    } else if (events & EVENT_HIT) {
      sound.hit();
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the swarm fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Starfall Defender. Press Space or tap to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
