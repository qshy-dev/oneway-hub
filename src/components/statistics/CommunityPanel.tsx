import { Users, MessageCircle, Heart } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useCommunityData } from '@/lib/useCommunityData';

export function CommunityPanel({ userId }: { userId: string | null }) {
  const { t } = useI18n();
  const { followers, loading, error } = useCommunityData(userId);

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

  if (followers.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-800 bg-ink-900/30 p-8 text-center">
        <p className="text-sm text-ink-600">{t('stat_community_empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-base font-bold text-ink-100">
        <Users className="h-5 w-5 text-accent-400" />
        {t('stat_community_title')}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-800 bg-ink-950/50 p-4">
          <div className="text-xs text-ink-600">{t('profile_chat_streamers')}</div>
          <div className="mt-1 text-xl font-bold text-ink-100 tabular-nums">{followers.length}</div>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-950/50 p-4">
          <div className="flex items-center gap-1 text-xs text-ink-600"><MessageCircle className="h-3.5 w-3.5" />{t('profile_chat_total_messages')}</div>
          <div className="mt-1 text-xl font-bold text-ink-100 tabular-nums">—</div>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-950/50 p-4">
          <div className="flex items-center gap-1 text-xs text-ink-600"><Heart className="h-3.5 w-3.5" />{t('profile_stat_followers')}</div>
          <div className="mt-1 text-xl font-bold text-ink-100 tabular-nums">—</div>
        </div>
      </div>
      <div className="rounded-xl border border-ink-800 bg-ink-900/30 p-4">
        <h4 className="mb-3 text-sm font-semibold text-ink-300">{t('profile_chat_per_streamer')}</h4>
        <div className="flex flex-col gap-2">
          {followers.slice(0, 10).map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-950/40 px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-ink-500">
                {(c.displayName || c.username).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-200">{c.displayName || c.username}</div>
                <div className="truncate text-xs text-ink-600">@{c.username}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}