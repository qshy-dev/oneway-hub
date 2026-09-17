export function parseLine(line) {
  const match = line.match(/^(?:@([^ ]+) )?(?::([^ ]+) )?([^ ]+)(?: (.*))?$/);
  if (!match) return null;
  const tags = Object.fromEntries(
    (match[1] || "")
      .split(";")
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf("=");
        return index < 0
          ? [pair, ""]
          : [
              pair.slice(0, index),
              pair
                .slice(index + 1)
                .replace(/\\s/g, " ")
                .replace(/\\:/g, ";"),
            ];
      }),
  );
  const rest = match[4] || "";
  const trailing = rest.indexOf(" :");
  return {
    tags,
    prefix: match[2] || "",
    command: match[3],
    params: (trailing < 0 ? rest : rest.slice(0, trailing)).split(" "),
    text: trailing < 0 ? rest.replace(/^:/, "") : rest.slice(trailing + 2),
  };
}
export function safeMessage(value) {
  return String(value)
    .replace(/[\r\n\0]/g, " ")
    .slice(0, 450);
}
export function commandReply(text, commands, username, channel, startedAt) {
  const name = text.trim().split(/\s+/)[0].slice(1).toLowerCase();
  const custom = commands.find((c) => c.name === name);
  if (custom)
    return custom.enabled
      ? {
          name,
          cooldown: custom.cooldown,
          text: custom.response
            .replaceAll("{user}", username)
            .replaceAll("{channel}", channel),
        }
      : null;
  const defaults = {
    help: `Команды: !help, !test, !uptime${commands
      .filter((c) => c.enabled)
      .map((c) => `, !${c.name}`)
      .join("")}`,
    test: "Бот подключён и отвечает на команды.",
    uptime: startedAt
      ? `Эфир идёт ${Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 60000))} мин.`
      : "Канал сейчас не в эфире.",
  };
  return defaults[name] ? { name, cooldown: 10, text: defaults[name] } : null;
}
