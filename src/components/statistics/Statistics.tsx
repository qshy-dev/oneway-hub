import { useMemo, useState } from 'react';
import {
  Gavel, Gift, Users, Coins, DollarSign, Package, Trophy, CalendarDays, TrendingUp,
} from 'lucide-react';
import { useI18n } from '@/i18n';

type StatCard = {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
};

function generateEmptyCalendar(): number[] {
  return new Array(365).fill(0);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function Statistics() {
  const { t } = useI18n();
  const [section] = useState<'all' | 'auction' | 'giveaways'>('all');

  const calendar = useMemo(() => generateEmptyCalendar(), []);

  const stats: StatCard[] = [
    { icon: <Gavel className="h-5 w-5" />, label: t('stat_auctions'), value: '0', accent: 'text-accent-400' },
    { icon: <Gift className="h-5 w-5" />, label: t('stat_giveaways'), value: '0', accent: 'text-emerald-400' },
    { icon: <Users className="h-5 w-5" />, label: t('stat_participants_total'), value: '0', accent: 'text-blue-400' },
    { icon: <Users className="h-5 w-5" />, label: t('stat_participants_unique'), value: '0', accent: 'text-cyan-400' },
    { icon: <Coins className="h-5 w-5" />, label: t('stat_points_spent'), value: '0', accent: 'text-amber-400' },
    { icon: <DollarSign className="h-5 w-5" />, label: t('stat_donations'), value: '0 ₽', accent: 'text-green-400' },
    { icon: <Package className="h-5 w-5" />, label: t('stat_lots_total'), value: '0', accent: 'text-pink-400' },
    { icon: <Trophy className="h-5 w-5" />, label: t('stat_top_winner'), value: '—', accent: 'text-yellow-400' },
  ];

  const topBlocks = [
    { icon: <Package className="h-5 w-5" />, label: t('stat_biggest_auction'), value: '—', sub: t('stat_lots_count').replace('{0}', '0') },
    { icon: <Users className="h-5 w-5" />, label: t('stat_popular_auction'), value: '—', sub: t('stat_unique_participants').replace('{0}', '0') },
    { icon: <Coins className="h-5 w-5" />, label: t('stat_most_points'), value: '—', sub: '0' },
    { icon: <DollarSign className="h-5 w-5" />, label: t('stat_most_donations'), value: '—', sub: '0 ₽' },
  ];

  const heatColors = [
    'bg-ink-800/40',
    'bg-accent-500/20',
    'bg-accent-500/40',
    'bg-accent-500/60',
    'bg-accent-500/90',
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
      {/* Section filter */}
      <div className="flex items-center gap-1 rounded-lg border border-ink-800 bg-ink-950 p-1">
        {(['all', 'auction', 'giveaways'] as const).map((s) => (
          <button
            key={s}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold capitalize transition ${section === s ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'}`}
          >
            {s === 'all' ? (t('lang_label') === 'Язык' ? 'Все' : 'All') : s === 'auction' ? t('section_auction') : t('section_giveaways')}
          </button>
        ))}
      </div>

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
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-accent-400" />
          <h3 className="text-sm font-bold text-ink-100">{t('stat_calendar_title')}</h3>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-1">
            {Array.from({ length: 12 }, (_, m) => (
              <div key={m} className="flex flex-col gap-1">
                <span className="mb-1 text-[10px] font-medium text-ink-600">{MONTHS[m]}</span>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 31 }, (_, d) => {
                    const idx = m * 31 + d;
                    const level = calendar[idx] ?? 0;
                    return (
                      <div
                        key={d}
                        className={`h-3 w-3 rounded-sm ${heatColors[level]}`}
                        title={`${MONTHS[m]} ${d + 1}: ${level} events`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <span className="text-[10px] text-ink-600">Less</span>
          {heatColors.map((c, i) => (
            <div key={i} className={`h-3 w-3 rounded-sm ${c}`} />
          ))}
          <span className="text-[10px] text-ink-600">More</span>
        </div>
      </div>

      {/* Top auction blocks */}
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
