/**
 * Slack通知モジュール
 * Webhook URLを使用してSlackにメッセージを送信する
 */

import { config } from "./config.js";

/**
 * Slack Block Kit のブロック型定義
 * @see https://api.slack.com/block-kit
 */
interface SlackBlock {
  type: string;                            // ブロックタイプ (header, section, divider等)
  text?: { type: string; text: string };   // テキスト内容
  elements?: { type: string; text: string }[]; // コンテキスト要素
}

/**
 * Slackメッセージの型定義
 */
interface SlackMessage {
  text: string;        // フォールバックテキスト (通知プレビュー用)
  blocks?: SlackBlock[]; // Block Kitブロック配列
}

/**
 * Slack Webhookにメッセージを送信
 * @param message 送信するメッセージ
 * @throws Error 送信に失敗した場合
 */
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

/**
 * 新しいCTFイベントをSlackに通知
 * Block Kitを使用してリッチなフォーマットで表示
 * @param events 通知するイベントの配列
 */
export async function notifyNewEvents(events: { title: string; formatted: string }[]): Promise<void> {
  // Block Kit形式でメッセージを構築
  const blocks: SlackBlock[] = [
    // ヘッダー: イベント数を表示
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚩 新しいCTFイベント (${events.length}件)`,
      },
    },
  ];

  // 各イベントをセクションブロックとして追加
  for (const event of events) {
    blocks.push({
      type: "divider", // 区切り線
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn", // Slack独自のMarkdown形式
        text: event.formatted,
      },
    });
  }

  // フッター: データソースと更新時刻
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `_Source: <https://ctftime.org|CTFtime.org> | ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}_`,
      },
    ],
  });

  // 通知を送信
  await sendSlackNotification({
    text: `新しいCTFイベントが${events.length}件見つかりました`, // 通知プレビュー用
    blocks,
  });
}
