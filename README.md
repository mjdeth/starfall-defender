# starfall-defender

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/mjdeth/starfall-defender/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/mjdeth/starfall-defender/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Starfall Defender** is a neon space shooter that runs entirely in the browser: no build step,
no libraries, no network. Pilot a lone fighter against escalating waves of drones, zigzag
weavers, diving stingers and tumbling asteroids; big asteroids split into fast fragments, and
every third wave opens with a five-drone formation. Catch falling shield, rapid-fire,
spread-shot and spare-hull power-ups. Chain kills to build a score multiplier of up to x5;
one hit resets it. Every fifth wave brings down the carrier: a strafing boss that sheds
drones and fires radial bursts, and each return visit it comes back with more hull, a faster
strafe and, from its second appearance, an aimed spread shot. Felling it pauses the run for
an upgrade choice: faster cannons, a spare hull, a salvage magnet that bends power-ups
toward the ship, or a bounty of points. Three lives, a persistent best score, synthesized
WebAudio sound and music (no audio files), full keyboard and touch controls, and a
fixed-step, seeded simulation so a given seed always replays the same game.

Move with the arrow keys or WASD, hold Space to fire, P pauses, M mutes. On touch screens,
drag to steer and hold to fire.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. To produce the judge's output directory instead:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are staged deterministically by the game itself: open
`index.html?shot=start|play|boss|end&seed=1` and the scene is simulated forward with an
autopilot, ready to capture.

---
<sub>Entered on [make.fun](https://make.fun/?ref=nab1rryh&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
