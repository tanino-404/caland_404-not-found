import { Car } from '../models/luxury/Car';
import { Fountain } from '../models/luxury/Fountain';
import { GoldVoxel } from '../models/luxury/GoldVoxel';
import { Palm } from '../models/luxury/Palm';
import { Pool } from '../models/luxury/Pool';
import { Voxel } from '../models/Voxel';

export interface LuxuryRooftopProps {
  dateKey: string;
  count: number;
  y: number;
}

const seedFromDateKey = (dateKey: string): number => {
  let sum = 0;
  for (let i = 0; i < dateKey.length; i += 1) sum += dateKey.charCodeAt(i);
  return sum;
};

/**
 * 黄金郷の屋上。ヤシ、プール、金の車、噴水、金塊。$ とヘリはいちばん高い塔だけ（LuxuryLandmark）。
 * 手前（+z）の下半分は日付ラベルを隠さない。
 */
export const LuxuryRooftop = ({ dateKey, count, y }: LuxuryRooftopProps) => {
  const seed = seedFromDateKey(dateKey);
  const yaw = ((seed % 8) * Math.PI) / 4;

  return (
    <group position={[0, y, 0]}>
      <GoldVoxel x={0} y={0} z={-0.48} w={0.98} h={0.06} d={0.05} color="#ffe56a" />
      <GoldVoxel x={-0.48} y={0} z={-0.1} w={0.05} h={0.06} d={0.8} color="#f0c43a" />
      <GoldVoxel x={0.48} y={0} z={-0.1} w={0.05} h={0.06} d={0.8} color="#f0c43a" />

      <Palm position={[0.36, 0.02, 0.3]} />
      <Palm position={[-0.36, 0.02, -0.32]} />
      {count >= 2 ? <Palm position={[0.34, 0.02, -0.28]} /> : null}
      {count >= 2 ? <Pool position={[0.02, 0.02, -0.22]} /> : null}
      <Car position={[-0.22, 0.02, 0.26]} yaw={yaw} />
      {count >= 3 ? <Fountain position={[0.28, 0.02, 0.02]} /> : null}
      {count >= 4 ? (
        <group position={[-0.3, 0.02, -0.02]}>
          <GoldVoxel x={0} y={0} z={0} w={0.14} h={0.06} d={0.08} color="#ffe56a" />
          <GoldVoxel x={0.02} y={0.06} z={0.02} w={0.12} h={0.05} d={0.07} color="#fff1a8" />
          <GoldVoxel x={-0.02} y={0.11} z={-0.01} w={0.1} h={0.04} d={0.06} color="#ffd24a" />
        </group>
      ) : null}
      {count >= 3 ? <Voxel x={0} y={0.02} z={0.08} w={0.08} h={0.012} d={0.28} color="#e23d4f" /> : null}
    </group>
  );
};
