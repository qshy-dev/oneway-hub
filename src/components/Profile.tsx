import { LogOut, Twitch, UserCircle, Calendar, Hash, Tv, AtSign, BadgeCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';

export function Profile() {
  const { t } = useI18n();
  const { profile, user, loading, signInWithTwitch, signOut } = useAuth();

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
                {profile?.twitch_display_name ?? profile?.twitch_username ?? 'User'}
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
          icon={<UserCircle className="h-4 w-4" />}
          label={t('profile_display_name')}
          value={profile?.twitch_display_name ?? '—'}
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
