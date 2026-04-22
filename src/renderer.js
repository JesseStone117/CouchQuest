import { getDirectorTarget } from "./world.js";
import { clamp, formatSeconds } from "./utils.js";

const HERO_COLOR = "#71f79f";
const HERO_HURT_COLOR = "#ffd4d4";
const GOBLIN_COLOR = "#ff8b7b";
const BRUTE_COLOR = "#ff5252";
const ROCK_COLOR = "#8e8b7b";

export function resizeCanvas(canvas) {
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * pixelRatio);
  const height = Math.floor(canvas.clientHeight * pixelRatio);

  if (canvas.width === width && canvas.height === height) {
    return;
  }

  canvas.width = width;
  canvas.height = height;
}

export function renderScene(ctx, canvas, world, phase, controllerSnapshot, summaryText) {
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

  const viewWidth = canvas.clientWidth;
  const viewHeight = canvas.clientHeight;

  paintBackdrop(ctx, viewWidth, viewHeight, world.theme);
  paintWorld(ctx, viewWidth, viewHeight, world);

  if (phase === "playing") {
    paintHud(ctx, viewWidth, viewHeight, world, controllerSnapshot);
  } else {
    paintPreviewBadge(ctx, viewWidth, viewHeight, world, summaryText);
  }

  ctx.restore();
}

function paintBackdrop(ctx, width, height, theme) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, theme.background);
  gradient.addColorStop(1, shadeColor(theme.background, -18));

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function paintWorld(ctx, width, height, world) {
  const shakeAmount = world.camera.shake * 12;
  const shakeX = Math.cos(world.elapsed * 42) * shakeAmount;
  const shakeY = Math.sin(world.elapsed * 34) * shakeAmount;

  ctx.save();
  ctx.translate(width / 2 - world.camera.x + shakeX, height / 2 - world.camera.y + shakeY);

  drawMap(ctx, world);
  drawHazards(ctx, world);
  drawObstacles(ctx, world);
  drawEnemies(ctx, world);
  drawHero(ctx, world.hero);
  drawDirectorCursor(ctx, world);

  ctx.restore();
}

function drawMap(ctx, world) {
  const { map, theme } = world;

  ctx.fillStyle = shadeColor(theme.background, -8);
  ctx.fillRect(0, 0, map.width, map.height);

  for (let y = 0; y < map.rows; y += 1) {
    for (let x = 0; x < map.columns; x += 1) {
      const tile = map.tiles[y * map.columns + x];
      const drawX = x * map.tileSize;
      const drawY = y * map.tileSize;

      if (tile === 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? theme.floorA : theme.floorB;
        ctx.fillRect(drawX, drawY, map.tileSize, map.tileSize);

        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        ctx.fillRect(drawX + 10, drawY + 10, map.tileSize - 20, map.tileSize - 20);
        continue;
      }

      if (!hasNearbyFloor(map, x, y)) {
        continue;
      }

      ctx.fillStyle = theme.wall;
      ctx.fillRect(drawX, drawY, map.tileSize, map.tileSize);

      ctx.strokeStyle = theme.wallEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX + 2, drawY + 2, map.tileSize - 4, map.tileSize - 4);
    }
  }
}

function hasNearbyFloor(map, x, y) {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const nextX = x + offsetX;
      const nextY = y + offsetY;

      if (nextX < 0 || nextX >= map.columns || nextY < 0 || nextY >= map.rows) {
        continue;
      }

      if (map.tiles[nextY * map.columns + nextX] === 1) {
        return true;
      }
    }
  }

  return false;
}

function drawHazards(ctx, world) {
  for (const hazard of world.hazards) {
    const pulse = 0.84 + Math.sin(world.elapsed * 6 + hazard.x * 0.01) * 0.08;

    ctx.beginPath();
    ctx.arc(hazard.x, hazard.y, hazard.radius * pulse, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 107, 107, 0.18)";
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255, 107, 107, 0.65)";
    ctx.stroke();
  }
}

function drawObstacles(ctx, world) {
  for (const obstacle of world.obstacles) {
    ctx.beginPath();
    ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
    ctx.fillStyle = ROCK_COLOR;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(obstacle.x - 8, obstacle.y - 10, obstacle.radius * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fill();
  }
}

function drawEnemies(ctx, world) {
  for (const enemy of world.enemies) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fillStyle = enemy.type === "brute" ? BRUTE_COLOR : GOBLIN_COLOR;

    if (enemy.hitFlash > 0) {
      ctx.fillStyle = "#fff2e8";
    }

    ctx.fill();

    const barWidth = enemy.radius * 2;
    const healthRatio = clamp(enemy.health / enemy.maxHealth, 0, 1);

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 16, barWidth, 5);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 16, barWidth * healthRatio, 5);
  }
}

function drawHero(ctx, hero) {
  ctx.beginPath();
  ctx.arc(hero.x, hero.y, hero.radius, 0, Math.PI * 2);
  ctx.fillStyle = hero.hurtFlash > 0 ? HERO_HURT_COLOR : HERO_COLOR;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(hero.x, hero.y);
  ctx.lineTo(hero.x + hero.facingX * 28, hero.y + hero.facingY * 28);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#f4f7e5";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(hero.x, hero.y, hero.radius + 8, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(113, 247, 159, 0.38)";
  ctx.stroke();
}

function drawDirectorCursor(ctx, world) {
  const target = getDirectorTarget(world);
  const scale = 0.92 + Math.sin(world.elapsed * 7) * 0.08;

  ctx.beginPath();
  ctx.arc(target.x, target.y, 28 * scale, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ff6b6b";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(target.x - 16, target.y);
  ctx.lineTo(target.x + 16, target.y);
  ctx.moveTo(target.x, target.y - 16);
  ctx.lineTo(target.x, target.y + 16);
  ctx.stroke();
}

function paintHud(ctx, width, height, world, controllerSnapshot) {
  const heroPadLabel = controllerSnapshot.hero?.label ?? "Waiting for controller";
  const directorPadLabel = controllerSnapshot.director?.label ?? "Waiting for controller";

  paintTopBar(ctx, width, world);
  paintCooldownCard(ctx, 24, height - 172, "Hero", [
    cooldownLabel("Dash", world.hero.dashCooldown),
    cooldownLabel("Slash", world.hero.slashCooldown),
    cooldownLabel("Burst", world.hero.burstCooldown),
    `Pad: ${heroPadLabel}`,
  ], "#71f79f");

  paintCooldownCard(ctx, width - 280, height - 172, "Director", [
    cooldownLabel("Goblin", world.director.spawnEnemyCooldown),
    cooldownLabel("Rock", world.director.spawnRockCooldown),
    cooldownLabel("Hazard", world.director.spawnHazardCooldown),
    cooldownLabel("Challenge", world.director.challengeCooldown),
    `Pad: ${directorPadLabel}`,
  ], "#ff6b6b");

  paintAnnouncements(ctx, width, height, world);
}

function paintTopBar(ctx, width, world) {
  ctx.fillStyle = "rgba(8, 20, 31, 0.72)";
  ctx.fillRect(24, 24, width - 48, 88);

  ctx.fillStyle = "#f4f7e5";
  ctx.font = "700 20px Trebuchet MS";
  ctx.fillText(`CouchQuest  |  ${world.theme.name}`, 42, 56);

  ctx.font = "600 14px Trebuchet MS";
  ctx.fillStyle = "#c0d4d8";
  ctx.fillText(`Seed ${world.seedLabel}  |  Time ${formatSeconds(world.elapsed)}  |  Kills ${world.score.kills}`, 42, 80);

  const hpRatio = clamp(world.hero.health / world.hero.maxHealth, 0, 1);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(42, 92, 260, 10);
  ctx.fillStyle = hpRatio > 0.35 ? "#71f79f" : "#ff8f8f";
  ctx.fillRect(42, 92, 260 * hpRatio, 10);

  if (!world.challenge.active) {
    return;
  }

  ctx.fillStyle = "#ffd166";
  ctx.fillText(
    `Challenge live  |  ${world.challenge.timeLeft.toFixed(1)}s  |  ${world.challenge.enemiesAlive} active`,
    width - 360,
    80,
  );
}

function paintCooldownCard(ctx, x, y, title, lines, accentColor) {
  ctx.fillStyle = "rgba(8, 20, 31, 0.76)";
  ctx.fillRect(x, y, 256, 170);

  ctx.fillStyle = accentColor;
  ctx.font = "700 18px Trebuchet MS";
  ctx.fillText(title, x + 18, y + 28);

  ctx.font = "600 14px Trebuchet MS";
  ctx.fillStyle = "#f4f7e5";

  let lineY = y + 58;
  for (const line of lines) {
    ctx.fillText(line, x + 18, lineY);
    lineY += 24;
  }
}

function paintAnnouncements(ctx, width, height, world) {
  let offsetY = height - 232;

  for (const entry of world.announcements) {
    const alpha = clamp(entry.life / 2.6, 0, 1);

    ctx.fillStyle = `rgba(8, 20, 31, ${0.75 * alpha})`;
    ctx.fillRect(width / 2 - 220, offsetY, 440, 34);

    ctx.fillStyle = applyAlpha(entry.color, alpha);
    ctx.font = "700 14px Trebuchet MS";
    ctx.fillText(entry.text, width / 2 - 200, offsetY + 22);

    offsetY -= 42;
  }
}

function paintPreviewBadge(ctx, width, height, world, summaryText) {
  ctx.fillStyle = "rgba(8, 20, 31, 0.72)";
  ctx.fillRect(width - 360, 24, 336, 112);

  ctx.fillStyle = "#ffd166";
  ctx.font = "700 18px Trebuchet MS";
  ctx.fillText("Map Preview", width - 336, 56);

  ctx.fillStyle = "#f4f7e5";
  ctx.font = "600 14px Trebuchet MS";
  ctx.fillText(`${world.theme.name}  |  Seed ${world.seedLabel}`, width - 336, 80);

  if (!summaryText) {
    return;
  }

  ctx.fillStyle = "#c0d4d8";
  ctx.fillText(summaryText, width - 336, 102);
}

function cooldownLabel(label, timeLeft) {
  if (timeLeft <= 0) {
    return `${label}: ready`;
  }

  return `${label}: ${timeLeft.toFixed(1)}s`;
}

function shadeColor(color, amount) {
  const value = color.replace("#", "");
  const red = clamp(parseInt(value.slice(0, 2), 16) + amount, 0, 255);
  const green = clamp(parseInt(value.slice(2, 4), 16) + amount, 0, 255);
  const blue = clamp(parseInt(value.slice(4, 6), 16) + amount, 0, 255);

  return `rgb(${red}, ${green}, ${blue})`;
}

function applyAlpha(color, alpha) {
  if (!color.startsWith("#")) {
    return color;
  }

  const value = color.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
