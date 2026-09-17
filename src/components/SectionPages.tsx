import { useEffect, useState } from "react";
import { ArrowUpRight, Dices, Gift, Gavel, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Profile } from "./Profile";
import { navigate } from "@/lib/router";

export function NotFound() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-8xl font-black text-accent-400">404</p>
      <h1 className="mt-6 text-2xl font-bold">Страница не найдена</h1>
      <p className="mt-3 text-ink-400">Такого раздела или профиля пока нет.</p>
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          navigate("/");
        }}
        className="mt-8 rounded-xl bg-accent-500 px-6 py-3 font-semibold text-white"
      >
        На главную
      </a>
    </section>
  );
}

export function ProfileRoute({ username }: { username?: string }) {
  const { profile, loading } = useAuth();
  const [result, setResult] = useState<{
    name: string;
    id: string | null;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!username || username === profile?.twitch_username?.toLowerCase())
      return;
    let cancelled = false;
    supabase
      .rpc("get_public_profile", { p_username: username, p_user_id: null })
      .then(({ data, error }) => {
        if (!cancelled)
          setResult({
            name: username,
            id: data?.id ?? null,
            error: error
              ? "Не удалось загрузить профиль. Проверьте соединение и повторите попытку."
              : undefined,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [username, profile?.twitch_username]);
  if (!username) return <Profile />;
  if (loading) return <p role="status">Загрузка профиля…</p>;
  if (username === profile?.twitch_username?.toLowerCase()) return <Profile />;
  if (result?.name !== username) return <p role="status">Загрузка профиля…</p>;
  if (result.error)
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-500/30 p-6 text-red-300"
      >
        {result.error}
      </p>
    );
  return result.id ? (
    <Profile key={result.id} userId={result.id} />
  ) : (
    <NotFound />
  );
}

export function ToolsPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[.25em] text-accent-400">
          ONEWAY / CREATOR TOOLS
        </p>
        <h1 className="mt-3 text-4xl font-bold">Инструменты для эфира</h1>
        <p className="mt-3 text-ink-400">
          Вовлекайте чат, выбирайте победителей и управляйте интерактивом.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {[
          {
            path: "/tools/roulette",
            title: "Рулетка прицелов",
            text: "Колесо и горизонтальная рулетка. Свои прицелы и коллекция игроков.",
            icon: Dices,
          },
          {
            path: "/tools/giveaways",
            title: "Розыгрыши",
            text: "Участники из Twitch-чата, условия участия и выбор победителя.",
            icon: Gift,
          },
          {
            path: "/tools/auction",
            title: "Аукцион",
            text: "Заявки сообщества, ставки и финальное колесо.",
            icon: Gavel,
          },
        ].map((item) => (
          <a
            key={item.path}
            href={item.path}
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                navigate(item.path);
              }
            }}
            className="group rounded-2xl border border-ink-800 bg-ink-900/60 p-7 transition hover:border-accent-500/50"
          >
            <item.icon className="mb-10 h-8 w-8 text-accent-400" />
            <h2 className="flex items-center justify-between text-xl font-bold">
              {item.title}
              <ArrowUpRight className="h-5 w-5" />
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-400">{item.text}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

export function HelpPage({ docs = false }: { docs?: boolean }) {
  const entries = docs
    ? [
        [
          "Начало работы",
          "Войдите через Twitch на странице профиля. Ваш публичный профиль доступен по адресу /ваш_ник. Инструменты, игры, бот и статистика доступны в боковом меню.",
        ],
        [
          "Инструменты и игры",
          "Откройте «Инструменты» и выберите рулетку, розыгрыш или аукцион. В разделе «Игры» доступны интерактивы для Twitch-чата. Настройки каждого инструмента находятся внутри него.",
        ],
        [
          "Подключение бота",
          "На странице «Бот» подключите свой канал верхней кнопкой. Для работы нужен авторизованный аккаунт бота. Статус присутствия подтверждается ответом Twitch, а не сохранением настройки. Команды и журнал находятся на отдельных вкладках.",
        ],
        [
          "Как читать статистику",
          "Обзор показывает сведения Twitch, записи эфиров и накопленные наблюдения. Средний и пиковый онлайн рассчитываются по замерам; архивы видео не содержат исторический онлайн. Прочерк означает отсутствие данных, а не ноль.",
        ],
        [
          "Доступность данных",
          "Некоторые метрики требуют разрешений владельца канала. История чата появляется только после начала сбора. Удалённые Twitch-записи и сообщения за прошлые периоды восстановить через API нельзя.",
        ],
      ]
    : [
        [
          "Почему вместо числа стоит прочерк?",
          "Для этой метрики ещё нет наблюдений или Twitch не предоставил доступ. Сайт не подставляет вымышленные значения.",
        ],
        [
          "Почему бот не подключается?",
          "Проверьте авторизацию аккаунта бота и сообщения в журнале. После изменения разрешений необходимо повторно авторизовать бота. Для круглосуточного присутствия должен работать серверный процесс бота.",
        ],
        [
          "Почему нет статистики за все 30 дней?",
          "Twitch не отдаёт готовую историю зрителей и сообщений. Эти данные собираются с момента подключения; доступные записи эфиров загружаются отдельно.",
        ],
        [
          "Как поделиться профилем?",
          "Отправьте ссылку на сайт с вашим Twitch-ником после слеша, например /qshyou. Профиль появится после первого входа на сайт.",
        ],
        [
          "Что делать при ошибке обновления?",
          "Сохранённые данные остаются доступны. Повторите обновление; при истёкшей авторизации выйдите и снова войдите через Twitch.",
        ],
      ];
  return (
    <section className="mx-auto w-full max-w-3xl space-y-8">
      <BookOpen className="h-9 w-9 text-accent-400" />
      <div>
        <p className="text-xs uppercase tracking-[.25em] text-ink-500">
          ONEWAY / HELP CENTER
        </p>
        <h1 className="mt-3 text-4xl font-bold">
          {docs ? "Документация" : "Частые вопросы"}
        </h1>
        <p className="mt-3 text-ink-400">
          Всё, что нужно для работы с вашим каналом.
        </p>
      </div>
      <div className="space-y-3">
        {entries.map(([title, text]) => (
          <details
            key={title}
            open={docs}
            className="rounded-2xl border border-ink-800 bg-ink-900/50 p-5"
          >
            <summary className="cursor-pointer font-semibold">{title}</summary>
            <p className="mt-4 text-sm leading-7 text-ink-400">{text}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
