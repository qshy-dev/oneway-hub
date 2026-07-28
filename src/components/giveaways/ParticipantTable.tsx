import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowUpDown, Users } from 'lucide-react';
import type { Participant } from './types';
import { RoleBadges } from './RoleBadges';
import { useI18n } from '@/i18n';

const ROW_HEIGHT = 56;
const VISIBLE_ROWS = 12;

type SortKey = 'firstSeenAt' | 'messageCount' | 'username' | 'followsChannel';

interface ParticipantListProps {
  participants: Participant[];
  onSelectParticipant?: (p: Participant) => void;
  hideHeader?: boolean;
  channel?: string;
  onParticipantsUpdate?: (updater: (prev: Participant[]) => Participant[]) => void;
}

function avatarUrlFor(username: string): string {
  return `https://unavatar.io/twitch/${encodeURIComponent(username)}`;
}

export function ParticipantTable({ participants, onSelectParticipant, hideHeader, channel, onParticipantsUpdate }: ParticipantListProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('firstSeenAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? participants.filter((p) => p.displayName.toLowerCase().includes(q) || p.username.toLowerCase().includes(q))
      : participants;
    const sorted = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'messageCount') cmp = a.messageCount - b.messageCount;
        else if (sortKey === 'username') cmp = a.username.localeCompare(b.username);
        else if (sortKey === 'followsChannel') cmp = (a.followsChannel ? 1 : 0) - (b.followsChannel ? 1 : 0);
        else cmp = a.firstSeenAt - b.firstSeenAt;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    return sorted;
  }, [participants, query, sortKey, sortDir]);

  const total = filtered.length;
  const needVirtual = total > 300;
  const startIdx = needVirtual ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2) : 0;
  const visibleCount = needVirtual ? VISIBLE_ROWS + 6 : total;
  const endIdx = Math.min(total, startIdx + visibleCount);
  const slice = filtered.slice(startIdx, endIdx);
  const padTop = needVirtual ? startIdx * ROW_HEIGHT : 0;
  const padBottom = needVirtual ? (total - endIdx) * ROW_HEIGHT : 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  return (
    <div className="flex flex-col gap-3">
      {!hideHeader && (
        <div className="flex h-11 items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-400">
            <Users className="h-4 w-4" /> {t('gw_participants')}
            <span className="text-ink-500">· {total.toLocaleString('ru-RU')}</span>
          </h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('gw_search')}
              className="w-36 rounded-lg border border-ink-800 bg-ink-900/60 py-2 pl-9 pr-3 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
            />
          </div>
        </div>
      )}
      {hideHeader && (
        <div className="flex h-11 items-center justify-end">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('gw_search')}
              className="w-36 rounded-lg border border-ink-800 bg-ink-900/60 py-2 pl-9 pr-3 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="flex h-8 items-center gap-2 px-1 text-xs text-ink-500">
        <span className="mr-1 uppercase tracking-wider">{t('gw_sort')}</span>
        <SortChip label={t('gw_sort_time')} active={sortKey === 'firstSeenAt'} dir={sortDir} onClick={() => toggleSort('firstSeenAt')} />
        <SortChip label={t('gw_sort_nick')} active={sortKey === 'username'} dir={sortDir} onClick={() => toggleSort('username')} />
        <SortChip label={t('gw_sort_messages')} active={sortKey === 'messageCount'} dir={sortDir} onClick={() => toggleSort('messageCount')} />

      </div>

      <div
        ref={containerRef}
        className="h-[420px] overflow-y-auto rounded-xl border border-ink-800 bg-ink-900/40"
      >
        {total === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-ink-500">
            {t('gw_no_participants_hint')}
          </div>
        ) : (
          <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
            <div className="flex flex-col">
              {slice.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectParticipant?.(p)}
                  className={`flex items-center gap-3 border-b border-ink-800/50 px-3 transition hover:bg-ink-800/40 ${onSelectParticipant ? 'cursor-pointer' : ''}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  <img
                    src={p.avatarUrl || avatarUrlFor(p.username)}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full border border-ink-700 bg-ink-850 object-cover"
                    loading="lazy"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <RoleBadges roles={p.roles} size={12} />
                      <span className="truncate text-sm font-semibold" style={{ color: p.color }}>{p.displayName}</span>
                    </div>
                    <div className="truncate text-xs text-ink-500">@{p.username} · {new Date(p.firstSeenAt).toLocaleTimeString('ru-RU')}</div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-sm font-semibold tabular-nums text-ink-200">{p.messageCount.toLocaleString('ru-RU')}</span>
                    <span className="ml-1 text-xs text-ink-500">{t('gw_messages_short')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortChip({ label, active, dir, onClick }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-2 py-1 transition ${
        active ? 'bg-accent-500/15 text-accent-300' : 'bg-transparent text-ink-400 hover:text-ink-200'
      }`}
    >
      {label}
      {active && <ArrowUpDown className="h-3 w-3" style={{ transform: dir === 'desc' ? 'scaleY(-1)' : 'none' }} />}
    </button>
  );
}
