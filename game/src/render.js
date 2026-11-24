// SOLMAR BAY — the view: renderer, scene, camera rig and lights. The camera
// is a third-person follow rig (behind the player on foot, further back and
// higher in a car) and a slow cinematic orbit while the menu is up. Nothing
// here knows about missions or input; main.js drives it with updateCamera.

import * as THREE from 'three';
import { PALETTE } from './config.js';

const FOLLOW_DISTANCE_FOOT = 10.5;
const FOLLOW_HEIGHT_FOOT = 4.4;
const FOLLOW_DISTANCE_CAR = 14.5;
const FOLLOW_HEIGHT_CAR = 5.6;
const MENU_ORBIT_RADIUS = 250;
const MENU_ORBIT_HEIGHT = 130;

export function createView() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('app').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(0x9fd4ef, 200, 640);

  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1400);
  camera.position.set(0, 90, 260);

  // Sun + sky fill, tuned for a bright coastal afternoon.
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.7);
  sun.position.set(190, 270, 130);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcfe8ff, 0.35);
  fill.position.set(-140, 120, -180);
  scene.add(fill);

  // A soft golden-hour tint the game can dial in for the menu cover shot.
  let goldenHour = 0; // 0 = midday, 1 = full sunset
  function applyGoldenHour(amount) {
    goldenHour = amount;
    sun.color.setHex(amount > 0.5 ? 0xffb36b : 0xfff2cf);
    sun.intensity = 1.7 - amount * 0.5;
    hemi.intensity = 0.95 - amount * 0.3;
    scene.background.setHex(amount > 0.5 ? 0xe8975a : 0x7ec8ee);
    scene.fog.color.setHex(amount > 0.5 ? 0xe8a06a : 0x9fd4ef);
  }

  const camPos = new THREE.Vector3(0, 90, 260);
  const lookTarget = new THREE.Vector3(0, 8, 40);
  let firstFrame = true;

  function updateCamera(dt, player, viewState = {}) {
    const mode = viewState.mode || 'playing';
    if (mode === 'menu') {
      // Slow orbit over the beachfront, looking back at downtown.
      const angle = (viewState.menuOrbit || 0) * 0.045;
      const wanted = new THREE.Vector3(
        Math.sin(angle) * MENU_ORBIT_RADIUS,
        MENU_ORBIT_HEIGHT,
        150 + Math.cos(angle) * MENU_ORBIT_RADIUS * 0.55
      );
      camPos.lerp(wanted, Math.min(1, dt * 1.2));
      camera.position.copy(camPos);
      lookTarget.lerp(new THREE.Vector3(0, 12, 30), Math.min(1, dt * 1.2));
      camera.lookAt(lookTarget);
      return;
    }
    const inCar = !!player.inCar;
    const px = inCar ? player.inCar.x : player.x;
    const pz = inCar ? player.inCar.z : player.z;
    const dist = inCar ? FOLLOW_DISTANCE_CAR : FOLLOW_DISTANCE_FOOT;
    const height = inCar ? FOLLOW_HEIGHT_CAR : FOLLOW_HEIGHT_FOOT;
    // Camera sits behind the camera yaw, not the body heading.
    const yaw = player.camYaw;
    const backX = Math.sin(yaw);
    const backZ = Math.cos(yaw);
    const wanted = new THREE.Vector3(px + backX * dist, height, pz + backZ * dist);
    if (firstFrame) {
      camPos.copy(wanted);
      firstFrame = false;
    } else {
      // Critically damped-ish follow: fast enough to feel attached, slow
      // enough to smooth out bumps and turns.
      const k = 1 - Math.exp(-dt * 7);
      camPos.lerp(wanted, k);
    }
    // Keep the camera out of the ground on the beach slope.
    camPos.y = Math.max(camPos.y, 2.2);
    camera.position.copy(camPos);
    const look = new THREE.Vector3(px - Math.sin(yaw) * 6, inCar ? 1.6 : 2.0, pz - Math.cos(yaw) * 6);
    lookTarget.lerp(look, 1 - Math.exp(-dt * 10));
    camera.lookAt(lookTarget);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  // A cheap screen-space flash the game can trigger (muzzle flash bloom is
  // done with a light; this is for full-screen events like being busted).
  function flash(color, opacity) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:${color};opacity:${opacity};pointer-events:none;z-index:40;transition:opacity .5s;`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = '0';
    });
    setTimeout(() => overlay.remove(), 600);
  }

  return {
    renderer,
    scene,
    camera,
    goldenHour() {
      return goldenHour;
    },
    applyGoldenHour,
    updateCamera,
    render,
    resize,
    flash,
  };
}
