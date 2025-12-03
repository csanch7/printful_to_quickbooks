/***************************************************
 * QuickBooks + Printful Integration (Sandbox)
 * ONE FILE — app.js
 ***************************************************/
import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import fs from "fs";

const app = express();
app.use(bodyParser.json());

import { MongoClient } from "mongodb";

const mongoClient = new MongoClient(process.env.MONGO_URI);
let tokensCollection;

async function initMongo() {
  await mongoClient.connect();
  const db = mongoClient.db("quickbooks"); // db name
  tokensCollection = db.collection("tokens");
  console.log("📦 MongoDB connected");
}


// ====================
// CONFIG
// ====================
const CLIENT_ID = "ABtdythQiSKdJPzvZpvig56Y44qCcdmXP4EMi3x4g82BrM8AZx";
const CLIENT_SECRET = "jL0vn8ZDwh8F3BQjjCGMUzRkKf1Czg9CPnmS8TWz";
const REDIRECT_URI = "https://printful-to-quickbooks.onrender.com/callback";
const REALM_ID = "9341455722544321";

// Single customer in QBO
const CUSTOMER_ID = "58";

// QuickBooks item IDs
const SALES_ITEM_ID = "25";
const SHIPPING_ITEM_ID = "24";
const TAX_ITEM_ID = "26";

// Printful API key & webhook URL
const PRINTFUL_API_KEY = "vIL3OCEAX5gDuThUMxjrpvZ25mc0dyl4Q92K8MCo";
const WEBHOOK_URL = "https://printful-to-quickbooks.onrender.com/printful-webhook";

// Token storage
const TOKEN_FILE = "./tokens.json";

// Base URL for QuickBooks Sandbox
const QUICKBOOKS_BASE_URL = "https://sandbox-quickbooks.api.intuit.com/v3/company";

// ====================
// Helper: Save & Load tokens
// ====================
async function saveTokens(data) {
  const timestamp = Date.now();
  await tokensCollection.updateOne(
    { _id: "qbo-tokens" },
    {
      $set: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        last_refreshed: timestamp
      }
    },
    { upsert: true }
  );
}



async function loadTokens() {
  return await tokensCollection.findOne({ _id: "qbo-tokens" });
}


app.get("/token-status", (req, res) => {
  const tokens = loadTokens();
  if (!tokens) return res.status(200).send("No tokens stored. Visit /auth to authorize your app.");

  const now = Date.now();
  const lastRefreshed = tokens.last_refreshed || now;
  const msSinceRefresh = now - lastRefreshed;
  const daysSinceRefresh = Math.floor(msSinceRefresh / (1000 * 60 * 60 * 24));

  const daysLeft = 100 - daysSinceRefresh; // refresh token expires in ~100 days

  let warning = "";
  if (daysLeft <= 10) {
    warning = "⚠️ Refresh token is expiring soon. Please reauthorize your app!";
  }

  res.status(200).send({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    last_refreshed: new Date(lastRefreshed).toISOString(),
    days_since_refresh: daysSinceRefresh,
    days_left_estimate: daysLeft,
    warning
  });
});


// ====================
// QuickBooks OAuth
// ====================
app.get("/auth", (req, res) => {
  const url = `https://appcenter.intuit.com/connect/oauth2?client_id=${CLIENT_ID}&response_type=code&scope=com.intuit.quickbooks.accounting&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=xyz`;
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  const authCode = req.query.code;
  try {
    const tokenResp = await axios.post(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: authCode,
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        auth: { username: CLIENT_ID, password: CLIENT_SECRET }
      }
    );
    await saveTokens(tokenResp.data);
    res.send("Tokens stored! Refresh token saved to tokens.json");
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("OAuth error");
  }
});

// ====================
// Automatic Access Token Refresh
// ====================
async function getAccessToken() {
  const tokens = await loadTokens();
  if (!tokens || !tokens.refresh_token) {
    throw new Error("No tokens stored — visit /auth first");
  }

  try {
    const resp = await axios.post(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        auth: { username: CLIENT_ID, password: CLIENT_SECRET }
      }
    );

    await saveTokens(resp.data);
    return resp.data.access_token;

  } catch (err) {
    if (err.response?.data?.error === "invalid_grant") {
      console.error("⚠️ Refresh token invalid — reauthorize with /auth");
      throw new Error("Manual reauthorization required");
    }
    throw err;
  }
}


// ====================
// Create QuickBooks Invoice
// ====================
async function createInvoiceFromPrintful(order) {
  const token = await getAccessToken();
  const lineItems = [];

  if (!order.items || !order.items.length) {
    console.log("⚠️ No items to create invoice for:", order);
    return null;
  }

  order.items.forEach(item => {
    const amount = parseFloat(item.retail_price ?? item.price ?? 0) || 0;
    const quantity = parseFloat(item.quantity ?? 1) || 1;

    lineItems.push({
      DetailType: "SalesItemLineDetail",
      Amount: amount * quantity,
      Description: item.name ?? "Unnamed item",
      SalesItemLineDetail: {
        ItemRef: { value: SALES_ITEM_ID },
        Qty: quantity,
        UnitPrice: amount
      }
    });
  });

  // Shipping
  const shippingAmount =
    parseFloat(order.shipping_price ?? order.shipping ?? 0) || 0;

  if (shippingAmount > 0) {
    lineItems.push({
      DetailType: "SalesItemLineDetail",
      Amount: shippingAmount,
      Description: "Shipping",
      SalesItemLineDetail: {
        ItemRef: { value: SHIPPING_ITEM_ID },
        Qty: 1,
        UnitPrice: shippingAmount
      }
    });
  }

  // Tax
  const taxAmount = parseFloat(order.tax ?? 0) || 0;

  if (taxAmount > 0) {
    lineItems.push({
      DetailType: "SalesItemLineDetail",
      Amount: taxAmount,
      Description: "Sales Tax",
      SalesItemLineDetail: {
        ItemRef: { value: TAX_ITEM_ID },
        Qty: 1,
        UnitPrice: taxAmount
      }
    });
  }

  const payload = {
    CustomerRef: { value: CUSTOMER_ID },
    Line: lineItems
  };

  const url = `${QUICKBOOKS_BASE_URL}/${REALM_ID}/invoice?minorversion=65`;

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  return response.data;
}


// ====================
// Printful Webhook
// ====================
app.post("/printful-webhook", async (req, res) => {
  try {
    const order =
      req.body.data?.order ||
      req.body.order ||
      req.body.data;

    const items = order.items || order.line_items || [];

    console.log("**************************************************");
    console.log("*******************ORDER ITEMS********************");
    console.log(items);
    console.log("**************************************************");

    if (!items.length) {
      console.log("⚠️ No items found:", JSON.stringify(req.body, null, 2));
      return res.status(200).send("No items to process");
    }

    const invoice = await createInvoiceFromPrintful({
      ...order,
      items
    });

    console.log("Invoice created:", invoice);
    return res.status(200).send("OK");

  } catch (err) {
    console.error("QBO Error:", err.response?.data || err.message);
    return res.status(500).send("Failed to create invoice");
  }
});



// ====================
// Register Printful Webhook Automatically
// ====================
async function registerPrintfulWebhook() {
  try {
    const resp = await axios.post(
      "https://api.printful.com/webhooks",
      { url: WEBHOOK_URL, types: ['order_created', 'package_shipped'] },
      { headers: { Authorization: `Bearer ${PRINTFUL_API_KEY}`, "Content-Type": "application/json" } }
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

// ====================
// Start server
// ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  await initMongo();
  await registerPrintfulWebhook();
});
