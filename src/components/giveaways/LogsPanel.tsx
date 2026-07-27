import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { LogEntry } from './types';
import { useI18n } from '@/i18n';

interface LogsPanelProps {
  open: boolean;
  onClose: () => void;
  logs: LogEntry[];
}

const typeColor: Record<LogEntry['type'], string> = {
  message: 'text-ink-400',
  participant: 'text-accent-400',
  event: 'text-ink-200',
  error: 'text-red-400',
};

const typeLabel: Record<LogEntry['type'], string> = {
  message: 'MSG',
  participant: 'USER',
  event: 'EVT',
  error: 'ERR',
};

export function LogsPanel({ open, onClose, logs }: LogsPanelProps) {
  const { t, lang } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            transition={{ duration: 0.25 }}
            className="flex h-[70vh] w-full max-w-3xl flex-col rounded-2xl border border-ink-700 bg-ink-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-200">{t('gw_logs')}</h3>
              <button
                onClick={onClose}
                className="rounded-lg border border-ink-700 bg-ink-800 p-1.5 text-ink-400 transition hover:bg-ink-700 hover:text-ink-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-3 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="py-10 text-center text-ink-500">{t('gw_logs_empty')}</div>
              ) : (
                logs.slice(-500).map((l) => (
                  <div key={l.id} className="flex gap-2 py-0.5">
                    <span className="shrink-0 text-ink-600">{new Date(l.timestamp).toLocaleTimeString(lang === 'en' ? 'en-US' : 'ru-RU')}</span>
                    <span className={`shrink-0 font-semibold ${typeColor[l.type]}`}>{typeLabel[l.type]}</span>
                    <span className="break-all text-ink-300">{l.text}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
