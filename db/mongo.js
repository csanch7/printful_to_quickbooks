import "dotenv/config";
import { MongoClient } from "mongodb";

const mongoUri = process.env.MONGO_URI;
if (!mongoUri || !mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://")) {
  console.error("Missing or invalid MONGO_URI. Add it to your .env file, for example:");
  console.error("MONGO_URI=mongodb+srv://USER:PASSWORD@HOST/DATABASE?retryWrites=true&w=majority");
  process.exit(1);
}

const mongoClient = new MongoClient(mongoUri);
let tokensCollection;

export async function initMongo() {
  await mongoClient.connect();
  const db = mongoClient.db("quickbooks");
  tokensCollection = db.collection("tokens");
  console.log("📦 MongoDB connected");
}

export function getTokensCollection() {
  if (!tokensCollection) {
    throw new Error("MongoDB is not initialized. Call initMongo() before using tokens.");
  }

  return tokensCollection;
}
