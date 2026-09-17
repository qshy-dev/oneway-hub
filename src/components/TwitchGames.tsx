import { useState } from 'react';
import { Gamepad2, Settings, ExternalLink, X, Loader2, Eye } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n';
import { ParachuteGamePreview } from './games/ParachuteGamePreview';
import { GAME_THEMES } from './games/themes';

interface Game {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  themes: { id: string; name: string }[];
  settings: Record<string, {
    type: 'range' | 'select' | 'number' | 'text';
    label: string;
    min?: number;
    max?: number;
    step?: number;
    default: string | number;
    options?: string[];
  }>;
}

const GAMES: Game[] = [
  {
    id: 'parachute',
    name: 'Parachute Drop',
    icon: '🪂',
    description: 'Чаттер пишет !drop и персонаж летит на парашюте вниз. Нужно попасть в цель.',
    color: '#a855f7',
    themes: GAME_THEMES.map(t => ({ id: t.id, name: t.name })),
    settings: {
      gravity: { type: 'range', min: 3, max: 20, default: 6, label: 'Гравитация (x0.01)' },
      maxSpeed: { type: 'range', min: 2, max: 8, default: 4, label: 'Макс. скорость' },
      windStrength: { type: 'range', min: 0, max: 10, default: 3, label: 'Сила ветера' },
      targetWidthPercent: { type: 'range', min: 8, max: 25, default: 12, label: 'Ширина цели (%)' },
      targetHeightPercent: { type: 'range', min: 4, max: 15, default: 8, label: 'Высота цели (%)' },
      command: { type: 'text', default: '!drop', label: 'Команда в чате' }
    }
  },
  {
    id: 'plinko',
    name: 'Plinko Bounce',
    icon: '🎯',
    description: 'Шарик падает через плоск с призами. Чат влияет на траекторию.',
    color: '#ec4899',
    themes: [
      { id: 'christmas', name: 'Рождество' },
      { id: 'halloween', name: 'Хеллоуин' },
      { id: 'day', name: 'День' }
    ],
    settings: {
      speed: { type: 'range', min: 1, max: 10, default: 5, label: 'Скорость' },
      prizes: { type: 'select', options: ['3', '5', '7'], default: '5', label: 'Количество призов' },
      tilt: { type: 'range', min: 0, max: 50, default: 20, label: 'Наклон (%)' },
      command: { type: 'text', default: '!plinko', label: 'Команда в чате' }
    }
  },
  {
    id: 'hillroll',
    name: 'Hill Rolling',
    icon: '🛷',
    description: 'Гонка по горке. Чат выбирает направление.',
    color: '#3b82f6',
    themes: [
      { id: 'christmas', name: 'Зима' },
      { id: 'summer', name: 'Лето' }
    ],
    settings: {
      speed: { type: 'range', min: 1, max: 10, default: 5, label: 'Скорость' },
      friction: { type: 'range', min: 0.9, max: 0.99, step: 0.01, default: 0.95, label: 'Трение' },
      aiCount: { type: 'number', min: 1, max: 10, default: 5, label: 'Количество ИИ' },
      command: { type: 'text', default: '!roll', label: 'Команда в чате' }
    }
  },
  {
    id: 'maze',
    name: 'Pixel Maze',
    icon: '🌀',
    description: 'Лабиринт. Чат помогает или мешает прохождению.',
    color: '#10b981',
    themes: [
      { id: 'christmas', name: 'Зимний' },
      { id: 'winter', name: 'Ледяной' },
      { id: 'wizards', name: 'Волшебники' }
    ],
    settings: {
      size: { type: 'select', options: ['5x5', '7x7', '9x9'], default: '7x7', label: 'Размер' },
      moveInterval: { type: 'number', min: 100, max: 1000, default: 300, label: 'Интервал хода (мс)' },
      command: { type: 'text', default: '!move', label: 'Команда в чате' }
    }
  },
  {
    id: 'chatflakes',
    name: 'Chat Flakes',
    icon: '❄️',
    description: 'Сообщения чата превращаются в частицы.',
    color: '#60a5fa',
    themes: [
      { id: 'snow', name: 'Снежинки' },
      { id: 'leaves', name: 'Листья' },
      { id: 'hearts', name: 'Сердечки' }
    ],
    settings: {
      density: { type: 'range', min: 1, max: 10, default: 5, label: 'Плотность' },
      speed: { type: 'range', min: 1, max: 10, default: 5, label: 'Скорость' },
      fade: { type: 'range', min: 0, max: 100, default: 50, label: 'Затухание' }
    }
  },
  {
    id: 'confetti',
    name: 'Pixel Confetti',
    icon: '🎉',
    description: 'Конфетти из чата. Зрители посылают частицы.',
    color: '#f59e0b',
    themes: [
      { id: 'basic', name: 'Базовый' },
      { id: 'blossoms', name: 'Цветы' },
      { id: 'autumn', name: 'Осень' }
    ],
    settings: {
      count: { type: 'number', min: 10, max: 200, default: 50, label: 'Количество' },
      spread: { type: 'range', min: 10, max: 100, default: 50, label: 'Разброс (%)' },
      colorScheme: { type: 'select', options: ['rainbow', 'warm', 'cool'], default: 'rainbow', label: 'Цветовая схема' }
    }
  }
];

export function TwitchGames() {
  const { t } = useI18n();
  const { profile, signInWithTwitch, loading: authLoading } = useAuth();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gameSettings, setGameSettings] = useState<Record<string, string | number>>({});
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [browserSourceLink, setBrowserSourceLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const openGameModal = (game: Game) => {
    setSelectedGame(game);
    const defaults: Record<string, string | number> = {};
    Object.keys(game.settings).forEach(key => {
      defaults[key] = game.settings[key].default;
    });
    setGameSettings(defaults);
    setSelectedTheme(game.themes[0]?.id || '');
    updateBrowserSourceLink();
  };

  const closeGameModal = () => {
    setSelectedGame(null);
    setGameSettings({});
    setSelectedTheme('');
    setBrowserSourceLink('');
    setCopied(false);
  };

  const handleSettingChange = (key: string, value: string | number) => {
    setGameSettings(prev => ({ ...prev, [key]: value }));
    updateBrowserSourceLink();
  };

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    updateBrowserSourceLink();
  };

  const updateBrowserSourceLink = () => {
    if (!selectedGame) return;
    const params = new URLSearchParams();
    Object.entries(gameSettings).forEach(([key, value]) => {
      params.set(key, String(value));
    });
    if (selectedTheme) {
      params.set('theme', selectedTheme);
    }
    params.set('game', selectedGame.id);
    const link = `${window.location.origin}/games/${selectedGame.id}.html?${params.toString()}`;
    setBrowserSourceLink(link);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(browserSourceLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-500" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center px-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-ink-700 bg-ink-900">
          <Gamepad2 className="h-12 w-12 text-accent-500" />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-ink-100 mb-4">{t('twitchgames_title')}</h2>
          <p className="text-ink-400 mb-8 max-w-md">{t('twitchgames_auth_required')}</p>
          <button
            onClick={signInWithTwitch}
            className="group flex items-center justify-center gap-2.5 rounded-xl bg-[#9146FF] px-6 py-3 text-base font-bold text-white transition hover:bg-[#7C3FE8]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
            </svg>
            {t('auth_twitch_btn')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-ink-100 mb-2">{t('twitchgames_title')}</h1>
        <p className="text-ink-400">{t('twitchgames_subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {GAMES.map(game => (
          <button
            key={game.id}
            onClick={() => openGameModal(game)}
            className="group relative p-6 rounded-2xl border border-ink-800 bg-ink-900/40 transition hover:border-accent-500/40 hover:bg-ink-800/50 hover:shadow-lg hover:shadow-accent-500/10 text-left"
            style={{ borderTopColor: game.color }}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink-800 text-3xl">{game.icon}</div>
              <div>
                <h3 className="text-lg font-bold text-ink-100">{game.name}</h3>
                <p className="text-sm text-ink-500 mt-1">{game.themes.length} {t('twitchgames_themes')}</p>
              </div>
            </div>
            <p className="text-ink-400 text-sm mb-4 line-clamp-2">{game.description}</p>
            <div className="flex flex-wrap gap-2">
              {game.themes.slice(0, 3).map(theme => (
                <span key={theme.id} className="px-2 py-1 text-xs rounded-full bg-ink-800 text-ink-500 border border-ink-700">
                  {theme.name}
                </span>
              ))}
              {game.themes.length > 3 && (
                <span className="px-2 py-1 text-xs rounded-full bg-ink-800 text-ink-500 border border-ink-700">
                  +{game.themes.length - 3}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/90 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-ink-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-800 text-2xl">{selectedGame.icon}</div>
                <h2 className="text-xl font-bold text-ink-100">{selectedGame.name}</h2>
              </div>
              <button onClick={closeGameModal} className="p-2 rounded-lg text-ink-500 hover:bg-ink-800 hover:text-ink-100 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row overflow-hidden">
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="aspect-video rounded-xl bg-ink-800 relative overflow-hidden mb-6">
{showPreview ? (
                      <iframe
                        src={`${window.location.origin}/games/${selectedGame.id}.html?${new URLSearchParams({ ...gameSettings, theme: selectedTheme, game: selectedGame.id } as Record<string, string>).toString()}`}
                        className="w-full h-full border-0"
                        title={selectedGame.name}
                      />
                  ) : (
                    <div className="flex h-full items-center justify-center text-ink-500">
                      <div className="text-center">
                        <div className="text-6xl mb-2">{selectedGame.icon}</div>
                        <p>{t('twitchgames_preview_placeholder')}</p>
                        <button
                          onClick={() => setShowPreview(true)}
                          className="mt-4 px-4 py-2 rounded-lg border border-ink-700 text-ink-300 hover:border-accent-500 hover:text-accent-400 transition"
                        >
                          {t('twitchgames_show_preview')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {selectedGame.themes.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-ink-300 mb-2">{t('twitchgames_theme')}</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedGame.themes.map(theme => (
                          <button
                            key={theme.id}
                            onClick={() => handleThemeChange(theme.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                              selectedTheme === theme.id
                                ? 'bg-accent-500 text-ink-950 shadow-lg shadow-accent-500/30'
                                : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-100 border border-ink-700'
                            }`}
                          >
                            {theme.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.entries(selectedGame.settings).map(([key, setting]) => (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-ink-300">{setting.label}</label>
                      {setting.type === 'range' && (
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={setting.min!}
                            max={setting.max!}
                            step={setting.step || 1}
                            value={gameSettings[key]}
                            onChange={e => handleSettingChange(key, parseFloat(e.target.value))}
                            className="flex-1 slider accent-accent-500"
                          />
                          <span className="w-12 text-right text-sm font-mono text-ink-400">{gameSettings[key]}</span>
                        </div>
                      )}
                      {setting.type === 'select' && (
                        <select
                          value={gameSettings[key]}
                          onChange={e => handleSettingChange(key, e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-ink-800 border border-ink-700 text-ink-100 focus:border-accent-500 focus:outline-none transition"
                        >
                          {setting.options!.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                      {setting.type === 'number' && (
                        <input
                          type="number"
                          min={setting.min!}
                          max={setting.max!}
                          value={gameSettings[key]}
                          onChange={e => handleSettingChange(key, parseFloat(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-ink-800 border border-ink-700 text-ink-100 focus:border-accent-500 focus:outline-none transition"
                        />
                      )}
                      {setting.type === 'text' && (
                        <input
                          type="text"
                          value={gameSettings[key]}
                          onChange={e => handleSettingChange(key, e.target.value)}
                          placeholder={String(setting.default)}
                          className="w-full px-3 py-2 rounded-lg bg-ink-800 border border-ink-700 text-ink-100 focus:border-accent-500 focus:outline-none transition"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full md:w-80 border-l border-ink-800 p-6 bg-ink-950/50">
                <h3 className="text-lg font-bold text-ink-100 mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {t('twitchgames_browser_source')}
                </h3>
                <p className="text-sm text-ink-500 mb-4">{t('twitchgames_browser_source_desc')}</p>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={browserSourceLink}
                      readOnly
                      className="w-full px-3 py-2 rounded-lg bg-ink-800 border border-ink-700 text-ink-100 text-sm font-mono truncate pr-12"
                    />
                    <button
                      onClick={copyLink}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${copied ? 'bg-emerald-500 text-ink-950' : 'bg-accent-500 text-white hover:bg-accent-400'}`}
                    >
                      {copied ? t('copied') : t('copy')}
                    </button>
                  </div>
                  <a
                    href={browserSourceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-ink-700 bg-ink-800 text-ink-300 hover:border-accent-500 hover:bg-ink-700 hover:text-ink-100 transition"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('twitchgames_open_in_new_tab')}
                  </a>
                </div>
                {/* Parachute Game Preview */}
                {selectedGame.id === 'parachute' && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-ink-300 mb-3 flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      {t('twitchgames_preview_placeholder')}
                    </h4>
                    <ParachuteGamePreview
                      themeId={selectedTheme}
                      config={{
                        gravity: Number(gameSettings.gravity || 15) / 100,
                        maxSpeed: Number(gameSettings.maxSpeed || 4),
                        windStrength: Number(gameSettings.windStrength || 3) / 10,
                        targetWidthPercent: Number(gameSettings.targetWidthPercent || 12),
                        targetHeightPercent: Number(gameSettings.targetHeightPercent || 8),
                      }}
                    />
                  </div>
                )}
                <div className="mt-6 p-4 rounded-lg bg-ink-800 border border-ink-700">
                  <h4 className="text-sm font-medium text-ink-300 mb-2">{t('twitchgames_chat_command')}</h4>
                  <code className="text-sm font-mono text-accent-400 bg-ink-900 px-2 py-1 rounded">
                    {gameSettings.command || selectedGame.settings.command?.default || ''}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}