import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Gavel, Gift, Users, Coins, DollarSign, Package, Trophy, CalendarDays, Banknote,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { useUserEvents } from '@/lib/useUserEvents';

type StatCard = {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
};

const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type AuctionData = {
  lots_count: number;
  total_sum: number;
  participants: number;
  winner_lot?: string;
  winner_price?: number;
};

type GiveawayData = {
  participants: number;
  messages: number;
  winner: string | null;
  duration_sec: number;
  mode: string;
};

export function Statistics() {
  const { t, lang } = useI18n();
  const { events, knownUsers, loading } = useUserEvents();
  const currencySymbol = lang === 'ru' ? '₽' : '$';
  const MONTHS = lang === 'ru' ? MONTHS_RU : MONTHS_EN;

  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarQuarter, setCalendarQuarter] = useState(() => {
    const m = new Date().getMonth();
    return Math.floor(m / 3);
  });
  const [calDir, setCalDir] = useState<1 | -1>(1);

  const auctionEvents = useMemo(
    () => events.filter((e) => e.type === 'auction') as (typeof events[number] & { data: AuctionData })[],
    [events],
  );
  const giveawayEvents = useMemo(
    () => events.filter((e) => e.type === 'giveaway') as (typeof events[number] & { data: GiveawayData })[],
    [events],
  );

  const auctionCount = auctionEvents.length;
  const giveawayCount = giveawayEvents.length;

  const totalGiveawayParticipants = useMemo(
    () => giveawayEvents.reduce((s, g) => s + (g.data.participants ?? 0), 0),
    [giveawayEvents],
  );

  const totalAuctionParticipants = useMemo(
    () => auctionEvents.reduce((s, a) => s + (a.data.participants ?? 0), 0),
    [auctionEvents],
  );

  const uniqueParticipants = knownUsers.length;

  const totalLots = useMemo(
    () => auctionEvents.reduce((s, a) => s + (a.data.lots_count ?? 0), 0),
    [auctionEvents],
  );

  const totalDonations = useMemo(
    () => auctionEvents.reduce((s, a) => s + (a.data.total_sum ?? 0), 0),
    [auctionEvents],
  );

  const topWinner = useMemo(() => {
    if (knownUsers.length === 0 || knownUsers.every((u) => u.win_count === 0)) return '—';
    const top = [...knownUsers].sort((a, b) => b.win_count - a.win_count)[0];
    return `${top.username} (${top.win_count})`;
  }, [knownUsers]);

  const biggestAuction = useMemo(() => {
    if (auctionEvents.length === 0) return { name: '—', lots: 0 };
    let best = auctionEvents[0];
    for (const a of auctionEvents.slice(1)) {
      if ((a.data.lots_count ?? 0) > (best.data.lots_count ?? 0)) best = a;
    }
    return { name: best.name ?? '—', lots: best.data.lots_count ?? 0 };
  }, [auctionEvents]);

  const popularAuction = useMemo(() => {
    if (auctionEvents.length === 0) return { name: '—', participants: 0 };
    let best = auctionEvents[0];
    for (const a of auctionEvents.slice(1)) {
      if ((a.data.participants ?? 0) > (best.data.participants ?? 0)) best = a;
    }
    return { name: best.name ?? '—', participants: best.data.participants ?? 0 };
  }, [auctionEvents]);

  const mostDonations = useMemo(() => {
    if (auctionEvents.length === 0) return { name: '—', sum: 0 };
    let best = auctionEvents[0];
    for (const a of auctionEvents.slice(1)) {
      if ((a.data.total_sum ?? 0) > (best.data.total_sum ?? 0)) best = a;
    }
    return { name: best.name ?? '—', sum: best.data.total_sum ?? 0 };
  }, [auctionEvents]);

  const calendar = useMemo(() => {
    const cells = new Array(372).fill(0);
    for (const e of events) {
      const d = new Date(e.created_at);
      if (d.getFullYear() === calendarYear) {
        const m = d.getMonth();
        const day = d.getDate() - 1;
        cells[m * 31 + day] += 1;
      }
    }
    return cells;
  }, [events, calendarYear]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const arr: number[] = [];
    for (let y = 2025; y <= now; y++) arr.push(y);
    return arr;
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-accent-500" />
      </div>
    );
  }

  const stats: StatCard[] = [
    { icon: <Gavel className="h-5 w-5" />, label: t('stat_auctions'), value: String(auctionCount), accent: 'text-accent-400' },
    { icon: <Gift className="h-5 w-5" />, label: t('stat_giveaways'), value: String(giveawayCount), accent: 'text-emerald-400' },
    { icon: <Users className="h-5 w-5" />, label: t('stat_participants_total'), value: String(totalGiveawayParticipants + totalAuctionParticipants), accent: 'text-blue-400' },
    { icon: <Users className="h-5 w-5" />, label: t('stat_participants_unique'), value: String(uniqueParticipants), accent: 'text-cyan-400' },
    { icon: <Coins className="h-5 w-5" />, label: t('stat_points_spent'), value: String(totalDonations), accent: 'text-amber-400' },
    { icon: <Banknote className="h-5 w-5" />, label: t('stat_donations'), value: `${totalDonations} ${currencySymbol}`, accent: 'text-green-400' },
    { icon: <Package className="h-5 w-5" />, label: t('stat_lots_total'), value: String(totalLots), accent: 'text-pink-400' },
    { icon: <Trophy className="h-5 w-5" />, label: t('stat_top_winner'), value: topWinner, accent: 'text-yellow-400' },
  ];

  const topBlocks = [
    { icon: <Package className="h-5 w-5" />, label: t('stat_biggest_auction'), value: biggestAuction.name, sub: t('stat_lots_count').replace('{0}', String(biggestAuction.lots)) },
    { icon: <Users className="h-5 w-5" />, label: t('stat_popular_auction'), value: popularAuction.name, sub: t('stat_unique_participants').replace('{0}', String(popularAuction.participants)) },
    { icon: <Coins className="h-5 w-5" />, label: t('stat_most_points'), value: '—', sub: '0' },
    { icon: <DollarSign className="h-5 w-5" />, label: t('stat_most_donations'), value: mostDonations.name, sub: `${mostDonations.sum} ${currencySymbol}` },
  ];

  const heatColors = [
    'bg-ink-800/40',
    'bg-accent-500/20',
    'bg-accent-500/40',
    'bg-accent-500/60',
    'bg-accent-500/90',
  ];

  const maxCell = Math.max(...calendar, 1);

  const quarterMonths = [calendarQuarter * 3, calendarQuarter * 3 + 1, calendarQuarter * 3 + 2];
  const canGoLeft = calendarQuarter > 0 || calendarYear > 2025;
  const canGoRight = calendarQuarter < 3 || calendarYear < new Date().getFullYear();
  const calKey = `${calendarYear}-q${calendarQuarter}`;

  const shiftCalendar = (dir: -1 | 1) => {
    let q = calendarQuarter + dir;
    let y = calendarYear;
    if (q < 0) { q = 3; y -= 1; }
    if (q > 3) { q = 0; y += 1; }
    if (y < 2025) return;
    if (y > new Date().getFullYear()) return;
    setCalDir(dir);
    setCalendarQuarter(q);
    setCalendarYear(y);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className="rounded-xl border border-ink-800 bg-ink-900/40 p-4 transition hover:border-ink-700"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className={s.accent}>{s.icon}</span>
              <span className="text-xs font-medium text-ink-500">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-ink-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Calendar heatmap */}
      <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-accent-400" />
            <h3 className="text-sm font-bold text-ink-100">{t('stat_calendar_title')}</h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={calendarYear}
              onChange={(e) => { const ny = Number(e.target.value); setCalDir(ny > calendarYear ? 1 : -1); setCalendarYear(ny); }}
              className="rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs font-semibold text-ink-200 focus:border-accent-500 focus:outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={() => shiftCalendar(-1)}
              disabled={!canGoLeft}
              className="rounded-md border border-ink-700 bg-ink-800 p-1.5 text-ink-300 transition hover:bg-ink-700 hover:text-ink-100 disabled:opacity-30 disabled:hover:bg-ink-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => shiftCalendar(1)}
              disabled={!canGoRight}
              className="rounded-md border border-ink-700 bg-ink-800 p-1.5 text-ink-300 transition hover:bg-ink-700 hover:text-ink-100 disabled:opacity-30 disabled:hover:bg-ink-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto pb-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={calKey}
              initial={{ opacity: 0, x: calDir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: calDir * -40 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex gap-4"
            >
              {quarterMonths.map((m) => (
                <div key={m} className="flex flex-col gap-1">
                  <span className="mb-1 text-[10px] font-medium text-ink-600">{MONTHS[m]}</span>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 31 }, (_, d) => {
                      const idx = m * 31 + d;
                      const level = calendar[idx] ?? 0;
                      const norm = level / maxCell;
                      const heatIdx = level === 0 ? 0 : Math.min(4, Math.ceil(norm * 4));
                      return (
                        <div
                          key={d}
                          className={`h-3.5 w-3.5 rounded-sm ${heatColors[heatIdx]}`}
                          title={`${MONTHS[m]} ${d + 1}: ${level}`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <span className="text-[10px] text-ink-600">{lang === 'ru' ? 'Меньше' : 'Less'}</span>
          {heatColors.map((c, i) => (
            <div key={i} className={`h-3 w-3 rounded-sm ${c}`} />
          ))}
          <span className="text-[10px] text-ink-600">{lang === 'ru' ? 'Больше' : 'More'}</span>
        </div>
      </div>

      {/* Top blocks */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {topBlocks.map((b, i) => (
          <div
            key={i}
            className="rounded-xl border border-ink-800 bg-ink-900/40 p-4 transition hover:border-accent-500/30"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-accent-400">{b.icon}</span>
              <span className="text-xs font-medium text-ink-500">{b.label}</span>
            </div>
            <p className="text-lg font-bold text-ink-100">{b.value}</p>
            <p className="mt-1 text-xs text-ink-500">{b.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
