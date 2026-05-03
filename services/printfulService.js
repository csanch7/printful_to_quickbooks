import axios from "axios";
import { config } from "../config/env.js";

export async function registerPrintfulWebhook() {
  try {
    const resp = await axios.post(
      "https://api.printful.com/webhooks",
      { url: `${config.printful.webhookUrl}/${config.printful.storeId}`, types: ["order_created"] },
      {
        headers: {
          Authorization: `Bearer ${config.printful.apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Printful webhook registered:", resp.data);
  } catch (err) {
    if (err.response?.status === 409) {
      console.log("Webhook already exists");
    } else {
      console.error("Failed to register webhook:", err.response?.data || err.message);
    }
  }
}
