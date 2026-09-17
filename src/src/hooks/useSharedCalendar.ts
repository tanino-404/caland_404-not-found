import { useState } from 'react';
import { SAMPLE_MEMBERS, sampleEvents } from '../data/sampleEvents';
import { type SharedCalendarState, clearState, initialState, loadState, saveState } from '../lib/storage';
import type { CalendarEvent, EventCategory } from '../types/calendar';

export interface NewEventInput {
  date: string;
  title: string;
  category: EventCategory;
  /** 誘うメンバー。自分と一緒に所有者になる */
  invited: string[];
}

export interface SharedCalendar {
  members: string[];
  currentUser: string | null;
  events: CalendarEvent[];
  login: (name: string) => void;
  logout: () => void;
  addEvent: (input: NewEventInput) => void;
  /** 他のメンバーの予定に自分も参加する（共有の予定になる） */
  joinEvent: (eventId: string) => void;
  /** 自分の予定を消す。共有の予定なら自分だけ抜け、他のメンバーの予定として残る */
  removeEvent: (eventId: string) => void;
  /** 保存データを消してサンプルに戻す */
  resetToSample: () => void;
}

const freshState = (): SharedCalendarState => initialState([...SAMPLE_MEMBERS], sampleEvents);

/**
 * メンバー全員で共有する 1 つのカレンダー。状態は localStorage に保存する。
 * 更新はすべてここを通し、保存は各アクションの中で行う。
 */
export const useSharedCalendar = (): SharedCalendar => {
  const [state, setState] = useState<SharedCalendarState>(() => loadState() ?? freshState());

  const commit = (next: SharedCalendarState) => {
    saveState(next);
    setState(next);
  };

  const login = (rawName: string) => {
    const name = rawName.trim();
    if (name.length === 0) {
      throw new Error('login: ユーザー名が空です');
    }
    const members = state.members.includes(name) ? state.members : [...state.members, name];
    commit({ ...state, members, currentUser: name });
  };

  const logout = () => commit({ ...state, currentUser: null });

  const addEvent = ({ date, title, category, invited }: NewEventInput) => {
    const user = state.currentUser;
    if (user === null) {
      throw new Error('addEvent: ログインしていません');
    }
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new Error('addEvent: タイトルが空です');
    }
    for (const name of invited) {
      if (!state.members.includes(name)) {
        throw new Error(`addEvent: 未登録のメンバーを誘っています: "${name}"`);
      }
    }
    const owners = [user, ...invited.filter((name) => name !== user)];
    const event: CalendarEvent = {
      id: `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      date,
      title: trimmed,
      category,
      owners,
    };
    commit({ ...state, events: [...state.events, event] });
  };

  const joinEvent = (eventId: string) => {
    const user = state.currentUser;
    if (user === null) {
      throw new Error('joinEvent: ログインしていません');
    }
    const target = state.events.find((e) => e.id === eventId);
    if (!target) {
      throw new Error(`joinEvent: 予定が見つかりません: ${eventId}`);
    }
    if (target.owners.includes(user)) return;
    const events = state.events.map((e) =>
      e.id === eventId ? { ...e, owners: [...e.owners, user] } : e,
    );
    commit({ ...state, events });
  };

  const removeEvent = (eventId: string) => {
    const user = state.currentUser;
    if (user === null) {
      throw new Error('removeEvent: ログインしていません');
    }
    const target = state.events.find((e) => e.id === eventId);
    if (!target) {
      throw new Error(`removeEvent: 予定が見つかりません: ${eventId}`);
    }
    if (!target.owners.includes(user)) {
      throw new Error(`removeEvent: "${user}" の予定ではありません: ${target.title}`);
    }
    const remaining = target.owners.filter((owner) => owner !== user);
    const events =
      remaining.length === 0
        ? state.events.filter((e) => e.id !== eventId)
        : state.events.map((e) => (e.id === eventId ? { ...e, owners: remaining } : e));
    commit({ ...state, events });
  };

  const resetToSample = () => {
    clearState();
    setState(freshState());
  };

  return {
    members: state.members,
    currentUser: state.currentUser,
    events: state.events,
    login,
    logout,
    addEvent,
    joinEvent,
    removeEvent,
    resetToSample,
  };
};
