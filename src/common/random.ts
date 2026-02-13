export function random(num: number): number {
  return Math.floor(Math.random() * num);
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function bound(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function coinFlip(): boolean {
  return Math.random() < 0.5;
}

export function truncGauss(mean: number, sd: number, min?: number, max?: number): number {
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  let result = z * sd + mean;

  if (min !== undefined) {
    result = Math.max(result, min);
  }
  if (max !== undefined) {
    result = Math.min(result, max);
  }

  return Math.round(result);
}

export function sample<T>(array: T[], num?: number): T[] {
  if (!num || num >= array.length) {
    return [...array];
  }
  const shuffled = shuffle(array);
  return shuffled.slice(0, num);
}

export function choice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function merge<T extends object>(target: T, source: Partial<T>): T {
  return { ...target, ...source };
}
