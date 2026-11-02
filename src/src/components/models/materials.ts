import { BoxGeometry, MeshStandardMaterial } from 'three';

export const UNIT_BOX = new BoxGeometry(1, 1, 1);

const materialCache = new Map<string, MeshStandardMaterial>();

/** 同じ色の MeshStandardMaterial をアプリ全体で 1 つに共有する */
export const materialFor = (color: string): MeshStandardMaterial => {
  const cached = materialCache.get(color);
  if (cached) {
    return cached;
  }
  const material = new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  materialCache.set(color, material);
  return material;
};

/** 黄金郷の金・宝石用。色と金属感の組でキャッシュする */
export const materialForMetal = (
  color: string,
  metalness: number,
  roughness: number,
): MeshStandardMaterial => {
  const key = `${color}|${metalness}|${roughness}`;
  const cached = materialCache.get(key);
  if (cached) {
    return cached;
  }
  const material = new MeshStandardMaterial({ color, metalness, roughness });
  materialCache.set(key, material);
  return material;
};
