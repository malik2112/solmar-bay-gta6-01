// Keyboard + mouse. Physical keys feed `keys`; tests and staged shots drive the
// game through `virtual`, which overrides the physical state while it is set.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_RELOAD = 32;
export const ACTION_RADIO = 64;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let actions = 0;
  let dragDX = 0;
  let dragDY = 0;
  let wheel = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'punch', KeyF: 'shoot',
    KeyE: 'enter', KeyR: 'reload', KeyQ: 'radio', KeyM: 'brief',
  };
  const ACTIONMAP = { Enter: ACTION_CONFIRM, Space: ACTION_PUNCH, KeyF: ACTION_SHOOT, KeyE: ACTION_ENTER, KeyR: ACTION_RELOAD, KeyQ: ACTION_RADIO, Escape: ACTION_PAUSE };

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (ACTIONMAP[e.code] !== undefined) actions |= ACTIONMAP[e.code];
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseDown(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
  function onMouseMove(e) {
    if (!dragging) return;
    dragDX += e.clientX - lastX; dragDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  }
  function onMouseUp() { dragging = false; }
  function onWheel(e) { wheel += e.deltaY; e.preventDefault(); }
  function onClick(e) { if (e.target === canvas) actions |= ACTION_SHOOT; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('click', onClick);

  const input = {
    virtual: null, // {up,down,left,right,run,...} — overrides physical keys while set
    read() {
      const v = this.virtual;
      const down = (name) => (v && v[name] !== undefined ? !!v[name] : [...keys].some((c) => KEYMAP[c] === name));
      return {
        up: down('up'), down: down('down'), left: down('left'), right: down('right'),
        run: down('run'), punch: down('punch'), shoot: down('shoot'),
        enter: down('enter'), reload: down('reload'), radio: down('radio'), brief: down('brief'),
      };
    },
    // Edge-triggered actions since the last call; also consumes the brief key.
    takeActions() {
      const a = actions;
      actions = 0;
      if (pressed.has('KeyM')) a |= 0; // brief handled via read()
      return a;
    },
    briefPressed() {
      const hit = pressed.has('KeyM') || (this.virtual && this.virtual.brief);
      pressed.delete('KeyM');
      return hit;
    },
    takeCamera() {
      const d = { dx: dragDX, dy: dragDY, wheel };
      dragDX = 0; dragDY = 0; wheel = 0;
      return d;
    },
    confirmPressed() { return pressed.has('Enter'); },
    clearPressed() { pressed.clear(); },
  };
  return input;
}
