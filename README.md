# starfall-defender

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/mjdeth/starfall-defender/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/mjdeth/starfall-defender/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Starfall Defender** is a neon space shooter that runs entirely in the browser: no build step,
no libraries, no network. Pilot a lone fighter against escalating waves of drones, zigzag
weavers and tumbling asteroids. Catch falling shield, rapid-fire and spare-hull power-ups,
and every fifth wave bring down the carrier: a strafing boss that sheds drones and fires
radial bursts. Three lives, a persistent best score, synthesized WebAudio sound (no audio
files), full keyboard and touch controls, and a fixed-step, seeded simulation so a given
seed always replays the same game.

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
`index.html?shot=start|play|end&seed=1` and the scene is simulated forward with an
autopilot, ready to capture.

---
<sub>Entered on [make.fun](https://make.fun/?ref=nab1rryh&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
