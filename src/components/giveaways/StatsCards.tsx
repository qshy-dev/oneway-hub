import { motion } from 'framer-motion';
import { Users, MessageSquare, Zap, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n';

interface StatsCardsProps {
  participants: number;
  messages: number;
  msgPerSec: number;
  timerLabel: string;
}

function AnimatedNumber({ value, locale }: { value: number; locale: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const lastUpdateRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const now = performance.now();
    const sinceLast = now - lastUpdateRef.current;
    lastUpdateRef.current = now;
    // When updates arrive faster than the animation duration, snap instantly
    // to avoid jitter from constantly restarting the tween.
    if (sinceLast < 400) {
      prevRef.current = to;
      setDisplay(to);
      return;
    }
    const start = now;
    const dur = 400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display.toLocaleString(locale)}</>;
}

export function StatsCards({ participants, messages, msgPerSec, timerLabel }: StatsCardsProps) {
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-US' : 'ru-RU';
  const cards = [
    { key: 'participants', icon: Users, label: t('gw_stat_participants'), accent: 'text-accent-400' },
    { key: 'messages', icon: MessageSquare, label: t('gw_stat_messages'), accent: 'text-ink-200' },
    { key: 'msgPerSec', icon: Zap, label: t('gw_stat_msg_per_sec'), accent: 'text-accent-300' },
    { key: 'timer', icon: Timer, label: t('gw_stat_timer'), accent: 'text-ink-200' },
  ] as const;
  const values: Record<string, string | number> = {
    participants,
    messages,
    msgPerSec,
    timer: timerLabel,
  };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="rounded-xl border border-ink-800 bg-ink-900/50 p-4"
        >
          <div className="flex items-center gap-2 text-ink-500">
            <c.icon className={`h-4 w-4 ${c.accent}`} />
            <span className="text-xs font-semibold uppercase tracking-wider">{c.label}</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold tabular-nums text-ink-100">
            {c.key === 'timer' ? (
              timerLabel
            ) : (
              <AnimatedNumber value={Number(values[c.key])} locale={locale} />
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
