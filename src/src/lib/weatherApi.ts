import type { WeatherCondition, WeatherNow } from '../types/weather';

const CONDITIONS: readonly WeatherCondition[] = ['clear', 'cloudy', 'rain', 'snow', 'thunder'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNullableNumber = (value: unknown): value is number | null =>
  value === null || typeof value === 'number';

const isCondition = (value: unknown): value is WeatherCondition =>
  typeof value === 'string' && CONDITIONS.includes(value as WeatherCondition);

const failureMessage = (body: unknown, status: number): string => {
  if (isRecord(body) && typeof body.error === 'string') return body.error;
  throw new Error(
    `weatherApi: HTTP ${status} の失敗応答に error 文字列がありません: ${JSON.stringify(body)}`,
  );
};

const request = async (path: string, init?: RequestInit): Promise<unknown> => {
  const res = await fetch(path, { cache: 'no-store', ...init });
  const body: unknown = await res.json();
  if (!res.ok) throw new Error(failureMessage(body, res.status));
  return body;
};

export const asWeatherNow = (body: unknown): WeatherNow => {
  if (
    !isRecord(body) ||
    !isCondition(body.condition) ||
    typeof body.weatherText !== 'string' ||
    !isNullableNumber(body.temperatureC) ||
    !isNullableNumber(body.precipitationMm) ||
    !isNullableNumber(body.cloudPct) ||
    !isNullableNumber(body.windSpeedMs) ||
    typeof body.forecastTime !== 'string' ||
    typeof body.fetchedAt !== 'string' ||
    !isRecord(body.place) ||
    typeof body.place.lat !== 'number' ||
    typeof body.place.lon !== 'number' ||
    !(body.error === null || typeof body.error === 'string')
  ) {
    throw new Error(`weatherApi: 天気の応答形式が不正です: ${JSON.stringify(body)}`);
  }
  return {
    condition: body.condition,
    weatherText: body.weatherText,
    temperatureC: body.temperatureC,
    precipitationMm: body.precipitationMm,
    cloudPct: body.cloudPct,
    windSpeedMs: body.windSpeedMs,
    forecastTime: body.forecastTime,
    fetchedAt: body.fetchedAt,
    place: { lat: body.place.lat, lon: body.place.lon },
    error: body.error,
  };
};

/** 現在の天気。サーバーが取得に失敗したときも 200 で返り、error に理由が入る */
export const fetchWeather = async (): Promise<WeatherNow> =>
  asWeatherNow(await request('/api/weather'));
