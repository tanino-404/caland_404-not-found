import { useMemo } from 'react';
import { BoxGeometry, MeshStandardMaterial } from 'three';
import { BLOCK_HEIGHT, TOWER_WIDTH } from '../../../lib/camera';
import { useSeason } from '../../month/SeasonContext';
import { BLOCK_COLORS, type BlockKind } from './blockKinds';

const BLOCK_GEOMETRY = new BoxGeometry(TOWER_WIDTH, BLOCK_HEIGHT, TOWER_WIDTH);

const standard = (color: string): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });

const sixFaces = (side: string, top: string, bottom: string): MeshStandardMaterial[] => {
  const s = standard(side);
  return [s, s, standard(top), standard(bottom), s, s];
};

export interface BlockProps {
  level: number;
  kind: BlockKind;
  /** 天面だけ差し替える。側面の標高色はそのまま */
  topColor?: string;
}

export const Block = ({ level, kind, topColor }: BlockProps) => {
  const season = useSeason();

  const material = useMemo((): MeshStandardMaterial | MeshStandardMaterial[] => {
    switch (kind) {
      case 'grass':
        return sixFaces(BLOCK_COLORS.dirt, topColor ?? season.grassTop, BLOCK_COLORS.dirtDark);
      case 'shore':
        return sixFaces(season.sand, topColor ?? season.grassTop, BLOCK_COLORS.sandDark);
      case 'dirt':
        return topColor
          ? sixFaces(BLOCK_COLORS.dirt, topColor, BLOCK_COLORS.dirtDark)
          : standard(BLOCK_COLORS.dirt);
      case 'stone':
        return sixFaces(BLOCK_COLORS.stoneDark, topColor ?? BLOCK_COLORS.stone, BLOCK_COLORS.stoneDark);
      case 'snow':
        return sixFaces(BLOCK_COLORS.snowSide, topColor ?? BLOCK_COLORS.snow, BLOCK_COLORS.snowSide);
      default:
        return standard(BLOCK_COLORS.dirt);
    }
  }, [kind, topColor, season.grassTop, season.sand]);

  return (
    <mesh
      geometry={BLOCK_GEOMETRY}
      material={material}
      position={[0, BLOCK_HEIGHT / 2 + BLOCK_HEIGHT * level, 0]}
    />
  );
};
