/**
 * CTFNotice Bot - メインエントリーポイント
 *
 * CTFtime.orgから新しいCTFイベントを検出し、Slackに通知する
 * GitHub Actionsで定期実行されることを想定
 */

import { config, validateConfig } from "./config.js";
import { fetchUpcomingEvents, formatEventForSlack } from "./ctftime.js";
import { notifyNewEvents } from "./slack.js";
import { getSeenEventIds, addSeenEventIds } from "./storage.js";

/**
 * 新しいCTFイベントをチェックしてSlackに通知
 *
 * 処理フロー:
 * 1. CTFtime APIから今後のイベントを取得
 * 2. 保存済みのイベントIDと比較して新規イベントを抽出
 * 3. 新規イベントがあればSlackに通知
 * 4. 通知したイベントIDを保存 (次回以降の重複通知を防ぐ)
 */
async function checkForNewEvents(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Checking for new CTF events...`);

  // CTFtime APIから今後のイベントを取得
  const events = await fetchUpcomingEvents(config.daysAhead);
  console.log(`Fetched ${events.length} upcoming events from CTFtime`);

  // 既に通知済みのイベントIDを取得
  const seenIds = await getSeenEventIds();

  // 新規イベントのみを抽出
  const newEvents = events.filter((e) => !seenIds.has(e.id));

  if (newEvents.length === 0) {
    console.log("No new events found");
    return;
  }

  console.log(`Found ${newEvents.length} new event(s)`);

  // Slack通知用にフォーマット
  const formatted = newEvents.map((e) => ({
    title: e.title,
    formatted: formatEventForSlack(e),
  }));

  // Slackに通知
  await notifyNewEvents(formatted);

  // 通知したイベントIDを保存
  await addSeenEventIds(newEvents.map((e) => e.id));

  console.log(`Notified Slack about ${newEvents.length} new event(s)`);
}

/**
 * メイン関数
 * 設定を検証してイベントチェックを実行
 */
async function main(): Promise<void> {
  console.log("CTFNotice Bot starting...");

  // 設定値のバリデーション
  validateConfig();

  // イベントチェックを実行
  await checkForNewEvents();

  console.log("Check complete.");
}

// エントリーポイント
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
