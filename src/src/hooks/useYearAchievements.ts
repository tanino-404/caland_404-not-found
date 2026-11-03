import { useEffect, useState } from 'react';
import { fetchAchievements } from '../lib/pluginApi';
import type { PluginSummary } from '../types/plugins';

export interface YearAchievements {
  /** 月（1〜12）→ 目標を達成したプラグイン。読み込み中は null */
  months: Map<number, PluginSummary[]> | null;
  /** 読み込みに失敗したときのメッセージ */
  error: string | null;
}

/** 年ビューを開いたときに、全プラグインの月ごとの達成を読む */
export const useYearAchievements = (year: number): YearAchievements => {
  const [state, setState] = useState<YearAchievements>({ months: null, error: null });

  useEffect(() => {
    let active = true;
    fetchAchievements(year).then(
      (months) => {
        if (active) setState({ months, error: null });
      },
      (err: unknown) => {
        console.error(err);
        if (active) setState({ months: null, error: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => {
      active = false;
    };
  }, [year]);

  return state;
};
