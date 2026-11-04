import { Clouds, type IslandDecorProps } from '@plugin-sdk';
import { FishingGrounds, FishingLandmark, FishingVillage } from './FishingScene';

export const FishingDecor = ({ rows, dayView, tallest }: IslandDecorProps) => (
  <>
    <Clouds />
    <FishingGrounds rows={rows} />
    {dayView ? null : <FishingVillage rows={rows} />}
    {tallest !== null && !dayView ? <FishingLandmark x={tallest.x} z={tallest.z} top={tallest.top} /> : null}
  </>
);
