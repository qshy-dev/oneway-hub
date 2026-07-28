import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, MessageSquare, Clock, CheckCircle2, AlertCircle, CalendarDays, Heart, HeartCrack, Loader2 } from 'lucide-react';
import type { Participant, ChatMessage } from './types';
import { RoleBadges } from './RoleBadges';
import { useI18n } from '@/i18n';

interface ParticipantModalProps {
  participant: Participant | null;
  messages: ChatMessage[];
  isWinner: boolean;
  canReroll: boolean;
  onReroll: () => void;
  onClose: () => void;
  autoStartTimer: boolean;
  onResponded?: () => void;
  channel?: string;
}

function avatarUrlFor(username: string): string {
  return `https://unavatar.io/twitch/${encodeURIComponent(username)}`;
}

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function ParticipantModal({
  participant,
  messages,
  isWinner,
  canReroll,
  onReroll,
  onClose,
  autoStartTimer,
  onResponded,
  channel,
}: ParticipantModalProps) {
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-US' : 'ru-RU';
  const [elapsed, setElapsed] = useState(0);
  const [responded, setResponded] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [followedAt, setFollowedAt] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoLoaded, setInfoLoaded] = useState(false);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const userMessages = useMemo(() => {
    if (!participant) return [];
    return messages
      .filter((m) => m.userId === participant.id || m.username === participant.username)
      .reverse();
  }, [participant, messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = userMessages.length > prevCountRef.current;
    prevCountRef.current = userMessages.length;
    if (grew) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      el.scrollTo({ top: 0 });
    }
  }, [userMessages]);

  useEffect(() => {
    if (!participant) {
      setResponded(false);
      setElapsed(0);
      return;
    }
    setResponded(false);
    setElapsed(0);
    prevCountRef.current = 0;
    if (autoStartTimer) {
      startRef.current = Date.now();
    }
  }, [participant, autoStartTimer]);

  useEffect(() => {
    if (!participant || !autoStartTimer || responded) return;
    const tick = () => {
      setElapsed(Date.now() - startRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [participant, autoStartTimer, responded]);

  useEffect(() => {
    if (!participant) {
      setCreatedAt(null);
      setFollowedAt(null);
      setInfoLoading(false);
      setInfoLoaded(false);
      return;
    }
    let cancelled = false;
    setCreatedAt(null);
    setFollowedAt(null);
    setInfoLoading(true);
    setInfoLoaded(false);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const params = new URLSearchParams({ login: participant.username });
    if (channel) params.set('channel', channel);
    const fnUrl = `${supabaseUrl}/functions/v1/twitch-user-info?${params.toString()}`;
    fetch(fnUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseKey}` } })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          if (data?.createdAt) setCreatedAt(data.createdAt);
          if (data?.followedAt) setFollowedAt(data.followedAt);
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) { setInfoLoading(false); setInfoLoaded(true); } });
    return () => { cancelled = true; };
  }, [participant, channel]);

  return (
    <AnimatePresence>
      {participant && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-2xl"
          >
            {/* Header */}
            <div className={`flex items-center gap-4 p-5 ${isWinner ? 'border-b border-accent-500/30 bg-accent-500/10' : 'border-b border-ink-800'}`}>
              <img
                src={participant.avatarUrl || avatarUrlFor(participant.username)}
                alt=""
                className={`h-16 w-16 shrink-0 rounded-full border-2 object-cover ${isWinner ? 'border-accent-500' : 'border-ink-700'}`}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-extrabold" style={{ color: participant.color }}>
                  {participant.displayName}
                </h3>
                <p className="truncate text-sm text-ink-500">@{participant.username}</p>
                <p className="mt-0.5 text-xs text-ink-600">
                  {t('gw_pm_messages_count', String(participant.messageCount))} · {t('gw_pm_joined')} {new Date(participant.firstSeenAt).toLocaleTimeString(locale)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-2 text-ink-500 transition hover:bg-ink-800 hover:text-ink-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Winner response timer */}
            {isWinner && autoStartTimer && (
              <div className={`flex items-center gap-3 px-5 py-3 ${responded ? 'bg-emerald-950/40' : elapsed > 60000 ? 'bg-red-950/40' : 'bg-ink-850'}`}>
                {responded ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                ) : elapsed > 60000 ? (
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                ) : (
                  <Clock className="h-5 w-5 shrink-0 text-accent-400" />
                )}
                <div className="flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                    {responded ? t('gw_pm_responded') : t('gw_pm_waiting')}
                  </div>
                  <div className={`font-mono text-2xl font-bold tabular-nums ${responded ? 'text-emerald-400' : elapsed > 60000 ? 'text-red-400' : 'text-ink-100'}`}>
                    {responded ? formatTimer(elapsed) : formatTimer(elapsed)}
                  </div>
                </div>
              </div>
            )}

            {/* Participant info */}
            <div className="flex flex-wrap gap-3 border-b border-ink-800 px-5 py-3">
              <div className="flex items-center gap-2 rounded-lg bg-ink-850/60 px-3 py-2">
                {infoLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-500" />
                ) : createdAt ? (
                  <CalendarDays className="h-4 w-4 shrink-0 text-accent-400" />
                ) : (
                  <CalendarDays className="h-4 w-4 shrink-0 text-ink-600" />
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{t('gw_pm_account_created')}</div>
                  <div className="truncate text-sm font-medium text-ink-200">
                    {infoLoading
                      ? '…'
                      : createdAt
                        ? new Date(createdAt).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
                        : t('gw_pm_no_data')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-ink-850/60 px-3 py-2">
                {infoLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-500" />
                ) : followedAt ? (
                  <Heart className="h-4 w-4 shrink-0 text-pink-400" />
                ) : (
                  <Heart className="h-4 w-4 shrink-0 text-ink-600" />
                )}
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{t('gw_pm_following_since')}</div>
                  <div className="truncate text-sm font-medium text-ink-200">
                    {infoLoading
                      ? '…'
                      : followedAt
                        ? new Date(followedAt).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
                        : t('gw_pm_no_data')}
                  </div>
                </div>
              </div>
              {participant.roles.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-ink-850/60 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{t('gw_pm_roles')}</div>
                    <div className="flex items-center gap-1 pt-0.5">
                      <RoleBadges roles={participant.roles} size={14} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="p-5">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                <MessageSquare className="h-4 w-4" /> {t('gw_pm_last_messages')}
              </h4>
              <div ref={scrollRef} className="max-h-[220px] overflow-y-auto rounded-xl border border-ink-800/60 bg-ink-950/40 p-2">
                {userMessages.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-600">{t('gw_pm_no_messages')}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {userMessages.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start gap-2.5 rounded-lg bg-ink-900/60 px-3 py-2"
                      >
                        <span className="shrink-0 text-xs tabular-nums text-ink-600">
                          {new Date(m.timestamp).toLocaleTimeString(locale)}
                        </span>
                        <span className="break-words text-sm text-ink-200">{m.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer with reroll and responded */}
            {isWinner && canReroll && (
              <div className="flex items-center justify-between gap-2 border-t border-ink-800 p-4">
                <button
                  onClick={() => { setResponded(true); onResponded?.(); }}
                  className="flex h-[42px] items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-900/30 px-4 text-sm font-medium text-emerald-300 transition hover:bg-emerald-900/50"
                >
                  <CheckCircle2 className="h-4 w-4" /> {t('gw_pm_mark_responded')}
                </button>
                <button
                  onClick={onReroll}
                  className="flex h-[42px] items-center gap-2 rounded-lg border border-ink-700 bg-ink-800/60 px-4 text-sm font-semibold text-ink-300 transition hover:bg-ink-700/60"
                >
                  <RefreshCw className="h-4 w-4" /> {t('gw_pm_reroll')}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
