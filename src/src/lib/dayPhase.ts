import { useEffect, useState } from 'react';
import type { DayPhase } from '../types/weather';

/** 端末の時計から時刻帯を決める。6:00〜15:59 day、16:00〜18:59 evening、それ以外 night */
export const dayPhaseAt = (date: Date): DayPhase => {
  const hour = date.getHours();
  if (hour >= 6 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'evening';
  return 'night';
};

/** 時刻帯を見直す間隔（1 分） */
const CHECK_INTERVAL_MS = 60_000;

/** 現在の時刻帯。1 分ごとに見直し、変わったときだけ再レンダリングする */
export const useDayPhase = (): DayPhase => {
  const [phase, setPhase] = useState<DayPhase>(() => dayPhaseAt(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase(dayPhaseAt(new Date()));
    }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return phase;
};
