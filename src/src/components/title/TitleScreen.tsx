import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalandLogo } from './CalandLogo';
import './TitleScreen.css';

export interface TitleScreenProps {
  /** 失敗したら Error を投げる（メッセージをそのまま出す） */
  onLogin: (name: string, password: string) => Promise<void>;
  onRegister: (name: string, password: string) => Promise<void>;
  /** 「画面をクリック！」でログインフォームへ進んだときに呼ぶ（効果音用） */
  onStart: () => void;
}

/**
 * - attract ：ロゴと飾り島だけ。「画面をクリック！」が点滅
 * - login   ：ID とパスワードでログイン
 * - register：新規登録（パスワード確認つき）
 */
type Phase = 'attract' | 'login' | 'register';

/**
 * タイトル（ログイン）画面。ログアウト中は必ずここを通る。
 * 背景は透過で、親の Canvas にある飾り島（TitleWorld）が見える。
 */
export const TitleScreen = ({ onLogin, onRegister, onStart }: TitleScreenProps) => {
  const [phase, setPhase] = useState<Phase>('attract');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);

  const trimmedName = name.trim();

  const fail = (err: unknown) => {
    console.error(err);
    setError(err instanceof Error ? err.message : String(err));
    setShaking(true);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      setError(null);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const switchPhase = useCallback(
    (next: Phase) => {
      setError(null);
      setShaking(false);
      if (phase === 'attract' && next === 'login') onStart();
      setPhase(next);
    },
    [phase, onStart],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'attract') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          switchPhase('login');
        }
        return;
      }
      if (e.key === 'Escape') {
        switchPhase('attract');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, switchPhase]);

  const canSubmit =
    !busy &&
    trimmedName.length > 0 &&
    password.length > 0 &&
    (phase === 'login' || confirm.length > 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (phase === 'register') {
      if (password !== confirm) {
        fail(new Error('パスワードが一致しません'));
        return;
      }
      void run(() => onRegister(trimmedName, password));
      return;
    }
    void run(() => onLogin(trimmedName, password));
  };

  const isAttract = phase === 'attract';

  return (
    <div
      className={isAttract ? 'title is-attract' : 'title'}
      onClick={isAttract ? () => switchPhase('login') : undefined}
    >
      <header className="title-head">
        <div className="title-logo">
          <CalandLogo width={460} />
        </div>
        <p className="title-tagline">毎日が、村になる。</p>
      </header>

      <main className="title-main">
        {isAttract ? (
          <p className="title-attract panel" aria-live="polite">
            画面をクリック！
          </p>
        ) : (
          <section
            className={shaking ? 'title-panel panel is-shake' : 'title-panel panel'}
            aria-labelledby="title-form-heading"
            onAnimationEnd={() => setShaking(false)}
          >
            <h1 id="title-form-heading" className="title-panel-heading">
              {phase === 'login' ? 'ログイン' : '新規登録'}
            </h1>

            <form className="title-form" onSubmit={submit}>
              <label className="title-field">
                <span className="title-label">ID</span>
                <input
                  className="input"
                  type="text"
                  value={name}
                  maxLength={12}
                  autoComplete="username"
                  autoFocus
                  placeholder="例：たろう"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="title-field">
                <span className="title-label">パスワード</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  autoComplete={phase === 'login' ? 'current-password' : 'new-password'}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {phase === 'register' ? (
                <label className="title-field">
                  <span className="title-label">パスワード（確認）</span>
                  <input
                    className="input"
                    type="password"
                    value={confirm}
                    autoComplete="new-password"
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              ) : null}

              {error !== null ? (
                <p className="ledger-status title-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="btn title-submit" disabled={!canSubmit}>
                {busy ? '…' : phase === 'login' ? 'ログイン' : '登録してはじめる'}
              </button>
            </form>

            <p className="title-switch">
              {phase === 'login' ? (
                <>
                  はじめての方は{' '}
                  <button type="button" className="link-btn" onClick={() => switchPhase('register')}>
                    新規登録
                  </button>
                </>
              ) : (
                <button type="button" className="link-btn" onClick={() => switchPhase('login')}>
                  ◀ ログインに戻る
                </button>
              )}
            </p>
          </section>
        )}
      </main>

      <aside className="title-hint panel">
        サンプル：たろう / はなこ（パスワード 1234）
      </aside>
    </div>
  );
};
