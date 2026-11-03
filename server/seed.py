"""2025・2026・2027 年の家計・予定シード。

src/src/data/sampleLedger.ts / sampleEvents.ts と同じ定数、同じ mulberry32。
乱数シードは年ごとに (基準シード + (year - 2026) * 10000)。
"""

from __future__ import annotations

import calendar
import math
from collections.abc import Callable

EXPENSE_TITLES = [
    "食費",
    "光熱費",
    "交通",
    "日用品",
    "交際",
    "趣味",
    "サブスク",
    "買い物",
    "医療",
    "通信費",
]

SPEND_RATIO = {
    1: 0.72,
    2: 0.95,
    3: 0.7,
    4: 0.75,
    5: 0.98,
    6: 1.05,
    7: 0.78,
    8: 1.12,
    9: 0.96,
    10: 1.08,
    11: 0.74,
    12: 0.65,
}

SAMPLE_YEAR = 2026
SAMPLE_YEARS = [2025, 2026, 2027]
SAMPLE_MEMBERS = ["たろう", "はなこ"]
SAMPLE_PASSWORD = "1234"
SEED = 20261014
# (メンバー, 給与, 冬の賞与)。SAMPLE_MEMBERS と同じ順に乱数を使う。
SAMPLE_INCOME = [
    (SAMPLE_MEMBERS[0], 220_000, 150_000),
    (SAMPLE_MEMBERS[1], 210_000, 120_000),
]
# 家賃 85,000 円をふたりで半分ずつ。各自の記帳にする。
RENT_SHARE = 42_500
# メンバーごとの月の貯金目標
GOAL = 30_000


def ledger_seed(year: int) -> int:
    """sampleLedger.ts の sampleLedgerSeed。"""
    return SEED + (year - SAMPLE_YEAR) * 10000


def _u32(value: int) -> int:
    return value & 0xFFFFFFFF


def _imul(left: int, right: int) -> int:
    """Math.imul の下位 32 ビット。符号付きでも積の下位 32 ビットは同じ。"""
    return _u32(_u32(left) * _u32(right))


def mulberry32(seed: int) -> Callable[[], float]:
    """sampleLedger.ts の mulberry32。返り値は [0, 1)。"""
    state = _u32(seed)

    def rng() -> float:
        nonlocal state
        state = _u32(state + 0x6D2B79F5)
        t = state
        t = _imul(t ^ (t >> 15), t | 1)
        t = _u32(t ^ _u32(t + _imul(t ^ (t >> 7), t | 61)))
        return (t ^ (t >> 14)) / 4294967296

    return rng


def js_round(value: float) -> int:
    """Math.round。半分は +∞ 側へ寄せる。"""
    return math.floor(value + 0.5)


def _pick(rng: Callable[[], float], items: list[str]) -> str:
    return items[math.floor(rng() * len(items))]


def _to_date_key(year: int, month: int, day: int) -> str:
    return f"{year:04d}-{month:02d}-{day:02d}"


def _to_year_month(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _build_sample_year(
    year: int, entries: list[dict], goals: dict[str, dict[str, int]]
) -> None:
    rng = mulberry32(ledger_seed(year))
    seq = 0

    def push(date: str, kind: str, amount: int, title: str, member: str) -> None:
        nonlocal seq
        entries.append(
            {
                "id": f"ledger-sample-{year}-{seq}",
                "date": date,
                "kind": kind,
                "amount": amount,
                "title": title,
                "owners": [member],
            }
        )
        seq += 1

    for month in range(1, 13):
        days = calendar.monthrange(year, month)[1]
        for member, salary, bonus in SAMPLE_INCOME:
            goals[member][_to_year_month(year, month)] = GOAL
            income = salary
            push(_to_date_key(year, month, min(25, days)), "income", salary, "給与", member)
            if month == 12:
                push(_to_date_key(year, 12, 10), "income", bonus, "冬の賞与", member)
                income += bonus

            target_spend = js_round((income * SPEND_RATIO[month]) / 100) * 100
            push(_to_date_key(year, month, 1), "expense", RENT_SHARE, "家賃", member)

            remaining = target_spend - RENT_SHARE
            count = 10
            weights = [0.45 + rng() for _ in range(count)]
            sum_w = 0.0
            for weight in weights:
                sum_w += weight
            allocated = 0
            for index in range(count):
                if index == count - 1:
                    raw = remaining - allocated
                else:
                    raw = js_round(((remaining * weights[index]) / sum_w) / 100) * 100
                amount = max(500, raw)
                allocated += amount
                day = 2 + math.floor(rng() * (days - 1))
                push(
                    _to_date_key(year, month, day),
                    "expense",
                    amount,
                    _pick(rng, EXPENSE_TITLES),
                    member,
                )


def build_sample() -> tuple[list[dict], dict[str, dict[str, int]]]:
    """SAMPLE_YEARS の 3 年分の家計と、メンバー → 月 → 目標。sampleLedger.ts と同じ並び。
    記帳はどれも 1 人のメンバーのもの（owners は 1 人）。"""
    entries: list[dict] = []
    goals: dict[str, dict[str, int]] = {member: {} for member in SAMPLE_MEMBERS}
    for year in SAMPLE_YEARS:
        _build_sample_year(year, entries, goals)
    return entries, goals


# sampleEvents.ts と同じ定数、同じ mulberry32。
EVENT_SEED = 20260917
SHARED_RATIO = 0.12
# 1 日に予定が入らない確率と、件数の係数
SKIP_RATIO = 0.25
COUNT_SCALE = 2.8
EVENT_TITLES = {
    "beauty": ["カット", "カラー", "パーマ", "ヘッドスパ", "ネイル", "まつエク"],
    "restaurant": ["ランチ会", "飲み会", "カフェ", "同期会", "焼肉", "ラーメン部"],
    "work": ["定例MTG", "1on1", "レビュー", "企画会議", "締め切り", "顧客訪問", "資料作成", "面談"],
    "wedding": ["結婚式", "披露宴", "二次会"],
    "hospital": ["歯医者", "健康診断", "眼科", "皮膚科", "予防接種"],
    "gym": ["筋トレ", "ランニング", "ヨガ", "スイム", "ボルダリング"],
    "travel": ["飛行機", "新幹線", "ホテルチェックイン", "観光", "温泉"],
    "school": ["英会話", "授業", "ゼミ", "発表", "参観日", "塾"],
}
MONTH_BUSYNESS = {
    1: 0.5,
    2: 0.7,
    3: 1.7,
    4: 1.2,
    5: 0.9,
    6: 1.0,
    7: 0.9,
    8: 0.3,
    9: 1.1,
    10: 1.5,
    11: 1.0,
    12: 1.9,
}
WEEKDAY_CATEGORIES = ["work", "work", "work", "school", "gym", "hospital"]
WEEKEND_CATEGORIES = ["beauty", "restaurant", "restaurant", "gym", "travel", "school"]
# (月, 日) → その日に必ず入れる予定の種類。SIGNATURE_YEARS の各年に同じ月日で入れる。
SIGNATURE_DAYS = {
    (12, 19): ["wedding", "beauty", "restaurant", "travel", "wedding", "restaurant", "beauty", "travel", "wedding"],
    (3, 27): ["work", "work", "work", "restaurant", "work", "gym", "work", "hospital"],
    (10, 10): ["travel", "travel", "restaurant", "beauty", "gym", "restaurant", "travel"],
    (6, 6): ["wedding", "beauty", "restaurant", "travel"],
}
# 2027 年はまだ先の予定なので見せ場の日を入れない
SIGNATURE_YEARS = (2025, 2026)


def event_seed(year: int) -> int:
    """sampleEvents.ts の sampleEventSeed。"""
    return EVENT_SEED + (year - SAMPLE_YEAR) * 10000


def year_scale(year: int, month: int) -> float:
    """sampleEvents.ts の yearScale。2025 年は 2026 年の 0.8 倍。
    2027 年はまだ予定を入れていない未来なので、1 月 0.7 から 12 月 0.15 へ線形に減らす。"""
    if year == 2025:
        return 0.8
    if year == 2027:
        return 0.7 - 0.05 * (month - 1)
    return 1


def _weekday_sun0(year: int, month: int, day: int) -> int:
    """Date.getDay。0 = 日曜。"""
    return (calendar.weekday(year, month, day) + 1) % 7


def _pick_owners(rng: Callable[[], float], category: str) -> list[str]:
    if category == "wedding" or rng() < SHARED_RATIO:
        return list(SAMPLE_MEMBERS)
    return [_pick(rng, SAMPLE_MEMBERS)]


def _build_sample_events_year(year: int, events: list[dict]) -> None:
    rng = mulberry32(event_seed(year))
    seq = 0

    def push(date: str, category: str) -> None:
        nonlocal seq
        events.append(
            {
                "id": f"sample-{year}-{seq}",
                "date": date,
                "title": _pick(rng, EVENT_TITLES[category]),
                "category": category,
                "owners": _pick_owners(rng, category),
            }
        )
        seq += 1

    for month in range(1, 13):
        days = calendar.monthrange(year, month)[1]
        scale = year_scale(year, month)
        for day in range(1, days + 1):
            date = _to_date_key(year, month, day)
            fixed = SIGNATURE_DAYS.get((month, day)) if year in SIGNATURE_YEARS else None
            if fixed is not None:
                for category in fixed:
                    push(date, category)
                continue
            weekday = _weekday_sun0(year, month, day)
            pool = WEEKEND_CATEGORIES if weekday in (0, 6) else WEEKDAY_CATEGORIES
            if rng() < SKIP_RATIO:
                continue
            raw = (
                rng() * COUNT_SCALE * MONTH_BUSYNESS[month] + (3 if rng() < 0.15 else 0)
            ) * scale
            count = min(10, math.floor(raw))
            for _ in range(count):
                push(date, _pick(rng, pool))


def build_sample_events() -> tuple[list[str], list[dict]]:
    """サンプルのメンバーと SAMPLE_YEARS の 3 年分の予定。sampleEvents.ts と同じ並び。"""
    events: list[dict] = []
    for year in SAMPLE_YEARS:
        _build_sample_events_year(year, events)
    return list(SAMPLE_MEMBERS), events
