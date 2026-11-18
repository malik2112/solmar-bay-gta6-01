// Renderer + chase camera. Third-person follow with a mouse-drag orbit offset
// and wheel zoom; the camera eases behind the player or the car.
import * as THREE from 'three';
import { clamp, lerp } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 2000);
  camera.position.set(0, 30, 60);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { renderer, scene, camera };
}

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yawOffset = 0;
    this.pitchOffset = 0;
    this.distance = 12;
    this.pos = new THREE.Vector3(0, 30, 60);
    this.look = new THREE.Vector3(0, 2, 0);
  }
  applyDrag(dx, dy, wheel) {
    this.yawOffset -= dx * 0.005;
    this.pitchOffset = clamp(this.pitchOffset + dy * 0.003, -0.35, 0.5);
    if (wheel) this.distance = clamp(this.distance + Math.sign(wheel) * 1.5, 7, 20);
  }
  // Follow the player (or their car). `yaw` is the heading the camera trails.
  follow(dt, x, z, heading, driving, speed) {
    const yaw = heading + Math.PI + this.yawOffset;
    const dist = driving ? this.distance + 2 : this.distance;
    const height = driving ? 6.5 + this.pitchOffset * 8 : 4.6 + this.pitchOffset * 8;
    const tx = x + Math.sin(yaw) * dist;
    const tz = z + Math.cos(yaw) * dist;
    const k = 1 - Math.exp(-dt * (driving ? 5 : 7));
    this.pos.x = lerp(this.pos.x, tx, k);
    this.pos.y = lerp(this.pos.y, height, k);
    this.pos.z = lerp(this.pos.z, tz, k);
    const lx = x + Math.sin(heading) * (driving ? 6 : 3);
    const lz = z + Math.cos(heading) * (driving ? 6 : 3);
    this.look.x = lerp(this.look.x, lx, k);
    this.look.y = lerp(this.look.y, 1.8, k);
    this.look.z = lerp(this.look.z, lz, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
  // Same framing as follow(), but snapped in one jump: staged screenshots
  // paint only a few frames, so an eased camera would never arrive.
  snapFollow(x, z, heading, driving) {
    const yaw = heading + Math.PI + this.yawOffset;
    const dist = driving ? this.distance + 2 : this.distance;
    const height = driving ? 6.5 + this.pitchOffset * 8 : 4.6 + this.pitchOffset * 8;
    this.pos.set(x + Math.sin(yaw) * dist, height, z + Math.cos(yaw) * dist);
    this.look.set(x + Math.sin(heading) * (driving ? 6 : 3), 1.8, z + Math.cos(heading) * (driving ? 6 : 3));
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
  // Fixed cinematic framing for the title / staged shots.
  setShot(x, y, z, lx, ly, lz) {
    this.pos.set(x, y, z);
    this.look.set(lx, ly, lz);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
