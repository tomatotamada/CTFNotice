/**
 * 設定管理モジュール
 * 環境変数から設定を読み込み、バリデーションを行う
 */

import dotenv from "dotenv";

// .envファイルから環境変数を読み込む
dotenv.config();

/**
 * アプリケーション設定
 * - slackWebhookUrl: Slack通知用のWebhook URL
 * - daysAhead: 何日先までのイベントを取得するか
 */
export const config = {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || "",
  daysAhead: parseInt(process.env.DAYS_AHEAD || "30", 10),
};

/**
 * 設定値のバリデーション
 * 必須の設定が正しく設定されているかチェック
 * @throws Error 設定が不正な場合
 */
export function validateConfig(): void {
  if (!config.slackWebhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL is required");
  }
  if (!config.slackWebhookUrl.startsWith("https://hooks.slack.com/")) {
    throw new Error("Invalid SLACK_WEBHOOK_URL format");
  }
}
