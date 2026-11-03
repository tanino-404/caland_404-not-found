import { WEATHER_LABELS, type DayPhase, type WeatherCondition, type WeatherNow } from '../../types/weather';
import './WeatherBadge.css';

export interface WeatherBadgeProps {
  /** null は初回取得前 */
  weather: WeatherNow | null;
  dayPhase: DayPhase;
  /** 設定のデバッグモードで選んだ天気。null なら実際の天気を出す */
  debugCondition: WeatherCondition | null;
}

const PHASE_LABELS: Record<DayPhase, string> = {
  day: '昼',
  evening: '夕方',
  night: '夜',
};

const CONDITION_MARKS = {
  clear: '☀',
  cloudy: '☁',
  rain: '☂',
  snow: '☃',
  thunder: '⚡',
} as const;

/** 右上に出す現在の天気と時刻帯。取得できないときは理由を小さく出し、空は晴れのまま */
export const WeatherBadge = ({ weather, dayPhase, debugCondition }: WeatherBadgeProps) => {
  if (debugCondition !== null) {
    return (
      <div className="weather-badge panel is-debug" role="status">
        <span className="weather-badge-main">
          {CONDITION_MARKS[debugCondition]} {WEATHER_LABELS[debugCondition]} · {PHASE_LABELS[dayPhase]}
        </span>
        <span className="weather-badge-debug">デバッグモード（設定で切り替え中）</span>
      </div>
    );
  }
  if (weather === null) {
    return (
      <div className="weather-badge panel" role="status">
        <span className="weather-badge-main">天気を取得中…</span>
      </div>
    );
  }
  const temperature = weather.temperatureC === null ? '' : ` ${Math.round(weather.temperatureC)}℃`;
  return (
    <div className="weather-badge panel" role="status">
      <span className="weather-badge-main">
        {CONDITION_MARKS[weather.condition]} {weather.weatherText || WEATHER_LABELS[weather.condition]}
        {temperature} · {PHASE_LABELS[dayPhase]}
      </span>
      {weather.error !== null ? (
        <span className="weather-badge-error">天気を取得できません：{weather.error}</span>
      ) : null}
    </div>
  );
};
