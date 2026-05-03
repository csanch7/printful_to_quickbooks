import axios from "axios";
import { config } from "../config/env.js";
import { loadTokens, saveTokens } from "../repositories/tokensRepository.js";

const {
  clientId,
  clientSecret,
  redirectUri,
  realmId,
  baseUrl,
  vendorId,
  accounts
} = config.quickbooks;

export function getAuthorizationUrl() {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state: "xyz"
  });

  return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
}

export async function exchangeAuthorizationCode(authCode) {
  const tokenResp = await axios.post(
    "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    new URLSearchParams({
      grant_type: "authorization_code",
      code: authCode,
      redirect_uri: redirectUri
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: { username: clientId, password: clientSecret }
    }
  );

  await saveTokens(tokenResp.data);
  return tokenResp.data;
}

export async function getAccessToken() {
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
        auth: { username: clientId, password: clientSecret }
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

export async function createBillFromPrintful(order) {
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

  order.items.forEach((item) => {
    const unitPrice = Number(item.price ?? 0);
    const quantity = Number(item.quantity ?? 1);
    const amount = unitPrice * quantity;

    addExpenseLine(amount, item.name ?? "Item", accounts.productExpense);
  });

  addExpenseLine(Number(order.costs?.shipping ?? 0), "Shipping", accounts.shippingExpense);
  addExpenseLine(Number(order.costs?.tax ?? 0), "Tax", accounts.taxExpense);
  addExpenseLine(Number(order.costs?.vat ?? 0), "VAT", accounts.taxExpense);
  addExpenseLine(Number(order.costs?.digitization ?? 0), "Digitization", accounts.feeExpense);
  addExpenseLine(Number(order.costs?.additional_fee ?? 0), "Additional Fee", accounts.feeExpense);
  addExpenseLine(Number(order.costs?.fulfillment_fee ?? 0), "Fulfillment Fee", accounts.feeExpense);
  addExpenseLine(Number(order.costs?.retail_delivery_fee ?? 0), "Retail Delivery Fee", accounts.feeExpense);
  addExpenseLine(-Number(order.costs?.discount ?? 0), "Discount", accounts.productExpense);

  const payload = {
    VendorRef: { value: vendorId },
    Line: lineItems,
    DocNumber: `PF-${printfulOrderId}`,
    PrivateNote: `Printful order ${printfulOrderId}${order.external_id ? ` / ${order.external_id}` : ""}`
  };

  const url = `${baseUrl}/${realmId}/bill?minorversion=65`;
  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  return response.data;
}
