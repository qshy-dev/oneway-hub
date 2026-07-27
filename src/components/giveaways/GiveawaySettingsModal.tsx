import { useState, useEffect } from 'react';
import { X, Shield, Star, BadgeCheck, User, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RoleWeights, ChatterRole } from './types';
import { DEFAULT_ROLE_WEIGHTS } from './types';
import { useI18n } from '@/i18n';

interface GiveawaySettingsModalProps {
  open: boolean;
  onClose: () => void;
  weights: RoleWeights;
  onSave: (weights: RoleWeights) => void;
}

interface RoleRow {
  key: keyof RoleWeights;
  label: string;
  icon: typeof Shield;
  color: string;
  desc: string;
}

const ROLE_ROWS: RoleRow[] = [
  { key: 'mod', label: 'Модераторы', icon: Shield, color: 'text-blue-400', desc: 'Модераторы канала' },
  { key: 'vip', label: 'VIP', icon: Star, color: 'text-pink-400', desc: 'VIP-пользователи канала' },
  { key: 'subscriber', label: 'Подписчики', icon: BadgeCheck, color: 'text-amber-400', desc: 'Платные подписчики' },
  { key: 'default', label: 'Обычные', icon: User, color: 'text-ink-300', desc: 'Все остальные участники' },
];

export function GiveawaySettingsModal({ open, onClose, weights, onSave }: GiveawaySettingsModalProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<RoleWeights>(weights);
  const [enabled, setEnabled] = useState<Record<keyof RoleWeights, boolean>>({
    mod: false,
    vip: false,
    subscriber: false,
    default: false,
  });

  useEffect(() => {
    if (open) {
      setDraft(weights);
      setEnabled({ mod: false, vip: false, subscriber: false, default: false });
    }
  }, [open, weights]);

  const effectiveWeight = (key: keyof RoleWeights): number => {
    if (key === 'default') return enabled.default ? Number(draft.default) || 1 : 1;
    return enabled[key] ? Number(draft[key]) || 1 : 1;
  };

  const handleSave = () => {
    const sanitized: RoleWeights = {
      mod: enabled.mod ? Math.max(0, Number(draft.mod) || 0) : 1,
      vip: enabled.vip ? Math.max(0, Number(draft.vip) || 0) : 1,
      subscriber: enabled.subscriber ? Math.max(0, Number(draft.subscriber) || 0) : 1,
      default: enabled.default ? Math.max(0.1, Number(draft.default) || 0.1) : 1,
    };
    onSave(sanitized);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_ROLE_WEIGHTS);
    setEnabled({ mod: false, vip: false, subscriber: false, default: false });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
              <h2 className="text-lg font-bold text-ink-100">{t('gw_settings_title')}</h2>
              <button onClick={onClose} className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-800 hover:text-ink-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="mb-4 text-sm text-ink-400">{t('gw_settings_desc')}</p>

              <div className="space-y-3">
                {ROLE_ROWS.map((row) => {
                  const Icon = row.icon;
                  const isEnabled = enabled[row.key];
                  return (
                    <div key={row.key} className={`flex items-center gap-3 rounded-xl border bg-ink-850/50 p-3 transition ${isEnabled ? 'border-accent-500/40' : 'border-ink-800'}`}>
                      <button
                        type="button"
                        onClick={() => setEnabled((e) => ({ ...e, [row.key]: !e[row.key] }))}
                        className="flex shrink-0 items-center"
                        aria-label={isEnabled ? 'Отключить' : 'Включить'}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${isEnabled ? 'border-accent-500 bg-accent-500' : 'border-ink-600 bg-ink-900'}`}>
                          {isEnabled && (
                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 8l3.5 3.5L13 4" />
                            </svg>
                          )}
                        </div>
                      </button>
                      <Icon className={`h-5 w-5 shrink-0 ${isEnabled ? row.color : 'text-ink-600'}`} />
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-semibold ${isEnabled ? 'text-ink-200' : 'text-ink-500'}`}>{row.label}</div>
                        <div className="truncate text-xs text-ink-500">{row.desc}</div>
                      </div>
                      <div className={`flex items-center gap-2 transition ${isEnabled ? 'opacity-100' : 'opacity-40'}`}>
                        <span className="text-xs text-ink-500">×</span>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={draft[row.key]}
                          disabled={!isEnabled}
                          onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                          className="gw-no-spin w-16 rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-center text-sm font-semibold text-ink-100 outline-none transition focus:border-accent-500 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-lg border border-ink-800 bg-ink-850/30 p-3">
                <p className="text-xs text-ink-400">{t('gw_settings_hint')}</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-ink-800 px-5 py-4">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink-400 transition hover:bg-ink-800 hover:text-ink-200"
              >
                <RotateCcw className="h-4 w-4" />
                {t('gw_settings_reset')}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-ink-400 transition hover:bg-ink-800 hover:text-ink-200"
                >
                  {t('gw_cancel')}
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
                >
                  {t('gw_settings_save')}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
