// SOLMAR BAY — combat: a hitscan pistol with tracers, muzzle flash, reload,
// and the consequences (noise scares peds, hurting people raises heat).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp } from './random.js';

export function createCombat(scene, camera) {
  const tracers = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe14d });
  const flashLight = new THREE.PointLight(0xffcc66, 0, 14);
  scene.add(flashLight);
  let flashUntil = 0;
  let cooldown = 0;

  function spawnTracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(0.03, 0.03, len, 5);
    const mesh = new THREE.Mesh(geo, tracerMat);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    scene.add(mesh);
    tracers.push({ mesh, ttl: 0.09 });
  }

  return {
    // Returns 'hit' | 'miss' | 'empty' | 'cooldown'.
    tryShoot(player, raycaster, targets, audio, onHit) {
      if (cooldown > 0) return 'cooldown';
      if (player.ammo <= 0) {
        if (audio) audio.error();
        return 'empty';
      }
      cooldown = 0.22;
      player.ammo -= 1;
      if (audio) audio.shoot();
      const now = performance.now() / 1000;
      flashUntil = now + 0.06;
      const origin = new THREE.Vector3(player.x, 1.55, player.z);
      if (player.inCar) {
        origin.set(player.inCar.x, 1.5, player.inCar.z);
      }
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      raycaster.far = 120;
      const hits = raycaster.intersectObjects(targets, true);
      let end;
      if (hits.length > 0) {
        end = hits[0].point.clone();
        spawnTracer(origin, end);
        if (onHit) onHit(hits[0]);
        return 'hit';
      }
      end = raycaster.ray.at(90, new THREE.Vector3());
      spawnTracer(origin, end);
      return 'miss';
    },
    reload(player, audio) {
      if (player.ammo >= CONFIG.pistolAmmo || player.ammoReserve <= 0) return false;
      const need = CONFIG.pistolAmmo - player.ammo;
      const take = Math.min(need, player.ammoReserve);
      player.ammo += take;
      player.ammoReserve -= take;
      if (audio) audio.reload();
      return true;
    },
    // Top the reserve up (ammo pickups, mission rewards). Returns how many
    // rounds were actually added.
    giveAmmo(player, rounds, audio) {
      const before = player.ammoReserve;
      player.ammoReserve = clamp(player.ammoReserve + rounds, 0, 240);
      if (audio && player.ammoReserve > before) audio.pickup();
      return player.ammoReserve - before;
    },
    // Hitscan damage falls off with distance: full inside 25 m, half past 60 m.
    damageAt(distance) {
      const t = clamp((distance - 25) / 35, 0, 1);
      return Math.round(CONFIG.pistolDamage * (1 - t * 0.5));
    },
    update(dt, t) {
      cooldown = Math.max(0, cooldown - dt);
      flashLight.intensity = t < flashUntil ? 60 : 0;
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].ttl -= dt;
        if (tracers[i].ttl <= 0) {
          scene.remove(tracers[i].mesh);
          tracers[i].mesh.geometry.dispose();
          tracers.splice(i, 1);
        }
      }
      void clamp;
    },
  };
}
