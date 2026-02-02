import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SEEN_EVENTS_FILE = path.join(DATA_DIR, "seen_events.json");

interface SeenEventsData {
  eventIds: number[];
  lastChecked: string;
}

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function getSeenEventIds(): Promise<Set<number>> {
  await ensureDataDir();

  if (!existsSync(SEEN_EVENTS_FILE)) {
    return new Set();
  }

  const data = await readFile(SEEN_EVENTS_FILE, "utf-8");
  const parsed: SeenEventsData = JSON.parse(data);
  return new Set(parsed.eventIds);
}

export async function saveSeenEventIds(ids: Set<number>): Promise<void> {
  await ensureDataDir();

  const data: SeenEventsData = {
    eventIds: Array.from(ids),
    lastChecked: new Date().toISOString(),
  };

  await writeFile(SEEN_EVENTS_FILE, JSON.stringify(data, null, 2));
}

export async function addSeenEventIds(newIds: number[]): Promise<void> {
  const existing = await getSeenEventIds();
  for (const id of newIds) {
    existing.add(id);
  }
  await saveSeenEventIds(existing);
}
