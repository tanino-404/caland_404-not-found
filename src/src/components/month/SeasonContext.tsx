import { createContext, useContext } from 'react';
import { type MonthSeason, monthSeason } from '../../lib/season';

export const SeasonContext = createContext<MonthSeason>(monthSeason(1));

export const useSeason = (): MonthSeason => useContext(SeasonContext);
