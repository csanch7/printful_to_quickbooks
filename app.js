/***************************************************
 * QuickBooks + Printful Integration * 
 ***************************************************/
import "dotenv/config";
import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import { MongoClient } from "mongodb";

const app = express();
app.use(bodyParser.json());

const mongoUri = process.env.MONGO_URI;
if (!mongoUri || !mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://")) {
  console.error("Missing or invalid MONGO_URI. Add it to your .env file, for example:");
  console.error("MONGO_URI=mongodb+srv://USER:PASSWORD@HOST/DATABASE?retryWrites=true&w=majority");
  process.exit(1);
}

const mongoClient = new MongoClient(mongoUri);
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

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const CLIENT_ID = requireEnv("QBO_CLIENT_ID");
const CLIENT_SECRET = requireEnv("QBO_CLIENT_SECRET");
const REDIRECT_URI = requireEnv("QBO_REDIRECT_URI");
const REALM_ID = requireEnv("QBO_REALM_ID");

// Vendor in QBO used when creating bills
const VENDOR_ID = process.env.QB_VENDOR_ID || "7";

// QuickBooks expense account IDs used on bill lines
const PRODUCT_EXPENSE_ACCOUNT_ID = process.env.QB_PRODUCT_EXPENSE_ACCOUNT_ID || process.env.QB_EXPENSE_ACCOUNT_ID || "18";
const SHIPPING_EXPENSE_ACCOUNT_ID = process.env.QB_SHIPPING_EXPENSE_ACCOUNT_ID || process.env.QB_EXPENSE_ACCOUNT_ID || "18";
const TAX_EXPENSE_ACCOUNT_ID = process.env.QB_TAX_EXPENSE_ACCOUNT_ID || process.env.QB_EXPENSE_ACCOUNT_ID || "18";
const FEE_EXPENSE_ACCOUNT_ID = process.env.QB_FEE_EXPENSE_ACCOUNT_ID || process.env.QB_EXPENSE_ACCOUNT_ID || "18";

// Printful API key & webhook URL
const PRINTFUL_API_KEY = requireEnv("PRINTFUL_API_KEY");
const WEBHOOK_URL = requireEnv("PRINTFUL_WEBHOOK_URL");


const QUICKBOOKS_BASE_URL = process.env.QBO_BASE_URL || "https://quickbooks.api.intuit.com/v3/company";


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

app.get("/", (req, res) => {
  res.send("Printful → QuickBooks integration is running.");
});

app.get("/privacy", (req, res) => {
  res.send(`
    <h1>Privacy Policy</h1>
<p><strong>Last Updated:</strong> 12/9/25</p>

<p>This Privacy Policy explains how Viking Ventures (“we”, “our”, “us”) collects, uses, and protects information processed by our Printful-to-QuickBooks integration service (“Service”).</p>

<h2>1. Information We Collect</h2>
<p>Our Service only collects and processes information necessary to sync Printful order data with your QuickBooks Online company. This may include:</p>
<ul>
  <li>Order details (items, shipping, taxes, totals)</li>
  <li>Customer names and shipping information</li>
  <li>Product information</li>
</ul>
<p>No payment information is collected or stored by our system.</p>

<h2>2. How We Use Information</h2>
<p>The information we process is used solely to:</p>
<ul>
  <li>Create or update bills in QuickBooks Online</li>
  <li>Transmit Printful order data to your accounting system</li>
</ul>

<h2>3. Data Sharing</h2>
<p>We do not sell, trade, or share your data with any third parties. Data may be transmitted only to Printful and QuickBooks Online as required for the Service to function.</p>

<h2>4. Data Storage</h2>
<p>We store only the minimum required credentials to connect to QuickBooks Online (OAuth tokens). These are encrypted and stored securely. We do not store unnecessary personal information.</p>

<h2>5. Data Security</h2>
<p>We take reasonable technical and administrative steps to protect your data from unauthorized access, disclosure, or misuse.</p>

<h2>6. User Rights</h2>
<p>You may request the deletion of all stored data associated with your account by contacting us at INFO@VIKINGVENTURESGROUP.ORG.</p>

<h2>7. Changes to This Policy</h2>
<p>We may update this Privacy Policy as needed. Continued use of our Service indicates acceptance of the updated policy.</p>

<h2>8. Contact Us</h2>
<p>For questions or concerns, contact Viking Ventures at: <br>
<strong>INFO@VIKINGVENTURESGROUP.ORG</strong></p>
  `);
});

app.get("/eula", (req, res) => {
  res.send(`
    <h1>End-User License Agreement (EULA)</h1>
<p><strong>Last Updated:</strong> 12/9/25</p>

<p>This End-User License Agreement (“Agreement”) is between you (“User”) and Viking Ventures (“Company”, “we”, “us”) and governs your use of the Printful-to-QuickBooks integration service (“Service”).</p>

<h2>1. Acceptance of Terms</h2>
<p>By using the Service, you agree to be bound by this Agreement. If you do not agree, do not use the Service.</p>

<h2>2. License</h2>
<p>We grant you a limited, non-exclusive, non-transferable license to use the Service for your internal business operations.</p>

<h2>3. User Responsibilities</h2>
<p>You are responsible for:</p>
<ul>
  <li>Ensuring the accuracy of your QuickBooks data</li>
  <li>Maintaining the security of your QuickBooks and Printful credentials</li>
  <li>Compliance with all relevant accounting, tax, and data laws</li>
</ul>

<h2>4. No Warranties</h2>
<p>The Service is provided “as is” without warranties of any kind. Viking Ventures does not guarantee error-free operation or that the Service will meet all requirements.</p>

<h2>5. Limitation of Liability</h2>
<p>To the maximum extent permitted by law, Viking Ventures is not liable for any indirect, incidental, or consequential damages, including loss of data or financial losses resulting from use of the Service.</p>

<h2>6. Termination</h2>
<p>We may terminate access to the Service at any time for misuse or violation of this Agreement. You may stop using the Service at any time.</p>

<h2>7. Updates</h2>
<p>We may modify or update this Agreement. Continued use of the Service constitutes acceptance of the updated terms.</p>

<h2>8. Contact</h2>
<p>For questions regarding this Agreement, contact us at:<br>
<strong>INFO@VIKINGVENTURESGROUP.ORG</strong></p>
  `);
});

app.get("/disconnect", (req, res) => {
  res.send("The QuickBooks connection has been disconnected.");
});

app.get("/my-ip", (req, res) => {
  res.send({ ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
});


app.get("/check-ip", async (req, res) => {
  const resp = await axios.get("https://api.ipify.org?format=json");
  res.send(resp.data);
});


app.get("/token-status", async (req, res) => {
  const tokens = await loadTokens();
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
// Create QuickBooks Bill
// ====================
async function createBillFromPrintful(order) {
  const token = await getAccessToken();
  const lineItems = [];
  const printfulOrderId = String(order.id ?? order.external_id ?? "");

  if (!order.items?.length) {
    console.log("⚠️ No items to create bill for:", order);
    return null;
  }

  if (!printfulOrderId) {
    throw new Error("Printful order is missing an id");
  }

  const addExpenseLine = (amount, description, accountId) => {
    const roundedAmount = Number(amount.toFixed(2));
    if (roundedAmount === 0) return;

    lineItems.push({
      DetailType: "AccountBasedExpenseLineDetail",
      Amount: roundedAmount,
      Description: description,
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: accountId }
      }
    });
  };

  // -------------------
  // Add each product at Printful cost
  // -------------------
  order.items.forEach(item => {
    const unitPrice = Number(item.price ?? 0);
    const quantity = Number(item.quantity ?? 1);
    const amount = unitPrice * quantity;

    addExpenseLine(amount, item.name ?? "Item", PRODUCT_EXPENSE_ACCOUNT_ID);
  });

  // -------------------
  // Shipping
  // -------------------
  const shippingAmount = Number(order.costs?.shipping ?? 0);
  addExpenseLine(shippingAmount, "Shipping", SHIPPING_EXPENSE_ACCOUNT_ID);

  // -------------------
  // Tax
  // -------------------
  const taxAmount = Number(order.costs?.tax ?? 0);
  addExpenseLine(taxAmount, "Tax", TAX_EXPENSE_ACCOUNT_ID);

  const vatAmount = Number(order.costs?.vat ?? 0);
  addExpenseLine(vatAmount, "VAT", TAX_EXPENSE_ACCOUNT_ID);

  // -------------------
  // Fees
  // -------------------
  const digitizationAmount = Number(order.costs?.digitization ?? 0);
  addExpenseLine(digitizationAmount, "Digitization", FEE_EXPENSE_ACCOUNT_ID);

  const additionalFeeAmount = Number(order.costs?.additional_fee ?? 0);
  addExpenseLine(additionalFeeAmount, "Additional Fee", FEE_EXPENSE_ACCOUNT_ID);

  const fulfillmentFeeAmount = Number(order.costs?.fulfillment_fee ?? 0);
  addExpenseLine(fulfillmentFeeAmount, "Fulfillment Fee", FEE_EXPENSE_ACCOUNT_ID);

  const retailDeliveryFeeAmount = Number(order.costs?.retail_delivery_fee ?? 0);
  addExpenseLine(retailDeliveryFeeAmount, "Retail Delivery Fee", FEE_EXPENSE_ACCOUNT_ID);

  // -------------------
  // Discount
  // -------------------
  const discountAmount = Number(order.costs?.discount ?? 0);
  addExpenseLine(-discountAmount, "Discount", PRODUCT_EXPENSE_ACCOUNT_ID);

  // -------------------
  // Build payload
  // -------------------
  const payload = {
    VendorRef: { value: VENDOR_ID },
    Line: lineItems,
    DocNumber: `PF-${printfulOrderId}`,
    PrivateNote: `Printful order ${printfulOrderId}${order.external_id ? ` / ${order.external_id}` : ""}`
  };

  const url = `${QUICKBOOKS_BASE_URL}/${REALM_ID}/bill?minorversion=65`;
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
    if (req.body.type && req.body.type !== "order_created") {
      return res.status(200).send("Event ignored");
    }

    const order =
      req.body.data?.order ||
      req.body.order ||
      req.body.data;

    if (!order) {
      return res.status(400).send("Missing order");
    }

    const items = order.items || order.line_items || [];

    console.log("**************************************************");
    console.log("*******************ORDER ITEMS********************");
    console.log(items);
    console.log("**************************************************");

    if (!items.length) {
      console.log("⚠️ No items found:", JSON.stringify(req.body, null, 2));
      return res.status(200).send("No items to process");
    }

    const bill = await createBillFromPrintful({
      ...order,
      items
    });

    console.log(bill?.skipped ? "Bill skipped:" : 
      `Bill {bill.Bill.Id} created: [{bill.Bill.PrivateNote}: {bill.Bill.TotalAmt}]`
    );
    return res.status(200).send("OK");

  } catch (err) {
    console.error("QBO Error:", JSON.stringify(err.response?.data || err.message, null, 2));
    return res.status(500).send("Failed to create bill");
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
async function start() {
  await initMongo();
  app.listen(PORT, async () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    await registerPrintfulWebhook();
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
