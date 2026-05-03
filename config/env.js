import "dotenv/config";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }

  return value;
}

export const config = {
  port: process.env.PORT || 3000,

  quickbooks: {
    clientId: requireEnv("QBO_CLIENT_ID"),
    clientSecret: requireEnv("QBO_CLIENT_SECRET"),
    redirectUri: requireEnv("QBO_REDIRECT_URI"),
    realmId: requireEnv("QBO_REALM_ID"),
    baseUrl: process.env.QBO_BASE_URL,
    vendorId: process.env.QB_VENDOR_ID,
    accounts: {
      productExpense: process.env.QB_EXPENSE_ACCOUNT_ID,
      shippingExpense:  process.env.QB_EXPENSE_ACCOUNT_ID,
      taxExpense: process.env.QB_EXPENSE_ACCOUNT_ID,
      feeExpense: process.env.QB_EXPENSE_ACCOUNT_ID
    }
  },

  printful: {
    apiKey: requireEnv("PRINTFUL_API_KEY"),
    webhookUrl: requireEnv("PRINTFUL_WEBHOOK_URL"),

  }
};
