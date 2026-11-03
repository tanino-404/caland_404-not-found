import type { ComponentType } from 'react';
import type { IslandTheme } from '../../types/ledger';
import { StudyEffect } from './StudyEffect';
import { LuxuryEffect } from './Luxury';

/** 達成した月の島の見た目。theme は島のブロック・光・海、Scene は追加で置く 3D 部品 */
export interface IslandEffect {
  theme: IslandTheme;
  Scene?: ComponentType;
}

/**
 * effect 名 → 島の見た目の部品表。manifest.json の effect はこのキーを指す。
 * luxury は黄金郷一式（金の島・マネーレイン・ヨット・リゾート屋上）。
 * 新しいプラグインの行は server/new_plugin.py が足す。
 */
export const ISLAND_EFFECTS: Record<string, IslandEffect> = {
  study: { theme: 'plain', Scene: StudyEffect },
  luxury: { theme: 'luxury', Scene: LuxuryEffect },
};
