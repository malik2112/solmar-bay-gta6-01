// SOLMAR BAY — screenshot presets (?shot=<name>): stage a composed scene for
// each dossier image, then tell the driver the frame is ready.
// Road centrelines sit at …, -150, -90, -30, 30, 90, 150, … so every preset
// stands on asphalt, facing down a road or out over the beach.

export function applyShot(name, state) {
  const { player, vehicles, missions, wanted, hud } = state;
  hud.hideMenu();
  state.mode = 'playing';
  state.shotName = name;
  state.settleFrames = 60; // ~12s at SwiftShader frame rates; traffic, clouds and HUD settle

  if (name === 'start') {
    // Menu cover: pull the camera high over the beachfront at golden hour.
    hud.showMenu(false);
    state.mode = 'menu';
    player.setPosition(0, 150, Math.PI);
    player.camYaw = Math.PI;
    state.menuOrbit = 0;
    return;
  }

  if (name === 'drive') {
    // Vic tearing south down road x=90 in a red coupe, a cruiser closing in.
    const car = vehicles.addCar(90, -150, 0, 'civil', 0xc0392b, { parked: false, name: 'hero-coupe' });
    car.driver = 'player';
    player.inCar = car;
    player.group.visible = false;
    car.speed = 30;
    wanted.setStars(1);
    const cop = wanted.spawnPolice(90, -210);
    if (cop) {
      cop.heading = 0;
      cop.mesh.rotation.y = 0;
    }
    state.shotCruise = true; // keep the hero car rolling for the camera
    player.setPosition(90, -150, 0);
    return;
  }

  if (name === 'street') {
    // On foot downtown, mid-road x=-30 looking south: towers, traffic, peds.
    missions.applySave([], 0);
    missions.start();
    player.setPosition(-30, -60, 0);
    player.camYaw = Math.PI;
    player.health = 100;
    wanted.setStars(0);
    return;
  }

  if (name === 'mission') {
    // Mission 2 active: the beachfront pickup beacon over the sand, Vic running in.
    missions.applySave(['m1'], 1);
    missions.start();
    player.setPosition(-150, 250, 0);
    player.camYaw = Math.PI;
    wanted.setStars(0);
    return;
  }

  // Unknown preset: plain street scene.
  player.setPosition(0, 0, 0);
  wanted.setStars(0);
}
