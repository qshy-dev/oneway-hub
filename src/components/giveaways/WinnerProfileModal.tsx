import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, UserCircle, AtSign, Hash, Calendar, ExternalLink, Twitch } from 'lucide-react';
import { useI18n } from '@/i18n';
import { supabase, type Profile } from '@/lib/supabase';

interface WinnerProfileModalProps {
  username: string | null;
  onClose: () => void;
  onViewFullProfile?: (userId: string) => void;
}

export function WinnerProfileModal({ username, onClose, onViewFullProfile }: WinnerProfileModalProps) {
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setProfile(null);

    supabase
      .from('profiles')
      .select('*')
      .ilike('twitch_username', username)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setProfile(data as Profile);
          setLoading(false);
          return;
        }
        // Not found in DB — try Twitch lookup
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-user-info?login=${encodeURIComponent(username)}`,
            {
              headers: {
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'X-Client-Info': 'web',
              },
            },
          );
          if (!res.ok) throw new Error('fetch failed');
          const json = await res.json();
          if (cancelled) return;
          if (json.createdAt) {
            setProfile({
              id: '',
              twitch_id: null,
              twitch_username: username,
              twitch_display_name: username,
              twitch_avatar: null,
              twitch_broadcaster_type: null,
              created_at: json.createdAt,
              updated_at: json.createdAt,
            });
            setLoading(false);
          } else {
            setNotFound(true);
            setLoading(false);
          }
        } catch {
          if (cancelled) return;
          setNotFound(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (!username) return null;

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm animate-backdrop-in"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-lg rounded-2xl border border-ink-800 bg-ink-950 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-ink-600 transition hover:text-ink-300"
        >
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink-700 border-t-accent-500" />
            <span className="ml-3 text-sm text-ink-500">{t('gw_profile_modal_loading')}</span>
          </div>
        ) : notFound ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3">
            <UserCircle className="h-12 w-12 text-ink-700" />
            <p className="text-sm text-ink-500">{t('gw_profile_modal_not_found')}</p>
          </div>
        ) : profile ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {profile.twitch_avatar ? (
                <img
                  src={profile.twitch_avatar}
                  alt={profile.twitch_display_name ?? profile.twitch_username ?? 'Avatar'}
                  className="h-20 w-20 shrink-0 rounded-2xl border-2 border-ink-700 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-ink-700 bg-ink-900">
                  <UserCircle className="h-10 w-10 text-ink-600" />
                </div>
              )}
              <div className="flex flex-1 flex-col items-center gap-1 sm:items-start">
                {profile.twitch_username ? (
                  <a
                    href={`https://twitch.tv/${profile.twitch_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-1.5 transition hover:text-accent-400"
                  >
                    <h3 className="text-xl font-extrabold text-ink-100 group-hover:text-accent-400">
                      {profile.twitch_display_name ?? profile.twitch_username}
                    </h3>
                    <ExternalLink className="h-4 w-4 text-ink-600 transition group-hover:text-accent-400" />
                  </a>
                ) : (
                  <h3 className="text-xl font-extrabold text-ink-100">
                    {profile.twitch_display_name ?? profile.twitch_username ?? 'user'}
                  </h3>
                )}
                {profile.twitch_username && (
                  <a
                    href={`https://twitch.tv/${profile.twitch_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-ink-400 transition hover:text-accent-400"
                  >
                    @{profile.twitch_username}
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoRow icon={<UserCircle className="h-4 w-4" />} label={t('profile_display_name')} value={profile.twitch_display_name ?? '—'} />
              <InfoRow icon={<AtSign className="h-4 w-4" />} label={t('profile_username')} value={profile.twitch_username ?? '—'} />
              <InfoRow icon={<Hash className="h-4 w-4" />} label={t('profile_twitch_id')} value={profile.twitch_id ?? '—'} />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label={t('profile_joined')} value={joinedDate} />
            </div>

            {onViewFullProfile && profile.id && (
              <button
                onClick={() => onViewFullProfile(profile.id)}
                className="flex items-center justify-center gap-2.5 rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 text-sm font-semibold text-ink-200 transition hover:border-accent-500/50 hover:text-accent-400"
              >
                <Twitch className="h-4 w-4" />
                {t('gw_profile_modal_view_full')}
              </button>
            )}
          </div>
        ) : null}
      </motion.div>
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
