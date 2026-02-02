/**
 * CTFtime APIクライアント
 * CTFtime.orgからCTFイベント情報を取得する
 */

/**
 * CTFイベントの型定義
 * CTFtime APIのレスポンス形式に対応
 */
export interface CTFEvent {
  id: number;                              // イベントの一意ID
  title: string;                           // イベント名
  url: string;                             // 公式サイトURL
  ctftime_url: string;                     // CTFtimeのイベントページURL
  start: string;                           // 開始日時 (ISO 8601形式)
  finish: string;                          // 終了日時 (ISO 8601形式)
  duration: { hours: number; days: number }; // 開催期間
  format: string;                          // 形式 (Jeopardy, Attack-Defense等)
  format_id: number;                       // 形式ID
  location: string;                        // 開催場所
  weight: number;                          // CTFtimeでの重み付け (難易度/重要度の指標)
  onsite: boolean;                         // オンサイト開催かどうか
  restrictions: string;                    // 参加制限 (Open, Academic等)
  organizers: { id: number; name: string }[]; // 主催者情報
  logo: string;                            // ロゴ画像URL
  ctf_id: number;                          // CTFシリーズのID
}

/**
 * CTFtime APIから今後のイベントを取得
 * @param daysAhead 何日先までのイベントを取得するか
 * @returns CTFイベントの配列
 */
export async function fetchUpcomingEvents(daysAhead: number): Promise<CTFEvent[]> {
  // UNIXタイムスタンプで期間を指定
  const now = Math.floor(Date.now() / 1000);
  const future = now + daysAhead * 24 * 60 * 60;

  const url = `https://ctftime.org/api/v1/events/?limit=100&start=${now}&finish=${future}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "CTFNotice Bot/1.0", // APIアクセスにはUser-Agentが必要
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`CTFtime API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<CTFEvent[]>;
}

/**
 * CTFイベントをSlack通知用にフォーマット
 * @param event CTFイベント
 * @returns Slackのmrkdwn形式でフォーマットされた文字列
 */
export function formatEventForSlack(event: CTFEvent): string {
  const startDate = new Date(event.start);
  const endDate = new Date(event.finish);

  // 日本時間でフォーマット
  const formatDate = (d: Date) =>
    d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });

  // 開催期間を読みやすい形式に変換
  const durationStr =
    event.duration.days > 0
      ? `${event.duration.days}日 ${event.duration.hours % 24}時間`
      : `${event.duration.hours}時間`;

  // Slack mrkdwn形式で構築
  const lines = [
    `*<${event.ctftime_url}|${event.title}>*`,          // タイトル (リンク付き)
    `📅 ${formatDate(startDate)} 〜 ${formatDate(endDate)}`, // 開催日時
    `⏱️ ${durationStr}`,                                // 開催期間
    `🏷️ ${event.format} | Weight: ${event.weight.toFixed(2)}`, // 形式とWeight
  ];

  // 参加制限がある場合は表示
  if (event.restrictions && event.restrictions !== "Open") {
    lines.push(`🔒 ${event.restrictions}`);
  }

  // 主催者情報
  if (event.organizers.length > 0) {
    lines.push(`👥 ${event.organizers.map((o) => o.name).join(", ")}`);
  }

  // 公式サイトへのリンク
  if (event.url) {
    lines.push(`🔗 <${event.url}|公式サイト>`);
  }

  return lines.join("\n");
}
