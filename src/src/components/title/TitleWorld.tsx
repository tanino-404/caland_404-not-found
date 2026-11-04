import { useMemo } from 'react';
import { TITLE_MONTH, TITLE_OWNER, TITLE_YEAR, titleEvents } from '../../data/titleIsland';
import { buildMonthGrid, groupEventsByDate } from '../../lib/calendar';
import type { CalendarEvent } from '../../types/calendar';
import { DayTower } from '../month/DayTower';
import { WeekdayHeader } from '../month/WeekdayHeader';

const TITLE_MEMBERS = [TITLE_OWNER];
const NO_EVENTS: CalendarEvent[] = [];

export interface TitleWorldProps {
  visible: boolean;
}

/**
 * ログアウト中に見せる飾りの島。親の Canvas の子として原点に置く（月の島と同じ場所。同時には表示しない）。
 * 塔はホバーもクリックもできない。海は親の Canvas にある。
 */
export const TitleWorld = ({ visible }: TitleWorldProps) => {
  const grid = useMemo(() => buildMonthGrid(TITLE_YEAR, TITLE_MONTH), []);
  const byDate = useMemo(() => groupEventsByDate(titleEvents), []);

  return (
    <group visible={visible}>
      <WeekdayHeader rows={grid.rows} />
      {grid.cells.map((cell) => (
        <DayTower
          key={cell.dateKey}
          cell={cell}
          rows={grid.rows}
          events={byDate.get(cell.dateKey) ?? NO_EVENTS}
          members={TITLE_MEMBERS}
          highlighted={false}
          island={null}
        />
      ))}
    </group>
  );
};
