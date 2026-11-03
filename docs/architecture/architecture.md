# アーキテクチャ

技術スタック・画面構成・`src/` 配下の構造をここに集約する。
「技術スタック」は開発開始前に `docs/human_idea/` をもとに AI が決定して記入する。それ以外は骨組みを作った後に記入する。

対象アプリ：**予定の混み具合マップ** — カレンダーの予定を、マイクラ風ブロックの山と小さな町として 3D で俯瞰する（`docs/human_idea/concept.md`）。

## 技術スタック

- 種別：**フロント + このPCの家計・予定サーバー**（クラウドへは出さない。予定・メンバー・家計・月目標は、サーバーを動かしている1台の SQLite。ログイン中の名前だけ各ブラウザの `localStorage`。同じWi-Fiの人は、その1台の開発サーバーURLを開く。審査員のネットワークへは出さない）
- 言語・フレームワーク：**Vite 8 + React 19 + TypeScript**（テンプレート `react-ts`）
  - 3D 描画：**three.js 0.186** + **@react-three/fiber 9**（React 19 とペア）+ **@react-three/drei 10**（`OrbitControls`）
  - 2D ヒートマップ：ライブラリなし。CSS Grid の `button` で描く
  - スタイル：素の CSS（`src/src/styles/global.css`）。UI ライブラリは入れない。書体は DotGothic16（日本語ドット体、OFL）を `src/public/fonts/` に同梱し `@font-face` で読む。ネットワーク不要
  - 3D モデル：外部アセット（glb 等）は使わない。`boxGeometry` を組み合わせた **ボクセル（ドット風）モデルをコードで生成** する。ローダー不要・アセット管理不要・見た目がマイクラ風で揃う
  - 3D 内の文字（日付・曜日）：フォントを使わず **3×5 ピクセルフォント**（`lib/pixelFont.ts`）を `InstancedMesh` 1 つで描く
  - リンター：oxlint（Vite 8 の `react-ts` テンプレート既定）
- 初期化コマンド（実施済み。`src/` が Vite プロジェクトルート）：

  ```bash
  npm create vite@latest src -- --template react-ts
  cd src
  npm install react@~19.2.8 react-dom@~19.2.8   # fiber 9.7 の peer 条件が react <19.3 のため 19.2 系に固定
  npm install three @react-three/fiber @react-three/drei
  npm install -D @types/three
  ```

- 起動コマンド：
  - 家計簿サーバー：`cd server && source .venv/bin/activate && python app.py`（`http://127.0.0.1:8787`）
  - 画面：`cd src && npm run dev`（`http://localhost:5173`。`/api` は Vite が 8787 へ渡す）
- 型チェック・リンター・ビルド：`cd src && npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build`
- 家計簿サーバーの確認：`cd server && source .venv/bin/activate && python -m unittest discover -s tests -v`
- 外部 API・秘密情報：予定・家計は本機の 127.0.0.1:8787 だけ。画面の開発サーバーは同じWi-Fiからも開き、`/api` はそのPCの中で 8787 へ渡す。予定と家計は `server/data/ledger.sqlite`。空の予定テーブルは起動時に `sampleEvents.ts` と同じシード（年ごとに 20260917 + (年 − 2026) × 10000）、空の家計は `sampleLedger.ts` と同じシード（20261014 + (年 − 2026) × 10000）で **2025〜2027 年の 3 年分** を入れる。Google カレンダー連携は「あれば嬉しい機能」で未着手
- **持ち物提案**はサーバーが外部 API を順に呼ぶ（キーはフロントに出さない。`secret/.env`）。Overpass API（場所名→緯度経度と OSM タグ）→ YuMake 体感温度予報 API（降水量・風・気温・湿度・気圧・雲量・体感温度・WBGT・不快指数・風冷指数。最大 78 時間先）→ Claude API（持ち物と LINE 本文）→ LINE Messaging API（push）。Claude は HTTP の呼び出し役にはしない。キーをブラウザに出さず、場所検索と天気取得を止めずに失敗メッセージを出すため。今日明日天気 API と週間天気 API は地点コードが別に要り、体感指標が無いので使わない
- **リアルタイム天候**：サーバーの `GET /api/weather` が YuMake 体感温度予報（`secret/.env` の `WEATHER_LAT` / `WEATHER_LON`、未設定なら大阪城）を 10 分キャッシュで返し、現在時刻に最も近い行の天気文字列（90 分以内に無ければ降水量・雲量から判定）で `condition`（clear / cloudy / rain / snow / thunder）を決める。取得できないときは晴れの既定値と `error` を返し、画面は右上に理由を小さく出して止まらない。画面側は端末の時計で時刻帯（day / evening / night）を決め、`WorldCanvas` の光・fog、`body` の空グラデーション、`WeatherFx`（雨・雪・雲・雷）に反映する
- **BGM / SE**：音声は `src/audio/bgm/<用途>/*.mp3` と `src/audio/se/<用途>/*.mp3`（Vite の `import.meta.glob` で収集。フォルダ名が用途）。`lib/audio.ts` の `AudioEngine` が場面ごとの BGM（複数曲はランダム、同じ曲を続けない、0.6 秒クロスフェード、曲が終わったら次もランダム）と SE を鳴らし、音量は `localStorage`（`caland-audio`）。ブラウザの自動再生制限により最初のクリックまで BGM は鳴らない
- 家計簿バックエンド：**Python 3.11 標準ライブラリのみ**（`http.server` + `sqlite3`）。追加パッケージは入れない。仮想環境は `server/.venv`
- ログイン：**ID（表示名を兼ねる）とパスワード**。パスワードはサーバーの SQLite `members` に PBKDF2-HMAC-SHA256（salt 付き、標準ライブラリ）で保存し、`POST /api/login` / `POST /api/register` で照合・登録する。サンプルメンバー「たろう」「はなこ」の初期パスワードは `1234`。今どの名前で入っているかだけ `localStorage` の 1 キー（`schedule-terrain-map`、`version` 4）に残し、リロードしてもログインのまま。バージョンが違う保存データは捨てる
- 動作確認ブラウザ：Cursor 内蔵ブラウザ（WebGL 必須）
- 迷ったときの既定：フロントのみ、Vite + React + TypeScript（`npm create vite@latest src -- --template react-ts`）。
  バックエンドが不要な構成を選び、状態はブラウザ内（メモリ / localStorage）で持つ。

### 採用理由（短く）

- 「目を引く 3D」が評価軸の最優先。React Three Fiber は React の状態管理でシーンを組めるため、ビュー切替（年 → 月 → 日）とカメラ演出を React state だけで扱える
- 3D の月・日・年ビューは本機だけで回る。持ち物提案だけ、サーバーが Overpass / YuMake / Claude / LINE を順に呼ぶ（キーはフロントに出さない）
- ボクセルをコード生成にすることで、3D モデル担当と画面担当が **別ファイルで並列作業** できる（§3.2 コンフリクト回避）

## 画面・構成の概要

単一ページ。`App` が `view` state を持ち、画面を切り替える。ブラウザのルーティングは使わない。
3D は **1 つの `<Canvas>`（`WorldCanvas`）** に、タイトルの飾り島（`TitleWorld`）・月のカルーセル（`MonthWorld`）・12 島の年ワールド（`YearWorld`）を **同時にマウント** し、`visible` で切り替える。WebGL コンテキストを作り直さず、隣の月・隣の年の島も先に建てておくので、切り替えに読み込み待ちが無い（＝キャッシュ）。

```
タイトル（ログイン）画面 ── ID・パスワード ──▶ メイン画面 ── 下部バー「設定」──▶ 設定画面（メインに戻る）
          ▲                                   │
          └──────── 下部バー「ログアウト」 ────┘

メイン画面（画面下部の BottomBar と、画面左右の SideArrows で移動する）
  month（3D 月カルーセル）──日をクリック──▶ day（3D 日ズーム）──「月に戻る」──▶ month
  month ──「年カレンダー」：クローズアウト + 雲 ──▶ year（3D の 12 島）──島をクリック：雲 + クローズアップ──▶ month
  friend（友達 1 人の島。見るだけ。入る前に「移動中…」のローディング画面）──「友達の年間」⇄「友達の月間」──▶ friendYear（友達の 12 島）
  ledger（管理機能「家計簿」。月の島を背景に家計簿パネル）
```

### 0. タイトル（ログイン）画面 `TitleScreen` + `TitleWorld`

- ログアウト中（初回アクセス・ログアウト後）は必ずここを通る。3D には実データを見せず、固定の飾り島（`data/titleIsland.ts`、6 月の 5 行グリッドに 0〜7 件の塔）を `OrbitControls` の autoRotate でゆっくり回す
- 上部に CALAND のロゴ（`CalandLogo.tsx`、ピクセルアートの SVG ワードマーク。頭出し版。最後にチームで FIX）と「毎日が、村になる。」。下部に点滅する「画面をクリック！」
- 画面をクリック（Enter / Space でも可）するとログインの看板：ID（12 文字まで）・パスワード・「ログイン」。「新規登録」で ID・パスワード・確認の登録フォームに切り替わる。失敗はサーバーのメッセージ（「IDまたはパスワードが違います」「この ID はもう使われています」）を赤字で出し、看板を揺らす。Escape で戻る
- ログインすると **今日の月**（`new Date()` の年月）の月ビューを開く。その前に「{名前} の島 / 準備中…」のローディング画面（`TravelLoading` の `build` 版：島が砂浜 → 土 → 草 → 塔 → 屋上の順に組み上がる 2D アニメ）を、本物の読み込み完了と最短 2 秒の両方を満たすまで見せる

### 1. 下部バー `BottomBar`（メイン画面の共通ナビ）

- マイクラのインベントリ（ホットバー）を指標にした横一列のスロット。今いる表示のスロットは白枠で点灯。ホバー / フォーカスでスロットの真上に「機能タイトル」の看板が出る。アイコンは `components/hud/icons/` のピクセルアート SVG（16×16、コード生成）
- スロット（左から）：
  1. **年カレンダー / 月カレンダー**：押すと切り替わる先を描く。年表示中は「月カレンダー」、それ以外は「年カレンダー」。月⇔年は雲の遷移を挟む
  2. **友達の島へ移動**：背景をブラーして行き先のポップアップ（`DestinationPicker`）を出す。自分の島にいるときは友達だけが候補、友達の島にいるときは「自分の島に戻る」（と他の友達）。どちらを選んでも同じローディング画面を挟んで移動する。自分以外のメンバーがいなければ押せない（看板は「友達がまだいません」）
  3. **管理機能**：押すとスロットの上方向にリストが開く。`MANAGE_FEATURES`（家計簿 / 筋トレ / 勉強 / NISA）を並べ、`available: false` のものは押せず「準備中」。家計簿を押すと `ledger` 表示へ。後でサンドボックス化のインポート機能と合わせる予定
  4. **設定**：設定画面へ
  5. **ログアウト**：タイトル画面へ
- タイトル画面と設定画面では出さない。**友達の島では「友達の年間 / 友達の月間」「友達の島へ移動」「設定」「ログアウト」の 4 スロット**（`showManage` = false、`friendCalendar` = true でスロット 1 の名前が変わる）。家計簿（管理機能）では 5 スロットすべてを出し、スロット 1 は「年カレンダー」

### 2. 左右の矢印 `SideArrows`（月と年の移動）

- 画面の左右の縦中央に大きな「◀」「▶」の看板ボタン。その下に行き先の名前（月ビュー・友達の島・家計簿では「2月」「4月」、年ビューでは「2025」「2027」）
- 月は 12 月の次が翌年 1 月（`shiftYearMonth`）。年は前後の年へ。日ビューと遷移中は出さない

### 3. 月ビュー `month`（MVP の主役）

- `MonthWorld`：中央の月の島を原点に、**前月の島を x = −32、翌月の島を x = +32**（`MONTH_PITCH`）に同時に建てる（3 島カルーセル）。隣の島は fog（18〜44）の中にあり、カメラを回しても靄の向こうにうっすら見える程度。矢印で月を送ると、全体の group が ±32 から 0 へ指数補間でスライドし、隣の島が中央に来る（新しい隣の島はその間に奥で建つ）。1 か月以外のジャンプはスライドせず即時
- 各島の中身は従来どおり：カレンダーグリッドは横 7 列（Sun〜Sat）× 週数、1 日 = 1 マス。`DayTower`（地面 + 予定数ぶんのブロック + 屋上 3×3 のボクセル建物）、海の日は水ブロック、曜日の木の看板、村人、日付のピクセル文字、黄金郷の月はリゾート屋上・金貨・ヨット（`LuxuryFx` / `LuxuryMarina` を島ごとの group に出す）。島ごとのテーマは `themeOf(year, month)` で決める
- カメラは `computeMonthPose`（斜め上の三人称俯瞰。`OrbitControls` で回転・ズーム可）
- HUD：左上に巨大な月数字・英語月名・「2026年11月 · 予定 N 件」、黄金郷なら「貯金目標を達成 · 黄金郷」。右上にログイン中のメンバー。右下にメンバー色とカテゴリの凡例。下中央（下部バーの上）にホバー中の日付・件数・持ち主内訳
- 日マスをホバー → 金色の半透明ハイライトと持ち主色の台座。クリック → `day` ビューへ

### 4. 日ビュー `day`（ズームイン）

- 同じ Canvas のまま、カメラだけをクリックした日の **最上段ブロックの真上付近** へ補間移動（`dayCameraPose`）。`OrbitControls` の `target` をその日の塔の頂点にし、町を回して眺められる
- HUD（`DayHud`）：日付・予定タイトル一覧（カテゴリアイコン・所有者チップ・場所）、「参加する」「削除 / 抜ける」、予定を建てるフォーム（タイトル・種類・誘う・場所）。場所を入れるとサーバーが持ち物を提案し LINE に送る。「月に戻る」→ 月俯瞰へ

### 5. 年ビュー `year`（3D の 12 島）

- `YearWorld`：海の上に 12 の島を **横 4 列 × 縦 3 段**（左上が 1 月、右下が 12 月。島の間隔 x 10 / z 9）に並べる。GPU の無いラップトップで滑らかに動かすため、年の島は **積みブロックだけの簡略島**（屋上の建物・村人・金貨は無し。`BlockKind` ごとの `InstancedMesh` で描く）。黄金郷の月は金ブロック。各島の手前の海面に月の数字（ピクセル文字）
- 前年・翌年の 12 島も x = ∓56 に建てておき、矢印で年を送るとスライドする（キャッシュ）
- 島をホバー → 金色のハイライトと下中央の「3月 · 予定 83 件 · 黄金郷」。クリック → その月へ
- HUD（`YearHud`）：左上に巨大な年「2026」と「一年を、上から見る。」「12 の島 · 予定 N 件」。右下に標高（海 / 0〜6+ / 雪山）と黄金郷の凡例
- カメラは `yearOverviewPose`（高い俯瞰）。fog は遠く（40〜110）、カメラの far は 200

### 6. 月 ⇔ 年の遷移（雲）

- 月 → 年：カメラを `monthPullOutPose`（島の真上・高め）へ引きながら `CloudOverlay` を出す（0.45 s）。雲が覆ったら `YearWorld` を visible にし、カメラをその月の島への寄り `yearIslandClosePose` へ **瞬間移動（`CameraRig` の `snap`）** してから `yearOverviewPose` へ補間、雲を外す（合計 0.8 s）
- 年 → 月：逆順。`yearIslandClosePose(月)` へ寄せる → 雲 → `MonthWorld` を visible にし `monthPullOutPose` から `computeMonthPose` へ
- `App` の `showYear` / `showMonth` がこのタイミング（`CLOUD_COVER_MS` 450 / `CLOUD_CLEAR_MS` 800）を持つ。遷移中は矢印を出さない

### 7. 友達の島 `friend` とローディング画面

- 下部バー「友達の島へ移動」→ ブラー背景の `DestinationPicker` で行き先を選ぶ → `TravelLoading`（`travel` 版。全画面。ピクセル SVG の空・雲・島の横顔・流れる波。ハートの旗の飛行機が左下から右下へ半円を描いて飛ぶ。「{行き先} の島へ」「移動中…」の点が順に点灯）を出し、同時に `MonthWorld` を友達の予定で建て直す。友達の島から「自分の島に戻る」も同じローディングを挟む
- **本物の読み込み完了**（`MonthWorld` が新しい `readyKey` で最初に描画したフレームの `onReady`。`readyKey` にはローディングの開始時刻を含め、ログインのようにワールドが先に描画済みでも開始後の最初の描画で完了になる）と **最短 2 秒** の両方を満たしたらフェードアウト（0.4 s）して外す
- 友達の島は見るだけ：日をクリックして降りない。ホバーは日付と件数だけ（持ち主内訳や予定名は出さない）。右上に今いる島の名前。別の友達へはポップアップから（ローディング画面をもう一度通る）
- **友達の年間**（`friendYear`）：下部バー「友達の年間」で、友達の予定だけで建てた 12 島の年ビューへ。雲の遷移・左右の矢印（前年・翌年）・島クリックで月へ、は自分の年ビューと同じ仕様。HUD の見出しは「{友達} の一年を、上から見る。」
- 自分と友達の両方が所有者の予定がある日は、塔から画面外（奥の霧の中、`FRIEND_FLIGHT_DISTANCE` 20）へハートの旗を曳く飛行機（`Flight.tsx`）が往復する。飛行機をクリックすると下中央に「日付 — ふたりの予定 N 件」
- `split`「ふたりの島」（自分の島と相方の島を並べる旧モード）のコードは `MonthWorld` の `partner` に **予備** として残す。画面のボタンからは出せない

### 8. ログインと共有

- **自分の島は自分が所有者の予定だけ**を建てる（共有の予定は台座が縦縞）。新しいアカウントはまっさらな島から始まる
- メンバーごとに識別色（`lib/members.ts` の `MEMBER_PALETTE`、登録順）。凡例にメンバー色と「みんなの予定」（全員の色の縦縞）
- ホバー / 選択中のタワーでは、屋上の各建物が少し浮き、足元に所有者色の台座（`OwnerPlate`）が出る。2 人以上で共有する予定は台座を人数ぶんの縦縞に分割する
- 状態管理は `hooks/useSharedCalendar.ts`（予定・メンバー・ログイン）の 1 か所。`login(name, password)` / `register(name, password)` / `addEvent` / `joinEvent` / `removeEvent` / `resetToSample` は `/api` に書いてから読み直す。`logout` と、今入っている名前の記憶だけはこのブラウザ。初回と、その後 2 秒ごとに `GET /api/calendar` する。内容が同じなら画面は描き直さない。失敗したらエラー文をそのまま画面に出す

### 9. 家計簿と黄金郷（管理機能）

- **家計はメンバーごと**。メンバー M の家計 = `owners` に M を含む記帳（`lib/ledger.ts` の `entriesOf`）。収入・支出は `LedgerEntry`（日付・種類・金額・タイトル・記帳者）。新しいアカウントは記帳も目標も無いので黄金郷にならない
- 保存先はサーバーの SQLite。月の貯金 = その月の収入合計 − 支出合計。月ごとの目標は **メンバーごと** `goals['<メンバー>']['YYYY-MM']`（テーブル `monthly_goals`、主キー `(owner, year_month)`、`goalsOf`）。目標が書いてあり、貯金 ≥ 目標ならその人の島のその月は `luxury`（黄金郷）。目標が無い月は達成扱いにしない。島のテーマと達成エフェクトは **島の持ち主**（自分の島は自分、友達の島は友達）の家計で決める
- 固定サンプルは、たろう・はなこ それぞれの給与・家賃の半分・支出で、月目標は 1 人 30,000 円。毎年 1・3・4・7・11・12 月が達成、6・8・10 月などは未達。**今日より後の記帳は DB に入れない**（`db._today()`、テストは `TODAY_OVERRIDE` で固定）ので、未来の月は黄金郷にならない（今月も 25 日の給与前は未達）
- 下部バー「管理機能 → 家計簿」（`ledger` 表示）で記帳・削除・目標変更ができ、達成／未達は 3D に即座に反映される。パネルは画面右（右矢印と重ならない `right: 120px`）、見出し横に月送り「◀」「▶」と「✕ 閉じる」（月ビューへ戻る）
- **管理機能はモジュール**（サンドボックス化でインポートする前提）：`src/src/management/`。`types.ts` の `ManagementModule`（id・名前・アイコン・データ用 hook `useRuntime`（達成判定 `isAchieved(owner, year, month)` とパネル描画 `renderPanel`）・達成時の島テーマ `achievedTheme`・達成エフェクト `Celebration`）を `registry.ts` の `MANAGEMENT_MODULES` に 1 行足すだけで、下部バーのリスト・右のパネル・島の黄金郷・達成エフェクト・BGM / SE（management）がつながる。`useRuntime` の無いもの（筋トレ・勉強・NISA）は「準備中」で並ぶ。家計簿は `ledgerModule.tsx`。ViewState は `{ kind: 'manage', module, year, month }`
- **達成エフェクトは汎用化**：`components/effects/CelebrationRain.tsx` が「降り注ぐオブジェクト群」（geometry / material / count / 大きさ・回転・落下速度のばらつき）を受け取り、達成した月に入る / 出るときの全体のフェードイン・アウト（1 秒）、**1 個ずつも上端の帯で現れて下端の帯で消える**（個体ごとの不透明度を InstancedBufferAttribute で渡し、複製した材質のシェーダーで掛ける。大きさも 0.45 → 1）と、 XY の揺れ・風・再出現のランダム化を付けて降らせる。家計簿の金貨と札は `LuxuryFx.tsx` がこの包みとして呼ぶ。管理機能のサンドボックス化（別メンバーが実装中）では、別のオブジェクト群を渡して同じ演出を使う
- **家計簿はカレンダーと別の機能として分けてある**：状態は `hooks/useLedger.ts`（`/api/ledger` を 2 秒ごとに読む）、画面は `components/ledger/LedgerScreen.tsx` + 専用 CSS。カレンダー側（`useSharedCalendar` / `MonthHud`）は家計を参照しない。両者をつなぐのは `App` が `isMonthLuxurious` で決める島のテーマ（黄金郷）だけ
- API（すべて JSON。失敗時は `{ "error": "<例外メッセージ>" }`）：
  - `GET /api/ledger` → `{ entries, goals }`
  - `POST /api/ledger` 本文 `{ date, kind, amount, title, owner }` → 201 で 1 件
  - `DELETE /api/ledger/<id>?user=<名前>` → 204。自分の記帳以外は 403
  - `PUT /api/goals` 本文 `{ owner, year, month, amount }` → `{ owner, yearMonth, amount }`。owner は登録済みメンバー（未登録は 400）。`GET /api/ledger` の goals は `{ メンバー: { YYYY-MM: 金額 } }`
  - `POST /api/ledger/reset` → 家計だけサンプルで作り直し、`{ entries, goals }`
  - `GET /api/calendar` → `{ members, events }`（`members` は名前の配列。ハッシュや salt は返さない）
  - `POST /api/login` 本文 `{ name, password }` → 200 `{ name }`。違えば 401 `{ "error": "IDまたはパスワードが違います" }`（名前の有無は言わない）
  - `POST /api/register` 本文 `{ name, password }` → 201 `{ name }`。name は 1〜12 文字、password は 4〜64 文字。既存なら 409 `{ "error": "この ID はもう使われています" }`
  - `POST /api/events` 本文 `{ date, title, category, owner, invited, place }` → 201 で 1 件。`place` は任意
  - `POST /api/events/<id>/join` 本文 `{ user }` → 予定 1 件
  - `POST /api/events/<id>/leave` 本文 `{ user }` → `{ event }`。最後の所有者が抜けると `event` は null
  - `POST /api/reset` → 予定・メンバー・家計をサンプルで作り直し、`{ entries, goals, members, events }`
  - `GET /api/weather` → `WeatherNow`（`condition` / `weatherText` / `temperatureC` / `precipitationMm` / `cloudPct` / `windSpeedMs` / `forecastTime` / `fetchedAt` / `place` / `error`）。失敗時も 200 で `error` に理由
  - `GET /api/health` → `{ "ok": true }`
  - `POST /api/suggest` 本文 `{ date, title, category, place }` → `{ place: { name, lat, lon }, weather, items, message }`。`message` は LINE へ送信済み。YuMake の予報範囲外の日付や、キー未設定、場所が見つからないときは `{ "error": "<例外メッセージ>" }` で止める

### 10. 持ち物提案（場所を入れた予定）

- キーは `secret/.env`（`CLAUDE_API_KEY` / `YUMAKE_API_KEY` / `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_PUSH_TO`）。サンプルは `secret/.env.template`
- 画面は `/api/suggest` だけを呼ぶ。Overpass・YuMake・Claude・LINE の URL もキーもフロントに置かない
- 天気は YuMake 体感温度予報（`feelsLike.php?lat&lon`）。目的地の緯度経度を Overpass からそのまま渡せる。公開 Overpass が 502 か 504 のときは、同じ検索を 2 秒、4 秒、8 秒待って最大 4 回までやり直す。それでも失敗したらそのエラーをそのまま出す。予報は発表時刻から最大 78 時間先なので、デモでは今日から 3 日以内の日付で場所を入れる
- Claude は持ち物の案を作り、同じ天気の数値で検討し直してから LINE の本文を書く。降水が 0 で天気が雨・雪・雷でないときは傘などの雨具を送らない。防寒は体感の最低が 18℃未満、暑さ対策は体感の最高が 22℃以上のときだけ。検討後も矛盾が残ったら送らずにエラーで止める。本文は絵文字と空行で区切る
- LINE は Messaging API の push（`/v2/bot/message/push`）。送信先は LINE Developers コンソールのユーザー ID（`LINE_PUSH_TO`）。ボットを友だち追加したアカウントだけ届く

### 11. 設定画面

下部バー「設定」で開く（`SettingsScreen.tsx`）。3D は見せず、マイクラのオプション画面のような暗い土ブロックのタイル背景（SVG data URI を TSX で生成）。中身はログイン中の名前、BGM 音量・SE 音量のスライダー、**デバッグモード**（トグル。ON のあいだは天気 5 種と時刻帯 3 種を手で選び、3D・空・右上の表示に反映。状態はメモリのみで、読み込み直すと OFF）、「保存したデータを消してサンプルに戻す」、「メインに戻る」。

### 12. 天候・時刻と音

- 右上（ログイン中の名前の下）に `WeatherBadge`：「☁ くもり 17℃ · 夕方」。取得できないときは「天気を取得できません：理由」を小さく出す
- `App` が `body` に `sky-day / sky-evening / sky-night` と `weather-<condition>` を付け、`global.css` の空グラデーションを `WorldCanvas` の fog 色（`HORIZON_BY_PHASE` / `horizonColorFor`）に合わせる
- BGM の場面：タイトル `opening`、ログイン後ローディング `loading_main`、月・年・日・家計簿 `main`、設定 `setting`、友達の島へのローディング `loading_friend`、友達の島（月・年）`friend`、自分の黄金郷の月は `management` に曲があればそれ（無ければ `main`）。SE：「画面をクリック！」`opening_click`、ログイン完了 `login`、ボタン `button`（`AudioProvider` が `button` 要素のクリックを拾う。`data-no-se` で除外）、黄金郷の月に入ったとき `management`、ログアウト `logout`

### 初期表示

未ログインならタイトル画面。ログイン直後と、ログイン維持でのリロードは **今日の月** の `month` ビュー。

## データモデル

```ts
// src/src/types/calendar.ts
export type EventCategory =
  | 'beauty'      // 美容室
  | 'restaurant'  // 飲食店
  | 'work'        // 仕事・会議
  | 'wedding'     // 結婚式
  | 'hospital'    // 病院
  | 'gym'         // ジム
  | 'travel'      // 旅行
  | 'school';     // 学校・習い事

export interface CalendarEvent {
  id: string;
  date: string;          // 'YYYY-MM-DD'
  title: string;
  category: EventCategory;
  owners: string[];      // 所有するメンバー名（1 人以上）。2 人以上なら共有の予定
  place?: string;        // 行き先。持ち物提案に使う。'' または未設定は場所なし
}

export type IslandLayout = 'merged' | 'split' | 'friend';
export type ManageFeature = 'ledger' | 'training' | 'study' | 'nisa';   // MANAGE_FEATURES に label と available

export type ViewState =
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number }               // month: 1-12
  | { kind: 'day'; year: number; month: number; day: number }
  | { kind: 'friend'; year: number; month: number; friend: string }  // 友達の島
  | { kind: 'friendYear'; year: number; friend: string }             // 友達の年間
  | { kind: 'ledger'; year: number; month: number };                 // 管理機能「家計簿」

// src/src/types/ledger.ts
export type LedgerKind = 'income' | 'expense';
export type IslandTheme = 'plain' | 'luxury';

export interface LedgerEntry {
  id: string;
  date: string;          // 'YYYY-MM-DD'
  kind: LedgerKind;
  amount: number;        // 円。1 以上の整数
  title: string;
  owners: string[];
}
```

- カテゴリ → ボクセル建物コンポーネントの対応表を `components/models/objects/index.ts` に 1 か所で持つ（新カテゴリ追加は「型に 1 行 + 対応表に 1 行 + 建物ファイル 1 つ」）
- 日別集計は `lib/calendar.ts` の純関数で行う（`groupEventsByDate`、`buildMonthGrid`）。React 側は計算しない

## 3D 表現の規約

- 単位：1 マス = 1 × 1（`CELL_SIZE`）。タワーの幅は 1.0（`TOWER_WIDTH`。マスいっぱいに使う）、ブロックの高さは 0.5（`BLOCK_HEIGHT`）。グリッドは原点中心に置き、x = 曜日（`colToX`）、z = 週（`rowToZ`）、y = 高さ。変換は `lib/camera.ts` に集約
- ブロックの質感は高さ（level）で決める：0 = 草の地面、1〜2 = 土（天面なら草）、3〜5 = 石、6 以上 = 雪（`blockKindForLevel`）。黄金郷では 0 = 砂金の浜、それより上は金。黄金郷の高い塔（予定 4 件以上）は側面に金の $ 看板（`luxury/DollarSign`）、6 件以上は屋上にヘリが付く（`LuxuryRooftop`）
- ブロックは `BoxGeometry` + `MeshStandardMaterial` の 6 面配列（フラットな単色。テクスチャ画像は使わない）。材質はモジュール定数として共有する
- 建物モデルは **1 ファイル 1 建物**、`export const Salon = ({ position }: ObjectProps) => …` 形式。中身は `Voxel`（位置・サイズ・色）を `<group>` で束ねた、底面 0.26 × 0.26・高さ 0.45 以内のボクセル（3×3・ピッチ 0.29 に収めるため）。色→材質は `materialFor` でキャッシュして共有する
- ライト：`ambientLight` + 影付き `directionalLight` 1 灯。背景は CSS の空色グラデーション（Canvas は透過）、地面の下に海面（青い平面）、遠景に `fog`（水平線色）で「島の地図」感を出す
- インタラクション：`onPointerOver` / `onClick` はタワーの `group` で受け、`stopPropagation` で手前のタワーだけ反応させる。ハイライトは金色の半透明ボックスをタワーに重ねる（材質の複製は作らない）。ホバーでカーソルを pointer に
- カメラ：`CameraRig` が `pose` の変化を検知して `camera.position` と `OrbitControls.target` を指数補間で寄せ、到着したら補間を止めてユーザー操作に任せる
- パフォーマンス：1 か月分は 31 日 × 最大 11 段 + 建物 ≒ 数百〜千 mesh。月カルーセルは 3 島ぶん同時に建てる。日付ラベルのピクセルは `InstancedMesh` 1 描画。年ビューの 12 島（× 3 年）はブロックだけを `BlockKind` ごとの `InstancedMesh` にまとめ、建物を描かない
- 海（`Sea.tsx`）：波の面は 110 × 110（150 分割）で年ビューの 12 島も覆い、端（中心から 40〜53）で波を静めて遠景の板と継ぎ目なくつなぐ。島の近く（半径 5）は振幅 ±0.1、半径 12 で 3 倍まで高くなり、頂点カラーで波の山を薄い水色・谷を濃くする。黄金郷の海色は通常との差を半分（`luxurySea #34ace7`）
- 飛行機（`Flight.tsx`）は smoothstep の加減速。周囲の浮島は海面に接地
- 光と fog は `WorldCanvas` の `SceneLighting` が theme × 時刻帯 × 天気の目標値へ指数補間する（evening は暖色の低い太陽、night は青白く暗く黄金郷の金の光だけ残る、rain / thunder は暗く fog が近い）
- 雲（`WeatherFx`）：カメラには追従せず、ワールドの決まった帯に置いて x 方向へゆっくり流す。帯は既定のカメラから見て画面に入り、島に重ならない位置（年ビューは 12 島の左右と奥の高さ 12〜14、月ビューは島の左右と奥の高さ 5〜7）。`cloudLayout`（month / year）で切り替え
- ワールドの切り替え：`WorldCanvas` の子（`TitleWorld` / `MonthWorld` / `YearWorld`）は `visible` で出し入れし、非表示のワールドにはポインタのハンドラを付けない。カメラの瞬間移動は `CameraRig` の `snap`（key が変わったら `from` へ copy してから `pose` へ補間）

## 固定データ（デモ用）

- `src/src/data/sampleEvents.ts`：`SAMPLE_YEARS = [2025, 2026, 2027]` の 3 年分の予定（合計 853 件。2025 年は 2026 年の 0.8 倍、2027 年は 1 月 0.7 → 12 月 0.15 と先へ行くほど少なく、見せ場の日は 2025・2026 年だけ）。年ごとにシードを変え（`20260917 + (年 − 2026) × 10000`）、月ごとに山谷がはっきり出るよう **繁忙月（3 月・10 月・12 月）と閑散月（8 月）** を意図的に作る。見せ場の日（12/19 の結婚式ラッシュなど）は各年の同じ月日に入れる。ID は `sample-{year}-{n}`
- `src/src/data/sampleLedger.ts`：3 年分の家計。給与・家賃と月ごとの支出割合で、達成月と未達月を意図的に作る。ID は `ledger-sample-{year}-{n}`
- `src/src/data/titleIsland.ts`：タイトル画面の飾り島（実データを見せないための固定の塔配置。所有者 `caland`）
- `server/seed.py` は上の 2 つと同じ乱数（mulberry32）と定数で同じ出力を作る。`server/tests/test_ledger.py` が JS 出力の SHA-256 と一致を検証する
- ファイル名・変数名で固定データと分かるようにする（`sampleEvents` / `sampleLedger` / `sampleGoals` / `titleEvents`）

## src/ 配下の構造（実装に合わせて最新化済み：2026-11-03）

```
server/                            ← 予定・メンバー・家計・持ち物のローカルサーバー（Python 3.11+・標準ライブラリのみ）
├─ .venv/                          ← 仮想環境（Mac で作成。Windows ではシステムの python で直接動かす）
├─ app.py                          ← 127.0.0.1:8787 の HTTP。/api/calendar /api/login /api/register /api/events /api/ledger /api/goals /api/suggest /api/reset
├─ db.py                           ← SQLite のスキーマ・CRUD・パスワードのハッシュ照合（PBKDF2）。失敗時は例外を隠さない
├─ seed.py                         ← sampleEvents.ts / sampleLedger.ts と同じシードで 3 年分を入れる。SAMPLE_PASSWORD = "1234"
├─ suggest.py                      ← Overpass → YuMake → Claude → LINE。キーは secret/.env（load_env / fetch_feels_like を weather.py と共有）
├─ weather.py                      ← GET /api/weather：現在の天気（10 分キャッシュ、失敗時は晴れ + error）
├─ tests/                          ← unittest（DB と API）
└─ data/
    └─ ledger.sqlite               ← 本機の DB（gitignore 対象）

src/                               ← Vite プロジェクトルート
├─ audio/                          ← BGM / SE の mp3（bgm/<用途>/、se/<用途>/。フォルダ名が用途。import.meta.glob で収集）
├─ index.html
├─ package.json                    ← 共有ファイル（§3.2）
├─ vite.config.ts                  ← 共有ファイル
├─ tsconfig.json / tsconfig.app.json / tsconfig.node.json ← 共有ファイル
├─ .oxlintrc.json                  ← 共有ファイル（リンター設定）
├─ public/
│   ├─ favicon.svg
│   └─ fonts/DotGothic16-Regular.ttf, OFL.txt ← 同梱フォントとライセンス
└─ src/
   ├─ main.tsx                     ← エントリポイント（共有ファイル）
   ├─ App.tsx                      ← 画面と ViewState、ワールドの切り替え、雲の遷移、ローディングのタイミング（共有ファイル）
   ├─ types/
   │   ├─ calendar.ts              ← CalendarEvent / EventCategory / IslandLayout / ManageFeature / ViewState / CATEGORY_INFO
   │   ├─ ledger.ts                ← LedgerEntry / MonthlyGoals / IslandTheme
   │   └─ weather.ts               ← WeatherCondition / DayPhase / WeatherNow / WEATHER_LABELS
   ├─ data/
   │   ├─ sampleEvents.ts          ← 固定データ：2025〜2027 年のサンプル予定（シード固定生成）
   │   ├─ sampleLedger.ts          ← 固定データ：2025〜2027 年の家計簿と月目標
   │   └─ titleIsland.ts           ← 固定データ：タイトル画面の飾り島
   ├─ lib/
   │   ├─ calendar.ts              ← 月グリッド計算・日別集計・日付表記（純関数）
   │   ├─ camera.ts                ← 座標変換、月俯瞰 / 日ズーム / 引きの姿勢（computeMonthPose / monthPullOutPose）、MONTH_PITCH、FRIEND_FLIGHT_DISTANCE、TITLE_POSE
   │   ├─ pixelFont.ts             ← 3×5 ピクセルフォント
   │   ├─ members.ts               ← メンバー識別色、所有者別の件数内訳、島ごとの予定の振り分け
   │   ├─ ledger.ts                ← 月の収支集計・目標・黄金郷判定・円表記（純関数）
   │   ├─ calendarApi.ts           ← 予定・メンバー・ログイン・登録（/api/calendar /api/login /api/register /api/events）。失敗時は Error
   │   ├─ suggestApi.ts            ← 持ち物提案（/api/suggest）
   │   ├─ ledgerApi.ts             ← 家計簿（/api/ledger /api/goals）
   │   ├─ weatherApi.ts            ← 現在の天気（/api/weather）
   │   ├─ dayPhase.ts              ← 端末の時計 → day / evening / night（useDayPhase）
   │   ├─ audio.ts                 ← AudioEngine：BGM の場面切替（ランダム・クロスフェード）、SE、音量の保存
   │   └─ storage.ts               ← localStorage（version 4。ログイン中の名前だけ）
   ├─ management/                 ← 管理機能のモジュール（types.ts / registry.ts / ledgerModule.tsx）
   ├─ hooks/
   │   ├─ useSharedCalendar.ts     ← 予定・メンバー・ログイン・登録。2 秒ごとに /api/calendar
   │   ├─ useLedger.ts             ← 家計（entries / goals）。2 秒ごとに /api/ledger。カレンダーとは別の hook
   │   ├─ useWeather.ts            ← 10 分ごとに /api/weather
   │   └─ useAudio.tsx             ← AudioProvider / useAudio（最初の操作で unlock、button クリックで SE）
   ├─ components/
   │   ├─ effects/
   │   │   ├─ CelebrationRain.tsx  ← 達成エフェクトの汎用版：objects（geometry / material / count …）を降らせる。フェード・揺れ・風
   │   │   └─ WeatherFx.tsx        ← 雨・雪・雲・雷（InstancedMesh。カメラに追従）
   │   ├─ world/
   │   │   ├─ WorldCanvas.tsx      ← 唯一の <Canvas>：ライト・fog（theme × 時刻帯 × 天気へ補間）・海・OrbitControls（autoRotate / maxDistance）・CameraRig（pose / snap）
   │   │   └─ CloudOverlay.tsx / .css ← 月⇔年の切り替えを隠す雲（CSS、0.45s）
   │   ├─ title/
   │   │   ├─ TitleScreen.tsx / .css ← タイトル：ロゴ・「画面をクリック！」・ログイン / 新規登録フォーム・エラー表示
   │   │   ├─ TitleWorld.tsx       ← Canvas の子：飾り島（DayTower、操作なし）
   │   │   └─ CalandLogo.tsx       ← CALAND のピクセルアート SVG ロゴ（頭出し版）
   │   ├─ year/
   │   │   ├─ yearLayout.ts        ← 4×3 の島の位置、年の間隔（56）、俯瞰 / 島への寄りの姿勢
   │   │   ├─ YearWorld.tsx        ← Canvas の子：3 年 × 12 島の簡略島（InstancedMesh）、月の数字、ホバー / クリック、年のスライド
   │   │   └─ YearHud.tsx / .css   ← 年ビューの HUD（巨大な年・件数・標高の凡例・ホバーの月）
   │   ├─ month/
   │   │   ├─ MonthWorld.tsx       ← Canvas の子：前月・当月・翌月の 3 島カルーセル（±32、靄の中）、日ズーム、友達の飛行機、予備の split、readyKey / onReady
   │   │   ├─ CameraRig.tsx        ← pose へ補間。snap で瞬間移動してから補間
   │   │   ├─ Flight.tsx           ← ハートの旗の飛行機。onClick を渡すとクリックできる
   │   │   ├─ LuxuryFx.tsx         ← 黄金郷のマネーレイン（金貨と札を CelebrationRain に渡す薄い包み）
   │   │   ├─ LuxuryMarina.tsx     ← 海のヨットと周回ヘリ
   │   │   ├─ LuxuryRooftop.tsx    ← 屋上のヤシ・プール・車・噴水・ヘリ
   │   │   ├─ DayTower.tsx         ← 1 日分：地面 + 積みブロック + 屋上 3×3 の建物 + ハイライト + 出現アニメ
   │   │   ├─ Sea.tsx              ← 全体の海面（揺れる水面 + 遠景板 400）
   │   │   ├─ Villagers.tsx        ← 出現アニメ後に島の上を歩く村人
   │   │   ├─ PixelLabels.tsx      ← ピクセル文字を 1 つの InstancedMesh で描く
   │   │   └─ WeekdayHeader.tsx    ← グリッド奥の木の看板（SUN〜SAT）
   │   ├─ ledger/
   │   │   ├─ LedgerScreen.tsx     ← 管理機能「家計簿」：月の収支・目標・記帳・削除・月送り
   │   │   └─ LedgerScreen.css     ← 家計簿専用スタイル
   │   ├─ models/                  ← （変更なし）ブロック・ボクセル建物・黄金郷のパーツ
   │   │   ├─ materials.ts / Voxel.tsx / OwnerPlate.tsx
   │   │   ├─ blocks/blockKinds.ts / Block.tsx
   │   │   ├─ objects/             ← 屋上に並べる建物（1 ファイル 1 棟。各カテゴリ 3 バリエーション）
   │   │   └─ luxury/              ← 黄金郷の装飾パーツ
   │   └─ hud/
   │       ├─ BottomBar.tsx / .css ← 画面下部のホットバー（年/月・友達の島・管理機能リスト・設定・ログアウト）
   │       ├─ SideArrows.tsx / .css ← 画面左右の「◀」「▶」と行き先の看板（月・年の移動）
   │       ├─ icons/index.tsx      ← 機能ロゴ：16×16 ピクセルアート SVG
   │       ├─ TravelLoading.tsx / .css ← ローディング画面。travel = 友達の島へ（島の横顔・半円を飛ぶ飛行機・「移動中…」）、build = ログイン直後（島が組み上がる・「準備中…」）
│       ├─ DestinationPicker.tsx / .css ← 「どこへ行く？」：ブラー背景に友達の候補と「自分の島に戻る」
   │       ├─ SettingsScreen.tsx / .css ← 設定画面（土ブロック背景・名前・BGM / SE 音量・サンプルに戻す・メインに戻る）
   │       ├─ WeatherBadge.tsx / .css ← 右上の現在の天気と時刻帯（取得失敗の理由も）
   │       ├─ MonthHud.tsx         ← 月名・現在のユーザー・凡例・ホバーの日付と所有者内訳・黄金郷の表示
   │       ├─ FriendHud.tsx / .css ← 友達の島：月名・今いる島の名前・カテゴリ凡例・ホバー（日付と件数）・飛行機クリックの件数
   │       └─ DayHud.tsx           ← 日付・予定一覧・予定を建てるフォーム・持ち物提案の結果・月に戻る
   └─ styles/
       └─ global.css               ← デザイントークン、HUD（看板風パネル）、日ビュー、レスポンシブ（各画面の専用スタイルはコンポーネント横の CSS）
```

### UI のデザイントークン（`global.css` の `:root`）

- 色：インク `#1b2a41`、紙 `#fff8e7`、古紙 `#f3e2b6`、金 `#ffc83d`、草 `#5fb63b`、空 `#5cb0ff → #cfeeff`
- 書体：DotGothic16 一系統。ヒーローは左上の巨大な月数字
- パネル・ボタン：3px のインク枠 + 硬い落ち影（角丸なし）。ピクセルゲームの看板の語彙で、3D の町を邪魔しない
- ヒートマップの色は 3D ブロックと同じ「標高」スケール（草 → 土 → 石 → 雪）

### 並列作業の分担単位（コンフリクト回避）

同時に触らないよう、次の単位で分けて着手する。

| 単位 | ファイル |
| --- | --- |
| A. シーンとカメラ | `components/world/**` / `components/month/**` / `lib/camera.ts` / `lib/pixelFont.ts` |
| B. ブロック・建物モデル | `components/models/**` |
| C. データと集計・年ビュー | `data/**` / `lib/calendar.ts` / `components/year/**` / `server/seed.py` |
| D. HUD とスタイル | `components/hud/**` / `components/title/**` / `styles/global.css` |
| E. ログイン・共有の状態 | `hooks/useSharedCalendar.ts` / `lib/calendarApi.ts` / `lib/storage.ts` / `lib/members.ts` / `server/db.py` / `server/app.py` |
| F. 家計簿と黄金郷 | `types/ledger.ts` / `data/sampleLedger.ts` / `lib/ledger.ts` / `hooks/useLedger.ts` / `components/ledger/**` / `components/month/Luxury*.tsx` / `components/models/luxury/**` |
| 共有（声をかけてから） | `App.tsx` / `main.tsx` / `types/calendar.ts` / `package.json` 等の設定ファイル |
