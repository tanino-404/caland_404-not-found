import { BLOCK_HEIGHT } from '../../../lib/camera';
import type { BlockMaterial } from '../../../types/island';
import { BLOCK_GEOMETRY } from './blockMaterials';

export interface BlockProps {
  level: number;
  material: BlockMaterial;
}

export const Block = ({ level, material }: BlockProps) => (
  <mesh geometry={BLOCK_GEOMETRY} material={material} position={[0, BLOCK_HEIGHT / 2 + BLOCK_HEIGHT * level, 0]} />
);
