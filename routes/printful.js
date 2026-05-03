import express from "express";
import { config } from "../config/env.js";
import { createBillFromPrintful } from "../services/quickbooksService.js";

const router = express.Router();

router.post("/printful-webhook/:storeId", async (req, res) => {
  try {
    if (req.params.storeId && req.params.storeId !== config.printful.storeId) {
      return res.status(404).send("Unknown store");
    }
    
    if (!req.body.type || req.body.type !== "order_created") {
      return res.status(200).send("Bad Event");
    }

    const order = req.body.data.order;
    if (!order) {
      return res.status(400).send("Missing order");
    }

    const items = order.items;

    if (!items.length) {
      console.log("No items found:", JSON.stringify(req.body, null, 2));
      return res.status(200).send("No items to process");
    }

    console.log("Incoming Order: ");
    items.forEach((item) => {
      console.log(`${item.name} x ${item.quantity}`);
    });


    const bill = await createBillFromPrintful({
      ...order,
      items
    });

    console.log(
      bill?.skipped
        ? "Bill skipped:"
        : `Bill ${bill.Bill.Id} created: [${bill.Bill.PrivateNote}: ${bill.Bill.TotalAmt}]`
    );

    return res.status(200).send("OK");
  } catch (err) {
    console.error("QBO Error:", JSON.stringify(err.response?.data || err.message, null, 2));
    return res.status(500).send("Failed to create bill");
  }
});

export default router;
