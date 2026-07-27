import { Hash } from 'lucide-react';
import type { GiveawayMode } from '../types';

export const KeywordMode: GiveawayMode = {
  config: {
    id: 'keyword',
    label: 'Ключевое слово',
    icon: Hash,
    fields: [
      {
        key: 'keyword',
        label: 'Ключевое слово',
        type: 'text',
        placeholder: '!нож',
        default: '!нож',
      },
      {
        key: 'matchType',
        label: 'Тип совпадения',
        type: 'select',
        default: 'exact',
        options: [
          { label: 'Строгое совпадение', value: 'exact' },
          { label: 'Содержит текст', value: 'contains' },
        ],
      },
    ],
  },
  handleMessage(msg, ctx) {
    if (!ctx.isCollecting()) return;
    const keyword = String(ctx.config.keyword ?? '').trim().toLowerCase();
    const matchType = String(ctx.config.matchType ?? 'exact');
    if (!keyword) return;
    const text = msg.text.trim().toLowerCase();
    const matched = matchType === 'contains' ? text.includes(keyword) : text === keyword;
    if (!matched) return;
    ctx.addParticipant(msg);
  },
};
