import { type FormEvent, useState } from 'react';
import { memberColor } from '../../lib/members';

export interface LoginScreenProps {
  members: string[];
  onLogin: (name: string) => Promise<void>;
  onReset: () => Promise<void>;
}

/** ユーザー名だけのログイン。既存メンバーはワンクリック、新しい名前は入力で参加する。 */
export const LoginScreen = ({ members, onLogin, onReset }: LoginScreenProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed.length === 0) return;
    void run(() => onLogin(trimmed));
  };

  return (
    <div className="login">
      <section className="login-panel panel" aria-labelledby="login-title">
        <h1 id="login-title" className="login-title">
          誰の地図に降りる？
        </h1>
        <p className="login-lead">
          同じ地図をみんなで作ります。名前を選ぶと、あなたの予定がこの島に建ちます。月の貯金目標を達成すると、島は黄金郷になります。
        </p>

        {members.length > 0 ? (
          <ul className="login-members">
            {members.map((member) => (
              <li key={member}>
                <button type="button" className="btn login-member" onClick={() => void run(() => onLogin(member))}>
                  <span className="chip" style={{ background: memberColor(members, member) }} />
                  {member} として入る
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <form className="login-form" onSubmit={submit}>
          <label className="login-label" htmlFor="login-name">
            新しい名前で入る
          </label>
          <div className="login-row">
            <input
              id="login-name"
              className="input"
              type="text"
              value={name}
              maxLength={12}
              placeholder="例：みさき"
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn" disabled={trimmed.length === 0}>
              はじめる
            </button>
          </div>
        </form>

        {error !== null ? (
          <p className="ledger-status" role="alert">
            {error}
          </p>
        ) : null}

        <button type="button" className="link-btn" onClick={() => void run(onReset)}>
          保存したデータを消してサンプルに戻す
        </button>
      </section>
    </div>
  );
};
