import { Clouds, type IslandDecorProps } from '@plugin-sdk';
import { MuscleFx } from './MuscleFx';
import { MuscleScene } from './MuscleScene';
import { MuscleSea } from './MuscleSea';

export const MuscleDecor = ({ rows, dayView }: IslandDecorProps) => (
  <>
    <Clouds />
    <MuscleFx active flare />
    <MuscleSea rows={rows} />
    {dayView ? null : <MuscleScene rows={rows} />}
  </>
);
