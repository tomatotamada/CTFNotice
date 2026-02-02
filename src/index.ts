import { config, validateConfig } from "./config.js";
import { fetchUpcomingEvents, formatEventForSlack } from "./ctftime.js";
import { notifyNewEvents } from "./slack.js";
import { getSeenEventIds, addSeenEventIds } from "./storage.js";

async function checkForNewEvents(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Checking for new CTF events...`);

  const events = await fetchUpcomingEvents(config.daysAhead);
  console.log(`Fetched ${events.length} upcoming events from CTFtime`);

  const seenIds = await getSeenEventIds();
  const newEvents = events.filter((e) => !seenIds.has(e.id));

  if (newEvents.length === 0) {
    console.log("No new events found");
    return;
  }

  console.log(`Found ${newEvents.length} new event(s)`);

  const formatted = newEvents.map((e) => ({
    title: e.title,
    formatted: formatEventForSlack(e),
  }));

  await notifyNewEvents(formatted);
  await addSeenEventIds(newEvents.map((e) => e.id));

  console.log(`Notified Slack about ${newEvents.length} new event(s)`);
}

async function main(): Promise<void> {
  console.log("CTFNotice Bot starting...");

  validateConfig();
  await checkForNewEvents();

  console.log("Check complete.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
