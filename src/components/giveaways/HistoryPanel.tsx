import { useState } from 'react';
import { motion } from 'framer-motion';
import { History, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { GiveawayHistoryEntry } from './types';
import { WinnerProfileModal } from './WinnerProfileModal';
import { useI18n } from '@/i18n';

interface HistoryPanelProps {
  history: GiveawayHistoryEntry[];
  onClear: () => void;
  onDeleteEntry: (id: string) => void;
  onViewProfile?: (userId: string) => void;
}

const PAGE_SIZE = 10;

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function HistoryPanel({ history, onClear, onDeleteEntry, onViewProfile }: HistoryPanelProps) {
  const { t, lang } = useI18n();
  const [page, setPage] = useState(0);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-ink-800 bg-ink-900/40 px-4 py-6 text-center text-sm text-ink-500">
        {t('gw_history_empty')}
      </div>
    );
  }

  const pageCount = Math.ceil(history.length / PAGE_SIZE);
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const pageItems = history.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-400">
          <History className="h-4 w-4" /> {t('gw_history')}
          <span className="ml-1 text-xs font-normal text-ink-600">
            {history.length.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')}
          </span>
        </h3>
        <button
          onClick={onClear}
          className="text-xs font-medium text-ink-500 transition hover:text-red-400"
        >
          {t('gw_clear')}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {pageItems.map((h, i) => (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="flex items-center gap-10 rounded-lg border border-ink-800 bg-ink-900/50 px-4 py-1.5 text-sm"
          >
            <div className="w-[140px] shrink-0 text-ink-400">
              {new Date(h.date).toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')}
            </div>
            <div className="w-[120px] shrink-0 truncate font-medium text-ink-200" title={h.modeLabel}>{h.modeLabel}</div>
            <div className="w-[80px] shrink-0 whitespace-nowrap text-ink-400">
              {h.participants.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')} {t('gw_history_participants_short')}
            </div>
            <div className="w-[80px] shrink-0 whitespace-nowrap text-ink-400">
              {h.messages.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')} {t('gw_history_messages_short')}
            </div>
            <div className="min-w-0 flex-1 truncate">
              {h.winner ? (
                <button
                  onClick={() => setProfileUsername(h.winner!)}
                  className="font-semibold text-accent-400 transition hover:text-accent-300 hover:underline"
                >
                  {h.winner}
                </button>
              ) : (
                <span className="text-ink-500">—</span>
              )}
            </div>
            <div
              className="w-[44px] shrink-0 cursor-help text-right tabular-nums text-ink-500"
              title={t('gw_history_duration_tooltip')}
            >
              {formatDuration(h.durationSec)}
            </div>
            <button
              onClick={() => onDeleteEntry(h.id)}
              title={t('gw_history_delete')}
              className="shrink-0 text-ink-600 transition hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-800 bg-ink-900/50 text-ink-400 transition hover:bg-ink-800 hover:text-ink-200 disabled:opacity-30 disabled:hover:bg-ink-900/50 disabled:hover:text-ink-400"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: pageCount }, (_, idx) => (
              <button
                key={idx}
                onClick={() => setPage(idx)}
                className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold transition ${
                  idx === safePage
                    ? 'bg-accent-500/15 text-accent-300 border border-accent-500/40'
                    : 'border border-ink-800 bg-ink-900/50 text-ink-400 hover:bg-ink-800 hover:text-ink-200'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage === pageCount - 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-800 bg-ink-900/50 text-ink-400 transition hover:bg-ink-800 hover:text-ink-200 disabled:opacity-30 disabled:hover:bg-ink-900/50 disabled:hover:text-ink-400"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <WinnerProfileModal
        username={profileUsername}
        onClose={() => setProfileUsername(null)}
        onViewFullProfile={onViewProfile}
      />
    </div>
  );
}
