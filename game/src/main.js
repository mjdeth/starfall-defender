// Boot and the one loop for Starfall Defender: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints what
// is there. The game moves between five screens: title, play, paused, the upgrade choice offered
// after each carrier kill, and game over. Sound is a tiny WebAudio synth (no audio files): shots,
// explosions, power-ups, UI cues and a looping bass-and-arpeggio music line, mutable with M.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|boss|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP, UPGRADE } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_HIT, EVENT_KILL, EVENT_MULT, EVENT_OVER, EVENT_POWER, EVENT_SHOOT, EVENT_WAVE, UP_FIRE, UP_LIFE, UP_MAGNET, UP_SCORE } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_ONE, ACTION_PAUSE, ACTION_TWO, createInput } from './input.js';
import { createRenderer, SCREEN_CHOICE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
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
  mult() {
    this.tone(660, 990, 0.1, 'sine', 0.13);
  },
  // The music line: a bass figure in A minor with a soft arpeggio over it, scheduled a
  // little ahead of the audio clock each frame. It only runs while a run is live.
  musicStep: 0,
  nextNoteAt: 0,
  toneAt(freq, at, seconds, type, gain) {
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(at);
    osc.stop(at + seconds);
  },
  music() {
    if (this.ctx === null || this.muted) return;
    const BASS = [55, 55, 65.41, 55, 82.41, 55, 49, 61.74];
    const ARP = [220, 261.63, 329.63, 440, 329.63, 261.63, 196, 246.94];
    const now = this.ctx.currentTime;
    if (this.nextNoteAt < now) this.nextNoteAt = now + 0.03;
    while (this.nextNoteAt < now + 0.12) {
      const stepIndex = this.musicStep;
      this.toneAt(BASS[stepIndex % BASS.length], this.nextNoteAt, 0.19, 'triangle', 0.05);
      if (stepIndex % 2 === 0) {
        this.toneAt(ARP[(stepIndex / 2) % ARP.length], this.nextNoteAt, 0.16, 'sine', 0.026);
      }
      this.musicStep += 1;
      this.nextNoteAt += 0.21;
    }
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
  let hitStop = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    sound.ensure();
    if (sound.ctx !== null && sound.ctx.state === 'suspended') sound.ctx.resume();
    world.reset();
    choice = null;
    accumulator = 0;
    hitStop = 0;
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

  // The upgrade offer after a carrier kill. Real upgrades headline while any are left;
  // the bounty is always available, so the offer never comes up empty.
  const UPGRADE_POOL = [
    { id: UP_FIRE, name: 'RAPID CANNONS', desc: 'Fire 12% faster, for good' },
    { id: UP_LIFE, name: 'SPARE HULL', desc: '+1 life, right now' },
    { id: UP_MAGNET, name: 'SALVAGE MAGNET', desc: 'Power-ups bend toward you' },
    { id: UP_SCORE, name: 'BOUNTY', desc: '+500 points, right now' },
  ];
  let choice = null;
  let choiceLatch = 0;

  function upgradeAvailable(u) {
    const s = world.state;
    if (u.id === UP_FIRE) return s.fireScale < UPGRADE.fireMax;
    if (u.id === UP_LIFE) return s.lives < 6;
    if (u.id === UP_MAGNET) return !s.magnet;
    return true;
  }

  function openChoice() {
    const real = UPGRADE_POOL.filter((u) => u.id !== UP_SCORE && upgradeAvailable(u));
    const bounty = UPGRADE_POOL.filter((u) => u.id === UP_SCORE);
    const options = (real.length >= 2 ? real.slice(0, 2) : [...real, ...bounty]).slice(0, 2);
    choice = { options, selected: 0 };
    choiceLatch = 0;
    screen = SCREEN_CHOICE;
    announce('Carrier down. Choose an upgrade: press 1 or 2.');
  }

  function takeChoice(index) {
    const option = choice.options[index];
    if (!option) return;
    world.applyUpgrade(option.id);
    sound.power();
    announce(`Upgrade taken: ${option.name}.`);
    choice = null;
    screen = SCREEN_PLAY;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      sound.muted = !sound.muted;
      announce(sound.muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_CHOICE && choice) {
      if (actions & ACTION_ONE) takeChoice(0);
      else if (actions & ACTION_TWO) takeChoice(1);
      else if (actions & ACTION_CONFIRM) takeChoice(choice.selected);
      return;
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
    if (events & EVENT_KILL) {
      sound.kill(events & EVENT_BOSS ? true : false);
      // Hit-stop: a breath of frozen time on a kill, longer on the carrier, sells the impact.
      hitStop = events & EVENT_BOSS ? 0.09 : 0.022;
    }
    if (events & EVENT_MULT) sound.mult();
    if (events & EVENT_POWER) sound.power();
    if (events & EVENT_WAVE) sound.wave();
    if (events & EVENT_OVER) {
      sound.hit();
      endGame();
    } else if (events & EVENT_HIT) {
      sound.hit();
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
    if ((events & EVENT_BOSS) && screen === SCREEN_PLAY) openChoice();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameSeconds = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameSeconds;
    last = now;
    handleActions();
    if (screen === SCREEN_CHOICE && choice) {
      // Steering moves the highlight; the latch makes one push move it once.
      const x = input.controls().x;
      const sign = x > 0.3 ? 1 : x < -0.3 ? -1 : 0;
      if (sign !== 0 && choiceLatch === 0) choice.selected = sign > 0 ? 1 : 0;
      choiceLatch = sign;
    }
    if (hitStop > 0) {
      hitStop = Math.max(0, hitStop - frameSeconds);
      accumulator = 0;
    } else if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
        if (hitStop > 0) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_CHOICE) sound.music();
    renderer.draw(world.state, screen, best, choice);
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
