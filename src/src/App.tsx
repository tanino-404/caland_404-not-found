import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomBar } from './components/hud/BottomBar';
import { DayHud } from './components/hud/DayHud';
import { DestinationPicker } from './components/hud/DestinationPicker';
import { FriendHud } from './components/hud/FriendHud';
import { MonthHud } from './components/hud/MonthHud';
import { type ManageMenuItem } from './components/hud/BottomBar';
import { IconLedger, IconManage, IconNisa, IconStudy, IconTraining, type IconComponent } from './components/hud/icons';
import { PluginHud, PluginStart } from './components/hud/PluginHud';
import { SettingsScreen, type WeatherDebug } from './components/hud/SettingsScreen';
import { SideArrows } from './components/hud/SideArrows';
import { TravelLoading } from './components/hud/TravelLoading';
import { WeatherBadge } from './components/hud/WeatherBadge';
import { WeatherFx } from './components/effects/WeatherFx';
import { type IslandLook, MonthWorld } from './components/month/MonthWorld';
import { TitleWorld } from './components/title/TitleWorld';
import { TitleScreen } from './components/title/TitleScreen';
import { CloudOverlay } from './components/world/CloudOverlay';
import { WorldCanvas } from './components/world/WorldCanvas';
import { YearHud } from './components/year/YearHud';
import { YearWorld } from './components/year/YearWorld';
import { yearIslandClosePose, yearOverviewPose } from './components/year/yearLayout';
import { AudioProvider, useAudio } from './hooks/useAudio';
import { usePlugin } from './hooks/usePlugin';
import { useYearAchievements } from './hooks/useYearAchievements';
import { useWeather } from './hooks/useWeather';
import { useDayPhase } from './lib/dayPhase';
import type { BgmScene } from './lib/audio';
import { useSharedCalendar, type SharedCalendar } from './hooks/useSharedCalendar';
import { countEventsInMonth, groupEventsByDate, toDateKey } from './lib/calendar';
import { type CameraPose, TITLE_POSE, computeMonthPose, monthPullOutPose } from './lib/camera';
import { islandFor } from './lib/islands';
import { datesSharedBetween, eventsOwnedBy } from './lib/members';
import { effectById, monthEndKey, monthStartKey, statusAt } from './lib/pluginStatus';
import type { CalendarEvent, ViewState } from './types/calendar';
import type { Island } from './types/island';
import type { PluginState, PluginStatus } from './types/plugins';

export const App = () => (
  <AudioProvider>
    <AppBody />
  </AudioProvider>
);

const AppBody = () => {
  const calendar = useSharedCalendar();
  if (calendar.error !== null) {
    return (
      <div className="app">
        <pre className="boot-panel panel" role="alert">
          {calendar.error}
        </pre>
      </div>
    );
  }
  if (!calendar.ready) {
    return (
      <div className="app">
        <p className="boot-panel panel">地図を読み込んでいます</p>
      </div>
    );
  }
  return <MapScreen calendar={calendar} />;
};

/** メイン画面の上に重ねる画面。settings は下部バーの「設定」 */
type Overlay = 'none' | 'settings';

/** 1 つの Canvas に同時にマウントしている 3 つのワールドのうち、今見せているもの */
type World = 'title' | 'month' | 'year';

/** 雲の下でワールドを切り替えるときのタイミング（ms） */
const CLOUD_COVER_MS = 450;
const CLOUD_CLEAR_MS = 800;
/** ローディング画面（友達の島へ移動 / ログイン後の島づくり）を最短でも見せる時間（ms）とフェードアウト */
const LOADING_MIN_MS = 2000;
const LOADING_FADE_MS = 400;

interface Loading {
  variant: 'travel' | 'build';
  /** 行き先の名前（友達、または自分） */
  name: string;
  startedAt: number;
  /** ワールドが新しい readyKey で最初に描画されたら true（本物の読み込み完了） */
  ready: boolean;
  hiding: boolean;
}

/** 下部バーの「管理機能」リストのアイコン。専用のものが無いプラグインは汎用のアイコン */
const PLUGIN_ICONS: Record<string, IconComponent> = {
  ledger: IconLedger,
  fitness: IconTraining,
  study: IconStudy,
  nisa: IconNisa,
};

const NO_EVENTS_BY_DATE = new Map<string, CalendarEvent[]>();
const PLAIN_LOOK: IslandLook = { island: null, scene: null, sceneKey: 'none' };

/** その月の最終日の時点の目標と進捗（期間中か、直前に終わった目標を見せる） */
const monthStatus = (state: PluginState, year: number, month: number): PluginStatus =>
  statusAt(state.manifest, state.goals, state.entries, monthEndKey(year, month));

/** 表示中プラグインの達成で決まる、その月の島の見た目 */
const lookOf = (state: PluginState | null, year: number, month: number): IslandLook => {
  if (state === null) return PLAIN_LOOK;
  const effect = effectById(state.manifest, monthStatus(state, year, month).effect);
  return {
    island: islandFor(state.manifest, effect.theme),
    scene: effect.scene ?? null,
    sceneKey: `${state.manifest.id}-${effect.id}`,
  };
};

const today = new Date();
const TODAY_YEAR = today.getFullYear();
const TODAY_MONTH = today.getMonth() + 1;

/** (year, month) の前後の月。12 月の次は翌年 1 月 */
const shiftYearMonth = (year: number, month: number, delta: number): { year: number; month: number } => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

const MapScreen = ({ calendar }: { calendar: SharedCalendar }) => {
  const user = calendar.currentUser;
  /** 自分の島に建てる予定：自分が所有者の予定だけ（新しいアカウントはまっさら） */
  const byDate = useMemo(
    () => (user === null ? NO_EVENTS_BY_DATE : groupEventsByDate(eventsOwnedBy(calendar.events, user))),
    [calendar.events, user],
  );
  const { weather } = useWeather();
  const realDayPhase = useDayPhase();
  const audio = useAudio();
  /** 設定のデバッグモード：ON のあいだは天気と時刻帯を手で選んだものにする */
  const [weatherDebug, setWeatherDebug] = useState<WeatherDebug>({
    enabled: false,
    condition: 'clear',
    dayPhase: 'day',
  });
  const condition = weatherDebug.enabled ? weatherDebug.condition : (weather?.condition ?? 'clear');
  const dayPhase = weatherDebug.enabled ? weatherDebug.dayPhase : realDayPhase;
  const [view, setView] = useState<ViewState>({ kind: 'month', year: TODAY_YEAR, month: TODAY_MONTH });
  /** 年ビューから月へ戻るときに開く月（最後に見ていた月） */
  const [lastMonth, setLastMonth] = useState(TODAY_MONTH);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);
  /** 友達の島で飛行機をクリックして選んだ日付 */
  const [selectedFlightKey, setSelectedFlightKey] = useState<string | null>(null);
  /** 雲の下で切り替えるワールドと、雲の表示 */
  const [world, setWorld] = useState<World>('month');
  const [clouds, setClouds] = useState(false);
  /** 遷移中だけカメラを別の姿勢へ寄せる（クローズアップ／クローズアウト） */
  const [poseOverride, setPoseOverride] = useState<CameraPose | null>(null);
  const [snap, setSnap] = useState<{ key: number; from: CameraPose } | null>(null);
  const [loading, setLoading] = useState<Loading | null>(null);
  /** 「友達の島へ移動」の行き先選択ポップアップ */
  const [pickerOpen, setPickerOpen] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );
  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const friends = useMemo(
    () => calendar.members.filter((m) => m !== user),
    [calendar.members, user],
  );

  const go = (next: ViewState) => {
    setHoveredKey(null);
    setHoveredMonth(null);
    setSelectedFlightKey(null);
    if (next.kind !== 'year' && next.kind !== 'friendYear') setLastMonth(next.month);
    setView(next);
  };

  const year = view.year;
  const isYearView = view.kind === 'year' || view.kind === 'friendYear';
  const month = isYearView ? lastMonth : view.month;

  const monthTotal = useMemo(() => countEventsInMonth(byDate, year, month), [byDate, year, month]);
  const yearTotalOf = (source: Map<string, CalendarEvent[]>): number => {
    let total = 0;
    for (let m = 1; m <= 12; m++) total += countEventsInMonth(source, year, m);
    return total;
  };

  /**
   * 友達の島。ログアウトやサンプルに戻した直後に相手がいなくなっていたら、
   * 状態は触らず自分の島として描く（ログアウト時は go で month に戻している）
   */
  const friendName =
    (view.kind === 'friend' || view.kind === 'friendYear') && user !== null && friends.includes(view.friend)
      ? view.friend
      : null;
  /** 今見ている島の持ち主。島のテーマは、この人が入っているグループの表示中プラグインの達成で決める */
  const islandOwner = friendName ?? user;
  const plugin = usePlugin(user, islandOwner);
  const pluginState = plugin.state;

  const islandLookOf = (y: number, m: number): IslandLook => lookOf(pluginState, y, m);
  const islandOf = (y: number, m: number): Island | null => islandLookOf(y, m).island;

  const monthLook = islandLookOf(year, month);
  /** 表示中プラグインのこの月の目標と進捗。読み込みに失敗していれば null */
  const status = pluginState === null ? null : monthStatus(pluginState, year, month);

  const shownWorld: World = user === null ? 'title' : world;
  const canvasLook: IslandLook = shownWorld === 'month' ? monthLook : PLAIN_LOOK;
  const canvasIsland = canvasLook.island;
  /** 島を表示しているあいだ body と .app に付けるクラス。島の CSS（plugins/<id>/island.css）はこれを見る */
  const islandClasses = canvasIsland === null ? [] : ['is-island', `is-${canvasIsland.name}`];
  const islandClassKey = islandClasses.join(' ');

  useEffect(() => {
    if (islandClassKey === '') return;
    const classes = islandClassKey.split(' ');
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [islandClassKey]);
  useEffect(() => {
    const classes = [`sky-${dayPhase}`, `weather-${condition}`];
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [dayPhase, condition]);

  const friendView = view.kind === 'friend' && friendName !== null ? view : null;
  const friendIsland = useMemo(() => {
    if (friendName === null || user === null) return null;
    const shared = calendar.events.filter(
      (event) => event.owners.includes(user) && event.owners.includes(friendName),
    );
    return {
      byDate: groupEventsByDate(eventsOwnedBy(calendar.events, friendName)),
      sharedByDate: groupEventsByDate(shared),
      commonDates: datesSharedBetween(calendar.events, user, friendName),
    };
  }, [friendName, user, calendar.events]);

  /** 月・年ワールドに建てる予定。友達の島なら友達の予定だけ */
  const monthByDate = friendIsland ? friendIsland.byDate : byDate;
  const yearByDate = friendIsland ? friendIsland.byDate : byDate;
  const selectedDay = view.kind === 'day' ? view.day : null;

  // ---- カメラ姿勢 ----
  const pose: CameraPose = useMemo(() => {
    if (poseOverride !== null) return poseOverride;
    if (shownWorld === 'title') return TITLE_POSE;
    if (shownWorld === 'year') return yearOverviewPose();
    return computeMonthPose(year, month, monthByDate, selectedDay);
  }, [poseOverride, shownWorld, year, month, monthByDate, selectedDay]);

  // ---- 月 ⇔ 年の切り替え（雲の下でワールドを入れ替える） ----
  const [transitioning, setTransitioning] = useState(false);
  const snapKey = useRef(0);

  const showYear = () => {
    if (transitioning || isYearView) return;
    const target: ViewState =
      friendName !== null ? { kind: 'friendYear', year, friend: friendName } : { kind: 'year', year };
    setTransitioning(true);
    setClouds(true);
    setPoseOverride(monthPullOutPose(year, month, monthByDate));
    later(CLOUD_COVER_MS, () => {
      snapKey.current += 1;
      setSnap({ key: snapKey.current, from: yearIslandClosePose(month) });
      setPoseOverride(null);
      setWorld('year');
      go(target);
    });
    later(CLOUD_CLEAR_MS, () => {
      setClouds(false);
      setTransitioning(false);
    });
  };

  const showMonth = (targetMonth: number) => {
    if (transitioning) return;
    const target: ViewState =
      friendName !== null
        ? { kind: 'friend', year, month: targetMonth, friend: friendName }
        : { kind: 'month', year, month: targetMonth };
    if (!isYearView) {
      go(target);
      return;
    }
    setTransitioning(true);
    setClouds(true);
    setPoseOverride(yearIslandClosePose(targetMonth));
    later(CLOUD_COVER_MS, () => {
      snapKey.current += 1;
      setSnap({ key: snapKey.current, from: monthPullOutPose(year, targetMonth, yearByDate) });
      setPoseOverride(null);
      setWorld('month');
      go(target);
    });
    later(CLOUD_CLEAR_MS, () => {
      setClouds(false);
      setTransitioning(false);
    });
  };

  // ---- 左右の矢印（月・年の移動） ----
  const shiftMonth = (delta: number) => {
    const next = shiftYearMonth(year, month, delta);
    if (view.kind === 'friend') {
      go({ kind: 'friend', year: next.year, month: next.month, friend: view.friend });
    } else if (view.kind === 'manage') {
      go({ kind: 'manage', year: next.year, month: next.month });
    } else {
      go({ kind: 'month', year: next.year, month: next.month });
    }
  };
  const shiftYear = (delta: number) =>
    go(
      friendName !== null
        ? { kind: 'friendYear', year: year + delta, friend: friendName }
        : { kind: 'year', year: year + delta },
    );

  // ---- ローディング画面（本物の読み込み完了を待ち、最短 2 秒は見せる） ----
  const startLoading = (variant: Loading['variant'], name: string) => {
    setLoading({ variant, name, startedAt: Date.now(), ready: false, hiding: false });
  };
  /** 友達の島へ。ポップアップで選んだあとに呼ぶ */
  const visitFriend = (name: string) => {
    setPickerOpen(false);
    if (isYearView) setWorld('month');
    startLoading('travel', name);
    go({ kind: 'friend', year, month, friend: name });
  };
  /** 友達の島から自分の島へ戻る。同じローディング画面を挟む */
  const goHome = () => {
    setPickerOpen(false);
    if (user === null) throw new Error('goHome: ログインしていません');
    if (isYearView) setWorld('month');
    startLoading('travel', user);
    go({ kind: 'month', year, month });
  };
  const onWorldReady = useCallback(() => {
    setLoading((current) => (current === null || current.ready ? current : { ...current, ready: true }));
  }, []);
  useEffect(() => {
    if (loading === null || !loading.ready || loading.hiding) return;
    const remaining = Math.max(0, LOADING_MIN_MS - (Date.now() - loading.startedAt));
    const hide = window.setTimeout(() => {
      setLoading((current) => (current === null ? null : { ...current, hiding: true }));
    }, remaining);
    return () => window.clearTimeout(hide);
  }, [loading]);
  useEffect(() => {
    if (loading === null || !loading.hiding) return;
    const unmount = window.setTimeout(() => setLoading(null), LOADING_FADE_MS);
    return () => window.clearTimeout(unmount);
  }, [loading]);

  /**
   * ワールドの「読み込み完了」を数えるキー。ローディングの開始時刻を含めるので、
   * ログインのようにユーザー名が先に入ってワールドが描画済みでも、ローディング開始後の最初の描画で完了になる
   */
  const readyKey = `${shownWorld}:${friendName ?? 'me'}:${year}-${month}:${loading?.startedAt ?? 0}`;

  // ---- BGM：画面ごとの場面。表示中プラグインの目標を達成した月は曲があるときだけ切り替える ----
  const onOwnLuxuryMonth = user !== null && friendName === null && !isYearView && status !== null && status.achieved;
  const bgmScene: BgmScene =
    user === null
      ? 'opening'
      : loading !== null && !loading.hiding
        ? loading.variant === 'build'
          ? 'loading_main'
          : 'loading_friend'
        : overlay === 'settings'
          ? 'setting'
          : friendName !== null
            ? 'friend'
            : onOwnLuxuryMonth && audio.hasBgm('management')
              ? 'management'
              : 'main';
  useEffect(() => {
    audio.playBgm(bgmScene);
  }, [bgmScene, audio]);
  // 目標達成の効果音：自分の黄金郷の月に入ったとき 1 回（曲が無ければ何も鳴らない）
  const luxuryKey = onOwnLuxuryMonth && loading === null ? `${year}-${month}` : null;
  useEffect(() => {
    if (luxuryKey !== null) audio.playSe('management');
  }, [luxuryKey, audio]);

  // ---- ログイン・ログアウト ----
  const enterMain = (name: string) => {
    startLoading('build', name);
    setWorld('month');
    go({ kind: 'month', year: TODAY_YEAR, month: TODAY_MONTH });
  };
  const login = async (name: string, password: string) => {
    await calendar.login(name, password);
    audio.playSe('login');
    enterMain(name);
  };
  const register = async (name: string, password: string) => {
    await calendar.register(name, password);
    audio.playSe('login');
    enterMain(name);
  };
  const logout = () => {
    audio.playSe('logout');
    setOverlay('none');
    setPickerOpen(false);
    setLoading(null);
    go({ kind: 'month', year, month });
    setWorld('month');
    calendar.logout();
  };

  /** 下部バーの「管理機能」でプラグインを選ぶ：そのプラグインを表示中にして（島のテーマも変わる）パネルを開く */
  const openManage = (id: string) => {
    if (id !== plugin.selectedId) {
      plugin.select(id).catch((err: unknown) => {
        console.error(err);
      });
    }
    if (isYearView) setWorld('month');
    go({ kind: 'manage', year, month });
  };

  const manageItems: ManageMenuItem[] = plugin.plugins.filter((p) => p.installed).map((p) => ({
    id: p.id,
    label: p.name,
    icon: PLUGIN_ICONS[p.id] ?? IconManage,
    selected: p.id === plugin.selectedId,
  }));

  const achievements = useYearAchievements(year, isYearView ? islandOwner : null);

  /** 年ビューにいるときだけ「月カレンダー」、それ以外（月・日・家計簿）は「年カレンダー」 */
  const calendarTarget: 'year' | 'month' = isYearView ? 'month' : 'year';
  const mainVisible = user !== null && overlay === 'none';

  const bottomBar = mainVisible ? (
    <BottomBar
      calendarTarget={calendarTarget}
      active={friendName !== null ? 'friend' : view.kind === 'manage' ? 'manage' : 'calendar'}
      friendCalendar={friendName !== null}
      showCalendar
      showManage={friendName === null}
      onShowCalendar={() => {
        if (isYearView) {
          showMonth(lastMonth);
        } else {
          showYear();
        }
      }}
      friendDisabled={friends.length === 0}
      onVisitFriend={() => setPickerOpen(true)}
      manageItems={manageItems}
      onOpenManage={openManage}
      onOpenSettings={() => setOverlay('settings')}
      onLogout={logout}
    />
  ) : null;

  const arrows =
    mainVisible && !transitioning && view.kind !== 'day' ? (
      isYearView ? (
        <SideArrows
          prevLabel={`${year - 1}`}
          nextLabel={`${year + 1}`}
          onPrev={() => shiftYear(-1)}
          onNext={() => shiftYear(1)}
        />
      ) : (
        <SideArrows
          prevLabel={`${shiftYearMonth(year, month, -1).month}月`}
          nextLabel={`${shiftYearMonth(year, month, 1).month}月`}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
        />
      )
    ) : null;

  const hud =
    user === null ? (
      <TitleScreen onLogin={login} onRegister={register} onStart={() => audio.playSe('opening_click')} />
    ) : overlay === 'settings' ? (
      <SettingsScreen
        currentUser={user}
        members={calendar.members}
        bgmVolume={audio.settings.bgmVolume}
        seVolume={audio.settings.seVolume}
        onBgmVolume={audio.setBgmVolume}
        onSeVolume={audio.setSeVolume}
        onReset={async () => {
          await calendar.resetToSample();
          setOverlay('none');
          setWorld('month');
          go({ kind: 'month', year: TODAY_YEAR, month: TODAY_MONTH });
        }}
        onBack={() => setOverlay('none')}
        debug={weatherDebug}
        onDebug={setWeatherDebug}
        plugins={plugin.plugins}
        onSetInstalled={plugin.setInstalled}
      />
    ) : isYearView ? (
      <YearHud
        year={year}
        total={yearTotalOf(yearByDate)}
        hoveredMonth={hoveredMonth}
        hoveredCount={hoveredMonth === null ? 0 : countEventsInMonth(yearByDate, year, hoveredMonth)}
        hoveredThemeLabel={hoveredMonth === null ? null : (islandOf(year, hoveredMonth)?.label ?? null)}
        hoveredAchieved={hoveredMonth === null ? [] : (achievements.months?.get(hoveredMonth) ?? [])}
        pluginName={pluginState?.manifest.name ?? '管理プラグイン'}
        achievementsError={achievements.error}
        friend={friendName}
      />
    ) : friendView !== null && friendIsland !== null ? (
      <FriendHud
        year={year}
        month={month}
        friend={friendView.friend}
        members={calendar.members}
        byDate={friendIsland.byDate}
        sharedByDate={friendIsland.sharedByDate}
        hoveredKey={hoveredKey}
        selectedFlightKey={selectedFlightKey}
        onCloseFlight={() => setSelectedFlightKey(null)}
      />
    ) : view.kind === 'manage' ? (
      <div className="hud">
        {pluginState === null || status === null ? (
          <aside className="ledger-panel panel" aria-label="管理プラグイン">
            <header className="ledger-head">
              <h2 className="ledger-title">
                {plugin.error === null ? '管理プラグインを読み込んでいます' : '管理プラグインを読み込めません'}
              </h2>
              <button type="button" className="btn btn-small ledger-close" onClick={() => go({ kind: 'month', year, month })}>
                ✕ 閉じる
              </button>
            </header>
            {plugin.error === null ? null : (
              <pre className="ledger-status" role="alert">
                {plugin.error}
              </pre>
            )}
          </aside>
        ) : pluginState.group === null ? (
          <PluginStart
            manifest={pluginState.manifest}
            year={year}
            month={month}
            currentUser={user}
            onStart={plugin.startGroup}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            onClose={() => go({ kind: 'month', year, month })}
          />
        ) : (
          <PluginHud
            key={`${pluginState.manifest.id}-${year}-${month}`}
            manifest={pluginState.manifest}
            group={pluginState.group}
            year={year}
            month={month}
            currentUser={user}
            entries={pluginState.entries
              .filter((entry) => entry.date.startsWith(monthStartKey(year, month).slice(0, 8)))
              .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))}
            goals={pluginState.goals.filter(
              (goal) => goal.start <= monthEndKey(year, month) && goal.end >= monthStartKey(year, month),
            )}
            status={status}
            onAddEntry={(date, data) => plugin.addEntry({ date, data })}
            onRemoveEntry={plugin.removeEntry}
            onAddGoal={plugin.addGoal}
            onRemoveGoal={plugin.removeGoal}
            onPrevMonth={() => shiftMonth(-1)}
            onNextMonth={() => shiftMonth(1)}
            onClose={() => go({ kind: 'month', year, month })}
          />
        )}
      </div>
    ) : view.kind === 'day' ? (
      <DayHud
        year={year}
        month={month}
        day={view.day}
        events={byDate.get(toDateKey(year, month, view.day)) ?? []}
        members={calendar.members}
        currentUser={user}
        onBack={() => go({ kind: 'month', year, month })}
        onAddEvent={(title, category, invited, place) =>
          calendar.addEvent({ date: toDateKey(year, month, view.day), title, category, invited, place })
        }
        onJoinEvent={calendar.joinEvent}
        onRemoveEvent={calendar.removeEvent}
      />
    ) : (
      <MonthHud
        year={year}
        month={month}
        monthTotal={monthTotal}
        hoveredKey={hoveredKey}
        byDate={byDate}
        members={calendar.members}
        currentUser={user}
        plugin={pluginState === null || status === null ? null : { manifest: pluginState.manifest, status }}
        pluginError={plugin.error}
        island={monthLook.island}
      />
    );

  const monthInteractive = mainVisible && shownWorld === 'month' && view.kind !== 'manage';

  return (
    <div className={['app', ...islandClasses].join(' ')}>
      <div className="scene">
        <WorldCanvas
          island={canvasIsland}
          scene={canvasLook.scene}
          fogRange={shownWorld === 'year' ? 'wide' : 'near'}
          pose={pose}
          snap={snap}
          autoRotate={shownWorld === 'title'}
          maxDistance={shownWorld === 'year' ? 90 : 38}
          dayPhase={dayPhase}
          weather={condition}
          onPointerMissed={() => {
            setHoveredKey(null);
            setHoveredMonth(null);
          }}
        >
          <TitleWorld visible={shownWorld === 'title'} />
          <WeatherFx
            condition={condition}
            visible={user !== null && overlay === 'none'}
            cloudLayout={shownWorld === 'year' ? 'year' : 'month'}
          />
          <MonthWorld
            visible={shownWorld === 'month'}
            year={year}
            month={month}
            byDate={monthByDate}
            members={calendar.members}
            lookOf={islandLookOf}
            selectedDay={selectedDay}
            hoveredKey={monthInteractive ? hoveredKey : null}
            onHover={monthInteractive ? setHoveredKey : () => undefined}
            onSelectDay={
              monthInteractive && view.kind === 'month'
                ? (day) => go({ kind: 'day', year, month, day })
                : undefined
            }
            friend={
              friendIsland
                ? { commonDates: friendIsland.commonDates, onSelectFlight: setSelectedFlightKey }
                : null
            }
            partner={null}
            readyKey={readyKey}
            onReady={onWorldReady}
          />
          <YearWorld
            visible={shownWorld === 'year'}
            year={year}
            byDate={yearByDate}
            islandOf={islandOf}
            hoveredMonth={hoveredMonth}
            onHoverMonth={setHoveredMonth}
            onSelectMonth={showMonth}
          />
        </WorldCanvas>
      </div>
      {hud}
      {mainVisible ? (
        <WeatherBadge
          weather={weather}
          dayPhase={dayPhase}
          debugCondition={weatherDebug.enabled ? weatherDebug.condition : null}
        />
      ) : null}
      {bottomBar}
      {arrows}
      {pickerOpen && user !== null ? (
        <DestinationPicker
          friends={friends.filter((name) => name !== friendName)}
          members={calendar.members}
          currentUser={user}
          showHome={friendName !== null}
          onPickFriend={visitFriend}
          onPickHome={goHome}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      <CloudOverlay active={clouds} />
      {loading !== null ? (
        <TravelLoading variant={loading.variant} name={loading.name} visible={!loading.hiding} />
      ) : null}
    </div>
  );
};
