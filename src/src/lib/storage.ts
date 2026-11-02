/** スキーマを変えたら version を上げる。旧バージョンは捨てる。予定と家計はサーバーに置く。 */
const STORAGE_KEY = 'schedule-terrain-map';
const STORAGE_VERSION = 4;

export const loadCurrentUser = (): string | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    throw new Error(`storage: 保存データの形式が不正です: ${raw.slice(0, 80)}`);
  }
  if ((parsed as { version: unknown }).version !== STORAGE_VERSION) {
    return null;
  }
  if (!('currentUser' in parsed)) {
    throw new Error(`storage: currentUser がありません: ${raw.slice(0, 80)}`);
  }
  const currentUser = (parsed as { currentUser: unknown }).currentUser;
  if (currentUser === null) return null;
  if (typeof currentUser !== 'string' || currentUser.trim() === '') {
    throw new Error(`storage: currentUser の形式が不正です: ${raw.slice(0, 80)}`);
  }
  return currentUser;
};

export const saveCurrentUser = (currentUser: string | null): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, currentUser }));
};
