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
