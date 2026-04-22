import {
  choose,
  circleIntersectsCircle,
  circleIntersectsRect,
  clamp,
  createRng,
  distance,
  length,
  lerp,
  normalize,
  randomInt,
} from "./utils.js";

const TILE_SIZE = 64;
const MAP_COLUMNS = 48;
const MAP_ROWS = 30;
const HERO_RADIUS = 20;
const HERO_SPEED = 280;
const HERO_DASH_SPEED = 860;
const GOBLIN_RADIUS = 18;
const BRUTE_RADIUS = 24;

const THEMES = [
  {
    name: "Sunken Canopy",
    background: "#08131e",
    floorA: "#244b3d",
    floorB: "#2d5e48",
    wall: "#13272b",
    wallEdge: "#2b5450",
    accent: "#f9d26d",
  },
  {
    name: "Amber Hollow",
    background: "#17120c",
    floorA: "#5b4429",
    floorB: "#6b5332",
    wall: "#2f2215",
    wallEdge: "#8d6f42",
    accent: "#ffd166",
  },
  {
    name: "Moonfen",
    background: "#0f1120",
    floorA: "#303657",
    floorB: "#394069",
    wall: "#171a2e",
    wallEdge: "#5b6ca8",
    accent: "#8fd3ff",
  },
];

export function createWorld(seed) {
  const rng = createRng(seed);
  const theme = choose(rng, THEMES);
  const map = buildMap(rng);
  const spawnTile = map.rooms[0];
  const spawnPoint = tileCenter(spawnTile.x, spawnTile.y);
  const floorSpots = collectFloorSpots(map);
  const world = {
    seed,
    seedLabel: String(seed).slice(-6),
    elapsed: 0,
    rng,
    theme,
    map,
    floorSpots,
    hero: createHero(spawnPoint.x, spawnPoint.y),
    director: createDirector(),
    enemies: [],
    obstacles: [],
    hazards: [],
    announcements: [],
    camera: {
      x: spawnPoint.x,
      y: spawnPoint.y,
      shake: 0,
    },
    score: {
      kills: 0,
      wavesCleared: 0,
    },
    challenge: {
      active: false,
      timeLeft: 0,
      spawnTimer: 0,
      remainingSpawns: 0,
      enemiesAlive: 0,
    },
  };

  addAmbientEnemies(world, rng, 9);
  centerDirectorCursor(world);
  addAnnouncement(world, `${theme.name} rolled. Seed ${world.seedLabel}.`, "#ffd166");

  return world;
}

function buildMap(rng) {
  const tiles = new Array(MAP_COLUMNS * MAP_ROWS).fill(0);
  const rooms = [];

  for (let index = 0; index < 10; index += 1) {
    const room = {
      x: randomInt(rng, 6, MAP_COLUMNS - 7),
      y: randomInt(rng, 6, MAP_ROWS - 7),
      radiusX: randomInt(rng, 3, 5),
      radiusY: randomInt(rng, 3, 4),
    };

    carveRoom(tiles, room);

    const previousRoom = rooms[rooms.length - 1];
    if (previousRoom) {
      connectRooms(tiles, previousRoom, room);
    }

    rooms.push(room);
  }

  return {
    columns: MAP_COLUMNS,
    rows: MAP_ROWS,
    tileSize: TILE_SIZE,
    tiles,
    rooms,
    width: MAP_COLUMNS * TILE_SIZE,
    height: MAP_ROWS * TILE_SIZE,
  };
}

function carveRoom(tiles, room) {
  for (let y = room.y - room.radiusY; y <= room.y + room.radiusY; y += 1) {
    for (let x = room.x - room.radiusX; x <= room.x + room.radiusX; x += 1) {
      if (!isInsideMap(x, y)) {
        continue;
      }

      const nx = (x - room.x) / room.radiusX;
      const ny = (y - room.y) / room.radiusY;

      if (nx * nx + ny * ny > 1) {
        continue;
      }

      setFloor(tiles, x, y);
    }
  }
}

function connectRooms(tiles, fromRoom, toRoom) {
  carveHorizontalCorridor(tiles, fromRoom.x, toRoom.x, fromRoom.y);
  carveVerticalCorridor(tiles, fromRoom.y, toRoom.y, toRoom.x);
}

function carveHorizontalCorridor(tiles, fromX, toX, y) {
  const start = Math.min(fromX, toX);
  const end = Math.max(fromX, toX);

  for (let x = start; x <= end; x += 1) {
    setFloor(tiles, x, y);
    setFloor(tiles, x, y + 1);
  }
}

function carveVerticalCorridor(tiles, fromY, toY, x) {
  const start = Math.min(fromY, toY);
  const end = Math.max(fromY, toY);

  for (let y = start; y <= end; y += 1) {
    setFloor(tiles, x, y);
    setFloor(tiles, x + 1, y);
  }
}

function setFloor(tiles, x, y) {
  if (!isInsideMap(x, y)) {
    return;
  }

  tiles[y * MAP_COLUMNS + x] = 1;
}

function isInsideMap(x, y) {
  return x >= 0 && x < MAP_COLUMNS && y >= 0 && y < MAP_ROWS;
}

function tileCenter(x, y) {
  return {
    x: x * TILE_SIZE + TILE_SIZE / 2,
    y: y * TILE_SIZE + TILE_SIZE / 2,
  };
}

function collectFloorSpots(map) {
  const spots = [];

  for (let y = 0; y < map.rows; y += 1) {
    for (let x = 0; x < map.columns; x += 1) {
      if (!isFloorTile(map, x, y)) {
        continue;
      }

      spots.push(tileCenter(x, y));
    }
  }

  return spots;
}

function createHero(x, y) {
  return {
    x,
    y,
    radius: HERO_RADIUS,
    health: 100,
    maxHealth: 100,
    facingX: 1,
    facingY: 0,
    aimAngle: 0,
    dashTimer: 0,
    dashCooldown: 0,
    slashCooldown: 0,
    burstCooldown: 0,
    hurtFlash: 0,
    lastHitTimer: 0,
  };
}

function createDirector() {
  return {
    cursorOffsetX: 0,
    cursorOffsetY: 0,
    spawnEnemyCooldown: 0,
    spawnRockCooldown: 0,
    spawnHazardCooldown: 0,
    challengeCooldown: 0,
  };
}

function addAmbientEnemies(world, rng, count) {
  let created = 0;
  let attempts = 0;

  while (created < count && attempts < count * 12) {
    attempts += 1;
    const spot = choose(rng, world.floorSpots);

    if (distance(world.hero, spot) < 260) {
      continue;
    }

    if (collidesWithAnything(world, spot.x, spot.y, GOBLIN_RADIUS + 6)) {
      continue;
    }

    world.enemies.push(createEnemy("goblin", spot.x, spot.y));
    created += 1;
  }
}

function createEnemy(type, x, y) {
  if (type === "brute") {
    return {
      type,
      x,
      y,
      radius: BRUTE_RADIUS,
      maxHealth: 48,
      health: 48,
      speed: 118,
      touchDamage: 15,
      touchCooldown: 0,
      hitFlash: 0,
      challengeSpawned: true,
    };
  }

  return {
    type: "goblin",
    x,
    y,
    radius: GOBLIN_RADIUS,
    maxHealth: 28,
    health: 28,
    speed: 146,
    touchDamage: 9,
    touchCooldown: 0,
    hitFlash: 0,
    challengeSpawned: false,
  };
}

export function updateWorld(world, inputs, dt, viewport) {
  world.elapsed += dt;
  world.camera.shake = Math.max(0, world.camera.shake - dt * 3.4);

  tickHeroCooldowns(world.hero, dt);
  tickDirectorCooldowns(world.director, dt);
  tickAnnouncements(world, dt);
  tickHazards(world, dt);
  tickEnemies(world, dt);
  tickChallenge(world, dt);

  updateHero(world, inputs.hero, dt);
  updateDirector(world, inputs.director, dt);
  updateCamera(world, dt, viewport);
}

function tickHeroCooldowns(hero, dt) {
  hero.dashCooldown = Math.max(0, hero.dashCooldown - dt);
  hero.slashCooldown = Math.max(0, hero.slashCooldown - dt);
  hero.burstCooldown = Math.max(0, hero.burstCooldown - dt);
  hero.dashTimer = Math.max(0, hero.dashTimer - dt);
  hero.hurtFlash = Math.max(0, hero.hurtFlash - dt * 4);
  hero.lastHitTimer = Math.max(0, hero.lastHitTimer - dt);
}

function tickDirectorCooldowns(director, dt) {
  director.spawnEnemyCooldown = Math.max(0, director.spawnEnemyCooldown - dt);
  director.spawnRockCooldown = Math.max(0, director.spawnRockCooldown - dt);
  director.spawnHazardCooldown = Math.max(0, director.spawnHazardCooldown - dt);
  director.challengeCooldown = Math.max(0, director.challengeCooldown - dt);
}

function tickAnnouncements(world, dt) {
  world.announcements = world.announcements.filter((entry) => {
    entry.life -= dt;
    return entry.life > 0;
  });
}

function tickHazards(world, dt) {
  world.hazards = world.hazards.filter((hazard) => {
    hazard.life -= dt;
    hazard.tickTimer -= dt;

    if (hazard.tickTimer > 0) {
      return hazard.life > 0;
    }

    hazard.tickTimer = 0.35;

    if (circleIntersectsCircle(world.hero.x, world.hero.y, world.hero.radius, hazard.x, hazard.y, hazard.radius)) {
      damageHero(world, hazard.damage, "Hazard field");
    }

    for (const enemy of world.enemies) {
      if (!circleIntersectsCircle(enemy.x, enemy.y, enemy.radius, hazard.x, hazard.y, hazard.radius)) {
        continue;
      }

      damageEnemy(world, enemy, 5);
    }

    return hazard.life > 0;
  });
}

function tickEnemies(world, dt) {
  for (const enemy of world.enemies) {
    enemy.touchCooldown = Math.max(0, enemy.touchCooldown - dt);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 4);

    const toHero = normalize(world.hero.x - enemy.x, world.hero.y - enemy.y);
    const moveSpeed = enemy.speed * dt;

    moveUnit(world, enemy, toHero.x * moveSpeed, toHero.y * moveSpeed);

    if (enemy.touchCooldown > 0) {
      continue;
    }

    if (!circleIntersectsCircle(enemy.x, enemy.y, enemy.radius, world.hero.x, world.hero.y, world.hero.radius)) {
      continue;
    }

    enemy.touchCooldown = 0.8;
    damageHero(world, enemy.touchDamage, enemy.type === "brute" ? "Brute slam" : "Goblin swipe");
  }

  world.enemies = world.enemies.filter((enemy) => enemy.health > 0);
}

function tickChallenge(world, dt) {
  if (!world.challenge.active) {
    return;
  }

  world.challenge.timeLeft -= dt;
  world.challenge.spawnTimer -= dt;

  if (world.challenge.remainingSpawns > 0 && world.challenge.spawnTimer <= 0) {
    spawnChallengeEnemy(world);
    world.challenge.remainingSpawns -= 1;
    world.challenge.spawnTimer = 1.2;
  }

  const challengeEnemiesAlive = world.enemies.filter((enemy) => enemy.challengeSpawned).length;

  if (world.challenge.timeLeft > 0) {
    world.challenge.enemiesAlive = challengeEnemiesAlive;
    return;
  }

  if (challengeEnemiesAlive > 0 || world.challenge.remainingSpawns > 0) {
    world.challenge.enemiesAlive = challengeEnemiesAlive;
    return;
  }

  world.challenge.active = false;
  world.challenge.enemiesAlive = 0;
  world.score.wavesCleared += 1;
  healHero(world, 18);
  addAnnouncement(world, "Challenge cleared. Hero recovered 18 HP.", "#7de2d1");
}

function updateHero(world, input, dt) {
  const hero = world.hero;

  if (!input.connected) {
    return;
  }

  const moveStick = normalize(input.axes.leftX, input.axes.leftY);
  const moveStrength = clamp(length(input.axes.leftX, input.axes.leftY), 0, 1);
  const aimStrength = clamp(length(input.axes.rightX, input.axes.rightY), 0, 1);

  if (aimStrength > 0) {
    hero.facingX = input.axes.rightX / aimStrength;
    hero.facingY = input.axes.rightY / aimStrength;
    hero.aimAngle = Math.atan2(hero.facingY, hero.facingX);
  } else if (moveStrength > 0) {
    hero.facingX = moveStick.x;
    hero.facingY = moveStick.y;
    hero.aimAngle = Math.atan2(hero.facingY, hero.facingX);
  }

  if (hero.dashTimer > 0) {
    moveUnit(world, hero, hero.facingX * HERO_DASH_SPEED * dt, hero.facingY * HERO_DASH_SPEED * dt);
  } else if (moveStrength > 0) {
    moveUnit(world, hero, moveStick.x * HERO_SPEED * moveStrength * dt, moveStick.y * HERO_SPEED * moveStrength * dt);
  }

  if (input.justPressed.a) {
    tryDash(world);
  }

  if (input.justPressed.x || input.justPressed.rb || input.justPressed.rt) {
    trySlash(world);
  }

  if (input.justPressed.b || input.justPressed.lb) {
    tryBurst(world);
  }
}

function updateDirector(world, input, dt) {
  const director = world.director;

  if (!input.connected) {
    return;
  }

  director.cursorOffsetX += input.axes.leftX * 460 * dt;
  director.cursorOffsetY += input.axes.leftY * 460 * dt;
  director.cursorOffsetX = clamp(director.cursorOffsetX, -520, 520);
  director.cursorOffsetY = clamp(director.cursorOffsetY, -280, 280);

  const target = getDirectorTarget(world);

  if (input.justPressed.a) {
    trySpawnEnemy(world, target.x, target.y);
  }

  if (input.justPressed.x) {
    tryPlaceRock(world, target.x, target.y);
  }

  if (input.justPressed.b) {
    tryPlaceHazard(world, target.x, target.y);
  }

  if (input.justPressed.y) {
    tryStartChallenge(world);
  }
}

function updateCamera(world, dt, viewport) {
  const halfViewWidth = clamp((viewport?.width ?? 1280) / 2, 320, world.map.width / 2);
  const halfViewHeight = clamp((viewport?.height ?? 720) / 2, 180, world.map.height / 2);

  world.camera.x = lerp(world.camera.x, world.hero.x, 1 - Math.exp(-dt * 7));
  world.camera.y = lerp(world.camera.y, world.hero.y, 1 - Math.exp(-dt * 7));
  world.camera.x = clamp(world.camera.x, halfViewWidth, world.map.width - halfViewWidth);
  world.camera.y = clamp(world.camera.y, halfViewHeight, world.map.height - halfViewHeight);
}

function tryDash(world) {
  const hero = world.hero;

  if (hero.dashCooldown > 0) {
    return;
  }

  if (hero.facingX === 0 && hero.facingY === 0) {
    return;
  }

  hero.dashCooldown = 2.2;
  hero.dashTimer = 0.18;
  world.camera.shake = 0.36;
  addAnnouncement(world, "Hero dashed.", "#71f79f");
}

function trySlash(world) {
  const hero = world.hero;

  if (hero.slashCooldown > 0) {
    return;
  }

  hero.slashCooldown = 0.42;

  for (const enemy of world.enemies) {
    const dx = enemy.x - hero.x;
    const dy = enemy.y - hero.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 150) {
      continue;
    }

    const enemyDirection = normalize(dx, dy);
    const facingDot = enemyDirection.x * hero.facingX + enemyDirection.y * hero.facingY;

    if (facingDot < 0.35) {
      continue;
    }

    damageEnemy(world, enemy, 16);
  }

  world.camera.shake = 0.24;
}

function tryBurst(world) {
  const hero = world.hero;

  if (hero.burstCooldown > 0) {
    return;
  }

  hero.burstCooldown = 5.5;

  for (const enemy of world.enemies) {
    const dx = enemy.x - hero.x;
    const dy = enemy.y - hero.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 190) {
      continue;
    }

    damageEnemy(world, enemy, 22);

    const push = normalize(dx, dy);
    moveUnit(world, enemy, push.x * 52, push.y * 52);
  }

  world.camera.shake = 0.42;
  addAnnouncement(world, "Pulse burst released.", "#8fd3ff");
}

function trySpawnEnemy(world, x, y) {
  const director = world.director;

  if (director.spawnEnemyCooldown > 0) {
    return;
  }

  if (!canPlaceAt(world, x, y, GOBLIN_RADIUS + 6)) {
    addAnnouncement(world, "Goblin spawn blocked.", "#ff9f43");
    return;
  }

  director.spawnEnemyCooldown = 1.4;
  world.enemies.push(createEnemy("goblin", x, y));
  addAnnouncement(world, "Director spawned a goblin.", "#ff6b6b");
}

function tryPlaceRock(world, x, y) {
  const director = world.director;

  if (director.spawnRockCooldown > 0) {
    return;
  }

  if (!canPlaceAt(world, x, y, 38)) {
    addAnnouncement(world, "Rock placement blocked.", "#ff9f43");
    return;
  }

  director.spawnRockCooldown = 2.8;
  world.obstacles.push({
    x,
    y,
    radius: 34,
  });

  if (world.obstacles.length > 18) {
    world.obstacles.shift();
  }

  addAnnouncement(world, "Director placed a rock.", "#ff6b6b");
}

function tryPlaceHazard(world, x, y) {
  const director = world.director;

  if (director.spawnHazardCooldown > 0) {
    return;
  }

  if (!canPlaceAt(world, x, y, 60)) {
    addAnnouncement(world, "Hazard placement blocked.", "#ff9f43");
    return;
  }

  director.spawnHazardCooldown = 4.4;
  world.hazards.push({
    x,
    y,
    radius: 72,
    life: 8,
    damage: 7,
    tickTimer: 0.1,
  });

  addAnnouncement(world, "Director dropped a hazard field.", "#ff6b6b");
}

function tryStartChallenge(world) {
  const director = world.director;

  if (director.challengeCooldown > 0) {
    return;
  }

  if (world.challenge.active) {
    addAnnouncement(world, "Challenge already active.", "#ff9f43");
    return;
  }

  director.challengeCooldown = 11;
  world.challenge.active = true;
  world.challenge.timeLeft = 12;
  world.challenge.remainingSpawns = 6;
  world.challenge.spawnTimer = 0.2;
  addAnnouncement(world, "Challenge wave started.", "#ffd166");
}

function canPlaceAt(world, x, y, radius) {
  if (distance(world.hero, { x, y }) < 160) {
    return false;
  }

  if (collidesWithWalls(world, x, y, radius)) {
    return false;
  }

  if (collidesWithObstacles(world, x, y, radius)) {
    return false;
  }

  for (const enemy of world.enemies) {
    if (!circleIntersectsCircle(x, y, radius, enemy.x, enemy.y, enemy.radius + 8)) {
      continue;
    }

    return false;
  }

  return true;
}

function spawnChallengeEnemy(world) {
  const ringDistance = 300;
  const baseAngle = world.rng() * Math.PI * 2;
  const enemyType = world.challenge.remainingSpawns % 3 === 0 ? "brute" : "goblin";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const angle = baseAngle + attempt * 0.6;
    const x = world.hero.x + Math.cos(angle) * ringDistance;
    const y = world.hero.y + Math.sin(angle) * ringDistance;
    const radius = enemyType === "brute" ? BRUTE_RADIUS : GOBLIN_RADIUS;

    if (!canPlaceAt(world, x, y, radius + 10)) {
      continue;
    }

    const enemy = createEnemy(enemyType, x, y);
    enemy.challengeSpawned = true;
    world.enemies.push(enemy);
    return;
  }
}

function damageHero(world, amount, source) {
  const hero = world.hero;

  if (hero.dashTimer > 0) {
    return;
  }

  if (hero.lastHitTimer > 0) {
    return;
  }

  hero.lastHitTimer = 0.3;
  hero.hurtFlash = 1;
  hero.health = Math.max(0, hero.health - amount);
  world.camera.shake = Math.max(world.camera.shake, 0.44);
  addAnnouncement(world, `${source} hit the hero for ${amount}.`, "#ff8f8f");
}

function healHero(world, amount) {
  world.hero.health = Math.min(world.hero.maxHealth, world.hero.health + amount);
}

function damageEnemy(world, enemy, amount) {
  enemy.health -= amount;
  enemy.hitFlash = 1;

  if (enemy.health > 0) {
    return;
  }

  world.score.kills += 1;
}

function moveUnit(world, unit, moveX, moveY) {
  if (moveX !== 0) {
    const nextX = unit.x + moveX;

    if (!collidesWithAnything(world, nextX, unit.y, unit.radius)) {
      unit.x = nextX;
    }
  }

  if (moveY !== 0) {
    const nextY = unit.y + moveY;

    if (!collidesWithAnything(world, unit.x, nextY, unit.radius)) {
      unit.y = nextY;
    }
  }
}

function collidesWithAnything(world, x, y, radius) {
  if (collidesWithWalls(world, x, y, radius)) {
    return true;
  }

  if (collidesWithObstacles(world, x, y, radius)) {
    return true;
  }

  return false;
}

function collidesWithWalls(world, x, y, radius) {
  const minTileX = Math.floor((x - radius) / TILE_SIZE) - 1;
  const maxTileX = Math.floor((x + radius) / TILE_SIZE) + 1;
  const minTileY = Math.floor((y - radius) / TILE_SIZE) - 1;
  const maxTileY = Math.floor((y + radius) / TILE_SIZE) + 1;

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      if (isFloorTile(world.map, tileX, tileY)) {
        continue;
      }

      const wallRect = {
        x: tileX * TILE_SIZE,
        y: tileY * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
      };

      if (circleIntersectsRect(x, y, radius, wallRect)) {
        return true;
      }
    }
  }

  return false;
}

function collidesWithObstacles(world, x, y, radius) {
  for (const obstacle of world.obstacles) {
    if (!circleIntersectsCircle(x, y, radius, obstacle.x, obstacle.y, obstacle.radius)) {
      continue;
    }

    return true;
  }

  return false;
}

function isFloorTile(map, x, y) {
  if (!isInsideMap(x, y)) {
    return false;
  }

  return map.tiles[y * map.columns + x] === 1;
}

function addAnnouncement(world, text, color = "#ffffff") {
  world.announcements.unshift({
    text,
    color,
    life: 2.6,
  });

  world.announcements = world.announcements.slice(0, 4);
}

function centerDirectorCursor(world) {
  world.director.cursorOffsetX = 160;
  world.director.cursorOffsetY = -40;
}

export function getDirectorTarget(world) {
  return {
    x: clamp(world.camera.x + world.director.cursorOffsetX, 0, world.map.width),
    y: clamp(world.camera.y + world.director.cursorOffsetY, 0, world.map.height),
  };
}

export function hasHeroFallen(world) {
  return world.hero.health <= 0;
}

export function getWorldSnapshot(world) {
  return {
    elapsed: world.elapsed,
    kills: world.score.kills,
    wavesCleared: world.score.wavesCleared,
    themeName: world.theme.name,
    seedLabel: world.seedLabel,
  };
}
