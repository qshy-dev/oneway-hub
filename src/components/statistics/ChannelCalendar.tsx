import { CalendarDays, Clock, Users, MessageCircle, BarChart3 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useChannelCalendar } from '@/lib/useChannelCalendar';

export function ChannelCalendar({ userId }: { userId: string | null }) {
  const { t } = useI18n();
  const { days, loading, error, refetch } = useChannelCalendar(userId, 90);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-ink-800 bg-ink-900/30 p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-700 border-t-accent-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-800 bg-ink-900/30 p-8 text-center">
        <p className="text-sm text-ink-600">{t('stat_calendar_empty')}</p>
      </div>
    );
  }

  const totalHours = days.reduce((s, d) => s + d.hours_streamed, 0);
  const totalStreams = days.reduce((s, d) => s + d.streams_count, 0);
  const totalMessages = days.reduce((s, d) => s + d.total_messages, 0);
  const totalChatters = days.reduce((s, d) => s + d.unique_chatters, 0);
  const peakDay = days.reduce((best, d) => d.peak_viewers > (best?.peak_viewers ?? 0) ? d : best, days[0]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink-100">
          <CalendarDays className="h-5 w-5 text-accent-400" />
          {t('stat_calendar_title')}
        </h3>
        <button
          onClick={refetch}
          className="text-xs text-ink-500 transition hover:text-accent-400"
        >
          {t('profile_sync')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-ink-800 bg-ink-950/50 p-4">
          <div className="flex items-center gap-1 text-xs text-ink-600"><Clock className="h-3.5 w-3.5" />{t('profile_stat_hours')}</div>
          <div className="mt-1 text-lg font-bold text-ink-100 tabular-nums">{totalHours.toFixed(1)}</div>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-950/50 p-4">
          <div className="flex items-center gap-1 text-xs text-ink-600"><BarChart3 className="h-3.5 w-3.5" />{t('profile_stat_streams')}</div>
          <div className="mt-1 text-lg font-bold text-ink-100 tabular-nums">{totalStreams}</div>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-950/50 p-4">
          <div className="flex items-center gap-1 text-xs text-ink-600"><MessageCircle className="h-3.5 w-3.5" />{t('profile_stat_messages')}</div>
          <div className="mt-1 text-lg font-bold text-ink-100 tabular-nums">{totalMessages}</div>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-950/50 p-4">
          <div className="flex items-center gap-1 text-xs text-ink-600"><Users className="h-3.5 w-3.5" />{t('profile_stat_chatters')}</div>
          <div className="mt-1 text-lg font-bold text-ink-100 tabular-nums">{totalChatters}</div>
        </div>
      </div>
      {peakDay && (
        <div className="rounded-xl border border-accent-500/30 bg-accent-500/5 p-4">
          <div className="text-xs text-ink-500">{t('stat_calendar_peak_day')}</div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-sm font-bold text-ink-100">
              {new Date(peakDay.stat_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </span>
            <span className="text-sm font-bold text-accent-400 tabular-nums">{peakDay.peak_viewers} {t('profile_stream_peak')}</span>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-ink-800 bg-ink-900/30 p-4">
        <h4 className="mb-3 text-sm font-semibold text-ink-300">{t('stat_calendar_list')}</h4>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ink-950 text-ink-600">
              <tr>
                <th className="py-2 text-left font-medium">{t('stat_calendar_date')}</th>
                <th className="py-2 text-right font-medium">{t('profile_stat_hours')}</th>
                <th className="py-2 text-right font-medium">{t('profile_stat_streams')}</th>
                <th className="py-2 text-right font-medium">{t('profile_stream_peak')}</th>
                <th className="py-2 text-right font-medium">{t('profile_stat_messages')}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.stat_date} className="border-t border-ink-800/60">
                  <td className="py-2 text-ink-300">
                    {new Date(d.stat_date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="py-2 text-right text-ink-400 tabular-nums">{d.hours_streamed.toFixed(1)}</td>
                  <td className="py-2 text-right text-ink-400 tabular-nums">{d.streams_count}</td>
                  <td className="py-2 text-right text-ink-400 tabular-nums">{d.peak_viewers}</td>
                  <td className="py-2 text-right text-ink-400 tabular-nums">{d.total_messages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}