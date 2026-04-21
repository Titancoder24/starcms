import { crawlAllSites } from "./crawl.js";
import pino from "pino";

const logger = pino({ level: "info" });

const CRON_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function run() {
  logger.info("StarCMS worker starting");

  async function tick() {
    logger.info("Starting crawl cycle");
    try {
      await crawlAllSites();
      logger.info("Crawl cycle completed");
    } catch (err) {
      logger.error(err, "Crawl cycle failed");
    }
  }

  // Run immediately on start, then on schedule
  await tick();
  setInterval(() => { void tick(); }, CRON_INTERVAL_MS);
}

run().catch((err) => {
  pino().error(err, "Worker fatal error");
  process.exit(1);
});
