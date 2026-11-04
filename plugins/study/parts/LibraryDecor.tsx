import { Clouds, type IslandDecorProps } from '@plugin-sdk';
import { LibraryGrounds, LibraryScene } from './LibraryScene';

export const LibraryDecor = ({ rows, dayView }: IslandDecorProps) => (
  <>
    <Clouds />
    <LibraryGrounds rows={rows} />
    {dayView ? null : <LibraryScene rows={rows} />}
  </>
);
