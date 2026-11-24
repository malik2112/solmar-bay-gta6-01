// SOLMAR BAY — renderer, chase cameras and the sun. One WebGLRenderer,
// antialiased, capped at the display's pixel ratio for speed.

import * as THREE from 'three';

export function createRenderer(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
  camera.position.set(0, 8, 20);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const cam = { x: 0, y: 10, z: 24, lookX: 0, lookY: 1.5, lookZ: 0 };

  return {
    renderer,
    scene,
    camera,
    domElement: renderer.domElement,
    // Smooth third-person chase camera. On foot it sits behind the camera yaw;
    // in a car it sits behind the car's heading, further back and lower.
    updateCamera(dt, player) {
      let yaw;
      let dist;
      let height;
      let lookAhead;
      if (player.inCar) {
        yaw = player.inCar.heading;
        dist = 13.5;
        height = 5.2;
        lookAhead = 7;
      } else {
        yaw = player.camYaw;
        dist = 8.5;
        height = 3.4;
        lookAhead = 4;
      }
      const tx = player.inCar ? player.inCar.x : player.x;
      const tz = player.inCar ? player.inCar.z : player.z;
      const wantX = tx + Math.sin(yaw) * dist;
      const wantZ = tz + Math.cos(yaw) * dist;
      const k = Math.min(1, dt * 6);
      cam.x += (wantX - cam.x) * k;
      cam.z += (wantZ - cam.z) * k;
      cam.y += (height - cam.y) * Math.min(1, dt * 5);
      cam.lookX = tx - Math.sin(yaw) * lookAhead;
      cam.lookZ = tz - Math.cos(yaw) * lookAhead;
      cam.lookY = 1.6;
      camera.position.set(cam.x, cam.y, cam.z);
      camera.lookAt(cam.lookX, cam.lookY, cam.lookZ);
    },
    render() {
      renderer.render(scene, camera);
    },
  };
}
