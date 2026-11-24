// SOLMAR BAY — the player on foot: a low-poly walker with a third-person
// camera rig, sprint, and car entry/exit. Health and ammo live on the state.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, angleLerp } from './random.js';

export function createPlayer(scene, city) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e86c1 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirt);
  torso.position.y = 1.28;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.42), skin);
  head.position.y = 1.95;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.46), hair);
  cap.position.y = 2.2;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), pants);
  legL.position.set(-0.19, 0.43, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.19;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.26), shirt);
  armL.position.set(-0.48, 1.3, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);
  // A simple pistol held in the right hand.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.48, 0.95, 0.28);
  group.add(gun);

  scene.add(group);

  const player = {
    group,
    x: 0,
    z: 120,
    heading: 0,      // facing
    camYaw: 0,       // camera orbit yaw
    speed: 0,
    health: CONFIG.startHealth,
    stamina: 100, // 0..100; sprint drains it, standing still refills it
    winded: false,
    ammo: CONFIG.pistolAmmo,
    ammoReserve: 60,
    inCar: null,
    walkPhase: 0,
    dead: false,
    setPosition(x, z, heading) {
      player.x = x;
      player.z = z;
      if (heading !== undefined) {
        player.heading = heading;
        player.camYaw = heading;
      }
      group.position.set(x, 0, z);
      group.rotation.y = heading;
    },
    update(dt, input, state) {
      if (player.dead || player.inCar) return;
      const ax = input.axis();
      const wantSprint = input.down('ShiftLeft') || input.down('ShiftRight');
      // Sprinting drains stamina; at zero the player is winded and forced to
      // walk until stamina recovers past 25.
      if (wantSprint && player.stamina <= 0) player.winded = true;
      if (player.winded && player.stamina >= 25) player.winded = false;
      const sprint = wantSprint && !player.winded;
      const target = sprint ? CONFIG.playerRunSpeed : CONFIG.playerWalkSpeed;
      const moving = ax.x !== 0 || ax.z !== 0;
      if (sprint && moving) player.stamina = clamp(player.stamina - dt * 22, 0, 100);
      else player.stamina = clamp(player.stamina + dt * (moving ? 8 : 16), 0, 100);
      // Camera-relative movement: forward is where the camera looks.
      const fwdX = -Math.sin(player.camYaw);
      const fwdZ = -Math.cos(player.camYaw);
      const rightX = Math.cos(player.camYaw);
      const rightZ = -Math.sin(player.camYaw);
      let mx = fwdX * -ax.z + rightX * ax.x;
      let mz = fwdZ * -ax.z + rightZ * ax.x;
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        mx /= len;
        mz /= len;
      }
      const want = moving ? target : 0;
      player.speed += (want - player.speed) * Math.min(1, dt * 8);
      player.x += mx * player.speed * dt;
      player.z += mz * player.speed * dt;
      const hit = city.collide(player.x, player.z, 0.6);
      player.x = hit.x;
      player.z = hit.z;
      if (!city.insideCity(player.x, player.z)) {
        player.x = clamp(player.x, -city.half - 4, city.half + 4);
        player.z = clamp(player.z, -city.half - 4, city.half + 44);
      }
      if (moving && player.speed > 0.5) {
        player.heading = angleLerp(player.heading, Math.atan2(mx, mz), Math.min(1, dt * 10));
        player.walkPhase += dt * player.speed * 1.4;
        const swing = Math.sin(player.walkPhase) * 0.5;
        legL.rotation.x = swing;
        legR.rotation.x = -swing;
        armL.rotation.x = -swing * 0.8;
        armR.rotation.x = swing * 0.8;
      } else {
        legL.rotation.x = 0;
        legR.rotation.x = 0;
        armL.rotation.x = 0;
        armR.rotation.x = 0;
      }
      group.position.set(player.x, 0, player.z);
      group.rotation.y = player.heading;
      // Mouse orbit (pointer lock) turns the camera, not the body.
      player.camYaw -= input.mouse.dx * 0.0032;
      player.camYaw = ((player.camYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      void state;
    },
    damage(amount) {
      if (player.dead) return false;
      player.health -= amount;
      if (player.health <= 0) {
        player.health = 0;
        player.dead = true;
      }
      return player.dead;
    },
    heal(amount) {
      player.health = clamp(player.health + amount, 0, CONFIG.startHealth);
    },
  };
  player.setPosition(0, 120, 0);
  return player;
}
