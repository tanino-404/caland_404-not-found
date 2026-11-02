import type { EventCategory } from '../types/calendar';

/** 持ち物提案（サーバー側で Overpass → YuMake → Claude → LINE を順に実行）の呼び出し */

export interface SuggestRequest {
  /** 'YYYY-MM-DD' */
  date: string;
  title: string;
  category: EventCategory;
  /** 行き先の名称（OpenStreetMap 上の名称） */
  place: string;
}

export interface SuggestedItem {
  name: string;
  reason: string;
}

export interface WeatherHour {
  hour: string;
  weather?: string;
  precipitationMm?: number;
  temperatureC?: number;
  humidityPct?: number;
  windDir?: string;
  windSpeedMs?: number;
  pressureHpa?: number;
  cloudPct?: number;
  feelsLikeC?: number;
  discomfort?: number;
  wbgt?: number;
  windChillC?: number;
}

export interface SuggestionResult {
  /** Overpass API が見つけた場所の名称 */
  placeName: string;
  weather: WeatherHour[];
  items: SuggestedItem[];
  /** LINE に送信済みの本文 */
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

const asWeatherHour = (row: unknown): WeatherHour => {
  if (!isRecord(row) || typeof row.hour !== 'string') {
    throw new Error(`suggestApi: 天気の形式が不正です: ${JSON.stringify(row)}`);
  }
  const hour: WeatherHour = { hour: row.hour };
  const weather = asString(row.weather);
  if (weather !== undefined) hour.weather = weather;
  const precipitationMm = asNumber(row.precipitationMm);
  if (precipitationMm !== undefined) hour.precipitationMm = precipitationMm;
  const temperatureC = asNumber(row.temperatureC);
  if (temperatureC !== undefined) hour.temperatureC = temperatureC;
  const humidityPct = asNumber(row.humidityPct);
  if (humidityPct !== undefined) hour.humidityPct = humidityPct;
  const windDir = asString(row.windDir);
  if (windDir !== undefined) hour.windDir = windDir;
  const windSpeedMs = asNumber(row.windSpeedMs);
  if (windSpeedMs !== undefined) hour.windSpeedMs = windSpeedMs;
  const pressureHpa = asNumber(row.pressureHpa);
  if (pressureHpa !== undefined) hour.pressureHpa = pressureHpa;
  const cloudPct = asNumber(row.cloudPct);
  if (cloudPct !== undefined) hour.cloudPct = cloudPct;
  const feelsLikeC = asNumber(row.feelsLikeC);
  if (feelsLikeC !== undefined) hour.feelsLikeC = feelsLikeC;
  const discomfort = asNumber(row.discomfort);
  if (discomfort !== undefined) hour.discomfort = discomfort;
  const wbgt = asNumber(row.wbgt);
  if (wbgt !== undefined) hour.wbgt = wbgt;
  const windChillC = asNumber(row.windChillC);
  if (windChillC !== undefined) hour.windChillC = windChillC;
  return hour;
};

const asSuggestion = (body: unknown): SuggestionResult => {
  if (
    !isRecord(body) ||
    !isRecord(body.place) ||
    typeof body.place.name !== 'string' ||
    !Array.isArray(body.weather) ||
    !Array.isArray(body.items) ||
    typeof body.message !== 'string'
  ) {
    throw new Error(`suggestApi: 応答形式が不正です: ${JSON.stringify(body)}`);
  }
  const items = body.items.map((item): SuggestedItem => {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.reason !== 'string') {
      throw new Error(`suggestApi: 持ち物の形式が不正です: ${JSON.stringify(item)}`);
    }
    return { name: item.name, reason: item.reason };
  });
  return {
    placeName: body.place.name,
    weather: body.weather.map(asWeatherHour),
    items,
    message: body.message,
  };
};

export const requestSuggestion = async (request: SuggestRequest): Promise<SuggestionResult> => {
  const res = await fetch('/api/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body: unknown = await res.json();
  if (!res.ok) {
    if (isRecord(body) && typeof body.error === 'string') throw new Error(body.error);
    throw new Error(`suggestApi: HTTP ${res.status} の失敗応答に error 文字列がありません: ${JSON.stringify(body)}`);
  }
  return asSuggestion(body);
};

export const weatherLine = (hours: WeatherHour[]): string =>
  hours
    .filter((_, index) => index % 3 === 0)
    .map((row) => {
      const parts = [row.hour];
      if (row.weather !== undefined) parts.push(row.weather);
      if (row.temperatureC !== undefined) parts.push(`${row.temperatureC}℃`);
      if (row.precipitationMm !== undefined && row.precipitationMm > 0) {
        parts.push(`雨${row.precipitationMm}mm`);
      }
      return parts.join(' ');
    })
    .join(' / ');
