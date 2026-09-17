import { supabase } from "./supabase";
export async function callEdge<T>(name: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body: body ?? {},
  });
  if (error) {
    const response = "context" in error ? error.context : null;
    if (response instanceof Response) {
      const detail = await response
        .clone()
        .json()
        .catch(() => null);
      if (detail?.error) throw new Error(detail.error);
      if (response.status === 401)
        throw new Error("Сессия истекла. Войдите через Twitch ещё раз.");
      if (response.status === 404)
        throw new Error(
          "Сервис ещё не установлен на сервере. Требуется развёртывание функций Supabase.",
        );
    }
    throw new Error(
      "Сервис недоступен. Проверьте соединение; сохранённые данные остаются на странице.",
    );
  }
  if (!data) throw new Error("Сервис вернул пустой ответ.");
  return data;
}
