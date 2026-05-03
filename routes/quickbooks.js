import express from "express";
import { exchangeAuthorizationCode, getAuthorizationUrl } from "../services/quickbooksService.js";

const router = express.Router();

router.get("/auth", (req, res) => {
  res.redirect(getAuthorizationUrl());
});

router.get("/callback", async (req, res) => {
  const authCode = req.query.code;

  try {
    await exchangeAuthorizationCode(authCode);
    res.send("Tokens stored in MongoDB");
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("OAuth error");
  }
});

export default router;
