import { IconLedger } from '../components/hud/icons';
import { LedgerScreen } from '../components/ledger/LedgerScreen';
import { LuxuryFx } from '../components/month/LuxuryFx';
import { useLedger } from '../hooks/useLedger';
import { toDateKey } from '../lib/calendar';
import { entriesOf, goalsOf, isMonthLuxurious, monthGoal, monthLedger } from '../lib/ledger';
import type { ManagementModule, ManagementRuntime } from './types';

/** 家計簿：メンバーごとの収支と月目標。貯金が目標以上の月は島が黄金郷になり、金貨と札が降る */
export const ledgerModule: ManagementModule = {
  id: 'ledger',
  label: '家計簿',
  icon: IconLedger,
  achievedTheme: 'luxury',
  Celebration: LuxuryFx,
  useRuntime: (currentUser): ManagementRuntime => {
    const store = useLedger(currentUser);
    const summaryOf = (owner: string, year: number, month: number) => {
      const ledger = monthLedger(entriesOf(store.entries, owner), year, month);
      const goal = monthGoal(goalsOf(store.goals, owner), year, month);
      return { ledger, goal, achieved: isMonthLuxurious(ledger.savings, goal) };
    };
    return {
      ready: store.ready,
      error: store.error,
      isAchieved: (owner, year, month) => summaryOf(owner, year, month).achieved,
      renderPanel: ({ year, month, currentUser: user, onPrevMonth, onNextMonth, onClose }) => {
        const { ledger, goal, achieved } = summaryOf(user, year, month);
        return (
          <LedgerScreen
            year={year}
            month={month}
            currentUser={user}
            ledger={ledger}
            goal={goal}
            achieved={achieved}
            onAdd={(day, kind, amount, title) =>
              store.addEntry({ date: toDateKey(year, month, day), kind, amount, title })
            }
            onRemove={store.removeEntry}
            onSetGoal={(amount) => store.setMonthlyGoal(year, month, amount)}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onClose={onClose}
          />
        );
      },
    };
  },
};
