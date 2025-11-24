import axios from "axios";
import fs from "fs";

const REALM_ID = "9341455722544321";
const CLIENT_ID = "ABtdythQiSKdJPzvZpvig56Y44qCcdmXP4EMi3x4g82BrM8AZx";
const CLIENT_SECRET = "jL0vn8ZDwh8F3BQjjCGMUzRkKf1Czg9CPnmS8TWz";

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
