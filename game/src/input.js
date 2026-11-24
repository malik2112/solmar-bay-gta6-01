// SOLMAR BAY — keyboard + mouse state, with edge-triggered "pressed" events.

export function createInput(canvasHost) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, clicked: false, locked: false };

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    if (document.pointerLockElement === canvasHost) {
      mouse.dx += e.movementX || 0;
      mouse.dy += e.movementY || 0;
    }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }
  function onLockChange() {
    mouse.locked = document.pointerLockElement === canvasHost;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    keys,
    mouse,
    down(code) {
      return keys.has(code);
    },
    // True only on the frame the key went down; consumed by endFrame().
    wasPressed(code) {
      return pressed.has(code);
    },
    axis() {
      let x = 0;
      let z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return { x, z };
    },
    requestLock() {
      if (canvasHost && canvasHost.requestPointerLock && document.pointerLockElement !== canvasHost) {
        try {
          canvasHost.requestPointerLock();
        } catch (_err) {
          /* pointer lock is a nicety, not a requirement */
        }
      }
    },
    endFrame() {
      pressed.clear();
      mouse.dx = 0;
      mouse.dy = 0;
      mouse.clicked = false;
    },
  };
}
