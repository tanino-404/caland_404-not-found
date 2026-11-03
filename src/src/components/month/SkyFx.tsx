import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  type BufferGeometry,
  CanvasTexture,
  Color,
  type InstancedMesh,
  type Material,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';
import { type Faller, unit } from './fallers';

/**
 * 達成した島の空に重ねる演出（黄金郷とマッチョの島で共用）：
 * ドット絵の板を降らせる PixelRain、瞬く星 Glints、右上の太陽のレンズフレア SunFlare。
 */

// ---------- 降るもの ----------

export interface RainItem {
  geometry: BufferGeometry;
  material: Material;
  fallers: Faller[];
  /** spin は硬貨のように回りながら、flutter は紙のようにひらひら */
  motion: 'spin' | 'flutter';
}

const RainLayer = ({ item }: { item: RainItem }) => {
  const mesh = useRef<InstancedMesh>(null);
  const o = useMemo(() => new Object3D(), []);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    item.fallers.forEach((f, i) => {
      if (item.motion === 'spin') {
        const k = (t * f.speed + f.phase) % 1;
        o.position.set(f.x + Math.sin(t * 0.6 + i) * 0.15, f.top - k * f.fall, f.z);
        o.rotation.set(0.35 + Math.sin(t * 0.9 + i) * 0.3, t * 2.2 + i, Math.sin(t * 0.7 + i) * 0.25);
      } else {
        const k = (t * f.speed * 0.8 + f.phase) % 1;
        o.position.set(f.x + Math.sin(t * 1.1 + i * 1.7) * 0.6, f.top - k * f.fall, f.z + Math.cos(t * 0.8 + i) * 0.3);
        o.rotation.set(-0.9 + Math.sin(t * 2.1 + i) * 0.6, t * 0.5 + i * 0.9, Math.sin(t * 1.4 + i * 0.7) * 0.5);
      }
      o.scale.setScalar(f.size);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[item.geometry, item.material, item.fallers.length]} frustumCulled={false} />;
};

/** ドット絵の板（pixelArtGeometry）を空から降らせる。種類ごとに InstancedMesh 1 つ */
export const PixelRain = ({ items }: { items: RainItem[] }) => (
  <group>
    {items.map((item, index) => (
      <RainLayer key={index} item={item} />
    ))}
  </group>
);

// ---------- きらめき（4 本光条の星） ----------

const paint = (size: number, draw: (ctx: CanvasRenderingContext2D, c: number) => void): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('SkyFx: 2D コンテキストが取れません');
  }
  draw(ctx, size / 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

const glow = (ctx: CanvasRenderingContext2D, c: number, radius: number, stops: [number, string][]) => {
  const g = ctx.createRadialGradient(c, c, 0, c, c, radius);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c * 2, c * 2);
};

/** 細い光条を 4 本（縦横は長く、斜めは短く） */
const spikes = (ctx: CanvasRenderingContext2D, c: number, long: number, short: number, color: string) => {
  ctx.globalCompositeOperation = 'lighter';
  const ray = (angle: number, length: number, width: number) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, length, 0);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -width);
    ctx.lineTo(length, 0);
    ctx.lineTo(0, width);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  for (let k = 0; k < 4; k++) {
    ray((k * Math.PI) / 2, long, c * 0.05);
    ray((k * Math.PI) / 2 + Math.PI / 4, short, c * 0.03);
  }
};

const GLINT_TEXTURE = paint(128, (ctx, c) => {
  glow(ctx, c, c * 0.45, [
    [0, 'rgba(255,255,255,1)'],
    [0.25, 'rgba(255,240,180,0.85)'],
    [1, 'rgba(255,210,90,0)'],
  ]);
  spikes(ctx, c, c, c * 0.45, 'rgba(255,252,230,1)');
});

const GLINT_MAT = new MeshBasicMaterial({
  map: GLINT_TEXTURE,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
  toneMapped: false,
});
const GLINT_PLANE = new PlaneGeometry(1, 1);
const GLINT_COUNT = 72;
const GLINT_TINTS = [new Color('#ffffff'), new Color('#fff2b0'), new Color('#ffd86a')];

/** 島のまわりで瞬く 4 本光条の星 */
export const Glints = () => {
  const mesh = useRef<InstancedMesh>(null);
  const o = useMemo(() => new Object3D(), []);
  const points = useMemo(
    () =>
      Array.from({ length: GLINT_COUNT }, (_, i) => ({
        x: (unit(i, 51) - 0.5) * 9,
        y: 0.6 + unit(i, 52) * 5.4,
        z: (unit(i, 53) - 0.5) * 7.5,
        size: 0.45 + unit(i, 54) * 0.9,
        rate: 0.6 + unit(i, 55) * 1.4,
        phase: unit(i, 56) * Math.PI * 2,
      })),
    [],
  );

  useFrame(({ clock, camera }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    if (m.instanceColor === null) {
      points.forEach((_, i) => m.setColorAt(i, GLINT_TINTS[i % GLINT_TINTS.length]));
    }
    points.forEach((p, i) => {
      const twinkle = Math.max(0, Math.sin(t * p.rate + p.phase));
      o.position.set(p.x, p.y, p.z);
      o.quaternion.copy(camera.quaternion);
      o.rotateZ(t * 0.2 + i);
      o.scale.setScalar(p.size * twinkle * twinkle);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[GLINT_PLANE, GLINT_MAT, GLINT_COUNT]} frustumCulled={false} />;
};

// ---------- レンズフレア ----------

const SUN_TEXTURE = paint(256, (ctx, c) => {
  glow(ctx, c, c, [
    [0, 'rgba(255,255,255,1)'],
    [0.12, 'rgba(255,250,220,0.95)'],
    [0.35, 'rgba(255,220,140,0.35)'],
    [1, 'rgba(255,200,100,0)'],
  ]);
  spikes(ctx, c, c, c * 0.55, 'rgba(255,250,225,0.95)');
});

const RING_TEXTURE = paint(128, (ctx, c) => {
  glow(ctx, c, c, [
    [0, 'rgba(255,255,255,0)'],
    [0.62, 'rgba(255,255,255,0.05)'],
    [0.8, 'rgba(255,255,255,0.5)'],
    [0.9, 'rgba(255,255,255,0.12)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
});

const DISC_TEXTURE = paint(128, (ctx, c) => {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    ctx[k === 0 ? 'moveTo' : 'lineTo'](c + Math.cos(a) * c * 0.9, c + Math.sin(a) * c * 0.9);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0.07)');
  ctx.fillStyle = g;
  ctx.fill();
});

/**
 * 右上の太陽から画面を横切る光の輪。地形や雲に隠れると消える（three の Lensflare の遮蔽判定）。
 * ライトに付けると全ての材質の計算が 1 灯ぶん重くなるので、ただの group に付ける。
 */
export const SunFlare = () => {
  const flare = useMemo(() => {
    const lens = new Lensflare();
    lens.addElement(new LensflareElement(SUN_TEXTURE, 540, 0, new Color('#fff8e6')));
    lens.addElement(new LensflareElement(RING_TEXTURE, 170, 0.18, new Color('#ffe08a')));
    lens.addElement(new LensflareElement(DISC_TEXTURE, 60, 0.32, new Color('#9ff0ff')));
    lens.addElement(new LensflareElement(DISC_TEXTURE, 110, 0.5, new Color('#ffd27a')));
    lens.addElement(new LensflareElement(RING_TEXTURE, 240, 0.68, new Color('#b8ffe0')));
    lens.addElement(new LensflareElement(DISC_TEXTURE, 80, 0.86, new Color('#ffb8f0')));
    lens.addElement(new LensflareElement(DISC_TEXTURE, 150, 1.05, new Color('#a8d8ff')));
    return lens;
  }, []);
  return (
    <group position={[4.9, 8.3, -1.4]}>
      <primitive object={flare} />
    </group>
  );
};

