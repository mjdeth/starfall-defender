# starfall-defender

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/mjdeth/starfall-defender/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/mjdeth/starfall-defender/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Starfall Defender** is a neon space shooter that runs entirely in the browser: no build step,
no libraries, no network. Pilot a lone fighter against escalating waves of drones, zigzag
weavers, diving stingers and tumbling asteroids; big asteroids split into fast fragments, and
every third wave opens with a five-drone formation. From the sixth wave, kamikazes hunt you:
they steer after your ship, speed up as they close, and blow with a blast that hurts anything
caught inside it and scatters enemy fire, so pop them early or be somewhere else when the
fuse burns out (the last second shows the blast ring). Catch falling shield, rapid-fire,
spread-shot and spare-hull power-ups. Chain kills to build a score multiplier of up to x5;
one hit resets it. Every explosion mixes fast sparks, slow embers and, on the big kills, an
expanding shockwave ring. Every fifth wave brings down the carrier: a strafing boss that
sheds drones and rotates its shot patterns burst by burst (a wide radial fan, a fan aimed at
you, then a split fan with a safe lane down the middle), steps up its fire under half hull,
and each return visit comes back with more hull, a faster strafe and, from its second
appearance, an aimed spread shot. Felling it pauses the run for an upgrade choice: faster
cannons, a spare hull, a salvage magnet that bends power-ups toward the ship, or a bounty of
points. Three lives, a persistent best score, synthesized WebAudio sound and music (no audio
files), full keyboard and touch controls, and a fixed-step, seeded simulation so a given seed
always replays the same game.

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
