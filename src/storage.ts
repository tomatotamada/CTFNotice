/**
 * ストレージモジュール
 * 既に通知済みのイベントIDを管理し、重複通知を防ぐ
 * GitHub Actionsのキャッシュ機能と連携して状態を永続化
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// データ保存ディレクトリ (GitHub Actionsのキャッシュ対象)
const DATA_DIR = path.join(process.cwd(), "data");
const SEEN_EVENTS_FILE = path.join(DATA_DIR, "seen_events.json");

/**
 * 保存データの型定義
 */
interface SeenEventsData {
  eventIds: number[];  // 通知済みイベントIDの配列
  lastChecked: string; // 最終チェック日時 (ISO 8601形式)
}

/**
 * データディレクトリが存在しない場合は作成
 */
async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * 通知済みイベントIDのセットを取得
 * @returns 通知済みイベントIDのSet
 */
export async function getSeenEventIds(): Promise<Set<number>> {
  await ensureDataDir();

  // ファイルが存在しない場合は空のSetを返す (初回実行時)
  if (!existsSync(SEEN_EVENTS_FILE)) {
    return new Set();
  }

  const data = await readFile(SEEN_EVENTS_FILE, "utf-8");
  const parsed: SeenEventsData = JSON.parse(data);
  return new Set(parsed.eventIds);
}

/**
 * 通知済みイベントIDをファイルに保存
 * @param ids 保存するイベントIDのSet
 */
export async function saveSeenEventIds(ids: Set<number>): Promise<void> {
  await ensureDataDir();

  const data: SeenEventsData = {
    eventIds: Array.from(ids),
    lastChecked: new Date().toISOString(),
  };

  // 整形して保存 (デバッグしやすいように)
  await writeFile(SEEN_EVENTS_FILE, JSON.stringify(data, null, 2));
}

/**
 * 新しいイベントIDを既存のリストに追加して保存
 * @param newIds 追加するイベントIDの配列
 */
export async function addSeenEventIds(newIds: number[]): Promise<void> {
  const existing = await getSeenEventIds();

  // 新しいIDを追加
  for (const id of newIds) {
    existing.add(id);
  }

  await saveSeenEventIds(existing);
}
