// SOLMAR BAY — the wanted system: heat 0..5 stars, police cruisers that spawn
// at the city edge and chase, and a "busted" timer when a cruiser sits on you.

import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { clamp, range } from './random.js';
import { makeCarMesh } from './vehicles.js';

export function createWanted(scene, city) {
  const police = [];
  let spawnCooldown = 0;

  const wanted = {
    stars: 0,
    heat: 0, // 0..5, fractional; stars = ceil(heat) while heat > 0
    bustTimer: 0,
    busted: false,
    police,
    addHeat(amount) {
      wanted.heat = clamp(wanted.heat + amount, 0, 5);
      wanted.stars = wanted.heat <= 0.05 ? 0 : Math.ceil(wanted.heat);
    },
    setStars(n) {
      wanted.heat = n;
      wanted.stars = n;
    },
    clearHeat() {
      wanted.heat = 0;
      wanted.stars = 0;
      wanted.bustTimer = 0;
      while (police.length > 0) wanted.removePolice(police[0]);
    },
    isBeingChased() {
      return police.length > 0 && wanted.stars > 0;
    },
    spawnPolice(x, z) {
      if (police.length >= CONFIG.policeMax) return null;
      const mesh = makeCarMesh(PALETTE.policePaint, 'police');
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      const car = {
        mesh,
        kind: 'police',
        x,
        z,
        heading: 0,
        speed: 0,
        steer: 0,
        driver: 'police',
        flash: 0,
      };
      police.push(car);
      return car;
    },
    removePolice(car) {
      const i = police.indexOf(car);
      if (i >= 0) police.splice(i, 1);
      scene.remove(car.mesh);
    },
    update(dt, player, vehicles, audio) {
      // Heat cools off when the player stays clean.
      if (wanted.heat > 0) {
        wanted.heat = Math.max(0, wanted.heat - CONFIG.wantedDecayPerSec * dt);
        wanted.stars = wanted.heat <= 0.05 ? 0 : Math.ceil(wanted.heat);
      }
      const px = player.inCar ? player.inCar.x : player.x;
      const pz = player.inCar ? player.inCar.z : player.z;
      // Spawn cruisers while wanted, at the nearest city edge behind the player.
      spawnCooldown -= dt;
      if (wanted.stars > 0 && police.length < Math.min(wanted.stars, CONFIG.policeMax) && spawnCooldown <= 0) {
        spawnCooldown = 4;
        const edge = city.half;
        const side = Math.floor(range(Math.random, 0, 4));
        let sx = px;
        let sz = pz;
        if (side === 0) { sx = px - 90; sz = pz; }
        if (side === 1) { sx = px + 90; sz = pz; }
        if (side === 2) { sx = px; sz = pz - 90; }
        if (side === 3) { sx = px; sz = pz + 90; }
        sx = clamp(sx, -edge, edge);
        sz = clamp(sz, -edge, edge + 30);
        wanted.spawnPolice(sx, sz);
      }
      // Despawn the chase once the heat is gone.
      if (wanted.stars === 0) {
        while (police.length > 0) wanted.removePolice(police[0]);
        wanted.bustTimer = 0;
        if (audio) audio.siren(false);
        return;
      }
      if (audio) audio.siren(true);
      let touching = false;
      for (const car of police.slice()) {
        // Steer toward the player, arcade style.
        const dx = px - car.x;
        const dz = pz - car.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        let diff = wantHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += clamp(diff, -dt * 2.2, dt * 2.2);
        const targetSpeed = dist > 60 ? 40 : 30;
        car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        const hit = city.collide(car.x, car.z, 2.4);
        car.x = hit.x;
        car.z = hit.z;
        if (hit.hit) car.speed *= 0.5;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
        // Flashing light bar.
        car.flash += dt * 8;
        const on = Math.sin(car.flash) > 0;
        if (car.mesh.userData.lights) {
          car.mesh.userData.lights[0].material.color.setHex(on ? 0xff2222 : 0x551111);
          car.mesh.userData.lights[1].material.color.setHex(on ? 0x112255 : 0x2266ff);
        }
        // Ram the player's car, or corner the player on foot.
        if (dist < 4.5) {
          touching = true;
          if (player.inCar) {
            player.inCar.speed *= 0.92;
            if (Math.random() < dt * 0.5) player.damage(4);
          }
        }
      }
      if (touching && !player.inCar) {
        wanted.bustTimer += dt;
        if (wanted.bustTimer >= CONFIG.bustHoldSeconds) {
          wanted.busted = true;
        }
      } else {
        wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 2);
      }
      void vehicles;
      void THREE;
    },
  };
  return wanted;
}
