/** メンバー（ログインユーザー）の識別色。登録順で割り当てる。 */
export const MEMBER_PALETTE = ['#ff2e88', '#19c2ff', '#ffd400', '#7dff5a', '#b06cff', '#ff8a2a'];

export const memberColor = (members: string[], name: string): string => {
  const index = members.indexOf(name);
  if (index < 0) {
    throw new Error(`memberColor: 未登録のメンバー "${name}"`);
  }
  return MEMBER_PALETTE[index % MEMBER_PALETTE.length];
};

/** 予定の所有者ごとの色。共有の予定は 2 色以上になる。 */
export const ownerColors = (members: string[], owners: string[]): string[] =>
  owners.map((owner) => memberColor(members, owner));

/** CSS 用：1 色なら単色、2 色以上なら縦縞のグラデーション */
export const ownerChipBackground = (colors: string[]): string => {
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  const stops = colors
    .map((color, i) => `${color} ${i * step}%, ${color} ${(i + 1) * step}%`)
    .join(', ');
  return `linear-gradient(90deg, ${stops})`;
};

export interface OwnerBreakdown {
  /** 1 人だけの予定：メンバー名 → 件数 */
  solo: Map<string, number>;
  /** 2 人以上で共有している予定の件数 */
  shared: number;
}

/** name が所有者に含まれる予定だけを残す（ふたりの島モードの各島の中身） */
export const eventsOwnedBy = <T extends { owners: string[] }>(events: T[], name: string): T[] =>
  events.filter((event) => event.owners.includes(name));

/** a と b の両方が所有者になっている予定の日付集合（ふたりの島モードで飛行機が飛ぶ日） */
export const datesSharedBetween = (
  events: { date: string; owners: string[] }[],
  a: string,
  b: string,
): Set<string> => {
  const dates = new Set<string>();
  for (const event of events) {
    if (event.owners.includes(a) && event.owners.includes(b)) {
      dates.add(event.date);
    }
  }
  return dates;
};

export const breakdownByOwner = (events: { owners: string[] }[]): OwnerBreakdown => {
  const solo = new Map<string, number>();
  let shared = 0;
  for (const event of events) {
    if (event.owners.length >= 2) {
      shared++;
    } else {
      solo.set(event.owners[0], (solo.get(event.owners[0]) ?? 0) + 1);
    }
  }
  return { solo, shared };
};
