import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Radio } from 'lucide-react';
import type { ChatMessage } from './types';
import { RoleBadges } from './RoleBadges';
import { useI18n } from '@/i18n';

interface ChatFeedProps {
  messages: ChatMessage[];
  connected: boolean;
  livePulse: number;
}

export function ChatFeed({ messages, connected, livePulse }: ChatFeedProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [recentTick, setRecentTick] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      stickRef.current = nearBottom;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (livePulse === 0) return;
    setRecentTick(Date.now());
    const id = window.setTimeout(() => setRecentTick(0), 1500);
    return () => clearTimeout(id);
  }, [livePulse]);

  const live = connected && (recentTick > 0 || messages.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-11 items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-400">
          <MessageSquare className="h-4 w-4" /> {t('gw_chat')}
        </h3>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            live
              ? 'bg-emerald-500/15 text-emerald-300'
              : connected
                ? 'bg-ink-800/60 text-ink-400'
                : 'bg-red-500/10 text-red-400'
          }`}
        >
          <Radio className={`h-3 w-3 ${live ? 'animate-pulse' : ''}`} />
          {live ? t('gw_chat_live') : connected ? t('gw_chat_waiting') : t('gw_chat_offline')}
        </span>
      </div>
      <div className="flex h-8 items-center px-1 text-xs text-ink-500">
        <span className="uppercase tracking-wider">{t('gw_chat_stream')}</span>
      </div>
      <div
        ref={scrollRef}
        className="h-[420px] overflow-y-auto rounded-xl border border-ink-800 bg-ink-900/40 p-3"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-ink-500">
            {connected ? t('gw_chat_waiting_messages') : t('gw_chat_connect_hint')}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex gap-2 rounded-md px-2 py-1 text-sm leading-snug hover:bg-ink-800/40"
                >
                  <div className="flex shrink-0 items-center gap-1 self-start pt-0.5">
                  <RoleBadges roles={m.roles} size={12} />
                  <span className="font-semibold" style={{ color: m.color || '#bf7fff' }}>
                    {m.displayName}:
                  </span>
                </div>
                <span className="min-w-0 break-words text-ink-300">{m.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
