import { LogOut, Twitch, UserCircle, Calendar, Hash, Tv, AtSign, BadgeCheck, Heart, X, Search } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';

interface FollowedChannel {
  login: string;
  displayName: string;
  avatar: string | null;
  followedAt: string | null;
}

export function Profile() {
  const { t } = useI18n();
  const { profile, user, loading, signInWithTwitch, signOut } = useAuth();
  const [showFollows, setShowFollows] = useState(false);
  const [follows, setFollows] = useState<FollowedChannel[]>([]);
  const [followsLoading, setFollowsLoading] = useState(false);
  const [followsError, setFollowsError] = useState<string | null>(null);
  const [followsSearch, setFollowsSearch] = useState('');

  const loadFollows = async () => {
    if (!profile?.twitch_username) return;
    setFollowsLoading(true);
    setFollowsError(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-follows?login=${encodeURIComponent(profile.twitch_username)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFollows(data.follows ?? []);
    } catch (err) {
      setFollowsError(err instanceof Error ? err.message : 'Failed to load');
      setFollows([]);
    } finally {
      setFollowsLoading(false);
    }
  };

  const openFollows = () => {
    setShowFollows(true);
    if (follows.length === 0) loadFollows();
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-accent-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-20">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-ink-800 bg-ink-900">
          <UserCircle className="h-10 w-10 text-ink-600" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-ink-200">{t('profile_not_signed_in')}</h3>
        </div>
        <button
          onClick={signInWithTwitch}
          className="flex items-center gap-2.5 rounded-xl bg-[#9146FF] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#7c2cf6] active:scale-95"
        >
          <Twitch className="h-5 w-5" />
          {t('profile_sign_in')}
        </button>
      </div>
    );
  }

  const broadcasterLabel = (bt: string | null) => {
    if (bt === 'partner') return t('profile_broadcaster_partner');
    if (bt === 'affiliate') return t('profile_broadcaster_affiliate');
    return t('profile_broadcaster_none');
  };

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className="flex flex-1 flex-col gap-6 py-4">
      {/* Header card */}
      <div className="relative overflow-hidden rounded-2xl border border-ink-800 bg-gradient-to-br from-ink-900/80 to-ink-950 p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-[#9146FF]/5 to-transparent" />
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {profile?.twitch_avatar ? (
            <img
              src={profile.twitch_avatar}
              alt={profile.twitch_display_name ?? profile.twitch_username ?? 'Avatar'}
              className="h-24 w-24 shrink-0 rounded-2xl border-2 border-ink-700 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-ink-700 bg-ink-900">
              <UserCircle className="h-12 w-12 text-ink-600" />
            </div>
          )}
          <div className="flex flex-1 flex-col items-center gap-1 sm:items-start">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold text-ink-100">
                @{profile?.twitch_username ?? 'user'}
              </h2>
              {profile?.twitch_broadcaster_type === 'partner' && (
                <BadgeCheck className="h-5 w-5 text-[#9146FF]" />
              )}
            </div>
            {profile?.twitch_username && (
              <a
                href={`https://twitch.tv/${profile.twitch_username}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-ink-400 transition hover:text-accent-400"
              >
                <Twitch className="h-4 w-4" />
                @{profile.twitch_username}
              </a>
            )}
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900 px-3 py-1 text-xs font-semibold text-ink-300">
              {broadcasterLabel(profile?.twitch_broadcaster_type ?? null)}
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-4 py-2 text-sm font-semibold text-ink-400 transition hover:border-red-500/50 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            {t('profile_sign_out')}
          </button>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoRow
          icon={<AtSign className="h-4 w-4" />}
          label={t('profile_username')}
          value={profile?.twitch_username ?? '—'}
        />
        <InfoRow
          icon={<Hash className="h-4 w-4" />}
          label={t('profile_twitch_id')}
          value={profile?.twitch_id ?? '—'}
        />
        <InfoRow
          icon={<Tv className="h-4 w-4" />}
          label={t('profile_broadcaster_type')}
          value={broadcasterLabel(profile?.twitch_broadcaster_type ?? null)}
        />
        <InfoRow
          icon={<Calendar className="h-4 w-4" />}
          label={t('profile_joined')}
          value={joinedDate}
        />
      </div>

      {/* Subscriptions button */}
      <button
        onClick={openFollows}
        className="flex items-center justify-center gap-2.5 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 text-sm font-semibold text-ink-200 transition hover:border-accent-500/50 hover:text-accent-400"
      >
        <Heart className="h-4 w-4" />
        {t('profile_view_follows')}
      </button>

      {/* Follows modal */}
      {showFollows && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-backdrop-in"
          onClick={() => setShowFollows(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-ink-800 bg-ink-950 p-6 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink-100">{t('profile_follows_title')}</h3>
              <button onClick={() => setShowFollows(false)} className="text-ink-600 transition hover:text-ink-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-900 px-3 py-2">
              <Search className="h-4 w-4 text-ink-600" />
              <input
                value={followsSearch}
                onChange={(e) => setFollowsSearch(e.target.value)}
                placeholder={t('profile_follows_search')}
                className="flex-1 bg-transparent text-sm text-ink-200 placeholder:text-ink-600 focus:outline-none"
              />
              <span className="text-xs font-medium text-ink-600">{follows.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {followsLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-700 border-t-accent-500" />
                </div>
              ) : followsError ? (
                <p className="flex h-32 items-center justify-center text-sm text-red-400">{followsError}</p>
              ) : follows.length === 0 ? (
                <p className="flex h-32 items-center justify-center text-sm text-ink-600">{t('profile_follows_empty')}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {follows
                    .filter((f) => !followsSearch || f.displayName.toLowerCase().includes(followsSearch.toLowerCase()) || f.login.toLowerCase().includes(followsSearch.toLowerCase()))
                    .map((f) => (
                      <li key={f.login} className="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2">
                        {f.avatar ? (
                          <img src={f.avatar} alt="" className="h-8 w-8 rounded-full border border-ink-700" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-700 bg-ink-900">
                            <UserCircle className="h-5 w-5 text-ink-600" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink-200">{f.displayName}</p>
                          <p className="truncate text-xs text-ink-600">@{f.login}</p>
                        </div>
                        <a
                          href={`https://twitch.tv/${f.login}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-ink-600 transition hover:text-accent-400"
                        >
                          <Twitch className="h-4 w-4" />
                        </a>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-950/50 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-ink-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-ink-600">{label}</div>
        <div className="truncate text-sm font-semibold text-ink-200">{value}</div>
      </div>
    </div>
  );
}
