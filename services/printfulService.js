import axios from "axios";
import { config } from "../config/env.js";

export async function registerPrintfulWebhook() {
  try {
    const resp = await axios.post(
      "https://api.printful.com/webhooks",
      { url: config.printful.webhookUrl, types: ["order_created", "package_shipped"] },
      {
        headers: {
          Authorization: `Bearer ${config.printful.apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Printful webhook registered:", resp.data);
  } catch (err) {
    if (err.response?.status === 409) {
      console.log("ℹ️ Webhook already exists");
    } else {
      console.error("❌ Failed to register webhook:", err.response?.data || err.message);
    }
  }
}
