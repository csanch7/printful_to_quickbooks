import axios from "axios";
import fs from "fs";

const tokens = JSON.parse(fs.readFileSync("./tokens.json"));
const accessToken = tokens.access_token;
const REALM_ID = "9341455722544321";

async function listItems() {
  const url = `https://quickbooks.api.intuit.com/v3/company/${REALM_ID}/query?query=select * from Item`;
  const resp = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });
  console.log(JSON.stringify(resp.data.QueryResponse.Item, null, 2));
}

listItems();
