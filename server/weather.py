"""現在の天気を YuMake 体感温度予報 API から取り、画面の空・光・雨雪の演出に渡す。

地点は secret/.env の WEATHER_LAT / WEATHER_LON（未設定なら大阪城）。
成功した結果はプロセス内に 10 分保持し、その間は YuMake を呼ばない。
失敗は握りつぶさずトレースバックを出力したうえで、晴れの既定値に error を添えて返す
（画面を止めない仕様）。失敗は 60 秒だけ保持して、連続で YuMake を叩かない。
"""

from __future__ import annotations

import threading
import time
import traceback
from datetime import datetime

from suggest import _require_env, fetch_feels_like, load_env

DEFAULT_LAT = 34.6873
DEFAULT_LON = 135.5262
SUCCESS_TTL_SEC = 10 * 60
FAILURE_TTL_SEC = 60
NO_PRECIPITATION = 999.99

_lock = threading.Lock()
_cached: dict | None = None
_cached_until = 0.0


def _place(env: dict[str, str]) -> tuple[float, float]:
    """地点。WEATHER_LAT / WEATHER_LON が未設定なら大阪城。数値でなければ例外（設定ミスを隠さない）。"""
    lat_text = env.get("WEATHER_LAT", "")
    lon_text = env.get("WEATHER_LON", "")
    if lat_text == "" or lon_text == "":
        return DEFAULT_LAT, DEFAULT_LON
    return float(lat_text), float(lon_text)


def _parse_stamp(stamp: str) -> datetime:
    """YuMake の forecastDateTime（例 "2026-11-03T15:00:00+09:00"）。タイムゾーンが無ければサーバーのローカル。"""
    parsed = datetime.fromisoformat(stamp)
    if parsed.tzinfo is None:
        return parsed.astimezone()
    return parsed


def _nearest_row(forecast: dict, now: datetime) -> dict:
    rows = [row for row in forecast.get("forecast", []) if isinstance(row.get("forecastDateTime"), str)]
    if len(rows) == 0:
        raise ValueError("YuMake 体感温度予報 API の応答に予報行がありません")
    return min(rows, key=lambda row: abs((_parse_stamp(row["forecastDateTime"]) - now).total_seconds()))


# 天気の文字列は 3 時間ごとの行にしか入らないので、この範囲内なら文字列付きの行を優先する
TEXT_WINDOW_SECONDS = 90 * 60


def _nearest_text(forecast: dict, now: datetime) -> str:
    """現在時刻から 90 分以内で最も近い、天気の文字列が入った行の文字列。無ければ ''。"""
    best = ""
    best_gap = TEXT_WINDOW_SECONDS + 1
    for row in forecast.get("forecast", []):
        stamp = row.get("forecastDateTime")
        text = row.get("weather")
        if not isinstance(stamp, str) or not isinstance(text, str) or text == "":
            continue
        gap = abs((_parse_stamp(stamp) - now).total_seconds())
        if gap <= TEXT_WINDOW_SECONDS and gap < best_gap:
            best = text
            best_gap = gap
    return best


def _number(row: dict, key: str) -> float | None:
    value = row.get(key)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    return None


def _condition(weather_text: str, precipitation: float | None, temperature: float | None, cloud: float | None) -> str:
    if weather_text != "":
        if "雪" in weather_text:
            return "snow"
        if "雷" in weather_text:
            return "thunder"
        if "雨" in weather_text:
            return "rain"
        if "曇" in weather_text or "くもり" in weather_text:
            return "cloudy"
        if "晴" in weather_text:
            return "clear"
    if precipitation is not None and precipitation > 0:
        if temperature is not None and temperature <= 1:
            return "snow"
        return "rain"
    if cloud is not None and cloud >= 70:
        return "cloudy"
    return "clear"


def _to_weather_now(row: dict, weather_text: str, lat: float, lon: float, fetched_at: datetime) -> dict:
    precipitation = _number(row, "precipitation")
    if precipitation is not None and precipitation == NO_PRECIPITATION:
        precipitation = 0.0
    temperature = _number(row, "temperature")
    cloud = _number(row, "tcdc")
    return {
        "condition": _condition(weather_text, precipitation, temperature, cloud),
        "weatherText": weather_text,
        "temperatureC": temperature,
        "precipitationMm": precipitation,
        "cloudPct": cloud,
        "windSpeedMs": _number(row, "windSpeed"),
        "forecastTime": _parse_stamp(row["forecastDateTime"]).strftime("%Y-%m-%d %H:%M"),
        "fetchedAt": fetched_at.isoformat(timespec="seconds"),
        "place": {"lat": lat, "lon": lon},
        "error": None,
    }


def _failure(message: str, lat: float, lon: float, fetched_at: datetime) -> dict:
    return {
        "condition": "clear",
        "weatherText": "",
        "temperatureC": None,
        "precipitationMm": None,
        "cloudPct": None,
        "windSpeedMs": None,
        "forecastTime": "",
        "fetchedAt": fetched_at.isoformat(timespec="seconds"),
        "place": {"lat": lat, "lon": lon},
        "error": message,
    }


def _fetch_now() -> dict:
    lat, lon = DEFAULT_LAT, DEFAULT_LON
    now = datetime.now().astimezone()
    try:
        env = load_env()
        lat, lon = _place(env)
        api_key = _require_env(env, "YUMAKE_API_KEY")
        forecast = fetch_feels_like(lat, lon, api_key)
        return _to_weather_now(_nearest_row(forecast, now), _nearest_text(forecast, now), lat, lon, now)
    except Exception as exc:
        traceback.print_exc()
        return _failure(str(exc), lat, lon, now)


def get_weather_now() -> dict:
    """現在時刻に最も近い予報行から作った WeatherNow（types/weather.ts と同じキー）。"""
    global _cached, _cached_until
    with _lock:
        if _cached is not None and time.monotonic() < _cached_until:
            return dict(_cached)
        result = _fetch_now()
        ttl = FAILURE_TTL_SEC if result["error"] is not None else SUCCESS_TTL_SEC
        _cached = result
        _cached_until = time.monotonic() + ttl
        return dict(result)
