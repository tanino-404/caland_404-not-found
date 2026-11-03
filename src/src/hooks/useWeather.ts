import { useEffect, useState } from 'react';
import { fetchWeather } from '../lib/weatherApi';
import type { WeatherNow } from '../types/weather';

export interface WeatherState {
  /** 初回取得が終わるまで null。通信に失敗しても晴れの既定値（error 付き）が入る */
  weather: WeatherNow | null;
}

const POLL_MS = 10 * 60 * 1000;

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** 通信自体に失敗したとき。サーバーの失敗応答と同じ形にして画面を止めない */
const unavailable = (err: unknown): WeatherNow => ({
  condition: 'clear',
  weatherText: '',
  temperatureC: null,
  precipitationMm: null,
  cloudPct: null,
  windSpeedMs: null,
  forecastTime: '',
  fetchedAt: new Date().toISOString(),
  place: { lat: 0, lon: 0 },
  error: errorMessage(err),
});

/** 現在の天気（/api/weather）。マウント時と 10 分ごとに取り直す */
export const useWeather = (): WeatherState => {
  const [weather, setWeather] = useState<WeatherNow | null>(null);

  useEffect(() => {
    let active = true;
    const tick = () => {
      fetchWeather()
        .then((next) => {
          if (active) setWeather(next);
        })
        .catch((err: unknown) => {
          if (!active) return;
          console.error(err);
          setWeather(unavailable(err));
        });
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return { weather };
};
