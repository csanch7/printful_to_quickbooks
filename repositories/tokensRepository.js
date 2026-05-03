import { getTokensCollection } from "../db/mongo.js";

export async function saveTokens(data) {
  const timestamp = Date.now();
  const tokensCollection = getTokensCollection();

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

export async function loadTokens() {
  const tokensCollection = getTokensCollection();

  return await tokensCollection.findOne({ _id: "qbo-tokens" });
}
