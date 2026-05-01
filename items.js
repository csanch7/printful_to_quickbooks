import axios from "axios";
import "dotenv/config";
import fs from "fs";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const REALM_ID = requireEnv("QBO_REALM_ID");
const CLIENT_ID = requireEnv("QBO_CLIENT_ID");
const CLIENT_SECRET = requireEnv("QBO_CLIENT_SECRET");

const tokenFile = "./tokens.json";

// Helper: read tokens from file
function getTokens() {
  return JSON.parse(fs.readFileSync(tokenFile, "utf8"));
}

// Helper: save updated tokens to file
function saveTokens(tokens) {
  fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));
}

// Refresh access token
async function refreshAccessToken(refreshToken) {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);

  const resp = await axios.post("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", params, {
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return {
    access_token: resp.data.access_token,
    refresh_token: resp.data.refresh_token || refreshToken, // keep old if not returned
  };
}

// Query Items
async function listItems(accessToken) {
   const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${REALM_ID}/query?query=select * from Item`;
  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  return resp.data.QueryResponse.Item || [];
}

async function main() {
  try {
    let tokens = getTokens();

    // Refresh access token
    tokens = await refreshAccessToken(tokens.refresh_token);
    saveTokens(tokens);

    const items = await listItems(tokens.access_token);
    console.log("Items:", items);
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

main();
