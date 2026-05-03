import "dotenv/config";
import express from "express";
import { config } from "./config/env.js";
import { initMongo } from "./db/mongo.js";
import frontendRoutes from "./routes/frontend.js";
import printfulRoutes from "./routes/printful.js";
import quickbooksRoutes from "./routes/quickbooks.js";
import { registerPrintfulWebhook } from "./services/printfulService.js";

const app = express();

app.use(express.json());
app.use("", frontendRoutes);
app.use("", quickbooksRoutes);
app.use("", printfulRoutes);

async function start() {
  await initMongo();

  app.listen(config.port, async () => {
    console.log(`🚀 Server running at http://localhost:${config.port}`);
    await registerPrintfulWebhook();
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
