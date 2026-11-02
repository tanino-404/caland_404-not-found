"""予定と場所から持ち物を提案し、LINE へ送る。

流れ（すべてこのサーバー内で行い、API キーはフロントに出さない）:
  1. Overpass API            : 場所名 → 緯度経度と OSM タグ（目的地の性質）
  2. YuMake 体感温度予報 API : 緯度経度 → 対象日の時間別の天気・体感指標
  3. Claude API              : 予定 + 目的地 + 天気 → 持ち物の案
  4. Claude API              : 案を天気の数値と突き合わせ、不適切なものを落として LINE 本文を作る
  5. このサーバー             : 雨具・防寒・暑さ対策が数値と矛盾していたら送らずに止める
  6. LINE Messaging API      : 検討後の本文だけを push 送信

どの段階でも失敗したら例外メッセージをそのまま返して止める。フォールバックはしない。
"""

from __future__ import annotations

import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import db
from db import LedgerError

ENV_PATH = Path(__file__).resolve().parent.parent / "secret" / ".env"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
YUMAKE_URL = "https://api.yumake.jp/1.1/feelsLike.php"
CLAUDE_URL = "https://api.anthropic.com/v1/messages"
LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"
DEFAULT_CLAUDE_MODEL = "claude-sonnet-5"
USER_AGENT = "tcp-osaka-2026-schedule-map/1.0"

CATEGORY_LABELS = {
    "beauty": "美容室",
    "restaurant": "飲食",
    "work": "仕事",
    "wedding": "結婚式",
    "hospital": "病院",
    "gym": "ジム",
    "travel": "旅行",
    "school": "学校",
}

PROPOSE_PROMPT = """あなたは予定の持ち物を提案するアシスタントです。
予定の内容、目的地の性質（OpenStreetMap のタグ）、当日の天気と体感指標から、持って行くべき物だけを選びます。
必ず次の形の JSON だけを、1行で出力してください。コードフェンスや説明文は書かないでください。文字列の中に改行と二重引用符は入れないでください。
{"items": [{"name": "持ち物名", "reason": "理由"}]}
- items は 3〜6 個。予定の種類と目的地に必要な物を先に選ぶ。
- 理由は、渡された数値か目的地の性質に触れる。1 項目 40 文字以内。
- 「念のため」「念の為」「降るかもしれない」は書かない。数値がその物を必要としているときだけ入れる。
- 雨具（傘、レインコート、レインウェア、カッパ）は、降水量が 0 より大きいか、天気に雨・雪・雷・あられ・みぞれがあるときだけ。
- 防寒（コート、マフラー、ストール、手袋、ダウン、ヒートテック）は、体感温度の最低が 18℃未満のときだけ。
- 暑さ対策（うちわ、扇子、冷感タオル、塩飴）は、体感温度の最高が 22℃以上のときだけ。"""

REVIEW_PROMPT = """あなたは持ち物リストの検討役です。提案された持ち物を、渡された天気の数値と照合し、条件に合わない物を除きます。
除いたあとの持ち物だけを残し、そのリストで LINE の本文を書きます。
必ず次の形の JSON だけを出力してください。コードフェンスや説明文は書かないでください。
{"items": [{"name": "持ち物名", "reason": "理由"}], "message": "LINE で送る本文"}
- 落とすのは、検討の基準に反する物だけ。天気と矛盾しない、予定や場所に必要な物は残す。新しい物を足すのは明らかに足りないときだけで、最大 6 個。
- 雨具は、雨具が必要 が「はい」のときだけ。それ以外は名前にも理由にも本文にも雨具を書かない。
- 防寒は、防寒が必要 が「はい」のときだけ。暑さ対策は、暑さ対策が必要 が「はい」のときだけ。
- 「念のため」では残さない。
- message は残した items と一致させる。除いた物には触れない。全体で 800 文字以内。
- message は次の並びで、空行を入れて読みやすくする。絵文字は区切りと各持ち物に 1 つずつ。文末に絵文字を重ねない。
🎒 予定名
（空行）
📅 日付
📍 場所
（空行）
🌤 天気
時刻と天気と気温を 1 行に 1 つ。体感の要点をその次の 1 行に。
（空行）
✅ 持っていくもの
・絵文字 持ち物名
　理由"""

RAIN_WORDS = ("傘", "レインコート", "レインウェア", "雨具", "カッパ", "雨合羽", "雨がっぱ")
COLD_WORDS = ("マフラー", "ストール", "手袋", "ダウン", "ヒートテック", "ネックウォーマー")
HEAT_WORDS = ("うちわ", "扇子", "冷感", "塩飴", "塩タブレット", "塩分タブレット")
WET_MARKS = ("雨", "雪", "雷", "あられ", "みぞれ")


def _load_env() -> dict[str, str]:
    if not ENV_PATH.exists():
        raise LedgerError(500, f"{ENV_PATH} がありません。secret/.env.template を基に作成してください")
    values: dict[str, str] = {}
    for line in ENV_PATH.read_text("utf-8").splitlines():
        text = line.strip()
        if text == "" or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def _require_env(env: dict[str, str], key: str) -> str:
    value = env.get(key, "")
    if value == "":
        raise LedgerError(500, f"secret/.env に {key} が設定されていません")
    return value


def _ssl_context() -> ssl.SSLContext:
    """python.org の 3.11 は同梱 CA が空なので、この Mac の証明書を使う。"""
    mac_certs = Path("/etc/ssl/cert.pem")
    if sys.platform == "darwin" and mac_certs.is_file():
        return ssl.create_default_context(cafile=str(mac_certs))
    return ssl.create_default_context()


def _http_json(req: urllib.request.Request, timeout: float, label: str) -> dict:
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as res:
            raw = res.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise LedgerError(502, f"{label} が HTTP {exc.code} を返しました: {detail}") from exc
    except urllib.error.URLError as exc:
        raise LedgerError(502, f"{label} に接続できません: {exc.reason}") from exc
    try:
        body = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LedgerError(502, f"{label} の応答が JSON ではありません: {raw[:300]}") from exc
    if not isinstance(body, dict):
        raise LedgerError(502, f"{label} の応答がオブジェクトではありません: {raw[:300]}")
    return body


def _search_place(place: str) -> dict:
    escaped = place.replace("\\", "\\\\").replace('"', '\\"')
    # 日本の bbox。area["ISO3166-1"="JP"] は Overpass 側が重く、デモ中に数十秒待たされる
    query = (
        "[out:json][timeout:25];"
        "("
        f'nwr["name"="{escaped}"](20,122,46,154);'
        f'nwr["name:ja"="{escaped}"](20,122,46,154);'
        ");"
        "out center tags 8;"
    )
    req = urllib.request.Request(
        OVERPASS_URL,
        data=urllib.parse.urlencode({"data": query}).encode("utf-8"),
        headers={"User-Agent": USER_AGENT},
        method="POST",
    )
    # 公開 Overpass は混雑すると 502 / 504 を返し、同じリクエストの再試行を案内している。
    # 別の結果には切り替えない。最後まで失敗したら、そのエラーをそのまま出す。
    body = None
    wait = 2.0
    for attempt in range(4):
        try:
            body = _http_json(req, 90.0, "Overpass API")
            break
        except LedgerError as exc:
            message = str(exc)
            busy = "HTTP 502" in message or "HTTP 504" in message
            if not busy or attempt == 3:
                raise
            time.sleep(wait)
            wait *= 2
    candidates = []
    for element in body.get("elements", []):
        center = element.get("center", element)
        lat = center.get("lat")
        lon = center.get("lon")
        if lat is None or lon is None:
            continue
        tags = element.get("tags", {})
        candidates.append({"name": tags.get("name", place), "lat": lat, "lon": lon, "tags": tags})
    if len(candidates) == 0:
        raise LedgerError(
            404,
            f"Overpass API で場所が見つかりません: {place}（OpenStreetMap 上の名称で入力してください）",
        )
    candidates.sort(key=lambda c: len(c["tags"]), reverse=True)
    return candidates[0]


def _fetch_feels_like(lat: float, lon: float, api_key: str) -> dict:
    params = urllib.parse.urlencode({"lat": lat, "lon": lon, "key": api_key, "format": "json"})
    req = urllib.request.Request(f"{YUMAKE_URL}?{params}", headers={"User-Agent": USER_AGENT})
    body = _http_json(req, 30.0, "YuMake 体感温度予報 API")
    if body.get("status") != "success":
        raise LedgerError(
            502,
            f"YuMake 体感温度予報 API がエラーを返しました: {json.dumps(body, ensure_ascii=False)}",
        )
    return body


def _extract_hours(forecast: dict, date: str) -> list[dict]:
    """対象日の 6〜21 時の予報だけを、Claude と画面へ渡す形に絞る。

    仕様書どおり、降水量 999.99 は「降水無し」、WBGT / 風冷指数の -999.99 は「使用しない」。
    """
    hours: list[dict] = []
    for row in forecast.get("forecast", []):
        stamp = row.get("forecastDateTime", "")
        if not stamp.startswith(date):
            continue
        hour = int(stamp[11:13])
        if hour < 6 or hour > 21:
            continue
        entry: dict = {"hour": f"{hour:02d}:00"}
        weather = row.get("weather")
        if isinstance(weather, str) and weather != "":
            entry["weather"] = weather
        precipitation = row.get("precipitation")
        if precipitation is not None:
            entry["precipitationMm"] = 0.0 if precipitation == 999.99 else precipitation
        mapping = {
            "temperature": "temperatureC",
            "relativeHumidity": "humidityPct",
            "windDirStr": "windDir",
            "windSpeed": "windSpeedMs",
            "meanSeaLevelPressure": "pressureHpa",
            "tcdc": "cloudPct",
            "net": "feelsLikeC",
            "discomfort": "discomfort",
        }
        for key, label in mapping.items():
            if row.get(key) is not None:
                entry[label] = row[key]
        for key, label in (("wbgt", "wbgt"), ("windChill", "windChillC")):
            value = row.get(key)
            if value is not None and value != -999.99:
                entry[label] = value
        hours.append(entry)
    if len(hours) == 0:
        raise LedgerError(
            422,
            f"{date} の天気は取得できません。YuMake 体感温度予報は発表時刻"
            f"（{forecast.get('reportDateTime', '不明')}）から最大 78 時間先までです。"
            "今日から3日以内の日付で試してください",
        )
    return hours


def _numbers(hours: list[dict], key: str) -> list[float]:
    return [row[key] for row in hours if isinstance(row.get(key), (int, float))]


def _weather_facts(hours: list[dict]) -> dict:
    """検討の基準にする。Claude の印象ではなく、予報の数値から決める。"""
    precips = _numbers(hours, "precipitationMm")
    weathers = [row["weather"] for row in hours if isinstance(row.get("weather"), str) and row["weather"] != ""]
    feels = _numbers(hours, "feelsLikeC") or _numbers(hours, "temperatureC")
    rainy = any(value > 0 for value in precips) or any(
        any(mark in text for mark in WET_MARKS) for text in weathers
    )
    feels_min = min(feels) if feels else None
    feels_max = max(feels) if feels else None
    return {
        "rainy": rainy,
        "needsCold": feels_min is not None and feels_min < 18,
        "needsHeat": feels_max is not None and feels_max >= 22,
        "maxPrecipitationMm": max(precips) if precips else None,
        "weathers": weathers,
        "feelsMin": feels_min,
        "feelsMax": feels_max,
    }


def _contains_any(text: str, words: tuple[str, ...]) -> bool:
    return any(word in text for word in words)


def _is_cold(text: str) -> bool:
    if _contains_any(text, COLD_WORDS):
        return True
    return "コート" in text and "レイン" not in text


def _problems(items: list[dict], message: str, facts: dict) -> list[str]:
    """天気の数値と矛盾する持ち物が残っていたら、送らずに止めるための指摘。"""
    problems: list[str] = []

    def names_matching(predicate) -> list[str]:
        found = [item["name"] for item in items if predicate(item["name"] + item["reason"])]
        if message != "" and predicate(message):
            found.append("送信文")
        return found

    if not facts["rainy"]:
        found = names_matching(lambda text: _contains_any(text, RAIN_WORDS))
        if found:
            problems.append("降水が無く雨や雪でもないのに雨具がある: " + "、".join(found))
    if not facts["needsCold"]:
        found = names_matching(_is_cold)
        if found:
            problems.append("体感温度が低くないのに防寒着がある: " + "、".join(found))
    if not facts["needsHeat"]:
        found = names_matching(lambda text: _contains_any(text, HEAT_WORDS))
        if found:
            problems.append("体感温度が高くないのに暑さ対策がある: " + "、".join(found))
    return problems


def _facts_text(facts: dict) -> str:
    feels = "不明"
    if facts["feelsMin"] is not None and facts["feelsMax"] is not None:
        feels = f"{facts['feelsMin']}〜{facts['feelsMax']}℃"
    return (
        f"- 雨具が必要: {'はい' if facts['rainy'] else 'いいえ'}"
        f"（降水量の最大 {facts['maxPrecipitationMm']} mm、天気 {'、'.join(facts['weathers']) or '不明'}）\n"
        f"- 防寒が必要: {'はい' if facts['needsCold'] else 'いいえ'}（体感温度 {feels}。18℃未満ならはい）\n"
        f"- 暑さ対策が必要: {'はい' if facts['needsHeat'] else 'いいえ'}（体感温度 {feels}。22℃以上ならはい）"
    )


def _loads_json_object(text: str) -> dict:
    """先頭の JSON オブジェクトを読む。末尾のカンマと、後ろに付いた説明文は捨てる。"""
    start = text.find("{")
    if start == -1:
        raise json.JSONDecodeError("JSON オブジェクトがありません", text, 0)
    blob = re.sub(r",(\s*[}\]])", r"\1", text[start:]).strip()
    try:
        parsed, _end = json.JSONDecoder().raw_decode(blob)
    except json.JSONDecodeError:
        if not blob.endswith("}"):
            parsed, _end = json.JSONDecoder().raw_decode(blob + "}")
        else:
            raise
    if not isinstance(parsed, dict):
        raise json.JSONDecodeError("JSON の先頭がオブジェクトではありません", text, start)
    return parsed


def _claude_json(api_key: str, model: str, system: str, user_prompt: str, require_message: bool) -> dict:
    payload = {
        "model": model,
        "max_tokens": 1500,
        # 考え事のブロックに出力枠を使われると、本文が空になり JSON が読めない
        "thinking": {"type": "disabled"},
        "system": system,
        "messages": [{"role": "user", "content": user_prompt}],
    }
    req = urllib.request.Request(
        CLAUDE_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    body = _http_json(req, 120.0, "Claude API")
    content = body.get("content")
    if not isinstance(content, list):
        raise LedgerError(502, f"Claude API の応答に content がありません: {json.dumps(body, ensure_ascii=False)[:300]}")
    text = "".join(
        block.get("text", "") for block in content if isinstance(block, dict) and block.get("type") == "text"
    ).strip()
    fenced = re.match(r"^```[^\n]*\n(.*)\n```$", text, re.S)
    if fenced is not None:
        text = fenced.group(1).strip()
    try:
        parsed = _loads_json_object(text)
    except json.JSONDecodeError as exc:
        kinds = [block.get("type") for block in content if isinstance(block, dict)]
        near = text[max(0, exc.pos - 24): exc.pos + 24]
        raise LedgerError(
            502,
            "Claude API の応答が指定の JSON ではありません: "
            f"stop={body.get('stop_reason')} blocks={kinds} text={text[:500]!r} 付近={near!r}",
        ) from exc
    items = parsed.get("items") if isinstance(parsed, dict) else None
    message = parsed.get("message") if isinstance(parsed, dict) else ""
    if (
        not isinstance(items, list)
        or len(items) == 0
        or not all(
            isinstance(item, dict)
            and isinstance(item.get("name"), str)
            and item["name"].strip() != ""
            and isinstance(item.get("reason"), str)
            and item["reason"].strip() != ""
            for item in items
        )
        or (require_message and (not isinstance(message, str) or message.strip() == ""))
    ):
        raise LedgerError(502, f"Claude API の応答形式が不正です: {text[:500]}")
    result = {"items": [{"name": item["name"].strip(), "reason": item["reason"].strip()} for item in items]}
    if require_message:
        result["message"] = message.strip()
    return result


def _context(date: str, title: str, category_label: str, spot: dict, hours: list[dict], facts: dict) -> str:
    place_json = json.dumps(
        {"name": spot["name"], "lat": spot["lat"], "lon": spot["lon"], "tags": spot["tags"]},
        ensure_ascii=False,
    )
    return (
        f"## 予定\n- 日付: {date}\n- タイトル: {title}\n- 種類: {category_label}\n"
        f"- 場所: {spot['name']}\n\n"
        f"## 目的地（Overpass API / OpenStreetMap）\n{place_json}\n\n"
        f"## 検討の基準（この数値に従う）\n{_facts_text(facts)}\n\n"
        "## 当日の天気（YuMake 体感温度予報、6〜21 時。"
        "hour=時刻, weather=天気, precipitationMm=降水量mm, temperatureC=気温,"
        " humidityPct=湿度, windDir=風向, windSpeedMs=風速, pressureHpa=気圧,"
        " cloudPct=全層雲量, feelsLikeC=体感温度, discomfort=不快指数,"
        " wbgt=WBGT, windChillC=風冷指数）\n"
        f"{json.dumps(hours, ensure_ascii=False)}\n"
    )


def _propose(api_key: str, model: str, context: str) -> list[dict]:
    result = _claude_json(api_key, model, PROPOSE_PROMPT, "次の予定の持ち物を提案してください。\n\n" + context, False)
    return result["items"]


def _review(
    api_key: str,
    model: str,
    context: str,
    items: list[dict],
    problems: list[str],
) -> dict:
    note = ""
    if problems:
        note = "前回の案は次の点で天気と矛盾していました。同じ物を残さないでください。\n" + "\n".join(
            f"- {problem}" for problem in problems
        ) + "\n\n"
    prompt = (
        note
        + "次の案を検討し、条件に合う物だけを残して LINE の本文を書いてください。\n\n"
        + f"## 提案された持ち物\n{json.dumps(items, ensure_ascii=False)}\n\n"
        + context
    )
    return _claude_json(api_key, model, REVIEW_PROMPT, prompt, True)


def _push_line(token: str, to: str, text: str) -> None:
    payload = {"to": to, "messages": [{"type": "text", "text": text[:5000]}]}
    req = urllib.request.Request(
        LINE_PUSH_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    _http_json(req, 30.0, "LINE Messaging API")


def run(body: object) -> dict:
    payload = db._require_object(body)
    date = db._require_date(payload)
    title = db._require_text(payload, "title")
    category = db._require_category(payload)
    place = db._require_text(payload, "place")

    # 外部 API を呼ぶ前に、必要なキーがすべて揃っているかを先に確かめる
    env = _load_env()
    claude_key = _require_env(env, "CLAUDE_API_KEY")
    yumake_key = _require_env(env, "YUMAKE_API_KEY")
    line_token = _require_env(env, "LINE_CHANNEL_ACCESS_TOKEN")
    line_to = _require_env(env, "LINE_PUSH_TO")
    model = env.get("CLAUDE_MODEL", "").strip() or DEFAULT_CLAUDE_MODEL

    spot = _search_place(place)
    forecast = _fetch_feels_like(spot["lat"], spot["lon"], yumake_key)
    hours = _extract_hours(forecast, date)
    facts = _weather_facts(hours)
    context = _context(date, title, CATEGORY_LABELS[category], spot, hours, facts)
    proposed = _propose(claude_key, model, context)
    result = _review(claude_key, model, context, proposed, [])
    problems = _problems(result["items"], result["message"], facts)
    if problems:
        result = _review(claude_key, model, context, result["items"], problems)
        problems = _problems(result["items"], result["message"], facts)
    if problems:
        raise LedgerError(502, "持ち物が天気と合わないため送信しません: " + " ".join(problems))
    _push_line(line_token, line_to, result["message"])
    return {
        "place": {"name": spot["name"], "lat": spot["lat"], "lon": spot["lon"]},
        "weather": hours,
        "items": result["items"],
        "message": result["message"],
    }
