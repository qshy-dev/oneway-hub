import { Clock, Users, Activity, Video } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useChannelHistory } from '@/lib/useChannelHistory';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}ч ${m}мин`;
  return `${m}мин`;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

export function ChannelHistory({ userId }: { userId: string | null }) {
  const { t } = useI18n();
  const { entries, loading, error } = useChannelHistory(userId, 30);

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

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-800 bg-ink-900/30 p-8 text-center">
        <p className="text-sm text-ink-600">{t('stat_history_empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-base font-bold text-ink-100">
        <Video className="h-5 w-5 text-accent-400" />
        {t('stat_history_title')}
      </h3>
      <div className="flex flex-col gap-3">
        {entries.map((e) => (
          <div key={e.id} className="rounded-xl border border-ink-800 bg-ink-900/40 p-4 transition hover:border-ink-700">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink-100">{e.title || t('profile_stream_untitled')}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                  <span>{new Date(e.started_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {e.game_name && <span>{e.game_name}</span>}
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDuration(e.duration_sec)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-ink-400"><Users className="h-3.5 w-3.5" />{t('profile_stream_peak')}: {formatNumber(e.peak_viewers)}</span>
                <span className="flex items-center gap-1 text-ink-400"><Activity className="h-3.5 w-3.5" />{t('profile_stream_avg')}: {formatNumber(e.avg_viewers)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}