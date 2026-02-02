import dotenv from "dotenv";

dotenv.config();

export const config = {
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || "",
  daysAhead: parseInt(process.env.DAYS_AHEAD || "30", 10),
};

export function validateConfig(): void {
  if (!config.slackWebhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL is required");
  }
  if (!config.slackWebhookUrl.startsWith("https://hooks.slack.com/")) {
    throw new Error("Invalid SLACK_WEBHOOK_URL format");
  }
}
