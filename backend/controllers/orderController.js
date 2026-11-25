import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const placeOrder = async (req, res) => {
  const frontend_url = "http://localhost:5174";

  try {
    const { userId, items, amount, address } = req.body;

    // Validate request body
    if (!userId || !address || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid order details. Items, userId and address are required.",
      });
    }

    // Validate items
    for (const item of items) {
      if (
        !item.name ||
        !Number.isFinite(Number(item.price)) ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.price) <= 0 ||
        Number(item.quantity) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid item details",
        });
      }
    }

    // Calculate amount on backend (never trust frontend price)
    const calculatedAmount =
      items.reduce(
        (total, item) => total + Number(item.price) * Number(item.quantity),
        0,
      ) + 2;

    // Create new order
    const newOrder = new orderModel({
      userId,
      items,
      amount: calculatedAmount,
      address,
    });

    await newOrder.save();

    // Create Stripe line items
    const line_items = items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: Number(item.quantity),
    }));

    // Add delivery charges
    line_items.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Delivery Charges",
        },
        unit_amount: 200,
      },
      quantity: 1,
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      line_items,
      mode: "payment",
      success_url: `${frontend_url}/verify?success=true&orderId=${newOrder._id}`,
      cancel_url: `${frontend_url}/verify?success=false&orderId=${newOrder._id}`,
    });

    return res.json({
      success: true,
      session_url: session.url,
    });
  } catch (error) {
    console.error("Place Order Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Error placing order",
    });
  }
};

const verifyOrder = async (req, res) => {
  const { orderId, success } = req.body;
  try {
    if (success == "true") {
      await orderModel.findByIdAndUpdate(orderId, { payment: true });
      res.json({ success: true, message: "Paid" });
    } else {
      await orderModel.findByIdAndDelete(orderId);
      res.json({ success: false, message: "Not Paid" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// user order for frontend ----
const userOrder = async (req, res) => {
  try {
    const orders = await orderModel.find({ userId: req.body.userId });
    res.json({ success: true, data: orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// Listing orders for admin panel
const ListOrders = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.json({ success: true, data: orders });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// api for updating order status---
const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    const updatedOrder = await orderModel.findOneAndUpdate(
      { _id: orderId },
      { $set: { status: status } },
      { new: true, runValidators: true },
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.json({
      success: true,
      message: "Status Updated",
      data: updatedOrder,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Error updating status",
    });
  }
};

export { placeOrder, verifyOrder, userOrder, ListOrders, updateStatus };
