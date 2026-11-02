"""2026 年の家計シード。

src/src/data/sampleLedger.ts と同じ定数、同じ mulberry32(20261014)。
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

SALARY_TARO = 220_000
SALARY_HANA = 210_000
RENT = 85_000
BONUS_TARO = 150_000
BONUS_HANA = 120_000
GOAL = 50_000
SAMPLE_YEAR = 2026
SAMPLE_MEMBERS = ["たろう", "はなこ"]
SEED = 20261014


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


def build_sample() -> tuple[list[dict], dict[str, int]]:
    rng = mulberry32(SEED)
    entries: list[dict] = []
    goals: dict[str, int] = {}
    seq = 0

    def push(date: str, kind: str, amount: int, title: str, owners: list[str]) -> None:
        nonlocal seq
        entries.append(
            {
                "id": f"ledger-sample-{seq}",
                "date": date,
                "kind": kind,
                "amount": amount,
                "title": title,
                "owners": owners,
            }
        )
        seq += 1

    for month in range(1, 13):
        goals[_to_year_month(SAMPLE_YEAR, month)] = GOAL
        days = calendar.monthrange(SAMPLE_YEAR, month)[1]
        income = 0

        push(
            _to_date_key(SAMPLE_YEAR, month, min(25, days)),
            "income",
            SALARY_TARO,
            "給与",
            [SAMPLE_MEMBERS[0]],
        )
        income += SALARY_TARO
        push(
            _to_date_key(SAMPLE_YEAR, month, min(25, days)),
            "income",
            SALARY_HANA,
            "給与",
            [SAMPLE_MEMBERS[1]],
        )
        income += SALARY_HANA

        if month == 12:
            push(
                _to_date_key(SAMPLE_YEAR, 12, 10),
                "income",
                BONUS_TARO,
                "冬の賞与",
                [SAMPLE_MEMBERS[0]],
            )
            income += BONUS_TARO
            push(
                _to_date_key(SAMPLE_YEAR, 12, 10),
                "income",
                BONUS_HANA,
                "冬の賞与",
                [SAMPLE_MEMBERS[1]],
            )
            income += BONUS_HANA

        target_spend = js_round((income * SPEND_RATIO[month]) / 100) * 100
        push(
            _to_date_key(SAMPLE_YEAR, month, 1),
            "expense",
            RENT,
            "家賃",
            list(SAMPLE_MEMBERS),
        )

        remaining = target_spend - RENT
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
                _to_date_key(SAMPLE_YEAR, month, day),
                "expense",
                amount,
                _pick(rng, EXPENSE_TITLES),
                [_pick(rng, SAMPLE_MEMBERS)],
            )

    return entries, goals


# sampleEvents.ts と同じ定数、同じ mulberry32(20260917)。
EVENT_SEED = 20260917
SHARED_RATIO = 0.12
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
SIGNATURE_DAYS = {
    "2026-12-19": ["wedding", "beauty", "restaurant", "travel", "wedding", "restaurant", "beauty", "travel", "wedding"],
    "2026-03-27": ["work", "work", "work", "restaurant", "work", "gym", "work", "hospital"],
    "2026-10-10": ["travel", "travel", "restaurant", "beauty", "gym", "restaurant", "travel"],
    "2026-06-06": ["wedding", "beauty", "restaurant", "travel"],
}


def _weekday_sun0(year: int, month: int, day: int) -> int:
    """Date.getDay。0 = 日曜。"""
    return (calendar.weekday(year, month, day) + 1) % 7


def _pick_owners(rng: Callable[[], float], category: str) -> list[str]:
    if category == "wedding" or rng() < SHARED_RATIO:
        return list(SAMPLE_MEMBERS)
    return [_pick(rng, SAMPLE_MEMBERS)]


def build_sample_events() -> tuple[list[str], list[dict]]:
    """サンプルのメンバーと一年分の予定。sampleEvents.ts と同じ並び。"""
    rng = mulberry32(EVENT_SEED)
    events: list[dict] = []
    seq = 0

    def push(date: str, category: str) -> None:
        nonlocal seq
        events.append(
            {
                "id": f"sample-{seq}",
                "date": date,
                "title": _pick(rng, EVENT_TITLES[category]),
                "category": category,
                "owners": _pick_owners(rng, category),
            }
        )
        seq += 1

    for month in range(1, 13):
        days = calendar.monthrange(SAMPLE_YEAR, month)[1]
        for day in range(1, days + 1):
            date = _to_date_key(SAMPLE_YEAR, month, day)
            fixed = SIGNATURE_DAYS.get(date)
            if fixed is not None:
                for category in fixed:
                    push(date, category)
                continue
            weekday = _weekday_sun0(SAMPLE_YEAR, month, day)
            pool = WEEKEND_CATEGORIES if weekday in (0, 6) else WEEKDAY_CATEGORIES
            if rng() < 0.2:
                continue
            raw = rng() * 3.2 * MONTH_BUSYNESS[month] + (3 if rng() < 0.15 else 0)
            count = min(10, math.floor(raw))
            for _ in range(count):
                push(date, _pick(rng, pool))
    return list(SAMPLE_MEMBERS), events
