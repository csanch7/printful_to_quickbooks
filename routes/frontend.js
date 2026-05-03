import express from "express";
import axios from "axios";
import { loadTokens } from "../repositories/tokensRepository.js";

const router = express.Router();



router.get("/", (req, res) => {
  res.send("Printful → QuickBooks integration is running.");
});

router.get("/privacy", (req, res) => {
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

router.get("/eula", (req, res) => {
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

router.get("/disconnect", (req, res) => {
  res.send("The QuickBooks connection has been disconnected.");
});

router.get("/my-ip", (req, res) => {
  res.send({ ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
});


router.get("/check-ip", async (req, res) => {
  const resp = await axios.get("https://api.ipify.org?format=json");
  res.send(resp.data);
});


router.get("/token-status", async (req, res) => {
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

export default router;
