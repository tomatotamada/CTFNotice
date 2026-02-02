/**
 * CTFNotice Cloudflare Worker
 *
 * 機能:
 * - Slackスラッシュコマンドでイベント登録/解除
 * - 登録イベントの開始前リマインダー (24時間前、1時間前)
 */

interface Env {
  WATCHLIST: KVNamespace;
  SLACK_WEBHOOK_URL: string;
  SLACK_SIGNING_SECRET: string;
}

/** ウォッチリストのエントリ */
interface WatchEntry {
  eventId: number | string;
  title: string;
  start: string;
  finish?: string;
  url?: string;
  description?: string;
  isCustom?: boolean;
  reminded24h: boolean;
  reminded1h: boolean;
  addedAt: string;
}

/** CTFtime APIのイベント型 */
interface CTFEvent {
  id: number;
  title: string;
  url: string;
  ctftime_url: string;
  start: string;
  finish: string;
  duration: { hours: number; days: number };
  format: string;
  weight: number;
  organizers: { id: number; name: string }[];
}

// ========== ユーティリティ関数 ==========

/** 日時文字列をパース（複数形式対応）*/
function parseDateTime(input: string): Date | null {
  // ISO 8601形式
  if (/^\d{4}-\d{2}-\d{2}T/.test(input)) {
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
  }

  // YYYY-MM-DD HH:MM 形式
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    // JST (UTC+9) として解釈
    const utcDate = new Date(Date.UTC(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10) - 9,
      parseInt(minute, 10)
    ));
    return utcDate;
  }

  return null;
}

/** カスタムイベントIDを生成 */
function generateCustomEventId(): string {
  return `custom-${Date.now()}`;
}

// ========== CTFtime API ==========

async function fetchEvent(eventId: number): Promise<CTFEvent | null> {
  const res = await fetch(`https://ctftime.org/api/v1/events/${eventId}/`, {
    headers: { "User-Agent": "CTFNotice Bot/1.0" },
  });
  if (!res.ok) return null;
  return res.json() as Promise<CTFEvent>;
}

// ========== KV操作 ==========

async function getWatchlist(kv: KVNamespace): Promise<WatchEntry[]> {
  const data = await kv.get("watchlist", "json");
  return (data as WatchEntry[]) || [];
}

async function saveWatchlist(kv: KVNamespace, list: WatchEntry[]): Promise<void> {
  await kv.put("watchlist", JSON.stringify(list));
}

// ========== Slack通知 ==========

async function sendSlackMessage(webhookUrl: string, text: string, blocks?: unknown[]): Promise<void> {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, blocks }),
  });
}

function formatEventForSlack(event: CTFEvent): string {
  const start = new Date(event.start);
  const formatDate = (d: Date) =>
    d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });

  return [
    `*<${event.ctftime_url}|${event.title}>*`,
    `📅 ${formatDate(start)}`,
    `🏷️ ${event.format} | Weight: ${event.weight.toFixed(2)}`,
    event.url ? `🔗 <${event.url}|公式サイト>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCustomEventForSlack(entry: WatchEntry): string {
  const start = new Date(entry.start);
  const parts = [
    `*${entry.title}* 🔖`,
    `📅 ${formatDate(start)}`,
  ];
  if (entry.url) {
    parts.push(`🔗 <${entry.url}|リンク>`);
  }
  if (entry.description) {
    parts.push(`📝 ${entry.description}`);
  }
  return parts.join("\n");
}

// ========== Slackコマンド処理 ==========

async function handleSlackCommand(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const command = formData.get("command") as string;
  const text = (formData.get("text") as string || "").trim();
  const args = text.split(/\s+/);
  const subcommand = args[0]?.toLowerCase();

  // Debug: show what we received
  if (subcommand === "debug" || (subcommand !== "watch" && subcommand !== "unwatch" && subcommand !== "list" && subcommand !== "add")) {
    return slackResponse(`DEBUG INFO:\ncommand: ${command}\ntext: "${text}"\nargs: ${JSON.stringify(args)}\nsubcommand: "${subcommand}"`);
  }

  // /ctf add <start_datetime> <title...>
  if (subcommand === "add") {
    // Slack removes quotes, so we need to handle: "add 2026-03-15T10:00 Title" or "add 2026-03-15 10:00 Title"
    if (args.length < 4) {
      return slackResponse("❌ 使用方法: `/ctf add <開始日時> <タイトル>`\n例: `/ctf add 2026-03-15T10:00 My Event` または `/ctf add 2026-03-15 10:00 My Event`");
    }

    // Try to extract datetime from args
    // args[0] = "add", args[1] = date or date, args[2] = time or title...
    let dateTimeStr: string;
    let titleStartIndex: number;

    // Check if args[1] is ISO 8601 format (contains T)
    if (args[1].includes('T')) {
      // Format: 2026-03-15T10:00
      dateTimeStr = args[1];
      titleStartIndex = 2;
    } else if (args[1].match(/^\d{4}-\d{2}-\d{2}$/) && args[2]?.match(/^\d{2}:\d{2}$/)) {
      // Format: 2026-03-15 10:00 (split into two args)
      dateTimeStr = args[1] + " " + args[2];
      titleStartIndex = 3;
    } else {
      return slackResponse(`❌ 日時形式が正しくありません: ${args[1]} ${args[2] || ""}\n形式: \`2026-03-15T10:00\` または \`2026-03-15 10:00\``);
    }

    const title = args.slice(titleStartIndex).join(" ");
    if (!title) {
      return slackResponse("❌ タイトルを指定してください");
    }

    const startDate = parseDateTime(dateTimeStr);
    if (!startDate) {
      return slackResponse(`❌ 日時をパースできません: ${dateTimeStr}\n形式: \`2026-03-15T10:00\` または \`2026-03-15 10:00\``);
    }

    const customEventId = generateCustomEventId();

    const list = await getWatchlist(env.WATCHLIST);
    list.push({
      eventId: customEventId,
      title,
      start: startDate.toISOString(),
      isCustom: true,
      reminded24h: false,
      reminded1h: false,
      addedAt: new Date().toISOString(),
    });
    await saveWatchlist(env.WATCHLIST, list);

    return slackResponse(`✅ *${title}* をウォッチリストに追加しました 🔖\n📅 ${formatDate(startDate)}\nID: \`${customEventId}\``);
  }

  // /ctf watch <event_id or url>
  if (subcommand === "watch" && args[1]) {
    const eventId = extractEventId(args[1]);
    if (!eventId) {
      return slackResponse("❌ イベントIDまたはCTFtime URLを指定してください\n例: `/ctf watch 12345` または `/ctf watch https://ctftime.org/event/12345`");
    }

    const event = await fetchEvent(eventId);
    if (!event) {
      return slackResponse(`❌ イベントID ${eventId} が見つかりません`);
    }

    const list = await getWatchlist(env.WATCHLIST);
    if (list.some((e) => e.eventId === eventId)) {
      return slackResponse(`⚠️ *${event.title}* は既に登録済みです`);
    }

    list.push({
      eventId,
      title: event.title,
      start: event.start,
      reminded24h: false,
      reminded1h: false,
      addedAt: new Date().toISOString(),
    });
    await saveWatchlist(env.WATCHLIST, list);

    return slackResponse(`✅ *${event.title}* をウォッチリストに追加しました\n📅 ${formatDate(new Date(event.start))}`);
  }

  // /ctf unwatch <event_id>
  if (subcommand === "unwatch" && args[1]) {
    const eventId = extractEventId(args[1]);
    if (!eventId) {
      // カスタムイベントIDの場合（文字列）
      const eventIdStr = args.slice(1).join("-");
      const list = await getWatchlist(env.WATCHLIST);
      const index = list.findIndex((e) => e.eventId === eventIdStr);
      if (index === -1) {
        return slackResponse(`⚠️ イベントID ${eventIdStr} はウォッチリストにありません`);
      }

      const removed = list.splice(index, 1)[0];
      await saveWatchlist(env.WATCHLIST, list);

      return slackResponse(`🗑️ *${removed.title}* をウォッチリストから削除しました`);
    }

    const list = await getWatchlist(env.WATCHLIST);
    const index = list.findIndex((e) => e.eventId === eventId);
    if (index === -1) {
      return slackResponse(`⚠️ イベントID ${eventId} はウォッチリストにありません`);
    }

    const removed = list.splice(index, 1)[0];
    await saveWatchlist(env.WATCHLIST, list);

    return slackResponse(`🗑️ *${removed.title}* をウォッチリストから削除しました`);
  }

  // /ctf list
  if (subcommand === "list" || !subcommand) {
    const list = await getWatchlist(env.WATCHLIST);
    if (list.length === 0) {
      return slackResponse("📋 ウォッチリストは空です\n`/ctf watch <event_id>` または `/ctf add <日時> <タイトル>` で追加できます");
    }

    // 開始日時でソート
    list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const lines = list.map((e, i) => {
      const start = new Date(e.start);
      const now = new Date();
      const hoursUntil = Math.floor((start.getTime() - now.getTime()) / (1000 * 60 * 60));
      const status = hoursUntil < 0 ? "🔴 終了" : hoursUntil < 24 ? "🟡 まもなく" : "🟢";
      const customBadge = e.isCustom ? " 🔖" : "";
      const details = hoursUntil > 0 ? `${hoursUntil}時間後` : "開始済み";
      return `${i + 1}. ${status} *${e.title}*${customBadge}\n   📅 ${formatDate(start)} (${details})`;
    });

    return slackResponse(`📋 *ウォッチリスト (${list.length}件)*\n\n${lines.join("\n\n")}`);
  }

  // /ctf help
  return slackResponse(
    "*CTFNotice コマンド*\n\n" +
      "`/ctf add <日時> <タイトル>` - カスタムイベントを手動登録\n" +
      "  例: `/ctf add 2026-03-15T10:00 My Event`\n\n" +
      "`/ctf watch <event_id or url>` - CTFtimeイベントをウォッチリストに追加\n" +
      "`/ctf unwatch <event_id>` - イベントをウォッチリストから削除\n" +
      "`/ctf list` - ウォッチリストを表示\n" +
      "`/ctf help` - このヘルプを表示"
  );
}

function extractEventId(input: string): number | null {
  // URLからID抽出: https://ctftime.org/event/12345
  const urlMatch = input.match(/ctftime\.org\/event\/(\d+)/);
  if (urlMatch) return parseInt(urlMatch[1], 10);

  // 数値のみ
  const num = parseInt(input, 10);
  return isNaN(num) ? null : num;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

function slackResponse(text: string): Response {
  return new Response(JSON.stringify({ response_type: "ephemeral", text }), {
    headers: { "Content-Type": "application/json" },
  });
}

// ========== リマインダー処理 (Cron) ==========

async function checkReminders(env: Env): Promise<void> {
  const list = await getWatchlist(env.WATCHLIST);
  const now = Date.now();
  const reminders: { entry: WatchEntry; type: "24h" | "1h" }[] = [];
  let updated = false;

  for (const entry of list) {
    const start = new Date(entry.start).getTime();
    const hoursUntil = (start - now) / (1000 * 60 * 60);

    // 24時間前リマインダー (23-25時間の範囲)
    if (!entry.reminded24h && hoursUntil > 0 && hoursUntil <= 25 && hoursUntil > 1) {
      reminders.push({ entry, type: "24h" });
      entry.reminded24h = true;
      updated = true;
    }

    // 1時間前リマインダー (0-2時間の範囲)
    if (!entry.reminded1h && hoursUntil > 0 && hoursUntil <= 2) {
      reminders.push({ entry, type: "1h" });
      entry.reminded1h = true;
      updated = true;
    }
  }

  // 終了したイベントを削除
  const activeList = list.filter((e) => new Date(e.start).getTime() > now - 24 * 60 * 60 * 1000);
  if (activeList.length !== list.length) {
    updated = true;
  }

  if (updated) {
    await saveWatchlist(env.WATCHLIST, activeList);
  }

  // リマインダー送信
  for (const { entry, type } of reminders) {
    const emoji = type === "24h" ? "📢" : "🚨";
    const timeText = type === "24h" ? "24時間後" : "まもなく（1時間以内）";

    let eventDetails: string;
    if (entry.isCustom) {
      eventDetails = formatCustomEventForSlack(entry);
    } else {
      const event = await fetchEvent(entry.eventId as number);
      eventDetails = event ? formatEventForSlack(event) : `📅 ${formatDate(new Date(entry.start))}`;
    }

    const text = `${emoji} *CTFリマインダー*\n\n` +
      `*${entry.title}* が${timeText}に開始します！\n\n` +
      eventDetails;

    await sendSlackMessage(env.SLACK_WEBHOOK_URL, text);
  }
}

// ========== Worker エントリーポイント ==========

export default {
  // HTTPリクエスト処理 (Slackコマンド)
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/slack") {
      return handleSlackCommand(request, env);
    }

    // ヘルスチェック
    if (url.pathname === "/health") {
      return new Response("OK");
    }

    return new Response("CTFNotice Worker", { status: 200 });
  },

  // Cronトリガー処理 (リマインダーチェック)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkReminders(env));
  },
};
