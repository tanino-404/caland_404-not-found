/** 画面に反映する現在の天気。サーバー（/api/weather）が YuMake の予報文字列と数値から決める */
export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'thunder';

/** 時刻帯。画面側が端末の時計から決める（空の色・光の強さに使う） */
export type DayPhase = 'day' | 'evening' | 'night';

export interface WeatherNow {
  condition: WeatherCondition;
  /** YuMake の天気文字列（例「晴れ」「曇り」「雨」）。無ければ '' */
  weatherText: string;
  temperatureC: number | null;
  precipitationMm: number | null;
  cloudPct: number | null;
  windSpeedMs: number | null;
  /** 使った予報の時刻（YYYY-MM-DD HH:00） */
  forecastTime: string;
  /** サーバーが取得した時刻（ISO 8601） */
  fetchedAt: string;
  place: { lat: number; lon: number };
  /** 取得に失敗したときの理由。成功時は null（失敗時は condition が 'clear' の既定値になる） */
  error: string | null;
}

export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  clear: '晴れ',
  cloudy: '曇り',
  rain: '雨',
  snow: '雪',
  thunder: '雷雨',
};
