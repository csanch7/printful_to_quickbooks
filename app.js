/***************************************************
 * Simple QuickBooks + Printful Integration
 * ONE FILE — app.js
 ***************************************************/
import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import fs from "fs";

const app = express();
app.use(bodyParser.json());

// ====================
// CONFIG
// ====================
const CLIENT_ID = "ABtdythQiSKdJPzvZpvig56Y44qCcdmXP4EMi3x4g82BrM8AZx";
const CLIENT_SECRET = "jL0vn8ZDwh8F3BQjjCGMUzRkKf1Czg9CPnmS8TWz";
const REDIRECT_URI = "https://printful-to-quickbooks.onrender.com/callback";
const REALM_ID = "9341455722544321";

const CUSTOMER_ID = "58";

// QuickBooks item IDs
const SALES_ITEM_ID = "1";
const SHIPPING_ITEM_ID = "2";
const TAX_ITEM_ID = "3";

// Printful API key & webhook URL
const PRINTFUL_API_KEY = "vIL3OCEAX5gDuThUMxjrpvZ25mc0dyl4Q92K8MCo";
const WEBHOOK_URL = "https://printful-to-quickbooks.onrender.com/printful-webhook"; // ngrok or live URL

// Token storage
const TOKEN_FILE = "./tokens.json";

// ====================
// Helper: Save & Load tokens
// ====================
function saveTokens(data) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE));
}

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
    saveTokens(tokenResp.data);
    res.send("Tokens stored! Refresh token saved to tokens.json");
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("OAuth error");
  }
});

// ====================
// Refresh Access Token
// ====================
async function getAccessToken() {
  const tokens = loadTokens();
  if (!tokens) throw new Error("No tokens stored — visit /auth first");
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
  saveTokens(resp.data);
  return resp.data.access_token;
}

// ====================
// Create QuickBooks Invoice
// ====================
async function createInvoiceFromPrintful(order) {
  const token = await getAccessToken();
  const lineItems = [];

  order.items.forEach(item => {
    lineItems.push({
      DetailType: "SalesItemLineDetail",
      Amount: item.retail_price,
      Description: item.name,
      SalesItemLineDetail: {
        ItemRef: { value: SALES_ITEM_ID },
        Qty: item.quantity,
        UnitPrice: item.retail_price
      }
    });
  });

  if (order.shipping) {
    lineItems.push({
      DetailType: "SalesItemLineDetail",
      Amount: order.shipping,
      Description: "Shipping",
      SalesItemLineDetail: {
        ItemRef: { value: SHIPPING_ITEM_ID },
        Qty: 1,
        UnitPrice: order.shipping
      }
    });
  }

  if (order.tax !== undefined) {
    lineItems.push({
      DetailType: "SalesItemLineDetail",
      Amount: order.tax,
      Description: "Sales Tax",
      SalesItemLineDetail: {
        ItemRef: { value: TAX_ITEM_ID },
        Qty: 1,
        UnitPrice: order.tax
      }
    });
  }

  const payload = {
    CustomerRef: { value: CUSTOMER_ID },
    Line: lineItems
  };

  const url = `https://quickbooks.api.intuit.com/v3/company/${REALM_ID}/invoice?minorversion=65`;
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
    const order = req.body.data;
    const invoice = await createInvoiceFromPrintful(order);
    console.log("Invoice created:", invoice);
    res.status(200).send("OK");
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Failed to create invoice");
  }
});

// ====================
// Register Printful Webhook Automatically
// ====================
async function registerPrintfulWebhook() {
  try {
    const resp = await axios.post(
      "https://api.printful.com/webhooks",
      { url: WEBHOOK_URL, types: ["order_created"] },
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
  await registerPrintfulWebhook();
});