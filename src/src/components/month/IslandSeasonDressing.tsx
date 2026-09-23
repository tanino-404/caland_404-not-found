import type { SeasonEffect } from '../../lib/season';
import { Voxel } from '../models/Voxel';

/** 屋上スロット（ピッチ 0.31）に収まる幅。隣の建物（半幅 0.13 + jitter 0.03）に届かない */
const CANOPY = 0.22;

const Trunk = ({ h }: { h: number }) => (
  <Voxel x={0} y={0} z={0} w={0.06} h={h} d={0.06} color="#6b4a2b" />
);

/** 空いている屋上スロットに置く木。塔の天面を覆う板にはしない */
export const SeasonTree = ({ effect }: { effect: SeasonEffect }) => {
  if (effect === 'sakura') {
    return (
      <group>
        <Trunk h={0.28} />
        <Voxel x={0} y={0.26} z={0} w={CANOPY} h={0.14} d={CANOPY} color="#ff78a8" />
        <Voxel x={0.04} y={0.34} z={0.03} w={0.12} h={0.1} d={0.12} color="#ffd0e4" />
      </group>
    );
  }

  if (effect === 'autumn') {
    return (
      <group>
        <Trunk h={0.26} />
        <Voxel x={0} y={0.24} z={0} w={0.16} h={0.1} d={0.16} color="#3a7828" />
        <Voxel x={0} y={0.3} z={0} w={CANOPY} h={0.14} d={CANOPY} color="#c02818" />
        <Voxel x={0.05} y={0.36} z={0.04} w={0.12} h={0.1} d={0.12} color="#e87810" />
      </group>
    );
  }

  if (effect === 'snow') {
    return (
      <group>
        <Trunk h={0.24} />
        <Voxel x={0} y={0.22} z={0} w={0.16} h={0.1} d={0.16} color="#2f6a28" />
        <Voxel x={0} y={0.28} z={0} w={CANOPY} h={0.14} d={CANOPY} color="#f4f8ff" />
        <Voxel x={0.04} y={0.36} z={0.02} w={0.12} h={0.08} d={0.12} color="#e7f1fb" />
      </group>
    );
  }

  if (effect === 'rain') {
    return (
      <group>
        <Trunk h={0.26} />
        <Voxel x={0} y={0.24} z={0} w={CANOPY} h={0.16} d={CANOPY} color="#2f6a32" />
        <Voxel x={0.04} y={0.32} z={0.03} w={0.12} h={0.1} d={0.12} color="#3f7a38" />
      </group>
    );
  }

  const leaf = effect === 'fresh' ? '#8ee060' : '#3fa028';
  return (
    <group>
      <Trunk h={0.26} />
      <Voxel x={0} y={0.24} z={0} w={CANOPY} h={0.16} d={CANOPY} color={leaf} />
      <Voxel x={0.04} y={0.34} z={0.03} w={0.12} h={0.1} d={0.12} color="#c8f0a0" />
    </group>
  );
};
