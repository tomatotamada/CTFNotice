import { config } from "./config.js";

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: { type: string; text: string }[];
}

interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

export async function sendSlackNotification(message: SlackMessage): Promise<void> {
  const response = await fetch(config.slackWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack API error: ${response.status} ${text}`);
  }
}

export async function notifyNewEvents(events: { title: string; formatted: string }[]): Promise<void> {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚩 新しいCTFイベント (${events.length}件)`,
      },
    },
  ];

  for (const event of events) {
    blocks.push({
      type: "divider",
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: event.formatted,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `_Source: <https://ctftime.org|CTFtime.org> | ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}_`,
      },
    ],
  });

  await sendSlackNotification({
    text: `新しいCTFイベントが${events.length}件見つかりました`,
    blocks,
  });
}
