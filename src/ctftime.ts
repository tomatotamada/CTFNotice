export interface CTFEvent {
  id: number;
  title: string;
  url: string;
  ctftime_url: string;
  start: string;
  finish: string;
  duration: { hours: number; days: number };
  format: string;
  format_id: number;
  location: string;
  weight: number;
  onsite: boolean;
  restrictions: string;
  organizers: { id: number; name: string }[];
  logo: string;
  ctf_id: number;
}

export async function fetchUpcomingEvents(daysAhead: number): Promise<CTFEvent[]> {
  const now = Math.floor(Date.now() / 1000);
  const future = now + daysAhead * 24 * 60 * 60;

  const url = `https://ctftime.org/api/v1/events/?limit=100&start=${now}&finish=${future}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "CTFNotice Bot/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`CTFtime API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<CTFEvent[]>;
}

export function formatEventForSlack(event: CTFEvent): string {
  const startDate = new Date(event.start);
  const endDate = new Date(event.finish);
  const formatDate = (d: Date) =>
    d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tokyo",
    });

  const durationStr =
    event.duration.days > 0
      ? `${event.duration.days}日 ${event.duration.hours % 24}時間`
      : `${event.duration.hours}時間`;

  const lines = [
    `*<${event.ctftime_url}|${event.title}>*`,
    `📅 ${formatDate(startDate)} 〜 ${formatDate(endDate)}`,
    `⏱️ ${durationStr}`,
    `🏷️ ${event.format} | Weight: ${event.weight.toFixed(2)}`,
  ];

  if (event.restrictions && event.restrictions !== "Open") {
    lines.push(`🔒 ${event.restrictions}`);
  }

  if (event.organizers.length > 0) {
    lines.push(`👥 ${event.organizers.map((o) => o.name).join(", ")}`);
  }

  if (event.url) {
    lines.push(`🔗 <${event.url}|公式サイト>`);
  }

  return lines.join("\n");
}
