export function clamp(value, min, max) {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

export function length(x, y) {
  return Math.hypot(x, y);
}

export function normalize(x, y) {
  const size = length(x, y);

  if (size === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / size,
    y: y / size,
  };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createRng(seed) {
  let value = seed >>> 0;

  return function nextRandom() {
    value += 0x6d2b79f5;

    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);

    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(rng, min, max) {
  return min + (max - min) * rng();
}

export function randomInt(rng, min, max) {
  return Math.floor(randomRange(rng, min, max + 1));
}

export function choose(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

export function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function circleIntersectsRect(circleX, circleY, radius, rect) {
  const nearestX = clamp(circleX, rect.x, rect.x + rect.width);
  const nearestY = clamp(circleY, rect.y, rect.y + rect.height);
  const dx = circleX - nearestX;
  const dy = circleY - nearestY;

  return dx * dx + dy * dy < radius * radius;
}

export function circleIntersectsCircle(aX, aY, aRadius, bX, bY, bRadius) {
  const dx = aX - bX;
  const dy = aY - bY;
  const radiusSum = aRadius + bRadius;

  return dx * dx + dy * dy < radiusSum * radiusSum;
}
