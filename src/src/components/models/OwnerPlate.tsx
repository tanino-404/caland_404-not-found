import { ownerColors } from '../../lib/members';
import { Voxel } from './Voxel';

/** 台座の厚み。薄い板にして立体感を抑える（元は 0.05、その 1/3） */
export const PLATE_HEIGHT = 0.05 / 3;
const PLATE_WIDTH = 0.285;

export interface OwnerPlateProps {
  owners: string[];
  members: string[];
  /** 台座の底面中心 */
  position: [number, number, number];
}

/**
 * 建物の足元に置く「縁取り」の台座。所有者の色で塗る。
 * 2 人以上で共有する予定は、人数ぶんの縦縞に分割して全員の色を見せる。
 */
export const OwnerPlate = ({ owners, members, position }: OwnerPlateProps) => {
  const colors = ownerColors(members, owners);
  const stripe = PLATE_WIDTH / colors.length;
  return (
    <group position={position}>
      {colors.map((color, i) => (
        <Voxel
          key={`${owners[i]}-${i}`}
          x={-PLATE_WIDTH / 2 + stripe * (i + 0.5)}
          y={0}
          z={0}
          w={stripe}
          h={PLATE_HEIGHT}
          d={PLATE_WIDTH}
          color={color}
        />
      ))}
    </group>
  );
};
