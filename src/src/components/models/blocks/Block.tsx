import { BLOCK_HEIGHT } from '../../../lib/camera';
import type { BlockKind } from './blockKinds';
import { BLOCK_GEOMETRY, BLOCK_MATERIALS } from './blockMaterials';

export interface BlockProps {
  level: number;
  kind: BlockKind;
}

export const Block = ({ level, kind }: BlockProps) => (
  <mesh
    geometry={BLOCK_GEOMETRY}
    material={BLOCK_MATERIALS[kind]}
    position={[0, BLOCK_HEIGHT / 2 + BLOCK_HEIGHT * level, 0]}
  />
);
