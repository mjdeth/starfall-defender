// Keyboard and pointer input for Starfall Defender. Held keys give a steering vector and a fire
// flag; one-shot presses (start or restart, pause, mute) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice. On touch
// screens, dragging steers the ship toward the drag and holding a finger down fires.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_ONE = 8;
export const ACTION_TWO = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const FIRE = new Set(['Space', 'KeyZ', 'KeyJ']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const ONE = new Set(['Digit1', 'Numpad1']);
const TWO = new Set(['Digit2', 'Numpad2']);

export function createInput(target) {
  const held = { left: false, right: false, up: false, down: false, fire: false };
  let actions = 0;
  let pointerDown = false;
  let pointerDX = 0;
  let pointerDY = 0;
  let lastPX = 0;
  let lastPY = 0;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (FIRE.has(event.code)) {
      held.fire = true;
      if (!event.repeat && event.code === 'Space') actions |= ACTION_CONFIRM;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (ONE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ONE;
    } else if (TWO.has(event.code)) {
      if (!event.repeat) actions |= ACTION_TWO;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (FIRE.has(event.code)) held.fire = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.left = held.right = held.up = held.down = held.fire = false;
    pointerDown = false;
  });

  target.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    lastPX = event.clientX;
    lastPY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointermove', (event) => {
    if (!pointerDown) return;
    pointerDX += event.clientX - lastPX;
    pointerDY += event.clientY - lastPY;
    lastPX = event.clientX;
    lastPY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });

  return {
    /** The current steering and fire state: x/y in -1..1, fire while held. */
    controls() {
      let x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      let y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && pointerDown && pointerDX !== 0) x = Math.max(-1, Math.min(1, pointerDX / 18));
      if (y === 0 && pointerDown && pointerDY !== 0) y = Math.max(-1, Math.min(1, pointerDY / 18));
      pointerDX = 0;
      pointerDY = 0;
      return { x, y, fire: held.fire || pointerDown };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
