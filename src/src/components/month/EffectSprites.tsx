import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  type InstancedMesh,
  type Material,
  Euler,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { WATER_TOP_Y } from '../../lib/camera';
import type { EffectSprite, SpriteZone, VoxelModel } from '../../types/plugins';
import { UNIT_BOX, materialFor } from '../models/materials';

/** 屋上に置くときの塔の頂上（ワールド座標） */
export interface RooftopSpot {
  x: number;
  y: number;
  z: number;
}

interface VoxelGroup {
  color: string;
  /** ボクセル単位のオフセット（底面中央が原点） */
  offsets: Matrix4[];
}

interface ModelMesh {
  groups: VoxelGroup[];
  /** 底面の幅（ボクセル数）。岸に置く砂の島の大きさに使う */
  footprint: number;
}

const glowMaterials = new Map<string, MeshBasicMaterial>();

const glowFor = (color: string): MeshBasicMaterial => {
  const cached = glowMaterials.get(color);
  if (cached !== undefined) return cached;
  const material = new MeshBasicMaterial({ color, toneMapped: false });
  glowMaterials.set(color, material);
  return material;
};

const SAND = '#f2d59a';

const buildModel = (model: VoxelModel): ModelMesh => {
  const height = model.layers.length;
  const depth = Math.max(...model.layers.map((layer) => layer.length));
  const width = Math.max(...model.layers.flatMap((layer) => layer.map((row) => row.length)));
  const byColor = new Map<string, Matrix4[]>();
  model.layers.forEach((layer, y) => {
    layer.forEach((row, z) => {
      [...row].forEach((char, x) => {
        if (char === '.') return;
        const color = model.palette[char];
        if (color === undefined) {
          throw new Error(`EffectSprites: palette に無い文字です: ${char}`);
        }
        const offset = new Matrix4().makeTranslation(x - (width - 1) / 2, y + 0.5, z - (depth - 1) / 2);
        const list = byColor.get(color) ?? [];
        list.push(offset);
        byColor.set(color, list);
      });
    });
  });
  if (height === 0 || byColor.size === 0) {
    throw new Error('EffectSprites: ボクセルが無い絵です');
  }
  return {
    groups: [...byColor.entries()].map(([color, offsets]) => ({ color, offsets })),
    footprint: Math.max(width, depth),
  };
};

/** 何個目かから決まる 0〜1 の値（毎フレーム同じ） */
const unit = (i: number, salt: number): number => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

interface Placement {
  position: Vector3;
  rotation: Euler;
  scale: number;
}

const placement = (
  sprite: EffectSprite,
  i: number,
  t: number,
  rows: number,
  rooftops: RooftopSpot[],
  out: Placement,
): void => {
  const speed = sprite.speed ?? 1;
  const phase = i * 2.399 + unit(i, 1) * 0.6;
  const yaw = unit(i, 2) * Math.PI * 2;
  out.scale = sprite.size;
  out.rotation.set(0, yaw, 0);

  const zone: SpriteZone = sprite.zone;
  let x = 0;
  let y = 0;
  let z = 0;
  let rx = 0;
  let rz = 0;
  if (zone === 'sea') {
    rx = 5 + (i % 3) * 0.9 + unit(i, 3) * 0.8;
    rz = rows * 0.5 + 1.4 + (i % 3) * 0.7 + unit(i, 4) * 0.6;
    y = WATER_TOP_Y - sprite.size * 0.6;
    x = Math.cos(phase) * rx;
    z = Math.sin(phase) * rz;
  } else if (zone === 'sky') {
    rx = 2 + unit(i, 3) * 3.6;
    rz = rx * 0.8;
    y = 3.4 + unit(i, 4) * 2.4;
    x = Math.cos(phase) * rx;
    z = Math.sin(phase) * rz;
  } else if (zone === 'shore') {
    const angle = (i / sprite.count) * Math.PI * 2 + 0.5;
    x = Math.cos(angle) * 4.9;
    z = Math.sin(angle) * (rows * 0.5 + 1.3);
    y = WATER_TOP_Y + 0.12;
    out.rotation.set(0, 0, 0);
  } else {
    if (rooftops.length === 0) {
      out.scale = 0;
      out.position.set(0, -10, 0);
      return;
    }
    const spot = rooftops[(i * 7) % rooftops.length];
    const corner = i % 4;
    x = spot.x + (corner % 2 === 0 ? -0.36 : 0.36);
    z = spot.z + (corner < 2 ? -0.36 : 0.36);
    y = spot.y;
  }

  if (sprite.motion === 'orbit') {
    const angle = phase + t * speed * 0.25;
    const ox = rx === 0 ? 0.6 : rx;
    const oz = rz === 0 ? 0.6 : rz;
    x = zone === 'sea' || zone === 'sky' ? Math.cos(angle) * ox : x + Math.cos(angle) * ox;
    z = zone === 'sea' || zone === 'sky' ? Math.sin(angle) * oz : z + Math.sin(angle) * oz;
    y += Math.sin(t * 2 + phase) * 0.04;
    out.rotation.set(0, Math.atan2(-Math.cos(angle) * oz, -Math.sin(angle) * ox), 0);
  } else if (sprite.motion === 'jump') {
    const cycle = (t * speed * 0.35 + unit(i, 5)) % 1;
    if (cycle > 0.4) {
      out.scale = 0;
    } else {
      const u = cycle / 0.4;
      y = WATER_TOP_Y + Math.sin(u * Math.PI) * 1.1 - sprite.size;
      out.rotation.set(0, yaw, (0.5 - u) * 1.8);
    }
  } else if (sprite.motion === 'bob') {
    y += Math.sin(t * speed * 1.5 + phase) * 0.05;
  } else if (sprite.motion === 'hop') {
    y += Math.abs(Math.sin(t * speed * 3 + phase)) * 0.12;
  } else {
    out.rotation.set(0, out.rotation.y, Math.sin(t * speed * 2 + phase) * 0.35);
  }
  out.position.set(x, y, z);
};

interface SpriteLayerProps {
  sprite: EffectSprite;
  rows: number;
  rooftops: RooftopSpot[];
}

const SpriteLayer = ({ sprite, rows, rooftops }: SpriteLayerProps) => {
  const mesh = useMemo(() => buildModel(sprite.model), [sprite.model]);
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  const islets = useRef<InstancedMesh>(null);
  const scratch = useMemo(
    () => ({
      place: { position: new Vector3(), rotation: new Euler(), scale: 1 } as Placement,
      root: new Matrix4(),
      composed: new Matrix4(),
      quat: new Quaternion(),
      scale: new Vector3(),
      islet: new Matrix4(),
    }),
    [],
  );
  const materials: Material[] = useMemo(
    () => mesh.groups.map((group) => (sprite.model.glow === true ? glowFor(group.color) : materialFor(group.color))),
    [mesh, sprite.model.glow],
  );
  const shore = sprite.zone === 'shore';

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { place, root, composed, quat, scale, islet } = scratch;
    for (let i = 0; i < sprite.count; i++) {
      placement(sprite, i, t, rows, rooftops, place);
      quat.setFromEuler(place.rotation);
      scale.setScalar(place.scale);
      root.compose(place.position, quat, scale);
      mesh.groups.forEach((group, g) => {
        const target = meshes.current[g];
        if (!target) return;
        group.offsets.forEach((offset, v) => {
          composed.multiplyMatrices(root, offset);
          target.setMatrixAt(i * group.offsets.length + v, composed);
        });
      });
      if (shore && islets.current) {
        const size = mesh.footprint * sprite.size + 0.35;
        islet.makeScale(size, 0.24, size * 0.8);
        islet.setPosition(place.position.x, WATER_TOP_Y, place.position.z);
        islets.current.setMatrixAt(i, islet);
      }
    }
    for (const target of meshes.current) {
      if (target) target.instanceMatrix.needsUpdate = true;
    }
    if (islets.current) islets.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {mesh.groups.map((group, g) => (
        <instancedMesh
          key={group.color}
          ref={(el) => {
            meshes.current[g] = el;
          }}
          args={[UNIT_BOX, materials[g], sprite.count * group.offsets.length]}
          frustumCulled={false}
        />
      ))}
      {shore ? (
        <instancedMesh ref={islets} args={[UNIT_BOX, materialFor(SAND), sprite.count]} frustumCulled={false} />
      ) : null}
    </group>
  );
};

export interface EffectSpritesProps {
  sprites: EffectSprite[];
  rows: number;
  rooftops: RooftopSpot[];
}

/** plugin.json の effects[].scene.sprites を島に重ねる */
export const EffectSprites = ({ sprites, rows, rooftops }: EffectSpritesProps) => (
  <group>
    {sprites.map((sprite, index) => (
      <SpriteLayer key={index} sprite={sprite} rows={rows} rooftops={rooftops} />
    ))}
  </group>
);
