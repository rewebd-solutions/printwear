var razorpayKeyID = "";
var razorpayKeySecret = "";

const paymentMode = process.env.CASH_MODE;

if (paymentMode != "test") {
  razorpayKeyID = process.env.RZPY_LIVE_KEY_ID;
  razorpayKeySecret = process.env.RZPY_LIVE_KEY_SEC;
} else {
  razorpayKeyID = process.env.RZPY_TEST_KEY_ID;
  razorpayKeySecret = process.env.RZPY_TEST_KEY_SEC;
}

const zohoRefreshToken = process.env.ZOHO_REFRESH_TOKEN;
const zohoClientID = process.env.ZOHO_CLIENT_ID;
const zohoClientSecret = process.env.ZOHO_CLIENT_SECRET;

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const ZOHO_INVOICE_TEMPLATE_ID = "2198251000000029496";
// const ZOHO_INVOICE_TEMPLATE_ID = "650580000000000231";
const RZPY_WH_SECRET = process.env.RZPY_WH_SEC;

const validStatusEnum = [
  "pending",
  "received",
  "ready-to-ship", // -> ready to ship
  "on-hold",
  "processing",
  "shipped",
  "in-transit",
  "delivered",
  "completed",
  "shipment-cancel",
  "pickup-scheduled",
  "out-for-pickup",
  "return-init",
  "return-to-origin", // -> return to origin
  "rto-delivered", // -> rto delivered
  "cancelled",
  "undelivered",
  "invoiced",
];

/** this library was used for old data migration for finding img file size, but i dont need it now, so commented it out */
// const imageFileSize = require("url-file-size");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const algorithm = "sha256";
const authServices = require("../services/auth");

const mongoose = require("mongoose");

var ProductModel = require("../model/productModel");
var StoreModel = require("../model/storeModel");
var UserModel = require("../model/userModel");
var ImageModel = require("../model/imageModel");
var ColorModel = require("../model/colorModel");
var OrderModel = require("../model/orderModel");
var NewDesignModel = require("../model/newDesignModel");
var OrderHistoryModel = require("../model/orderHistory");
var LabelModel = require("../model/labelModel");

const otpGen = require("otp-generator");
const storageReference = require("../services/firebase");
const ZohoProductModel = require("../model/zohoProductModel");
const MockupModel = require("../model/mockupModel");
const WalletModel = require("../model/walletModel");
// const { Cashfree } = require("cashfree-payout");
const CODModel = require("../model/codDetailsModel");
const QueryModel = require("../model/queryModel");
const Razorpay = require("razorpay");
const { escapeHtml, slugify, formatDate } = require("../services/utils");
const { publishJob } = require("../services/pubsub");

const SHIPROCKET_BASE_URL = process.env.SHIPROCKET_URL;
/** I've not put CASHFREE_BASE_URL_TEST in yaml because mode should never be in test during production..
 * hence below ternary will be false in production
 */
const razorpay = new Razorpay({
  key_id: razorpayKeyID,
  key_secret: razorpayKeySecret,
});

const CASHFREE_BASE_URL =
  paymentMode == "test"
    ? process.env.CASHFREE_BASE_URL_TEST
    : process.env.CASHFREE_BASE_URL;
/** check old commit to see removed key from .env */
const ZOHO_INVOICE_ORGANIZATION_ID = "60035071106";

exports.register = async (req, res) => {
  // validate request
  if (!req.body) {
    res.status(400).send({ message: "Content can not be emtpy!" });
    return;
  }
  // new user
  let num = req.body.number;

  const existingUser = await UserModel.findOne({
    name: escapeHtml(req.body.name),
    email: escapeHtml(req.body.email),
    phone: num,
  });
  console.log("🚀 ~ exports.register= ~ existingUser:", existingUser);
  if (existingUser)
    return res.render("login", { data: { error: "Account already exists" } });

  if (req.body.register_repass !== req.body.password)
    return res.render("login", { data: { error: "Passwords don't match" } });

  try {
    await UserModel.create({
      name: escapeHtml(req.body.name),
      email: escapeHtml(req.body.email),
      password: crypto
        .createHash(algorithm)
        .update(req.body.password)
        .digest("hex"),
      phone: "+91" + escapeHtml(num),
      emailVerified: false,
      phoneVerified: false,
      profileImage: "https://cdn-icons-png.flaticon.com/512/1077/1077114.png",
    });

    res.render("login", { data: { status: "Account created, please log in" } });
  } catch (error) {
    console.log(error);
    // check for mongodb error
    if (error instanceof mongoose.mongo.MongoServerError) {
      if (error.code === 11000) {
        return res.render("login", {
          data: { warning: "Account already exists, please login!" },
        });
      }
    }
    res.render("login", {
      data: { error: "Server Error in saving data, try again" },
    });
  }
};

exports.login = async (req, res) => {
  try {
    const check = await UserModel.findOne({
      email: escapeHtml(req.body.email),
    });

    if (check === null) {
      return res.render("login", {
        data: { error: "Account does not exist. Please register!" },
      });
    }

    if (check.name === "support-admin@gmail.com") {
      if (
        crypto.createHash(algorithm).update(req.body.password).digest("hex") !==
        check.password
      ) {
        return res.render("login", {
          data: {
            error: "Invalid admin credentials",
          },
        });
      }
      const cookieToken = authServices.createToken(check._id, check.name);
      res.cookie("admtk", cookieToken, {
        httpOnly: true,
        secure: true,
      });
      return res.redirect("/admin/orders");
    }

    if (check.password === "RESET") {
      return res.redirect("/resetpassword");
    }

    // toggle a boolean if pwd match or not
    const pwdToCheckAgainst = crypto
      .createHash(algorithm)
      .update(req.body.password)
      .digest("hex");
    let doPwdsMatch = check.password === pwdToCheckAgainst;

    if (!doPwdsMatch) {
      return res.render("login", {
        data: {
          error: "Invalid email or password!",
        },
      });
    }

    const wallet = await WalletModel.findOne({ userId: check._id });
    if (!wallet) {
      console.log(wallet);
      await WalletModel.findOneAndUpdate(
        { userId: check._id },
        {
          $setOnInsert: {
            userId: check._id,
          },
          $push: {
            transactions: {
              transactionType: "recharge",
              amount: 0,
              transactionStatus: "success",
            },
          },
        },
        { new: true, upsert: true },
      );
    }

    const cookieToken = authServices.createToken(check._id, check.name);
    res.cookie("actk", cookieToken, {
      httpOnly: true,
      secure: true,
    });
    console.log(
      `User ${check.name} logged in @${new Date().toLocaleString(undefined, { timeZone: "Asia/Kolkata" })}`,
    );
    return res.redirect("/dashboard");
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .send("<h1>Internal server error couldn't log you in</h1>");
  }
};

exports.logout = async (req, res) => {
  console.log(
    `User ${req.name} logged out @${new Date().toLocaleString(undefined, {
      timeZone: "Asia/Kolkata",
    })}`,
  );
  res.clearCookie("admtk");
  return res.clearCookie("actk").redirect("/login");
};

exports.changepassword = async (req, res) => {
  try {
    if (req.body.newPwd !== req.body.confirmPwd)
      return res.status(400).json({ message: "Passwords dont match" });
    const userProfile = await UserModel.findOneAndUpdate(
      {
        _id: req.userId,
        password: crypto
          .createHash(algorithm)
          .update(req.body.currentPwd)
          .digest("hex"),
      },
      {
        $set: {
          password: crypto
            .createHash(algorithm)
            .update(req.body.newPwd)
            .digest("hex"),
        },
      },
      { new: true },
    );

    if (!userProfile)
      return res.status(400).json({ message: "Incorrect password" });
    return res.json(userProfile);
  } catch (error) {
    console.log(error);
    res.json({ error });
  }
};

exports.initiateResetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.render("resetpassword", {
        data: { error: "No account found with this email" },
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password/${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Printwear Password Reset Request for ${user.name}`,
      html: `
              <h2>Password Reset for ${user.name}</h2>
              <p>Click the link below to reset your printwear password. This link is valid for 10 minutes.</p>
              <a href="${resetUrl}">Reset Password</a>
              <p>If you did not request this, please ignore this email.</p>
              <p>Thank you,</p>
              <p>Team Printwear</p>
              <img src="https://printwear.in/images/Logo.png" alt="Printwear Logo" style="width: 100px; height: auto;" />
          `,
    });

    res.render("resetpassword", {
      data: { message: "Reset link sent to your email" },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.render("resetpassword", {
      data: { error: "Error sending reset email" },
    });
  }
};

exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("resetpassword", {
        data: { error: "Password reset link is invalid or has expired" },
      });
    }

    // Show password reset form if token is valid
    res.render("resetpassword", {
      data: {
        validToken: true,
        token: token,
      },
    });
  } catch (error) {
    console.error("Token validation error:", error);
    res.render("resetpassword", {
      data: { error: "Error validating reset token" },
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render("resetpassword", {
        data: {
          validToken: true,
          token: token,
          error: "Passwords do not match",
        },
      });
    }

    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.render("resetpassword", {
        data: { error: "Password reset link expired or invalid" },
      });
    }

    // Update password with hashed value
    user.password = crypto.createHash(algorithm).update(password).digest("hex");
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.redirect("/login?pwdreset=true");
  } catch (error) {
    console.error("Password reset error:", error);
    res.render("resetpassword", {
      data: { error: "Error resetting password" },
    });
  }
};

exports.updateinfo = async (req, res) => {
  try {
    const { type } = req.body;
    if (type == "general") {
      const { firstName, lastName, brandName } = req.body;
      const userInfo = await UserModel.findOneAndUpdate(
        { _id: req.userId },
        {
          $set: {
            firstName: escapeHtml(firstName),
            lastName: escapeHtml(lastName),
            brandName: escapeHtml(brandName),
          },
        },
        { new: true },
      );
      if (!userInfo)
        return res.status(404).json({ message: "User not found!" });
    } else if (type == "address") {
      const {
        firstName,
        lastName,
        email,
        address,
        city,
        state,
        pincode,
        phone,
        country,
      } = req.body;
      const userInfo = await UserModel.findOneAndUpdate(
        { _id: req.userId },
        {
          $set: {
            billingAddress: {
              firstName: escapeHtml(firstName),
              lastName: escapeHtml(lastName),
              email: escapeHtml(email),
              streetLandmark: escapeHtml(address),
              city: escapeHtml(city),
              state: escapeHtml(state),
              country: country || "India",
              pincode: escapeHtml(pincode),
              phone: escapeHtml(phone),
            },
          },
        },
        { new: true },
      );
      if (!userInfo)
        return res.status(404).json({ message: "User not found!" });
    } else if (type == "gst") {
      const userInfo = await UserModel.findOneAndUpdate(
        { _id: req.userId },
        { $set: { gstNo: escapeHtml(req.body.gst) } },
        { new: true },
      );
      if (!userInfo)
        return res.status(404).json({ message: "User not found!" });
    } else {
      return res.status(403).json({ message: "Invalid update type!" });
    }
    res.status(200).json({ message: "User info updated successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in saving user info" });
  }
};

// removed savebank fucntion

exports.deleteprofile = async (req, res) => {
  // first delete from userModel, then delete from all the records where the userId is there
  // first, for now just delete from userModel
  try {
    const userInfo = await UserModel.findOneAndDelete(
      {
        _id: req.userId,
        password: crypto
          .createHash(algorithm)
          .update(req.body.password)
          .digest("hex"),
      },
      { new: true },
    );
    if (!userInfo)
      return res
        .status(400)
        .json({ message: "User not found / Incorrect password" });
    console.log("deleted user: ", JSON.stringify(userInfo));
    return res.clearCookie("actk").redirect("/login");
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong!" });
  }
};

exports.profilepage = async (req, res) => {
  // write code to get req.userId and findOne and SSR the page
  const userData = await UserModel.findOne({ _id: req.userId });
  const storeData = await StoreModel.findOne({ userid: req.userId });

  const data = {
    userData: userData,
    storeData: storeData,
  };
  res.render("profile", { data: data });
};

// Dashbord page rendering
exports.dashboard = async (req, res) => {
  try {
    const [orderHistory, userData, storeData] = await Promise.all([
      OrderHistoryModel.findOne({ userId: req.userId }),
      UserModel.findOne({ _id: req.userId }),
      StoreModel.findOne({ userid: req.userId }),
    ]);

    if (!userData)
      return res.render("dashboard", {
        error: "Could not find user! Please contact +91 93454 96725",
      });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 64);

    const graphData = [];

    for (let i = 0; i < 65; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);

      const dayIndex = currentDate.getDay();
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const day = dayNames[dayIndex];
      var orders = 0;
      if (orderHistory) {
        orders = orderHistory.orderData.filter(
          (order) =>
            order.createdAt.getDate() == currentDate.getDate() &&
            order.createdAt.getMonth() == currentDate.getMonth(),
        ).length;
      }

      graphData.push({
        date: currentDate.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
        }),
        day: day,
        orders: orders,
      });
    }

    const userDataToSend = {
      name: userData.name,
      orderCount: orderHistory?.orderData?.length ?? 0,
      address: userData.billingAddress?.phone ? true : false,
      brand: userData.brandName ? true : false,
    };

    const stores = {
      shopify: storeData?.shopifyStore?.shopifyStoreURL ? true : false,
      woo: storeData?.shopifyStore?.shopifyStoreURL ? true : false,
    };

    const totalExpense = orderHistory?.orderData
      ? orderHistory?.orderData.reduce(
          (total, curr) => total + curr.totalAmount,
          0,
        )
      : 0;
    const totalRetail = orderHistory?.orderData
      ? orderHistory?.orderData.reduce(
          (total, curr) => total + (curr.retailPrice ?? 0),
          0,
        )
      : 0;
    console.log(
      "🚀 ~ exports.dashboard= ~ totalExpense:",
      req.userName,
      totalExpense,
      totalRetail,
    );

    res.render("dashboard", {
      error: false,
      data: {
        graph: graphData,
        user: userDataToSend,
        store: stores,
        stats: {
          orders: orderHistory?.orderData?.length ?? 0,
          revenue: totalRetail - totalExpense,
        },
      },
    });
  } catch (error) {
    console.log(`🚀 ~ exports.dashboard= ~ error ${userData.name}:`, error);
    res.render("dashboard", { error: "Server error in creating this page" });
  }
};

// for CRD on designgallery images
exports.uploadimage = async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname
      .replace(/ /g, "-")
      .replace(/[^a-zA-Z0-9-_.]/g, "");
    const fileReference = storageReference.child(
      `images/${req.userId + "_" + otpGen.generate(4, { specialChars: false }) + "_" + fileName}`,
    );
    await fileReference.put(fileBuffer, { contentType: "image/png" });
    const fileDownloadURL = await fileReference.getDownloadURL();

    await ImageModel.findOneAndUpdate(
      { userId: req.userId },
      {
        $setOnInsert: {
          userId: req.userId,
        },
        $push: {
          images: {
            url: fileDownloadURL,
            name: req.file.originalname,
            size: req.file.size / 1000,
            format: req.file.mimetype.split("/")[1],
          },
        },
      },
      { new: true, upsert: true },
    );

    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to upload image" });
  }
};

exports.obtainimages = async (req, res) => {
  const userId = req.userId;
  try {
    const imageData = await ImageModel.findOne({ userId: userId });
    res.status(200).json(imageData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in loading images" });
  }
};

exports.deleteimage = async (req, res) => {
  const imageId = req.body.imageId;

  try {
    const imageToDelete = await ImageModel.findOne(
      { userId: req.userId, "images._id": imageId },
      { "images.$": 1 },
    );
    console.log(imageToDelete);
    if (imageToDelete.images[0].isWooDeleted === false) {
      imageToDelete.images[0].isWooDeleted = true;
      await imageToDelete.save({ validateBeforeSave: false });
      return res.status(200).json({ message: "Deleted successfully!" });
    }
    const fileNameFromURL = imageToDelete.images[0].url
      .split("?alt")[0]
      .split("images%2F")[1];
    console.log("🚀 ~ exports.deleteimage ~ fileNameFromURL:", fileNameFromURL);
    const fileReference = storageReference.child(`images/${fileNameFromURL}`);
    await fileReference.delete();

    await ImageModel.findOneAndUpdate(
      {
        userId: req.userId,
      },
      {
        $pull: {
          images: {
            _id: imageId,
          },
        },
      },
    );
    res.status(200).json({ message: "Deleted successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in deleting image!" });
  }
};

// for adding products and getting products data
/** removed addproduct very old endpoint */

exports.getproducts = async (req, res) => {
  try {
    const productData = await ProductModel.find();
    const colorsData = {};

    for (let products of productData) {
      colorsData[products._id] = await ColorModel.find({
        productId: products._id,
      });
    }

    res.status(200).json({
      productData,
      colorsData,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("error");
  }
};

exports.getproduct = async (req, res) => {
  console.log(req.params.id);
  try {
    const productData = await ProductModel.findOne({ _id: req.params.id });
    const colorsData = await ColorModel.find({ productId: productData._id });
    res.status(200).json({
      productData,
      colorsData,
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "Product not found!" });
  }
};

// endpoint for adding design
/** old design format removed */

// deleted old commented code for old schema
// utils

const generateShiprocketToken = async () => {
  try {
    const shiprocketTokenRequest = await fetch(
      "https://apiv2.shiprocket.in/v1/external/auth/login",
      {
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          email: process.env.SHIPROCKET_EMAIL,
          password: process.env.SHIPROCKET_SECRET,
        }),
      },
    );
    const shiprocketTokenResponse = await shiprocketTokenRequest.json();
    return shiprocketTokenResponse;
  } catch (error) {
    console.log(error);
    return;
  }
};
const generateZohoToken = async () => {
  try {
    const zohoAccRequest = await fetch(
      `https://accounts.zoho.in/oauth/v2/token?refresh_token=${zohoRefreshToken}&client_id=${zohoClientID}&client_secret=${zohoClientSecret}&grant_type=refresh_token`,
      { method: "POST" },
    );
    const zohoAccResponse = await zohoAccRequest.json();

    const zohoAPIAccessToken = zohoAccResponse.access_token;
    return zohoAPIAccessToken;
  } catch (error) {
    console.log(error);
    return false;
  }
};

// endpoints for querying shopify stores
exports.getstoredetails = async (req, res) => {
  try {
    const userId = req.userId;
    const shopifyStoreDetails = await StoreModel.findOne({ userid: userId });
    if (!shopifyStoreDetails)
      return res
        .status(404)
        .json({ message: `Store data not found for ${req.userName}` });

    res.json({
      shopify: shopifyStoreDetails.shopifyStore,
      woo: shopifyStoreDetails.wooCommerceStore,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error in fetching details!" });
  }
};

exports.getshopifystock = async (req, res) => {
  try {
    const userId = req.userId;

    const shopifyStoreDetails = await StoreModel.findOne(
      { userid: userId },
      "shopifyStore",
    );
    const shopifyStoreData = shopifyStoreDetails.shopifyStore;

    var shopifyShopStockData = [];

    // remove this one by one method and use only Promise.all method
    for (let store of shopifyStoreData) {
      const SHOPIFY_ACCESS_TOKEN = store.shopifyAccessToken;
      const SHOPIFY_SHOP_URL = store.shopifyStoreURL;
      const SHOPIFY_SHOP_NAME = store.shopName;

      const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2025-07/products.json?fields=id,title,vendor,product_type,tags,variants,options`;

      try {
        const shopifyStoreStockRequest = await fetch(shopifyEndpoint, {
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          },
        });
        const shopifyStoreStockResponse = await shopifyStoreStockRequest.json();
        shopifyShopStockData.push({
          shopName: SHOPIFY_SHOP_NAME,
          products: shopifyStoreStockResponse.products
            .filter((product) => product.product_type === "tshirt")
            .map((product) => {
              return {
                id: product.id,
                name: product.title,
                tags: product.tags,
                // colors: product.options.find(option => option.name === 'Color'),
                variants: product.variants,
              };
            }),
        });
      } catch (error) {
        console.log(error);
        shopifyShopStockData.push({
          shopName: SHOPIFY_SHOP_NAME,
          error,
        });
      }
    }
    res.json(shopifyShopStockData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in fetching stock data" });
  }
};

exports.getshopifyorders = async (req, res) => {
  try {
    const userId = req.userId;
    // const userId = "64f175edd683cd124e440f23";

    const [storeDetails, designDetails, orderHistoryData] = await Promise.all([
      StoreModel.findOne({ userid: userId }),
      NewDesignModel.findOne({ userId: userId }),
      OrderHistoryModel.findOne({ userId: userId }),
    ]);

    if (!storeDetails || !storeDetails.shopifyStore.shopifyAccessToken)
      return res.status(404).json({ error: "Shopify Store not connected!" });
    if (!designDetails || designDetails?.designs?.length < 1)
      return res.status(404).json({ error: "No designs created yet!" });
    const allSKUs = designDetails.designs.map((design) => design.designSKU);

    const shopifyStoreData = storeDetails.shopifyStore;

    const SHOPIFY_ACCESS_TOKEN = shopifyStoreData.shopifyAccessToken;
    const SHOPIFY_SHOP_URL = shopifyStoreData.shopifyStoreURL;
    const SHOPIFY_SHOP_NAME = shopifyStoreData.shopName;

    const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2025-07/orders.json`;

    const shopifyStoreOrderRequest = await fetch(shopifyEndpoint, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      },
    });
    const shopifyStoreOrderResponse = await shopifyStoreOrderRequest.json();

    const dataToSend = shopifyStoreOrderResponse.orders.filter(
      (order) =>
        order.line_items.filter((item) => allSKUs.includes(item.sku)).length >
        0,
    );
    console.log("🚀 ~ exports.getshopifyorders= ~ dataToSend:", dataToSend);
    if (orderHistoryData && orderHistoryData.orderData?.length > 0) {
      const orderIDsFromHistory = orderHistoryData.orderData.map((order) => ({
        shopifyId: order.shopifyId,
        printwearOrderId: order.printwearOrderId,
        deliveryStatus: order.deliveryStatus,
      }));
      dataToSend.forEach((order, i) => {
        const isPlaced = orderIDsFromHistory.find(
          (id) => id.shopifyId == order.id,
        );
        if (isPlaced) {
          dataToSend[i].isOrderPlaced = true;
          dataToSend[i].printwearOrderId = isPlaced.printwearOrderId;
          dataToSend[i].printwearStatus = isPlaced.deliveryStatus;
        }
      });
    }

    res.json({ shopify: dataToSend });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "Server error in fetching Shopify order data" });
  }
};

exports.getwooorders = async (req, res) => {
  try {
    const userId = req.userId;
    // const userId = "64f175edd683cd124e440f23";

    const [storeDetails, designDetails, orderHistoryData] = await Promise.all([
      StoreModel.findOne({ userid: userId }),
      NewDesignModel.findOne({ userId: userId }),
      OrderHistoryModel.findOne({ userId: userId }),
    ]);
    if (!storeDetails || !storeDetails.wooCommerceStore.consumerKey)
      return res
        .status(404)
        .json({ error: "WooCommerce Store not connected!" });
    if (!designDetails || designDetails?.designs?.length < 1)
      return res.status(404).json({ error: "No designs created yet!" });
    const allSKUs = designDetails.designs.map((design) => design.designSKU);

    const wooCommerceStoreData = storeDetails.wooCommerceStore;
    if (!wooCommerceStoreData)
      return res.status(404).json({ message: "No WooCommerce store found!" });

    const WOOCOMMERCE_SHOP_URL = wooCommerceStoreData.url;
    const WOOCOMMERCE_CONSUMER_KEY = wooCommerceStoreData.consumerKey;
    const WOOCOMMERCE_CONSUMER_SECRET = wooCommerceStoreData.consumerSecret;

    try {
      const encodedAuth = btoa(
        `${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`,
      );
      const endpoint = `https://${WOOCOMMERCE_SHOP_URL}/wp-json/wc/v3/orders`;
      const wooOrderRequest = await fetch(endpoint, {
        headers: {
          Authorization: "Basic " + encodedAuth,
        },
      });
      const wooOrderResponse = await wooOrderRequest.json();

      const dataToSend = wooOrderResponse.filter(
        (order) =>
          order.line_items.filter((item) => allSKUs.includes(item.sku)).length >
          0,
      );

      if (orderHistoryData && orderHistoryData.orderData?.length > 0) {
        const orderIDsFromHistory = orderHistoryData.orderData.map((order) => ({
          wooCommerceId: order.wooCommerceId,
          printwearOrderId: order.printwearOrderId,
          deliveryStatus: order.deliveryStatus,
        }));
        dataToSend.forEach((order, i) => {
          const isPlaced = orderIDsFromHistory.find(
            (id) => id.wooCommerceId == order.id,
          );
          if (isPlaced) {
            dataToSend[i].isOrderPlaced = true;
            dataToSend[i].printwearOrderId = isPlaced.printwearOrderId;
            dataToSend[i].printwearStatus = isPlaced.deliveryStatus;
          }
        });
      }
      res.json({ woo: dataToSend });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ error: "Server error in fetching WooCommerce Orders!" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in fetching data" });
  }
};

// zoho inventory hitting
/** 2 huge funcitons for zoho removed, was used for db data creation for zohoproducts */

// endpoints for uploading design images
exports.createdesign = async (req, res) => {
  try {
    // explicitly parsing JSON here because FormData() cannot accept Objects, so from client Object was stringified
    req.body.productData = JSON.parse(req.body.productData);
    // return res.json({ message: "OK" });

    let uniqueSKU =
      req.body.productData.product.SKU +
      "-" +
      (req.body.productData.designSKU != ""
        ? req.body.productData.designSKU
        : otpGen.generate(5, {
            lowerCaseAlphabets: false,
            specialChars: false,
          }));

    const designImageHeight =
      req.body.direction === "front"
        ? req.body.productData.designDimensions.height
        : req.body.productData.backDesignDimensions.height;
    const designImageWidth =
      req.body.direction === "front"
        ? req.body.productData.designDimensions.width
        : req.body.productData.backDesignDimensions.width;

    if (req.body.designId != "null") {
      const currentDirection = req.body.direction;
      const currentDesign = await NewDesignModel.findOne({
        userId: req.userId,
        "designs._id": req.body.designId,
      });
      const currentDesignIndex = currentDesign.designs.findIndex(
        (design) => design._id + "" == req.body.designId,
      );
      if (!currentDesignIndex)
        return res.status(404).json({ message: "Design could not be found!" });
      if (
        currentDesign.designs.at(currentDesignIndex).designImage[
          currentDirection
        ] != "false"
      )
        return res.status(403).json({ message: "Design already saved!" });
      const printCharges =
        designImageHeight <= 8.0 && designImageWidth <= 8.0
          ? 70.0
          : req.body.productData.price * 1 < 70.0
            ? 70.0
            : req.body.productData.price * 1;
      // already necklabel = 0, if necklabel now, then 10
      const neckLabelCharges = currentDesign.designs.at(currentDesignIndex)
        .neckLabel
        ? 0
        : req.body.neckLabel != "null"
          ? 10
          : 0;
      currentDesign.designs.at(currentDesignIndex).neckLabel =
        req.body.neckLabel != "null" ? req.body.neckLabel : undefined;
      currentDesign.designs.at(currentDesignIndex)[
        currentDirection == "front" ? "frontPrice" : "backPrice"
      ] = parseFloat(printCharges.toFixed(2));
      currentDesign.designs.at(currentDesignIndex)[
        currentDirection == "front"
          ? "designDimensions"
          : "backDesignDimensions"
      ] = {
        ...req.body.productData[
          currentDirection == "front"
            ? "designDimensions"
            : "backDesignDimensions"
        ],
      };
      currentDesign.designs.at(currentDesignIndex).designItems.push({
        itemName: req.body.designImageName,
        URL: req.body.designImageURL,
      });
      currentDesign.designs.at(currentDesignIndex).price += parseFloat(
        (printCharges + neckLabelCharges).toFixed(2),
      );
      // call publishJob and save jobStatus as well
      const jobData = {
        userId: req.userId,
        productData: req.body.productData,
        direction: req.body.direction,
        neckLabel: currentDesign.designs.at(currentDesignIndex).neckLabel ?? req.body.neckLabel,
        designImageURL: req.body.designImageURL
      };
      const publishedJobId = await publishJob(jobData);
      currentDesign.designs.at(currentDesignIndex).designImageStatus[currentDirection].jobId = publishedJobId;
      await currentDesign.save({ validateBeforeSave: false });
      return res.status(200).json(currentDesign);
    }

    const designsDataObject = {
      productId: req.body.productData.productId,
      product: { ...req.body.productData.product },
      designSKU: uniqueSKU,
      designName: req.body.productData.designName,
      price: parseFloat(
        parseFloat(designImageWidth) == 0
          ? req.body.productData.product.price +
              0 +
              (req.body.neckLabel == "null" ? 0 : 10)
          : req.body.productData.product.price +
              (designImageHeight <= 8.0 &&
              designImageHeight &&
              designImageWidth <= 8.0
                ? 70.0
                : req.body.productData.price * 1 < 70.0
                  ? 70.0
                  : req.body.productData.price * 1) +
              (req.body.neckLabel == "null" ? 0 : 10),
      ).toFixed(2),
      [req.body.direction == "front" ? "frontPrice" : "backPrice"]: parseFloat(
        designImageWidth == 0
          ? 0
          : (designImageHeight <= 8.0 && designImageWidth <= 8.0
              ? 70.0
              : req.body.productData.price * 1 < 70.0
                ? 70.0
                : req.body.productData.price * 1
            ).toFixed(2),
      ),
      designItems: [
        {
          itemName: req.body.designImageName, // saves as "undefined", check for "undefined" in the name and then NOT render it
          URL: req.body.designImageURL,
        },
      ],
      neckLabel: req.body.neckLabel == "null" ? undefined : req.body.neckLabel,
    };

    if (req.body.direction === "front") {
      designsDataObject.designDimensions = {
        ...req.body.productData.designDimensions,
      };
    } else {
      designsDataObject.backDesignDimensions = {
        ...req.body.productData.backDesignDimensions,
      };
    }

     const jobData = {
       userId: req.userId,
       productData: req.body.productData,
       direction: req.body.direction,
       neckLabel: req.body.neckLabel,
       designImageURL: req.body.designImageURL,
     };
     const publishedJobId = await publishJob(jobData);

     designsDataObject.designImageStatus = {
      [req.body.direction]: {
        jobId: publishedJobId
      }
     }

    const designSave = await NewDesignModel.findOneAndUpdate(
      { userId: req.userId },
      {
        $push: {
          designs: designsDataObject,
        },
      },
      { upsert: true, new: true },
    );

    console.log(req.userName + " saved design");
    res.status(200).json(designSave);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in creating new design" });
  }
};

exports.deletedesign = async (req, res) => {
  try {
    const userDesigns = await NewDesignModel.findOne({
      userId: req.userId,
      "designs.designSKU": req.body.designSKU,
    });
    if (!userDesigns)
      return res
        .status(404)
        .json({ error: "Invalid design cannot be deleted" });

    const designId = userDesigns.designs.find(
      (design) => design.designSKU == req.body.designSKU,
    )._id;
    await userDesigns.updateOne(
      { $pull: { designs: { designSKU: req.body.designSKU } } },
      { new: true },
    );

    console.log("User " + req.userId + " deleted design with Id: " + designId);

    const userOrders = await OrderModel.findOne({
      userId: req.userId,
      "items.designId": new mongoose.Types.ObjectId(designId),
    });
    if (userOrders) {
      const newOrderItems = userOrders.items.filter(
        (item) => item.designId + "" != designId + "",
      );
      userOrders.items = newOrderItems;
      userOrders.totalAmount = newOrderItems
        .reduce((total, item) => total + item.price, 0)
        .toFixed(2);
      userOrders.taxes = (userOrders.totalAmount * 0.05).toFixed(2);
      console.log(
        "User " + req.userId + " orders after deleting design: " + userOrders,
      );

      await userOrders.save({ validateBeforeSave: false });
    }

    res.json({ message: "Deleted design successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Server error in deleting design!" });
  }
};

exports.getdesigns = async (req, res) => {
  try {
    const userDesigns = await NewDesignModel.findOne({ userId: req.userId });
    if (!userDesigns) return res.json({ designs: [] });
    res.json(userDesigns);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in obtaining designs" });
  }
};

// create shopify product
exports.createshopifyproduct = async (req, res) => {
  const shopifyStoreData = await StoreModel.findOne({ userid: req.userId });
  if (!shopifyStoreData)
    return res.status(400).json({ error: "Shopify store not connected" });
  const designData = (
    await NewDesignModel.findOne({ userId: req.userId })
  ).designs.find((design) => design.designSKU === req.body.designSKU);

  try {
    const SHOPIFY_ACCESS_TOKEN =
      shopifyStoreData.shopifyStore?.shopifyAccessToken;
    const SHOPIFY_SHOP_URL = shopifyStoreData.shopifyStore?.shopifyStoreURL;
    const SHOPIFY_SHOP_NAME = shopifyStoreData.shopifyStore?.shopName;

    const productData = {
      title: designData.designName,
      product_type: "tshirt",
      tags: ["printwear", "custom", "designer"],
      body_html: "<strong>" + designData.product.name + "</strong>",
      vendor: "Printwear",
      options: [
        {
          name: "Size",
          values: [designData.product.size],
        },
        {
          name: "Color",
          color: [designData.product.color],
        },
      ],
      variants: [
        {
          title: designData.product.size + " / " + designData.product.color,
          sku: designData.designSKU,
          price:
            req.body.price > designData.price
              ? req.body.price
              : designData.price.toFixed(2),
          option1: designData.product.size,
          option2: designData.product.color,
          requires_shipping: true,
        },
      ],
      images: [
        {
          src:
            designData.designImage.front == "false"
              ? designData.designImage.back
              : designData.designImage.front,
        },
      ],
    };

    const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2025-07/products.json`;
    const shopifyProductCreateRequest = await fetch(shopifyEndpoint, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        product: productData,
      }),
    });
    const shopifyProductCreateResponse =
      await shopifyProductCreateRequest.json();
    console.log(
      "🚀 ~ exports.createshopifyproduct= ~ shopifyProductCreateResponse:",
    );
    console.dir(shopifyProductCreateResponse, { depth: 4 });
    // add images if images field is null or empty in product response
    if (
      !shopifyProductCreateResponse.product.images.length ||
      !shopifyProductCreateResponse.product.image
    ) {
      const shopifyImagesEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2025-07/products/${shopifyProductCreateResponse.product.id}/images.json`;
      await fetch(shopifyImagesEndpoint, {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          image: {
            src:
              designData.designImage.front == "false"
                ? designData.designImage.back
                : designData.designImage.front,
          },
        }),
      })
        .then((res) => res.json())
        .then((res) => {
          console.log(
            "🚀 ~ shopifyProductImageResponse:",
            res,
          );
        }).catch(err => {
          console.log("Shopify product image creation error:", err);
        });
    }

    if (shopifyProductCreateRequest.ok) {
      await NewDesignModel.findOneAndUpdate(
        { userId: req.userId, "designs.designSKU": req.body.designSKU },
        { $set: { "designs.$.isAddedToShopify": true } },
      );
      res.status(200).json({ message: "Added to shopify" });
    } else {
      res
        .status(500)
        .json({ message: "Something went wrong in adding product!" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in creating shopify product" });
  }
};
//create woo commerce product
exports.createwoocommerceorder = async (req, res) => {
  const storeData = await StoreModel.findOne({ userid: req.userId });

  if (!storeData?.wooCommerceStore?.url)
    return res.status(404).json({ error: "WooCommerce store not connected!" });
  const designData = (
    await NewDesignModel.findOne({ userId: req.userId })
  ).designs.find((design) => design.designSKU === req.body.designSKU);

  const consumerKey = storeData.wooCommerceStore.consumerKey;
  const consumerSecret = storeData.wooCommerceStore.consumerSecret;
  const shopURL = storeData.wooCommerceStore.url;

  const encodedAuth = btoa(`${consumerKey}:${consumerSecret}`);
  console.log(
    designData.designImage.front == "false"
      ? designData.designImage.back
      : designData.designImage.front,
  );
  // const encodedAuthBuffer = Buffer.from(`${consumerKey}:${consumerSecret}`, 'base64');
  // const encodedAuth = encodedAuthBuffer.toString('base64')

  const endpoint = `https://${shopURL}/wp-json/wc/v3/products`;

  const productData = {
    name: designData.designName,
    slug: slugify(designData.designName),
    type: "simple",
    status: "publish",
    regular_price:
      req.body.price > designData.price
        ? req.body.price + ""
        : designData.price + "",
    sale_price:
      req.body.price > designData.price
        ? req.body.price + ""
        : designData.price + "",
    sku: req.body.designSKU,
    description: designData.description || "User generated design",
    short_description: designData.product.name,
    dimensions: {
      length: designData.product.dimensions.length + "",
      width: designData.product.dimensions.chest + "",
    },
    images: [
      {
        src:
          designData.designImage.front == "false"
            ? designData.designImage.back
            : designData.designImage.front,
        name: designData.designName + " image",
      },
    ],
    attributes: [
      {
        id: 6,
        name: "Color",
        position: 0,
        visible: true,
        variation: true,
        options: [designData.product.color],
      },
      {
        id: 1,
        name: "Size",
        position: 0,
        visible: true,
        variation: true,
        options: [designData.product.size],
      },
    ],
  };

  try {
    const createWooProductRequest = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encodedAuth}`,
      },
      body: JSON.stringify(productData),
    });
    const createWooProductResponse = await createWooProductRequest.json();

    await NewDesignModel.findOneAndUpdate(
      { userId: req.userId, "designs.designSKU": req.body.designSKU },
      { $set: { "designs.$.isAddedToWoocommerce": true } },
    );
    if (
      createWooProductResponse.data?.status &&
      createWooProductResponse.data.status != 200
    ) {
      res
        .status(createWooProductResponse.data.status)
        .json({ message: createWooProductResponse.message });
      return console.log("Uploaded failed");
    }
    if (createWooProductRequest.ok)
      return res.json({
        message:
          "Created successfully. WooCommerce ID: " +
          createWooProductResponse.id,
      });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Server error in creating woocommerce order!" });
  }
};

// temp for creating zoho products, disable in prod
/** cleared temp endpoint for dev */

// actual endpoint to fetch zoho products from mongoDB
exports.getZohoProducts = async (req, res) => {
  try {
    const zohoProductsData = await ZohoProductModel.find({});
    const zohoProductObjects = {};
    zohoProductsData.forEach(
      (product) => (zohoProductObjects[product.style] = product),
    );
    res.json(zohoProductObjects);
  } catch (error) {
    console.log(error);
    res.json({ error: "Server error in fetching products" });
  }
};

// endpoint for creating a mockup -- test only
exports.addmockup = async (req, res) => {
  try {
    // const productsData = await ZohoProductModel.find({});
    // const sample data = {
    //       "name": "Women's Half Sleeve",
    //       "description": "Women's Half Sleeve T-Shirt ready to print",
    //       "product": "6520cee2094cfa85e4fcbd19",
    //       "image": "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/mockups%2Fwomen-tees-mockup.png?alt=media&token=782ccdca-1ca3-437d-a71e-ca1fbb323fb1"
    // }
    const { name, description, product, image, canvas } = req.body;
    const mockupsData = await MockupModel.create({
      name,
      description,
      product,
      image,
      canvas,
    });
    res.json(mockupsData);
  } catch (error) {
    res.status(500).json({ error });
  }
};

exports.getmockups = async (req, res) => {
  try {
    const mockupsData = await MockupModel.find({});
    const productData = await ZohoProductModel.find({});

    mockupsData.forEach((mockup) => {
      mockup.product = productData.find(
        (product) => product._id + "" === mockup.product + "",
      );
    });
    res.status(200).json(mockupsData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
};

// endpoints for creating order
exports.createorder = async (req, res) => {
  try {
    let orderData = await OrderModel.findOne({ userId: req.userId });
    const design = await NewDesignModel.findOne(
      { userId: req.userId, "designs._id": req.body.designId },
      { "designs.$": 1 },
    );

    if (!design) return res.status(404).json({ error: "Invalid design ID" });

    const currDesign = design.designs[0];

    if (!orderData) {
      const newOrder = new OrderModel({
        userId: req.userId,
        items: [
          {
            designId: currDesign._id,
            productId: currDesign.productId,
            price: currDesign.price,
          },
        ],
        totalAmount: currDesign.price,
        taxes: (currDesign.price * 0.05).toFixed(2),
        printwearOrderId: otpGen.generate(16, {
          digits: true,
          specialChars: false,
        }),
      });
      await newOrder.save();
      return res.json(newOrder);
    }

    if (
      orderData.items.find((item) => String(item.designId) == req.body.designId)
    )
      return res.status(400).json({ message: "Item already in cart" });

    orderData.items.push({
      designId: currDesign._id,
      productId: currDesign.productId,
      price: currDesign.price,
    });
    let totalCost = orderData.items
      .reduce((total, item) => total + item.price, 0)
      .toFixed(2);
    orderData.totalAmount = totalCost;
    orderData.printwearOrderId = otpGen.generate(16, {
      digits: true,
      specialChars: false,
    });
    orderData.taxes = (totalCost * 0.05).toFixed(2);
    await orderData.save();
    res.json(orderData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in creating order" });
  }
};

exports.getorders = async (req, res) => {
  try {
    const orderData = await OrderModel.findOne({ userId: req.userId });

    if (!orderData) return res.status(404).json({ message: "No orders yet!" });
    const designsFromOrders = orderData.items.map((item) => item.designId);

    const designsData = await NewDesignModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId), // Match the specific document by userId
        },
      },
      {
        $project: {
          designs: {
            $filter: {
              input: "$designs",
              as: "design",
              cond: {
                $in: [
                  "$$design._id",
                  designsFromOrders.map(
                    (id) => new mongoose.Types.ObjectId(id),
                  ),
                ],
              },
            },
          },
        },
      },
    ]);

    res.json({ orderData, designsData });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching order data" });
  }
};

exports.deleteorderitem = async (req, res) => {
  try {
    const orderData = await OrderModel.findOne({ userId: req.userId });
    if (!orderData)
      return res.status(404).json({ message: "Couldn't find item" });

    orderData.items = orderData.items.filter(
      (item) => item.designId + "" != req.body.designId,
    );
    orderData.totalAmount = orderData.items
      .reduce((total, item) => total + item.price, 0)
      .toFixed(2);
    orderData.taxes = (orderData.totalAmount * 0.05).toFixed(2);

    if (orderData.items.length == 0) {
      await orderData.deleteOne();
    } else {
      await orderData.save();
    }

    res.json(orderData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in deleting order item" });
  }
};

exports.updateorder = async (req, res) => {
  try {
    // const orderData = await OrderModel.findOneAndUpdate({ userId: req.userId, 'items.designId': req.body.designId }, {
    //   $set: {
    //     'items.$.quantity': req.body.quantity,
    //     'items.$.price': req.body.price,
    //     totalAmount: {
    //       $sum: '$items.price'
    //     }
    //   }
    // }, { new: true });

    const orderData = await OrderModel.findOne({
      userId: req.userId,
      "items.designId": req.body.designId,
    });
    if (!orderData)
      return res.status(400).json({ error: "Coulnd't find order" });

    const currentItem = orderData.items.findIndex(
      (item) => String(item.designId) == req.body.designId,
    );

    if (currentItem === -1)
      return res.status(400).json({ error: "Coulnd't find item" });

    const qty = parseInt(req.body.quantity);
    const price = parseFloat(req.body.price);

    if (isNaN(qty) || isNaN(price)) {
      throw new Error("Quantity is invalid!");
    }

    orderData.items[currentItem].quantity = qty;
    orderData.items[currentItem].price = (price * qty).toFixed(2);

    orderData.totalAmount = orderData.items
      .reduce((total, item) => total + item.price, 0)
      .toFixed(2);
    orderData.taxes = (orderData.totalAmount * 0.05).toFixed(2);

    await orderData.save();

    res.json({ totalPrice: orderData.totalAmount });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in updating order" });
  }
};

// endpoints for connecting stores
const SHOPIFY_ACCESS_SCOPES = [
  "read_orders",
  "read_products",
  "write_products",
  "write_product_listings",
  "read_product_listings",
  "read_all_orders",
];
exports.connectShopify = async (req, res) => {
  const reqBody = req.body;

  const SHOPIFY_ACCESS_TOKEN = reqBody.access_token;
  const SHOPIFY_SHOP_URL = reqBody.store_url;
  const SHOPIFY_SHOP_NAME = escapeHtml(reqBody.store_name);

  const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/oauth/access_scopes.json`;

  try {
    const fetchReq = await fetch(shopifyEndpoint, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      },
    });
    const fetchData = await fetchReq.json();

    if (fetchReq.status != 200)
      return res.status(fetchReq.status).json({ error: fetchData.errors });
    // if (fetchReq.status.toString().startsWith('5')) return res.status(fetchReq.status).json({ error: "Shopify Server Error" });
    const customerShopifyStoreAccessScopes = fetchData.access_scopes.map(
      (scope) => scope.handle,
    );
    const isAccessSatified = SHOPIFY_ACCESS_SCOPES.every((scope) =>
      customerShopifyStoreAccessScopes.includes(scope),
    );
    if (!isAccessSatified)
      return res
        .status(400)
        .json({ error: "Provided credentials doesn't have access scopes" });

    const store = await StoreModel.findOneAndUpdate(
      { userid: req.userId },
      {
        $set: {
          userid: req.userId,
          shopifyStore: {
            shopName: SHOPIFY_SHOP_NAME,
            shopifyAccessToken: SHOPIFY_ACCESS_TOKEN,
            shopifyStoreURL: SHOPIFY_SHOP_URL,
          },
        },
      },
      { new: true, upsert: true },
    );

    res.status(200).json({ message: "Added Shopify store successfully!" }); // idhu redirect pannidu
    // return;
  } catch (error) {
    console.log("Error in Shopify connect " + error);
    res.status(500).json({ error: "Unable to connect Shopify store" });
    return;
  }
};
// render individual shoporder page
exports.shopifystoreorderedit = async (req, res) => {
  try {
    const shopOrderId = req.params.id;
    const [storeData, designsData, orderHistory] = await Promise.all([
      StoreModel.findOne({ userid: req.userId }),
      NewDesignModel.findOne({ userId: req.userId }),
      OrderHistoryModel.findOne({
        userId: req.userId,
        orderData: { $elemMatch: { shopifyId: shopOrderId } },
      }),
      // OrderModel.findOne({
      //   userId: req.userId,
      //   shopifyId: shopOrderId
      // })
    ]);
    if (!storeData)
      return res.render("storeorderedit", {
        error: "Could not find store credentials",
      });

    if (orderHistory) {
      return res.render("storeorderedit", {
        error: "Order has already been placed!",
      });
    }

    // let shopifyOrderResponse = {};

    const SHOPIFY_SHOP_URL = storeData.shopifyStore.shopifyStoreURL;
    const SHOPIFY_ACCESS_TOKEN = storeData.shopifyStore.shopifyAccessToken;

    const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2025-07/orders/${shopOrderId}.json`;

    const shopifyOrderRequest = await fetch(shopifyEndpoint, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
      },
    });
    const shopifyOrderResponse = await shopifyOrderRequest.json();

    if (shopifyOrderResponse.errors)
      return res.render("storeorderedit", {
        error: shopifyOrderResponse.errors,
      });

    // if (orderData) {
    //   shopifyOrderResponse.order.line_items = orderData.items.map(item => {
    //     const currentDesign = designsData.designs.find(design => design._id + '' == item.designId + '');
    //     // const currentShopifyItem = shopifyOrderResponse.order.line_items.find(item => item.sku == currentDesign.designSKU);
    //     return {
    //       sku: currentDesign.designSKU,
    //       quantity: item.quantity,
    //     }
    //   })
    // }

    const SKUs = shopifyOrderResponse.order.line_items.map((item) => item.sku);

    // deleted designs prechana pannudhu -- fixed it by checking on frontend
    const designData = designsData.designs.filter((design) =>
      SKUs.includes(design.designSKU),
    );

    res.render("storeorderedit", {
      error: false,
      shopifyData: { order: shopifyOrderResponse.order, designs: designData },
    });
  } catch (error) {
    console.log("🚀 ~ exports.storeorderedit= ~ error:", error);
    return res.render("storeorderedit", {
      error: "Server error in fetching store details!",
    });
  }
};

exports.connectWooCommerce = async (req, res) => {
  const reqBody = req.body;
  console.log(reqBody);
  const WOOCOMMERCE_CONSUMER_KEY = reqBody.consumer_key;
  const WOOCOMMERCE_CONSUMER_SECRET = reqBody.consumer_secret;
  const WOOCOMMERCE_SHOP_URL = reqBody.store_url;
  const WOOCOMMERCE_SHOP_NAME = reqBody.store_name;

  try {
    const encodedAuth = btoa(
      `${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`,
    );
    const endpoint = `https://${WOOCOMMERCE_SHOP_URL}/wp-json/wc/v3/orders`;
    const wooOrderRequest = await fetch(endpoint, {
      headers: {
        Authorization: "Basic " + encodedAuth,
      },
    });

    const wooOrderReponse = await wooOrderRequest.text();

    if (!wooOrderRequest.ok)
      return res
        .status(403)
        .json({ error: "Unable to connect to WooCommerce Store!" });

    const store = await StoreModel.findOneAndUpdate(
      { userid: req.userId },
      {
        $set: {
          // _id:
          userid: req.userId,
          wooCommerceStore: {
            shopName: WOOCOMMERCE_SHOP_NAME,
            url: WOOCOMMERCE_SHOP_URL,
            consumerKey: WOOCOMMERCE_CONSUMER_KEY,
            consumerSecret: WOOCOMMERCE_CONSUMER_SECRET,
          },
        },
      },
      { new: true, upsert: true },
    );
    // await store.save();

    res.status(200).json({ message: "Added WooCommerce store successfully!" });
    return;
  } catch (error) {
    console.log("Error in woocommerce connect " + error);
    res.status(500).json({
      error: "Server error in connecting WooCommerce Store!",
    });
    return;
  }
};

// render woocomms store order edit page
exports.woostoreorderedit = async (req, res) => {
  try {
    const shopOrderId = req.params.id;
    const [storeData, designsData] = await Promise.all([
      StoreModel.findOne({ userid: req.userId }),
      NewDesignModel.findOne({ userId: req.userId }),
    ]);
    if (!storeData)
      return res.render("storeorderedit", {
        error: "Could not find store credentials",
      });

    const WOOCOMMERCE_SHOP_URL = storeData.wooCommerceStore.url;
    const WOOCOMMERCE_CONSUMER_KEY = storeData.wooCommerceStore.consumerKey;
    const WOOCOMMERCE_CONSUMER_SECRET =
      storeData.wooCommerceStore.consumerSecret;

    const encodedAuth = btoa(
      `${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`,
    );
    const endpoint = `https://${WOOCOMMERCE_SHOP_URL}/wp-json/wc/v3/orders/${shopOrderId}`;
    const wooCommerceOrderReq = await fetch(endpoint, {
      headers: {
        Authorization: "Basic " + encodedAuth,
      },
    });
    const wooCommerceOrderRes = await wooCommerceOrderReq.json();

    if (!wooCommerceOrderReq.ok)
      return res.render("storeorderedit", {
        error: "There was an error trying to fetch WooCommerce order data",
      });
    const SKUs = wooCommerceOrderRes.line_items.map((item) => item.sku);

    const designData = designsData.designs.filter((design) =>
      SKUs.includes(design.designSKU),
    );

    res.render("storeorderedit", {
      error: false,
      shopifyData: null,
      wooData: { order: wooCommerceOrderRes, designs: designData },
    });
  } catch (error) {
    console.log("🚀 ~ exports.storeorderedit= ~ error:", error);
    return res.render("storeorderedit", {
      error: "Server error in fetching store details!",
    });
  }
};

// endpoint for creating order from shopify & woo
exports.createordershopify = async (req, res) => {
  const { shopifyId, items: unfilteredItems } = req.body;
  const items = unfilteredItems.filter((item) => item);
  try {
    let totalAmount = items
      .reduce((total, item) => total + item.price * item.quantity, 0)
      .toFixed(2);
    const orderData = await OrderModel.findOneAndUpdate(
      { userId: req.userId },
      {
        $set: {
          items: items.map((item) => ({
            ...item,
            price: (item.price * item.quantity).toFixed(2),
          })),
          shopifyId: shopifyId,
          totalAmount,
          taxes: (totalAmount * 0.05).toFixed(2),
          printwearOrderId: otpGen.generate(16, {
            digits: true,
            specialChars: false,
          }),
        },
        $unset: {
          wooCommerceId: 1,
        },
      },
      { new: true, upsert: true },
    );
    if (!orderData)
      return res
        .status(402)
        .json({ error: "Order could not be created! Please contact help" });
    return res.json({ message: "Created order successfully!" });
  } catch (error) {
    console.log("🚀 ~ exports.createordershopify= ~ error:", error);
    res
      .status(500)
      .json({ error: "Server error in transferring Shopify order" });
  }
};

exports.createorderwoo = async (req, res) => {
  const { wooId, items } = req.body;
  try {
    let totalAmount = items
      .reduce((total, item) => total + item.price * item.quantity, 0)
      .toFixed(2);
    const orderData = await OrderModel.findOneAndUpdate(
      { userId: req.userId },
      {
        $set: {
          items: items.map((item) => ({
            ...item,
            price: (item.price * item.quantity).toFixed(2),
          })),
          wooCommerceId: wooId,
          totalAmount,
          taxes: (totalAmount * 0.05).toFixed(2),
          printwearOrderId: otpGen.generate(16, {
            digits: true,
            specialChars: false,
          }),
        },
        $unset: {
          shopifyId: 1,
        },
      },
      { new: true, upsert: true },
    );
    return res.json({ message: "Created order successfully!" });
  } catch (error) {
    console.log("🚀 ~ exports.createorderwoo= ~ error:", error);
    res
      .status(500)
      .json({ error: "Server error in transferring WooCommerce order" });
  }
};
// render pay page for order via shopify
exports.payshoporder = async (req, res) => {
  try {
    const shopType = req.path.split("/")[2];

    if (!["shopify", "woo"].includes(shopType))
      return res.render("storeorderpay", { error: "Invalid URL!" });

    const orderId = req.params.id;

    if (shopType == "shopify") {
      const [orderData, userData] = await Promise.all([
        await OrderModel.findOne({ userId: req.userId, shopifyId: orderId }),
        await UserModel.findById(req.userId),
      ]);
      if (!orderData)
        return res.render("storeorderpay", {
          error: "Could not find such order!",
        });
      if (orderData.paymentStatus == "success")
        return res.render("storeorderpay", {
          error: "This order has already been paid for!",
        });

      const storeData = await StoreModel.findOne({ userid: req.userId });
      if (!storeData)
        return res.render("storeorderpay", {
          error: "Could not find store credentials!",
        });

      const SHOPIFY_SHOP_URL = storeData.shopifyStore.shopifyStoreURL;
      const SHOPIFY_ACCESS_TOKEN = storeData.shopifyStore.shopifyAccessToken;

      const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2025-07/orders/${orderId}.json`;

      const shopifyOrderRequest = await fetch(shopifyEndpoint, {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
      });
      const { order: shopifyOrderResponse } = await shopifyOrderRequest.json();

      // const shopifyOrderResponse = /// --> SIMPLY FOR TESTING, if needed, copy from test_assets/shopifyorderreference.json
      if (shopifyOrderResponse.errors)
        return res.render("storeorderedit", {
          error: shopifyOrderResponse.errors,
        });

      const payOrderPageData = {
        id: orderId,
        orderName: shopifyOrderResponse.name,
        firstName: shopifyOrderResponse.shipping_address?.first_name ?? "",
        lastName: shopifyOrderResponse.shipping_address?.last_name ?? "",
        email: shopifyOrderResponse.shipping_address?.email ?? "",
        streetLandmark: shopifyOrderResponse.shipping_address?.address1 ?? "",
        city: shopifyOrderResponse.shipping_address?.city ?? "",
        mobile: shopifyOrderResponse.shipping_address?.phone ?? "",
        state: shopifyOrderResponse.shipping_address?.province ?? "",
        country: shopifyOrderResponse.shipping_address?.country ?? "",
        pincode: shopifyOrderResponse.shipping_address?.zip ?? "",
        total: orderData.totalAmount,
        retail: shopifyOrderResponse.total_line_items_price,
        itemCount: orderData.items.length ?? 0,
        shopType: "Shopify",
        shopSlug: "shopify",
        billingAddress: userData.billingAddress,
      };

      return res.render("storeorderpay", {
        error: false,
        data: payOrderPageData,
      });
    } else {
      const [orderData, storeData, userData] = await Promise.all([
        OrderModel.findOne({ userId: req.userId, wooCommerceId: orderId }),
        StoreModel.findOne({ userid: req.userId }),
        UserModel.findById(req.userId),
      ]);

      if (!orderData)
        return res.render("storeorderpay", {
          error: "Could not find such order!",
        });
      if (orderData.paymentStatus == "success")
        return res.render("storeorderpay", {
          error: "This order has already been paid for!",
        });

      if (!storeData)
        return res.render("storeorderpay", {
          error: "Could not find store credentials!",
        });
      const WOOCOMMERCE_SHOP_URL = storeData.wooCommerceStore.url;
      const WOOCOMMERCE_CONSUMER_KEY = storeData.wooCommerceStore.consumerKey;
      const WOOCOMMERCE_CONSUMER_SECRET =
        storeData.wooCommerceStore.consumerSecret;

      const encodedAuth = btoa(
        `${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`,
      );
      const endpoint = `https://${WOOCOMMERCE_SHOP_URL}/wp-json/wc/v3/orders/${orderId}`;
      const wooCommerceOrderReq = await fetch(endpoint, {
        headers: {
          Authorization: "Basic " + encodedAuth,
        },
      });
      const wooCommerceOrderRes = await wooCommerceOrderReq.json();

      if (!wooCommerceOrderReq.ok)
        return res.render("storeorderpay", {
          error: "There was an error trying to fetch WooCommerce order data",
        });

      const payOrderPageData = {
        id: orderId,
        orderName: wooCommerceOrderRes.id,
        firstName:
          wooCommerceOrderRes.shipping?.first_name ??
          wooCommerceOrderRes.billing?.first_name ??
          "",
        lastName:
          wooCommerceOrderRes.shipping?.last_name ??
          wooCommerceOrderRes.billing?.last_name ??
          "",
        email:
          wooCommerceOrderRes.shipping?.email ??
          wooCommerceOrderRes.billing?.email ??
          "",
        streetLandmark: wooCommerceOrderRes.shipping?.address_1
          ? wooCommerceOrderRes.shipping?.address_1 +
            " " +
            wooCommerceOrderRes.shipping?.address_2
          : wooCommerceOrderRes.billing?.address_1
            ? wooCommerceOrderRes.billing?.address_1 +
              " " +
              wooCommerceOrderRes.billing?.address_2
            : "",
        city:
          wooCommerceOrderRes.shipping?.city ??
          wooCommerceOrderRes.billing?.city ??
          "",
        phone:
          wooCommerceOrderRes.shipping?.phone ??
          wooCommerceOrderRes.billing?.phone ??
          "",
        state:
          wooCommerceOrderRes.shipping?.state ??
          wooCommerceOrderRes.billing?.state ??
          "",
        country:
          wooCommerceOrderRes.shipping?.country ??
          wooCommerceOrderRes.billing?.country ??
          "",
        pincode:
          wooCommerceOrderRes.shipping?.postcode ??
          wooCommerceOrderRes.billing?.postcode ??
          "",
        total: orderData.totalAmount,
        retail: wooCommerceOrderRes.total,
        itemCount: orderData.items.length ?? 0,
        shopType: "WooCommerce",
        shopSlug: "woo",
        billingAddress: userData.billingAddress,
      };

      return res.render("storeorderpay", {
        error: false,
        data: payOrderPageData,
      });
    }
  } catch (error) {
    console.log("🚀 ~ exports.payshoporder= ~ error:", error);
    res.render("storeorderpay", {
      error: "Server error in creating payment page for your order!",
    });
  }
};

// RENDER pages:
// render billing page
exports.billing = async (req, res) => {
  try {
    const [orderData, userData] = await Promise.all([
      await OrderModel.findOne({ userId: req.userId }),
      await UserModel.findById(req.userId),
    ]);
    if (!orderData) return res.render("billing", { orderData: { items: [] } });
    const designsFromOrders = orderData.items.map((item) => item.designId);

    const designsData = await NewDesignModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId), // Match the specific document by userId
        },
      },
      {
        $project: {
          designs: {
            $filter: {
              input: "$designs",
              as: "design",
              cond: {
                $in: [
                  "$$design._id",
                  designsFromOrders.map(
                    (id) => new mongoose.Types.ObjectId(id),
                  ),
                ],
              },
            },
          },
        },
      },
    ]);
    res.render("billing", {
      orderData,
      designsData: designsData[0].designs,
      billing: userData.billingAddress,
    });
  } catch (error) {
    console.log(error);
    res.send(
      "<h1>Something went wrong :( Contact Help</h1><a href='/contact'>Help</a>",
    );
  }
};
// render reship page
exports.reship = async (req, res) => {
  try {
    const pwOrderId = req.params.id;
    console.log("Reship request for order id:", pwOrderId);
    const [orderData, userData] = await Promise.all([
      await OrderHistoryModel.findOne(
        {
          userId: req.userId,
          orderData: { $elemMatch: { printwearOrderId: pwOrderId } },
        },
        { "orderData.$": 1 },
      ),
      await UserModel.findById(req.userId),
    ]);

    if (
      !orderData ||
      !["rto-delivered", "cancelled"].includes(
        orderData.orderData[0].deliveryStatus,
      )
    )
      return res.render("billing", { orderData: { items: [] } });

    const designsFromOrders = orderData.orderData[0].items.map(
      (item) => item.designId,
    );

    const designsData = await NewDesignModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId), // Match the specific document by userId
        },
      },
      {
        $project: {
          designs: {
            $filter: {
              input: "$designs",
              as: "design",
              cond: {
                $in: [
                  "$$design._id",
                  designsFromOrders.map(
                    (id) => new mongoose.Types.ObjectId(id),
                  ),
                ],
              },
            },
          },
        },
      },
    ]);
    res.render("billing", {
      orderData: orderData.orderData[0],
      designsData: designsData[0].designs,
      billing: orderData.orderData[0].billingAddress ?? userData.billingAddress,
    });
  } catch (error) {
    console.log(error);
    res.send(
      "<h1>Something went wrong :( Contact Help</h1><a href='/contact'>Help</a>",
    );
  }
};
// render order details page
exports.orderpage = async (req, res) => {
  try {
    const orderId = req.params.id;

    // query db with specific order id
    const [orderDetails, designDetails, labelData] = await Promise.all([
      await OrderHistoryModel.findOne(
        {
          userId: req.userId,
          orderData: { $elemMatch: { printwearOrderId: orderId } },
        },
        { "orderData.$": 1 },
      ),
      await NewDesignModel.findOne({ userId: req.userId }),
      await LabelModel.findOne({ userId: req.userId }),
    ]);
    // check if null, if so return a page with not found error
    if (!orderDetails || !designDetails)
      return res.render("orderpage", { orderData: null }); // go to that page and check if null and shout
    // obtain design data with ids from orderhistory
    const designIds = orderDetails.orderData[0].items.map(
      (order) => order.designId + "",
    );
    let designs = designDetails.designs.filter((design) =>
      designIds.includes(design._id + ""),
    );
    res.render("orderpage", {
      orderData: orderDetails,
      designData: designs,
      labelData,
    });
  } catch (error) {
    console.log(error);
    res.render("orderpage", { orderData: null });
  }
};
// render wallet recharge page
exports.recharge = async (req, res) => {
  try {
    const wallet = await WalletModel.findOne({ userId: req.userId });
    if (!wallet) {
      return res.render("recharge", {
        data: { userName: req.userName, error: true },
      });
    }
    return res.render("recharge", {
      data: { userName: req.userName, walletData: wallet, mode: paymentMode },
    });
  } catch (error) {}
};

// endpoint for creating cashfree link
// deleted cashfree thing

//endpoint for creating payment link for recharge
exports.rechargewallet = async (req, res) => {
  try {
    const { amount } = req.body;

    const UserWallet = await WalletModel.findOne({ userId: req.userId });
    const UserData = await UserModel.findById(req.userId);

    let walletRechargeOrderId =
      "RECHARGE_" +
      otpGen.generate(16, {
        lowerCaseAlphabets: true,
        upperCaseAlphabets: true,
        digits: true,
        specialChars: false,
      });

    const rechargeOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      // customer_id: req.userId,
      notes: {
        message: `Recharge for ${req.userName} WalletOrderId: ${walletRechargeOrderId}`,
      },
      partial_payment: false,
      receipt: walletRechargeOrderId,
      customer_details: {
        name: req.userName,
        email: UserData.email,
        contact: UserData.phone,
        billing_address: {
          line1: UserData.billingAddress?.streetLandmark,
          city: UserData.billingAddress?.city,
          state: UserData.billingAddress?.state,
          country: "India",
        },
        shipping_address: {
          line1: UserData.shippingAddress?.streetLandmark,
          city: UserData.shippingAddress?.city,
          state: UserData.shippingAddress?.state,
          country: "India",
        },
      },
    });
    console.log(rechargeOrder);
    if (rechargeOrder.error) {
      res
        .status(500)
        .json({ message: "Error couldn't create payment link for recharge" });
    }

    UserWallet.transactions.push({
      walletOrderId: walletRechargeOrderId,
      amount: amount,
      transactionType: "recharge",
      rzpyOrderId: rechargeOrder.id,
      // cashfreeOrderId: rechargeOrder.cf_order_id,
      // cashfreeSessionId: createRechargePaymentlinkResponse.payment_session_id,
      transactionStatus: "pending",
    });

    await UserWallet.save();

    return res.status(200).json({
      ...rechargeOrder,
      name: UserData.name,
      email: UserData.email,
      phone: UserData.phone,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error couldn't create payment link for recharge" });
  }
};

exports.paymentSuccessCallback = async (req, res) => {
  try {
    const walletData = await WalletModel.find({
      "transactions.rzpyOrderId": req.body.razorpay_order_id,
    });
    // check for status and all

    res.render("payment-success", {
      data: { orderId: req.body.razorpay_order_id, status: "success" },
    });
  } catch (err) {
    console.log(err);
    res.send("not ok");
  }
};

// state to code mapping for GST
const stateToCode = {
  "Andhra Pradesh": "AP",
  Kerala: "KL",
  Tripura: "TR",
  "Arunachal Pradesh": "AR",
  "Madhya Pradesh": "MP",
  Uttarakhand: "UK",
  Assam: "AS",
  Maharashtra: "MH",
  "Uttar Pradesh": "UP",
  Bihar: "BR",
  Manipur: "MN",
  "West Bengal": "WB",
  Chhattisgarh: "CG",
  Meghalaya: "ML",
  Goa: "GA",
  Mizoram: "MZ",
  "Andaman and Nicobar Islands": "AN",
  Gujarat: "GJ",
  Nagaland: "NL",
  Chandigarh: "CH",
  Haryana: "HR",
  Orissa: "OR",
  "Dadra and Nagar Haveli": "DH",
  "Himachal Pradesh": "HP",
  Punjab: "PB",
  "Daman and Diu": "DD",
  "Jammu and Kashmir": "JK",
  Rajasthan: "RJ",
  Delhi: "DL",
  Jharkhand: "JH",
  Sikkim: "SK",
  Lakshadweep: "LD",
  Karnataka: "KA",
  "Tamil Nadu": "TN",
  Pondicherry: "PY",
  Telangana: "TG",
};

// the brand new endpoint for creating orders
exports.placeorder = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      mobile,
      email,
      streetLandmark,
      city,
      pincode,
      state,
      country,
      retailPrice,
      customerOrderId,
      shippingCharge,
      courierId,
      courierData,
      cashOnDelivery,
      isStore,
      billingAddress,
    } = req.body;
    console.log(isStore);
    const [orderData, userData, designData, labelData] = await Promise.all([
      OrderModel.findOne({ userId: req.userId }),
      UserModel.findById(req.userId),
      NewDesignModel.findOne({ userId: req.userId }),
      LabelModel.findOne({ userId: req.userId }),
    ]);

    if (!orderData) {
      res.status(404).json({ error: "No such order found!" });
      return console.log(`No such order data found for ${req.userId}`);
    }

    let totalPurchaseCost =
      (orderData.totalAmount + shippingCharge + (cashOnDelivery ? 50 : 0)) *
      1.05;

    if (retailPrice < totalPurchaseCost)
      return res.status(403).json({
        error: `Retail price should be greater than ${totalPurchaseCost}`,
      });

    const shippingAddressToCheck = {
      firstName,
      lastName,
      mobile,
      email,
      streetLandmark,
      city,
      pincode,
      state,
      country,
    };

    for (const [field, value] of Object.entries(shippingAddressToCheck)) {
      if (value === "" || !value) {
        return res.status(403).json({
          message: "Please fill shipping address",
          reason: "invalid",
        });
      }
    }

    // if (!isStore) {
    for (const key of Object.keys(shippingAddressToCheck)) {
      if (billingAddress[key] === "" || !billingAddress[key]) {
        return res.status(403).json({
          message: "Please fill billing address",
          reason: "invalid",
        });
      }
    }
    // }

    /// STEP 1: WALLET GAME
    const walletData = await WalletModel.findOne({ userId: req.userId });

    if (!walletData)
      return res.status(404).json({ message: "Wallet not found!" });

    if (walletData.balance < totalPurchaseCost) {
      return res.status(403).json({
        message: "Not enough credits in wallet. Please recharge wallet",
      });
    }

    const walletOrderId = otpGen.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: true,
      digits: true,
      specialChars: false,
    });
    walletData.balance = (walletData.balance - totalPurchaseCost).toFixed(2); // MONEY GONE!!!
    walletData.transactions.push({
      amount: totalPurchaseCost,
      transactionType: "payment",
      transactionStatus: "success",
      walletOrderId: "PAYMENT_" + walletOrderId,
      transactionNote: `Payment for Order ${orderData.printwearOrderId}`,
    }); // summa
    await walletData.save(); //summa
    console.log(orderData.printwearOrderId + " Wallet operation successful!");

    /// STEP 1.5: ORDERDATA GAM
    // for now billing address same as shipping, but later ask vendor to enter billing address data --- done
    orderData.billingAddress = {
      firstName: billingAddress?.firstName,
      lastName: billingAddress?.lastName,
      mobile: billingAddress?.mobile,
      email: billingAddress?.email,
      streetLandmark: billingAddress?.streetLandmark,
      city: billingAddress?.city,
      pincode: billingAddress?.pincode,
      state: billingAddress?.state,
      country: billingAddress?.country,
    };
    // orderData.billingAddress = {
    //   firstName,
    //   lastName,
    //   mobile,
    //   email,
    //   streetLandmark,
    //   city,
    //   pincode,
    //   state,
    //   country,
    // }
    orderData.shippingAddress = {
      firstName,
      lastName,
      mobile,
      email,
      streetLandmark,
      city,
      pincode,
      state,
      country,
    };
    // CashfreeOrderId: paymentLinkResponse.cf_order_id,
    // paymentLinkId: paymentLinkResponse.payment_session_id,
    // paymentLink: paymentLinkResponse.payments.url,
    orderData.retailPrice = retailPrice;
    orderData.deliveryCharges = shippingCharge;
    orderData.customerOrderId = customerOrderId;
    orderData.shipRocketCourier = {
      courierId: courierId ?? -1,
      courierName: courierData?.courier_name ?? "SELF PICKUP",
      estimatedDelivery: courierData?.etd ?? "N/A",
    };
    orderData.cashOnDelivery = cashOnDelivery;
    orderData.totalAmount = (
      orderData.totalAmount +
      shippingCharge +
      (cashOnDelivery ? 50 : 0)
    ).toFixed(2);
    orderData.taxes = (orderData.totalAmount * 0.05).toFixed(2);

    orderData.paymentStatus = "success";
    orderData.amountPaid = (orderData.totalAmount + orderData.taxes).toFixed(2);

    await orderData.save();
    console.log("🚀 ~ orderData:", orderData);

    /// STEP 2: CREATE SHIPROCKET ORDER
    if (courierId) {
      // check if order is not self pickup, courierId null means, self pickup = no need for shiprocket.
      /** previously debited walelt only when not self pickup, changed it to debit wallet always */
      const shiprocketToken = await generateShiprocketToken();

      const SHIPROCKET_ACC_TKN = shiprocketToken.token;

      const shiprocketOrderData = {
        order_id: orderData.printwearOrderId,
        order_date: formatDate(new Date()),
        pickup_location: "Primary",
        channel_id: process.env.SHIPROCKET_CHANNEL_ID,
        comment:
          "Order for " +
          orderData.shippingAddress.firstName +
          " " +
          orderData.shippingAddress.lastName,
        billing_customer_name: billingAddress.firstName,
        billing_last_name: billingAddress.lastName,
        billing_address: billingAddress.streetLandmark,
        billing_address_2: "",
        billing_city: billingAddress.city,
        billing_pincode: billingAddress.pincode,
        billing_state: billingAddress.state,
        billing_country: billingAddress.country || "India",
        billing_email: billingAddress.email,
        billing_phone: billingAddress.mobile,
        shipping_is_billing: false, // --> later change to False
        shipping_customer_name: orderData.shippingAddress.firstName,
        shipping_last_name: orderData.shippingAddress.lastName,
        shipping_address: orderData.shippingAddress.streetLandmark,
        shipping_address_2: "",
        shipping_city: orderData.shippingAddress.city,
        shipping_pincode: orderData.shippingAddress.pincode,
        shipping_state: orderData.shippingAddress.state,
        shipping_country: orderData.shippingAddress.country,
        shipping_email: orderData.shippingAddress.email,
        shipping_phone: orderData.shippingAddress.mobile,
        order_items: orderData.items.map((item) => {
          let currentItemDesignData = designData.designs.find(
            (design) => design._id + "" == item.designId + "",
          );
          return {
            name: currentItemDesignData.designName,
            sku: currentItemDesignData.designSKU,
            units: item.quantity,
            selling_price: currentItemDesignData.price * 1.05,
            discount: "",
            tax: `${currentItemDesignData.price * 0.05}`,
            hsn: 441122,
          };
        }),
        payment_method: orderData.cashOnDelivery ? "COD" : "Prepaid",
        shipping_charges:
          orderData.deliveryCharges +
          (orderData.cashOnDelivery ? 50 : 0) +
          orderData.taxes,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: 0,
        // "sub_total": orderData.items.reduce((total, item) => total + (item.price * item.quantity), 0), // i changed from Retail price to totalAmount.. idk how that works
        // turns out u need to use retailprice only
        sub_total:
          orderData.retailPrice -
          (orderData.deliveryCharges +
            (orderData.cashOnDelivery ? 50 : 0) +
            orderData.taxes), // i changed from Retail price to totalAmount.. idk how that works
        length: 28,
        breadth: 20,
        height: 0.5,
        weight: (
          0.25 *
          orderData.items.reduce((total, item) => total + item.quantity, 0)
        ).toFixed(2),
      };

      console.log("Shiprocket data:");
      console.dir(shiprocketOrderData, { depth: 5 });

      const createShiprocketOrderRequest = await fetch(
        SHIPROCKET_BASE_URL + "/orders/create/adhoc",
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + SHIPROCKET_ACC_TKN,
          },
          method: "POST",
          body: JSON.stringify(shiprocketOrderData),
        },
      );
      const createShiprocketOrderResponse =
        await createShiprocketOrderRequest.json();
      console.log("Shiprocket order response:");
      console.log(createShiprocketOrderResponse);

      if (!createShiprocketOrderRequest.ok)
        throw new Error("Failed to create order");

      orderData.shipRocketOrderId = createShiprocketOrderResponse.order_id;
      orderData.shipmentId = createShiprocketOrderResponse.shipment_id;
      orderData.deliveryStatus = "received";
    }

    /// STEP 3: TRANSFER ORDERDATA TO ORDERHISTORY
    const updatedOrderHistory = await OrderHistoryModel.findOneAndUpdate(
      { userId: req.userId },
      {
        $set: {
          userId: req.userId,
        },
        $push: {
          orderData: orderData,
        },
      },
      { upsert: true, new: true },
    );

    await orderData.updateOne({
      $unset: {
        items: 1,
        billingAddress: 1,
        shippingAddress: 1,
        totalAmount: 1,
        amountPaid: 1,
        paymentStatus: 1,
        deliveryStatus: 1,
        deliveryCharges: 1,
        paymentLink: 1,
        paymentLinkId: 1,
        CashfreeOrderId: 1,
        printwearOrderId: 1,
        shipRocketOrderId: 1,
        shipmentId: 1,
        createdAt: 1,
        deliveredOn: 1,
        processed: 1,
        retailPrice: 1,
        customerOrderId: 1,
        shipRocketCourier: 1,
        cashOnDelivery: 1,
        taxes: 1,
        shopifyId: 1,
        wooCommerceId: 1,
      },
    });

    /// STEP 4: GENERATE ZOHO INVOICE
    const zohoToken = await generateZohoToken();
    if (
      !userData.zohoCustomerID ||
      !userData.zohoContactID ||
      !userData.isZohoCustomer
    ) {
      // write endpoint to create zoho customer
      let customerData = {
        contact_name: userData.name,
        company_name: userData.brandName ?? "N/A",
        contact_persons: [
          {
            salutation: userData.name,
            first_name: userData.firstName ?? billingAddress.firstName,
            last_name: userData.lastName ?? billingAddress.lastName,
            email: userData.email,
            phone: userData.phone,
            mobile: userData.phone,
            is_primary_contact: true,
          },
        ],
        billing_address: {
          address: billingAddress.streetLandmark,
          street2: "",
          city: billingAddress.city,
          state: billingAddress.state,
          zipcode: billingAddress.pincode,
          country: "India",
          phone: userData.phone,
          fax: "",
          attention: "",
        },
        language_code: "en",
        country_code: "IN",
        place_of_contact: stateToCode[billingAddress.state],
      };
      const zohoCustomerCreateRequest = await fetch(
        `https://www.zohoapis.in/books/v3/contacts?organization_id=${ZOHO_INVOICE_ORGANIZATION_ID}`,
        {
          method: "POST",
          headers: {
            Authorization: "Zoho-oauthtoken " + zohoToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(customerData),
        },
      );
      const zohoCustomerCreateResponse = await zohoCustomerCreateRequest.json();
      //console.log(zohoCustomerCreateResponse); // remove
      if (zohoCustomerCreateResponse.code == 0) {
        console.log(`zohoCustomer for ${req.userId} created!`);
        userData.isZohoCustomer = true;
        userData.zohoCustomerID = zohoCustomerCreateResponse.contact.contact_id;
        userData.zohoContactID =
          zohoCustomerCreateResponse.contact.primary_contact_id;
        await userData.save({ validateBeforeSave: false });
      }
    }

    const orderDetails = await OrderHistoryModel.findOne(
      {
        userId: req.userId,
        orderData: {
          $elemMatch: { printwearOrderId: orderData.printwearOrderId },
        },
      },
      { "orderData.$": 1 },
    );
    const zohoCustomerId = userData.zohoCustomerID;
    const zohoContactId = userData.zohoContactID;
    const invoiceData = {
      // branch_id: "650580000000098357",
      // autonumbergenerationgroup_id: "650580000004188098",
      reference_number: orderDetails.orderData[0].printwearOrderId,
      payment_terms: 0,
      payment_terms_label: "Due on Receipt",
      customer_id: zohoCustomerId,
      contact_persons: zohoContactId ? [zohoContactId] : [],
      date: formatDate(new Date(orderDetails.orderData[0].updatedAt), true),
      due_date: formatDate(new Date(orderDetails.orderData[0].updatedAt), true),
      notes:
        "We thank you for your business\npls write us for additional information accounts@printwear.in\nMSME REGISTERED NO - UDYAM-TN-02-0351728\n\n",
      terms:
        "Terms & Conditions\nsubject to chennai jurisdiction\nNon refundable transaction\nAll grievences to be addressed within 2days of receiving invoice\n21% INTEREST APPLICABLE FOR THE INVOICES AFTER DUE DATE\n\n",
      is_inclusive_tax: false,
      line_items: orderDetails.orderData[0].items.map((item, i) => {
        let currentDesignItem = designData.designs.find(
          (design) => design._id + "" == item.designId,
        );
        return {
          item_order: i + 1,
          item_id: currentDesignItem.product.id,
          rate: currentDesignItem.price,
          name: currentDesignItem.product.name,
          description: currentDesignItem.designName,
          quantity: item.quantity.toFixed(2),
          discount: "0%",
          // tax_id:
          //   stateToCode[orderDetails.orderData[0].shippingAddress.state] == "TN"
          //     ? TN_TAX_ID
          //     : INTERSTATE_TAX_ID,
          project_id: "",
          tags: [],
          tax_exemption_code: "",
          account_id: "2198251000000029361",
          item_custom_fields: [],
          hsn_or_sac: "61130000",
          gst_treatment_code: "",
          unit: "PCS",
        };
      }),
      allow_partial_payments: false,
      custom_fields: [
        {
          value: Object.keys(orderDetails.orderData[0].billingAddress)
            .map((key) => orderDetails.orderData[0].billingAddress[key])
            .join(", "),
          customfield_id: "2198251000000029540",
        },
      ],
      is_discount_before_tax: "",
      discount: 0,
      discount_type: "",
      adjustment:
        (orderDetails.orderData[0].deliveryCharges +
          (orderDetails.orderData[0].cashOnDelivery ? 50 : 0)) *
        1.05,
      adjustment_description: "Standard Shipping",
      shipping_charge: 0,
      tax_exemption_code: "",
      tax_authority_name: "",
      pricebook_id: "",
      template_id: ZOHO_INVOICE_TEMPLATE_ID,
      project_id: "",
      documents: [],
      mail_attachments: [],
      // billing_address_id: "650580000004548004",
      // shipping_address_id: "650580000004548006",
      gst_treatment: "consumer",
      gst_no: "",
      place_of_supply:
        stateToCode[orderDetails.orderData[0].shippingAddress.state],
      quick_create_payment: {
        account_id: "2198251000000092239",
        payment_mode: "Bank Transfer",
      },
      tcs_tax_id: "",
      is_tcs_amount_in_percent: true,
      tds_tax_id: "",
      is_tds_amount_in_percent: true,
      tax_total: orderDetails.orderData[0].totalAmount * 0.05,
      payment_made: orderDetails.orderData[0].amountPaid,
    };
    console.log("Zoho invoice data: ", invoiceData);

    const zohoInvoiceFormData = new FormData();
    zohoInvoiceFormData.append("JSONString", JSON.stringify(invoiceData));
    zohoInvoiceFormData.append("organization_id", ZOHO_INVOICE_ORGANIZATION_ID);
    zohoInvoiceFormData.append("is_quick_create", "true");
    //console.log(zohoInvoiceFormData);

    const zohoInvoiceCreateRequest = await fetch(
      `https://www.zohoapis.in/books/v3/invoices?organization_id=${ZOHO_INVOICE_ORGANIZATION_ID}&send=false`,
      {
        // const zohoInvoiceCreateRequest = await fetch(`https://books.zoho.in/api/v3/invoices`, {
        method: "POST",
        headers: {
          Authorization: "Zoho-oauthtoken " + zohoToken,
        },
        body: zohoInvoiceFormData,
      },
    );
    const zohoInvoiceCreateResponse = await zohoInvoiceCreateRequest.json();
    console.log(zohoInvoiceCreateResponse);
    if (zohoInvoiceCreateResponse.code != 0 || !zohoInvoiceCreateRequest.ok) {
      console.log(`Couldn't create invoice for ${orderData.printwearOrderId}`);
      console.log(zohoInvoiceCreateResponse);
    } else {
      let purchaseTransactionIndex = walletData.transactions.findIndex(
        (transaction) =>
          transaction.walletOrderId == `PAYMENT_${walletOrderId}`,
      );
      walletData.transactions[purchaseTransactionIndex].invoiceURL =
        zohoInvoiceCreateResponse.invoice?.invoice_url;
    }

    res.json({ message: "Order was successfull!" });

    await walletData.save();
    updatedOrderHistory.orderData.at(-1).walletOrderId = walletOrderId;
    await updatedOrderHistory.save({ validateBeforeSave: false });

    // STEP 5: SEND ORDER DATA TO WOOCOMMS
    // part where i send the line item data to santo woocomms
    // should create order in woocomms
    // deleted a huge comment, if needed take from old commit

    /* no longer need to send data to santo.. cuz cpanel died :( 
    // hence deleted a bigass comment 
    // deleted big ass comment, check old git commits for the deleted comment hre */
  } catch (error) {
    console.log("General error");
    console.log(error);
    console.log(
      "Failed to create order for: " +
        req.userId +
        " Order Id: " +
        req.body.customerOrderId,
    );
    res.status(500).json({ message: "Internal server Error" });
  }
};

exports.reshiporder = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      mobile,
      email,
      streetLandmark,
      city,
      pincode,
      state,
      country,
      shippingCharge,
      courierId,
      courierData,
      cashOnDelivery,
      billingAddress,
      pwOrderId,
    } = req.body;
    console.log(req.body);

    const orderHistory = await OrderHistoryModel.findOne({
      userId: req.userId,
    });
    const walletData = await WalletModel.findOne({ userId: req.userId });

    const orderToRefund = orderHistory.orderData.find(
      (order) => order.printwearOrderId == pwOrderId,
    );

    const orderToRefundIndex = orderHistory.orderData.findIndex(
      (order) => order.printwearOrderId == pwOrderId,
    );

    if (
      !orderHistory ||
      orderToRefundIndex == -1 ||
      !["rto-delivered", "cancelled"].includes(orderToRefund.deliveryStatus)
    )
      return res.status(404).json({ error: "Invalid Reship order request" });

    const shippingAddressToCheck = {
      firstName,
      lastName,
      mobile,
      email,
      streetLandmark,
      city,
      pincode,
      state,
      country,
    };

    for (const [field, value] of Object.entries(shippingAddressToCheck)) {
      if (value === "" || !value) {
        return res.status(403).json({
          message: "Please fill shipping address",
          reason: "invalid",
        });
      }
    }

    for (const [field, value] of Object.entries(billingAddress)) {
      if (value === "" || !value) {
        return res.status(403).json({
          message: "Please fill billing address",
          reason: "invalid",
        });
      }
    }

    const oldCharges =
      orderToRefund.deliveryStatus == "cancelled"
        ? orderToRefund.items.reduce((curr, item) => curr + item.price, 0)
        : orderToRefund.totalAmount;
    console.log("🚀 ~ exports.reshiporder= ~ oldCharges:", oldCharges);
    const totalCharges =
      shippingCharge + (cashOnDelivery ? 50 : 0) + oldCharges;
    console.log("🚀 ~ exports.reshiporder= ~ totalCharges:", totalCharges);

    /** wallet deduct charges */
    const walletOrderId = otpGen.generate(6, {
      lowerCaseAlphabets: false,
      upperCaseAlphabets: true,
      digits: true,
      specialChars: false,
    });

    if (courierId) {
      const walletDeduction =
        orderToRefund.deliveryStatus == "cancelled"
          ? totalCharges * 1.05
          : (shippingCharge + (cashOnDelivery ? 50 : 0)) * 1.05;
      console.log(walletDeduction);
      if (walletData.balance < walletDeduction) {
        return res.status(403).json({
          message: "Not enough credits in wallet. Please recharge wallet",
        });
      }

      walletData.balance = (walletData.balance - walletDeduction).toFixed(2); // MONEY GONE!!!
      walletData.transactions.push({
        amount: walletDeduction,
        transactionType: "payment",
        transactionStatus: "success",
        walletOrderId: "RESHIP_" + pwOrderId + "_" + walletOrderId,
        transactionNote: `Reship payment for Order ${orderToRefund.printwearOrderId}`,
      }); // summa
      await walletData.save(); //summa
      console.log(
        orderToRefund.printwearOrderId + " Wallet operation successful!",
      );
    }

    /** update orderData */
    orderHistory.orderData.at(orderToRefundIndex).shippingAddress = {
      firstName,
      lastName,
      mobile,
      email,
      streetLandmark,
      city,
      pincode,
      state,
      country,
    };
    orderHistory.orderData.at(orderToRefundIndex).deliveryCharges +=
      shippingCharge;
    orderHistory.orderData.at(orderToRefundIndex).walletOrderId = walletOrderId;
    orderHistory.orderData.at(orderToRefundIndex).cashOnDelivery =
      cashOnDelivery ? true : false;
    orderHistory.orderData.at(orderToRefundIndex).totalAmount = totalCharges;
    orderHistory.orderData.at(orderToRefundIndex).taxes = (
      orderHistory.orderData.at(orderToRefundIndex).totalAmount * 0.05
    ).toFixed(2);
    orderHistory.orderData.at(orderToRefundIndex).deliveryStatus = "received";
    orderHistory.orderData.at(orderToRefundIndex).paymentStatus = "success";
    orderHistory.orderData.at(orderToRefundIndex).shipRocketCourier = {
      courierId: courierId ?? -1,
      courierName: courierData?.courier_name ?? "SELF PICKUP",
      estimatedDelivery: courierData?.etd ?? "N/A",
    };
    orderHistory.orderData.at(orderToRefundIndex).amountPaid = (
      orderHistory.orderData.at(orderToRefundIndex).taxes +
      orderHistory.orderData.at(orderToRefundIndex).totalAmount
    ).toFixed(2);

    await orderHistory.save({ validateBeforeSave: false });

    return res.json({ message: "Reship was successfully initiated!" });
  } catch (error) {
    console.log("🚀 ~ exports.reshiporder= ~ error:", error);
    res.status(500).json({ error: "Server error in creating reship order" });
  }
};

/** Deleted a comment for shiprocket missing data as complained with "shiprocket data not fetched" */

// endpoint for wallet balance
exports.walletballance = async (req, res) => {
  try {
    const walletData = await WalletModel.findOne({ userId: req.userId });
    if (!walletData)
      return res.status(404).json({ message: "Wallet for user not found!" });
    return res.json({ balance: walletData.balance, name: req.userName });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Couldn't fetch Wallet details!" });
  }
};

// endpoints for creating orders in shiprocket
exports.calculateshippingcharges = async (req, res) => {
  try {
    const { weight, pincode, cod } = req.body;
    // get couriers
    const shippingChargeRequest = await fetch(
      `https://apiv2.shiprocket.in/v1/external/courier/serviceability?pickup_postcode=600087&weight=${weight}&delivery_postcode=${pincode}&cod=${cod ? 1 : 0}`,
      {
        headers: {
          Authorization: "Bearer " + (await generateShiprocketToken()).token,
        },
      },
    );
    const shippingChargeResponse = await shippingChargeRequest.json();
    console.log(
      `Shipping charges checked by ${req.userId} for pincode: `,
      pincode,
    );
    if (shippingChargeResponse.status != 200 || !shippingChargeRequest.ok)
      return res
        .status(
          shippingChargeResponse.status_code || shippingChargeResponse.status,
        )
        .json({ message: shippingChargeResponse.message });

    // the following code should be put in getpaymentlink function
    // get courier id for the order
    // const recommendedCourierID = shippingChargeResponse.data.recommended_courier_company_id;
    // const charges = shippingChargeResponse.data.available_courier_companies.find(courier => courier.courier_company_id == recommendedCourierID)["freight_charge"];
    // const orderData = await OrderModel.findOneAndUpdate({ userId: req.userId }, { $set: { deliveryCharges: charges } });

    res.status(200).json(shippingChargeResponse);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong!" });
  }
};

//endpoint for initiating refund
exports.initiaterefund = async (req, res) => {
  // 2 levels: CANCEL ORDER (before its even shipped), RETURN ORDER (after it is shipped)
  // for CANCEL ORDER: check if order has a courier assigned.. if so first hit shiprocket API and cancel that assigned courier
  // next hit cashfree API to initiate refund and get the status via webhook
  // else, if not assigned any courier, then simply hit cashfree API and initiate refund
  // i think shiprocket also has webhook? idk i need to see
  // for RETURN ORDER: hit shiprocket API to initiate return, then listen to the event via webhook and then update
  // orderHistory with appropriate status and all

  /** removed 5 function that were previously used for cancellation */

  try {
    var orderHistory = await OrderHistoryModel.findOne({ userId: req.userId });
    var walletData = await WalletModel.findOne({ userId: req.userId });
    var designData = await NewDesignModel.findOne({ userId: req.userId });
    var orderToRefund = orderHistory.orderData.find(
      (order) => order.printwearOrderId == req.body.orderId,
    );
    var orderToRefundIndex = orderHistory.orderData.findIndex(
      (order) => order.printwearOrderId == req.body.orderId,
    );
    var walletOrderId = otpGen.generate(6, {
      lowerCaseAlphabets: false,
      specialChars: false,
    });
    // this purchase transaction is to make sure that i correspond the walletorder id that was used to make payment for the order is
    // inside the orderhistory data itself so when i need to make a refund i can simply refer it from orderhistory and find that specific
    // transaction and then if refund is needed, do so by passing it to refundFunction as argument
    var purchaseTransaction = walletData.transactions.find(
      (transaction) =>
        transaction.walletOrderId == "PAYMENT_" + orderToRefund.walletOrderId,
    );
    //// now that i realised that the last recharge type of transaction can only be used to refund the customer, why even have purchaseTransaction?
    let purchaseTransactionOrderId = walletData.transactions
      .filter((transaction) => transaction.transactionType === "recharge")
      .at(-1).walletOrderId; // this is what i need

    if (!orderToRefund || orderToRefundIndex === -1)
      return res.status(404).json({ message: "Order not found!" });

    if (!purchaseTransaction)
      return res.status(404).json({ message: "Wallet transaction not found!" }); // if no such transaction found, then cant refund, problem with us only

    if (
      ["pending", "received", "invoiced"].includes(orderToRefund.deliveryStatus)
    ) {
      orderHistory.orderData.at(orderToRefundIndex).deliveryStatus =
        "cancelled";

      walletData.transactions.push({
        amount: orderToRefund.amountPaid,
        transactionType: "refund",
        walletOrderId: `REFUND_` + walletOrderId,
        refundAmount: orderToRefund.totalAmount,
        transactionNote: "Refund for order " + orderToRefund.printwearOrderId,
        transactionStatus: "success", // later listen to webhook and change status
      });
      walletData.balance = walletData.balance + orderToRefund.amountPaid;

      await walletData.save({ validateBeforeSave: false });

      orderHistory.orderData.at(orderToRefundIndex).paymentStatus = "refunded";
      await orderHistory.save({ validateBeforeSave: false });

      return res.json({ message: "Order cancelled successfully!" });
    }

    if (
      ["delivered"].includes(orderToRefund.deliveryStatus) ||
      (orderToRefund.deliveryStatus === "completed" &&
        orderToRefund.shipRocketCourier.courierId !== "-1")
    ) {
      orderHistory.orderData[orderToRefundIndex].deliveryStatus = "return-init";

      await orderHistory.save({ validateBeforeSave: false });
      return res.json({ message: "Return request sent successfully!" });
    }

    if (["cancelled", "rto-delivered"].includes(orderToRefund.deliveryStatus)) {
      return res.redirect(`/order/${orderToRefund.printwearOrderId}/reship`);
    }

    res.status(403).json({ error: "Invalid operation!" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Something went wrong in cancelling this order!" });
  }
  /** deleted a huge descriptive + code comment */
};

// for now create a test endpoint for fetching order data, then later change /manageorder route to do data fetching and implement SSR
exports.getorderhistory = async (req, res) => {
  try {
    const orderHistory = await OrderHistoryModel.findOne({
      userId: req.userId,
    });
    if (!orderHistory) {
      return res.json([]);
    }
    res.json(orderHistory.orderData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching orderhistory" });
  }
};

// new endpoint to upload new label
exports.uploadlabel = async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname
      .replace(/ /g, "-")
      .replace(/[^a-zA-Z0-9-_.]/g, "");
    const fileReference = storageReference.child(
      `labels/${req.userId + "_" + otpGen.generate(4, { specialChars: false }) + "_" + fileName}`,
    );
    await fileReference.put(fileBuffer, { contentType: "image/png" });
    const fileDownloadURL = await fileReference.getDownloadURL();

    await LabelModel.findOneAndUpdate(
      { userId: req.userId },
      {
        $setOnInsert: {
          userId: req.userId,
        },
        $push: {
          labels: {
            name: req.file.originalname,
            url: fileDownloadURL,
          },
        },
      },
      { new: true, upsert: true },
    );

    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to upload image" });
  }
};

exports.obtainlabels = async (req, res) => {
  try {
    const labelData = await LabelModel.findOne({ userId: req.userId });
    res.status(200).json(labelData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Label data error" });
  }
};

exports.deletelabel = async (req, res) => {
  const imageId = req.body.imageId;

  try {
    const imageToDelete = await LabelModel.findOne(
      { userId: req.userId, "labels._id": imageId },
      { "labels.$": 1 },
    );
    // const imageToDelete = await LabelModel.findOne({ userId: req.userId, 'labels.' })
    const fileNameFromURL = imageToDelete.labels?.[0].url
      .split("?alt")[0]
      .split("labels%2F")[1];
    const fileReference = storageReference.child(`labels/${fileNameFromURL}`);
    await fileReference.delete();

    await LabelModel.findOneAndUpdate(
      {
        userId: req.userId,
      },
      {
        $pull: {
          labels: {
            _id: imageId,
          },
        },
      },
    );
    res.status(200).json({ message: "Deleted successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error deleting label" });
  }
};

// endpoint for checking if orderid is unique
exports.checkorderid = async (req, res) => {
  try {
    const currentOrderId = req.body.customerOrderId;
    const orderIDs = await OrderHistoryModel.findOne({ userId: req.userId });
    if (!orderIDs) return res.status(200).json({ message: "OK" });
    const orderIDmatches = orderIDs.orderData.find(
      (order) =>
        order.customerOrderId == currentOrderId &&
        !["rto-delivered", "cancelled"].includes(order.deliveryStatus),
    );

    if (!orderIDmatches) {
      return res.status(200).json({ message: "OK" });
    }
    return res.status(400).json({ message: "Order ID already exists!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error when checking order id" });
  }
};

// endpoint for getting invoice link for the orders
exports.getinvoices = async (req, res) => {
  try {
    const walletData = await WalletModel.findOne({ userId: req.userId });
    const lastTransaction = walletData.transactions.at(-1);
    if (
      lastTransaction.transactionType === "recharge" &&
      lastTransaction.amount === 0
    )
      return res.render("invoice", { walletData: null });
    res.render("invoice", { walletData });
  } catch (error) {
    console.log(error);
    res.json(error);
  }
};

//endpoint for generating zoho books invoice
/** zoho books invoice testing endpoint, before making edits, copy current invoicing logic with states selections anol and paste it here
 * and conitnue
 */
// exports.generateZohoBooksInvoice = async (req, res) => {
//   try {
//     const zohoToken = await generateZohoToken();

//     // for now testing, actually obtain userid from the createshiporder userid thing, this endpoint itself is just for test
//     let userid = "64f175edd683cd124e440f23";
//     let testorderid = "XHDAYP";
//     const userData = await UserModel.findById(userid);
//     if (!userData.isZohoCustomer) {
//       // write endpoint to create zoho customer
//       let customerData = {
//         "contact_name": userData.name,
//         "company_name": userData.brandName ?? 'N/A',
//         "contact_persons": [
//           {
//             "salutation": userData.name,
//             "first_name": userData.firstName,
//             "last_name": userData.lastName,
//             "email": userData.email,
//             "phone": userData.phone,
//             "mobile": userData.phone,
//             "is_primary_contact": true
//           }
//         ],
//         "billing_address": {
//           "address": userData.billingAddress.landmark,
//           "street2": "",
//           "city": userData.billingAddress.city,
//           "state": userData.billingAddress.state,
//           "zipcode": userData.billingAddress.pincode,
//           "country": "India",
//           "phone": userData.phone,
//           "fax": "",
//           "attention": ""
//         },
//         "language_code": "en",
//         "country_code": "IN",
//         "place_of_contact": "TN",
//       }
//       const zohoCustomerCreateRequest = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${ZOHO_INVOICE_ORGANIZATION_ID}`, {
//         method: "POST",
//         headers: {
//           Authorization: 'Zoho-oauthtoken ' + zohoToken,
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(customerData)
//       });
//       const zohoCustomerCreateResponse = await zohoCustomerCreateRequest.json();
//       //res.json(zohoCustomerCreateResponse); // remove
//       if (zohoCustomerCreateResponse.code == 0) {

//         userData.isZohoCustomer = true;
//         userData.zohoCustomerID = zohoCustomerCreateResponse.contact.contact_id;
//         userData.zohoContactID = zohoCustomerCreateResponse.contact.primary_contact_id;
//         await userData.save();
//       }
//     }

//     // create item
//     // not necessary because when taking data from zoho inventory i got the product id which was saved in newdesigns itself!
//     // so for now, just query the designs, and for each of them simply fetch their id and use it for invoice
//     // following query is for testing only, take actual data from the createshiporder data
//     const orderDetails = await OrderHistoryModel.findOne(
//       {
//         "userId": userid,
//         "orderData": { $elemMatch: { "printwearOrderId": testorderid } }
//       },
//       { "orderData.$": 1 });
//     const designIds = orderDetails.orderData[0].items.map(item => item.designId + '');
//     const designsData = await NewDesignModel.findOne({ userId: userid });
//     let productIds = designsData.designs.filter(design => designIds.includes(design._id + '')).map(design => design.product.id);

//     // create invoice request
//     const zohoCustomerId = userData.zohoCustomerID;
//     const zohoContactId = userData.zohoContactID;

//     const invoiceData = {
//       // branch_id: "650580000000098357",
//       // autonumbergenerationgroup_id: "650580000004188098",
//       reference_number: orderDetails.orderData[0].printwearOrderId,
//       payment_terms: 0,
//       payment_terms_label: "Due on Receipt",
//       customer_id: zohoCustomerId,
//       contact_persons: zohoContactId ? [zohoContactId] : [],
//       date: formatDate(new Date(orderDetails.orderData[0].createdAt), true),
//       due_date: formatDate(new Date(orderDetails.orderData[0].createdAt), true),
//       notes:
//         "We thank you for your business\npls write us for additional information accounts@printwear.in\nMSME REGISTERED NO - UDYAM-TN-02-0351728\n\n",
//       terms:
//         "Terms & Conditions\nsubject to chennai jurisdiction\nNon refundable transaction\nAll grievences to be addressed within 2days of receiving invoice\n21% INTEREST APPLICABLE FOR THE INVOICES AFTER DUE DATE\n\n",
//       is_inclusive_tax: false,
//       line_items: orderDetails.orderData[0].items.map((item, i) => {
//         let currentDesignItem = designsData.designs.find(
//           (design) => design._id + "" == item.designId,
//         );
//         return {
//           item_order: i + 1,
//           item_id: currentDesignItem.product.id,
//           rate: currentDesignItem.price,
//           name: currentDesignItem.product.name,
//           description: currentDesignItem.designName,
//           quantity: item.quantity.toFixed(2),
//           discount: "0%",
//           // tax_id:
//           //   stateToCode[orderDetails.orderData[0].shippingAddress.state] == "TN"
//           //     ? TN_TAX_ID
//           //     : INTERSTATE_TAX_ID,
//           project_id: "",
//           tags: [],
//           tax_exemption_code: "",
//           account_id: "2198251000000029361",
//           item_custom_fields: [],
//           hsn_or_sac: "61130000",
//           gst_treatment_code: "",
//           unit: "PCS",
//         };
//       }),
//       allow_partial_payments: false,
//       custom_fields: [
//         {
//           value: Object.keys(orderDetails.orderData[0].billingAddress)
//             .map((key) => orderDetails.orderData[0].billingAddress[key])
//             .join(", "),
//           customfield_id: "2198251000000029540",
//         },
//       ],
//       is_discount_before_tax: "",
//       discount: 0,
//       discount_type: "",
//       adjustment:
//         (orderDetails.orderData[0].deliveryCharges +
//           (orderDetails.orderData[0].cashOnDelivery ? 50 : 0)) *
//         1.05,
//       adjustment_description: "Standard Shipping",
//       shipping_charge: 0,
//       tax_exemption_code: "",
//       tax_authority_name: "",
//       pricebook_id: "",
//       template_id: ZOHO_INVOICE_TEMPLATE_ID,
//       project_id: "",
//       documents: [],
//       mail_attachments: [],
//       // billing_address_id: "650580000004548004",
//       // shipping_address_id: "650580000004548006",
//       gst_treatment: "consumer",
//       gst_no: "",
//       place_of_supply:
//         stateToCode[orderDetails.orderData[0].shippingAddress.state],
//       quick_create_payment: {
//         account_id: "2198251000000092239",
//         payment_mode: "Bank Transfer",
//       },
//       tcs_tax_id: "",
//       is_tcs_amount_in_percent: true,
//       tds_tax_id: "",
//       is_tds_amount_in_percent: true,
//       tax_total: orderDetails.orderData[0].totalAmount * 0.05,
//       payment_made: orderDetails.orderData[0].amountPaid,
//     };

//     const zohoInvoiceFormData = new FormData();
//     zohoInvoiceFormData.append('JSONString', JSON.stringify(invoiceData));
//     zohoInvoiceFormData.append('organization_id', ZOHO_INVOICE_ORGANIZATION_ID);
//     zohoInvoiceFormData.append('is_quick_create', 'true');

//     const zohoInvoiceCreateRequest = await fetch(`https://www.zohoapis.in/books/v3/invoices?organization_id=${ZOHO_INVOICE_ORGANIZATION_ID}&send=false`, {
//       // const zohoInvoiceCreateRequest = await fetch(`https://books.zoho.in/api/v3/invoices`, {
//       method: "POST",
//       headers: {
//         Authorization: 'Zoho-oauthtoken ' + zohoToken,
//         // "Content-Type": "application/json"
//       },
//       body: zohoInvoiceFormData
//     });
//     const zohoInvoiceCreateResponse = await zohoInvoiceCreateRequest.json();
//     res.json(zohoInvoiceCreateResponse);
//

//   } catch (error) {

//     res.send(error);
//   }
// }

// dummy testing endpoint for testing santo woocomms order creation
// testing done. so probably remove
// removed, maybe need na add from git

// dummy endpoint for adding new product data in womens rn
// removed addwomens endpoint function, venuna git landhu eduthuko

// / WEBHOOKS
// webhook for cashfree to hit and notify about payment

exports.createshiporder = async (req, res) => {
  let errorMessage;

  const rzpyIdempotency = req.headers["x-razorpay-event-id"];
  const rzpyWHSignature = req.headers["x-razorpay-signature"];
  console.log(`Payload for Event ID: ${rzpyIdempotency}`);
  console.dir(req.body, { depth: 6 });

  const rawData = req.body;

  if (!rzpyWHSignature || !rzpyIdempotency) {
    errorMessage = "Invalid request - No signature found";
    console.log("[WH]: errorMessage:", errorMessage);
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const webhookVerified = Razorpay.validateWebhookSignature(
    JSON.stringify(rawData),
    String(rzpyWHSignature),
    RZPY_WH_SECRET,
  );
  if (!webhookVerified) {
    errorMessage = "Invalid webhook. Could not be verified!";
    console.log("[WH]: errorMessage:", errorMessage);
    res.status(400).json({ error: errorMessage });
    return;
  }

  res.json({ message: "OK" });

  const rzpyOrderId = rawData.payload.payment.entity.order_id;
  const rzpyPaymentId = rawData.payload.payment.entity.id;

  const UserWallet = await WalletModel.findOne({
    "transactions.rzpyOrderId": rzpyOrderId,
  });
  if (!UserWallet)
    return console.log(`[WH]: Couldn't find wallet for ${userid}`);

  const currentTransactionIndex = UserWallet.transactions.findIndex(
    (transaction) => transaction.rzpyOrderId == rzpyOrderId,
  );
  console.log(currentTransactionIndex);
  if (currentTransactionIndex == -1)
    return console.log(
      `[WH]: Couldn't find transaction with ID: ${rzpyOrderId}`,
    );

  if (rawData.event === "payment.captured") {
    try {
      // check if that wallet already has been updated because 2nd duplicate webhook take time and pass the idempotency check
      if (
        UserWallet.transactions[currentTransactionIndex].transactionStatus ===
        "success"
      )
        return console.log(
          `[WH]: [DUPLICATE] Received webhook for ${rzpyOrderId} and updated already.`,
        );

      UserWallet.transactions[currentTransactionIndex].amount =
        rawData.payload.payment.entity.amount / 100;
      UserWallet.transactions[currentTransactionIndex].transactionStatus =
        "success";
      UserWallet.transactions[currentTransactionIndex].rzpyPaymnetId =
        rzpyPaymentId;
      UserWallet.transactions[currentTransactionIndex].rzpyEventId =
        rzpyIdempotency;
      UserWallet.balance += rawData.payload.payment.entity.amount / 100;
      console.log("[WH]: Updated SUCCESS transaction!");
      await UserWallet.save();
      return;
    } catch (error) {
      console.log("Webhook error");
      console.log(error);
      console.log(
        "[WH]: Failed to update wallet for: " +
          `Couldn't find user with email: ${rawData.payload.payment.entity.email}`,
      );
    }
  }

  if (rawData.event === "payment.failed") {
    try {
      // check if that wallet already has been updated because 2nd duplicate webhook take time and pass the idempotency check
      if (
        UserWallet.transactions[currentTransactionIndex].transactionStatus ===
        "failed"
      )
        return console.log(
          `[WH]: [DUPLICATE] Received webhook for ${rzpyOrderId} and updated already.`,
        );

      UserWallet.transactions[currentTransactionIndex].amount =
        rawData.payload.payment.entity.amount / 100;
      UserWallet.transactions[currentTransactionIndex].rzpyEventId =
        rzpyIdempotency;
      UserWallet.transactions[currentTransactionIndex].transactionStatus =
        "failed";
      // UserWallet.balance += req.body.data.payment.payment_amount;
      console.log("[WH]: Updated FAILED transaction!");
      await UserWallet.save();
      return;
    } catch (error) {
      console.log("[WH]: Failed to update FAILED transaction!");
    }
  }
};

exports.updateorderdetails = async (req, res) => {
  console.log("Shiprocket webhook:");
  console.log(req.body);

  res.send("OK");
  const currentTracking = req.body.scans.at(-1);
  if (!currentTracking) return;

  await OrderHistoryModel.findOneAndUpdate(
    { "orderData.shipRocketOrderId": req.body.sr_order_id },
    {
      $push: {
        "orderData.$.deliveryTracking": {
          location: currentTracking.location,
          date: new Date(currentTracking.date),
          activity: currentTracking.activity,
          status: currentTracking["sr-status-label"],
        },
      },
      $set: {
        "orderData.$.shipRocketCourier.courierAWB": req.body.awb,
      },
    },
  );
};

exports.getadminorders = async (req, res) => {
  try {
    const allOrderHistories = await OrderHistoryModel.aggregate([
      { $unwind: "$orderData" }, // Unwind the orderData array to get individual objects
      {
        $addFields: {
          "orderData.statusSortIndex": {
            $indexOfArray: [validStatusEnum, "$orderData.deliveryStatus"],
          },
        },
      },
      {
        $sort: {
          "orderData.updatedAt": -1,
          "orderData.createdAt": -1,
          "orderData.statusSortIndex": 1,
        },
      },
      { $limit: 300 },
      { $group: { _id: null, allOrderData: { $push: "$orderData" } } }, // Group all orderData arrays into a single array
      { $project: { _id: 0, allOrderData: 1 } }, // Project the result to include only the allOrderData array
    ]);

    // const data = allOrderHistories[0].allOrderData.sort(order => )
    res.json(allOrderHistories[0].allOrderData);
  } catch (error) {
    console.log("🚀 ~ exports.getadminorders= ~ error:", error);
    res.status(500).json({ error: "Server error in fetching order details!" });
  }
};

exports.getadminorder = async (req, res) => {
  const pwOrder = req.params.id;
  try {
    const orderData = await OrderHistoryModel.findOne(
      { "orderData.printwearOrderId": pwOrder },
      { userId: 1, "orderData.$": 1 },
    );
    if (!orderData)
      return res
        .status(404)
        .json({ error: `Order data for ${pwOrder} not found!` });
    const designIds = orderData.orderData[0].items.map((item) => item.designId);

    const [designsData, userData, walletData, labelData] = await Promise.all([
      await NewDesignModel.aggregate([
        {
          $match: {
            userId: orderData.userId, // Match the specific document by userId
          },
        },
        {
          $project: {
            designs: {
              $filter: {
                input: "$designs",
                as: "design",
                cond: {
                  $in: ["$$design._id", designIds],
                },
              },
            },
          },
        },
      ]),
      await UserModel.findById(orderData.userId),
      await WalletModel.findOne(
        {
          userId: orderData.userId,
          $or: [
            {
              "transactions.walletOrderId": `PAYMENT_${orderData.orderData?.[0]?.walletOrderId}`,
            },
            {
              "transactions.walletOrderId": `RESHIP_${orderData.orderData?.[0]?.printwearOrderId}_${orderData.orderData?.[0]?.walletOrderId}`,
            },
          ],
        },
        { _id: 1, "transactions.$": 1 },
      ),
      await LabelModel.findOne({ userId: orderData.userId }),
    ]);

    res.json({
      orderData: orderData.orderData[0],
      designsData: JSON.stringify(designsData),
      userData: userData,
      walletData,
      labelData,
    });
  } catch (error) {
    console.log("🚀 ~ exports.getadminorder= ~ error:", error);
    res
      .status(500)
      .json({ error: `Server error in fetching order ${pwOrder}` });
  }
};

// webhook for woocommerce to hit when order is updated
exports.updateadminorder = async (req, res) => {
  try {
    const IDsToUpdate = Array.from(new Set(req.body.ids));
    const statusToUpdate = req.body.status;
    console.log(IDsToUpdate, statusToUpdate);

    if (!validStatusEnum.includes(statusToUpdate))
      return res.status(400).json({ error: "Invalid status string" });
    if (IDsToUpdate.length < 1)
      return res.status(400).json({ error: "Empty IDs string" });
    const updatedOrderHistories = await OrderHistoryModel.updateMany(
      {
        "orderData.printwearOrderId": { $in: IDsToUpdate },
      },
      {
        $set: {
          "orderData.$[e].deliveryStatus": statusToUpdate.trim(),
        },
      },
      {
        arrayFilters: [
          {
            "e.printwearOrderId": { $in: IDsToUpdate },
          },
        ],
        multi: true,
      },
    );
    console.log(
      "🚀 ~ updated order history: ",
      updatedOrderHistories.modifiedCount,
    );
    return res.json({ message: "Bulk action was successful!" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Server error in bulk updates!" });
  }
};

exports.renderadminwallets = async (req, res) => {
  try {
    // const [ userData, walletData ] = await Promise.all([
    //   await UserModel.find(),
    //   await WalletModel.find()
    // ]);
    const walletsAndUserData = await WalletModel.aggregate([
      [
        {
          $lookup: {
            from: "users", // Name of the users collection
            localField: "userId",
            foreignField: "_id",
            as: "userData",
          },
        },
        {
          $unwind: "$userData", // Unwind the array to denormalize the data
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            balance: 1,
            "userData.name": 1,
            "userData.firstName": 1,
            "userData.lastName": 1,
            "userData.email": 1,
            "userData.phone": 1,
            "userData.billingAddress": 1,
          },
        },
      ],
    ]);
    if (walletsAndUserData.length < 1)
      throw new Error("Something went wrong with DB");
    res.render("adminwallets", { error: null, data: walletsAndUserData });
  } catch (error) {
    console.log("🚀 ~ exports.renderadminwallets ~ error:", error);
    res.render("adminwallets", {
      error: "Server error in displaying this page",
      data: null,
    });
  }
};

exports.renderadminwallet = async (req, res) => {
  try {
    const walletId = req.params.id;
    const result = await WalletModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(walletId) } },
      {
        $lookup: {
          from: "users", // Name of the User collection (use the actual collection name, usually the lowercase plural form of the model)
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: {
          path: "$userDetails",
          preserveNullAndEmptyArrays: true, // In case there are wallets without a corresponding user
        },
      },
      {
        $project: {
          _id: 1,
          balance: 1,
          userId: 1,
          transactions: 1,
          "userDetails._id": 1,
          "userDetails.name": 1,
          "userDetails.firstName": 1,
          "userDetails.lastName": 1,
          "userDetails.email": 1,
          "userDetails.phone": 1,
        },
      },
    ]);
    if (result.length < 1)
      throw new Error(`Could not find data for ${walletId}`);
    res.render("adminwallet", { error: null, data: { ...result[0] } });
  } catch (error) {
    console.log("🚀 ~ exports.renderadminwal ~ error:", error);
    res.render("adminwallet", { error: error, data: null });
  }
};

exports.renderadminqueries = async (req, res) => {
  try {
    const userQueries = await QueryModel.find(
      {},
      {},
      { sort: { createdAt: -1 } },
    );
    res.render("adminqueries", { data: { queries: userQueries, error: null } });
  } catch (error) {
    console.log("🚀 ~ exports.renderadminqueries= ~ error:", error);
    res.render("adminqueries", {
      data: { queries: null, error: "Server error in fetching details!" },
    });
  }
};

exports.markadminqueryresponse = async (req, res) => {
  try {
    const { queryId, isResponded } = req.body;
    await QueryModel.findByIdAndUpdate(queryId, {
      $set: { respondedOn: isResponded ? new Date() : null },
    });
    res.json({ message: "Response successful" });
  } catch (error) {
    console.log("🚀 ~ exports.markadminqueryresponse= ~ error:", error);
    res.status(500).json({ error: "Server error in marking response!" });
  }
};

exports.adminrefund = async (req, res) => {
  try {
    const refundData = req.body;
    const walletId = req.params.id;

    const walletData = await WalletModel.findById(walletId);
    if (!walletData)
      return res.status(404).json({ error: "Wallet could not be found!" });

    let orderHistories;

    if (refundData.orderId && refundData.orderId.length != 0) {
      orderHistories = await OrderHistoryModel.findOne({
        userId: walletData.userId,
      });
      if (!orderHistories)
        return res
          .status(404)
          .json({ error: "Order history could not be found!" });

      const orderIndex = orderHistories.orderData.findIndex(
        (order) => order.printwearOrderId == refundData.orderId.trim(),
      );
      if (orderIndex == -1) {
        return res.status(404).json({ error: "Invalid Order ID" });
      }

      // const order = orderHistories.orderData.at(orderIndex);
    }

    const walletTransactionIds = walletData.transactions.map(
      (trans) => trans.walletOrderId,
    );

    if (walletTransactionIds.includes(refundData.transactionId.trim())) {
      return res.status(404).json({
        error:
          "Transaction with same ID already found. Please enter new transaction ID",
      });
    }

    if (refundData.comments.trim().length == 0)
      return res.status(404).json({ error: "Comments cannot be empty" });

    /**
     if (parseFloat(refundData.amount) > order.amountPaid) {
 
     } 
     * i am not sure if i should perform this check, heck i should ask if the client needs to refund only for specific orders or directly send cash 
     * regardless of order id 
     */

    if (
      parseFloat(refundData.amount) > walletData.balance &&
      refundData.transactionType == "debit"
    ) {
      return res
        .status(403)
        .json({ error: "Insufficient balance in customers wallet to debit!" });
    }

    walletData.transactions.push({
      amount: refundData.amount,
      transactionType: refundData.transactionType,
      transactionNote:
        refundData.comments +
        (refundData.orderId != ""
          ? `. Transaction for ${refundData.orderId}`
          : "") +
        ". Initiated by admin",
      walletOrderId:
        refundData.transactionType == "credit"
          ? `CREDIT_${refundData.transactionId}`
          : `DEBIT_${refundData.transactionId}`,
      transactionStatus: "success",
    });

    if (refundData.transactionType == "credit") {
      walletData.balance = (
        walletData.balance + parseFloat(refundData.amount)
      ).toFixed(2);
    } else {
      walletData.balance = (
        walletData.balance - parseFloat(refundData.amount)
      ).toFixed(2);
    }

    await walletData.save({ validateBeforeSave: false });

    res.json(walletData);
  } catch (error) {
    console.log("🚀 ~ exports.adminrefund= ~ error:", error);
    res.status(500).json({ error: "Server error in issuing refund" });
  }
};

exports.admincod = async (req, res) => {
  try {
    const allOrderHistories = await OrderHistoryModel.aggregate([
      { $unwind: "$orderData" }, // Unwind the orderData array to get individual objects
      { $match: { "orderData.cashOnDelivery": true } },
      { $sort: { "orderData.createdAt": -1 } },
      { $group: { _id: null, allOrderData: { $push: "$orderData" } } }, // Group all orderData arrays into a single array
      { $project: { _id: 0, allOrderData: 1 } }, // Project the result to include only the allOrderData array
    ]);
    res.render("admincod", {
      error: null,
      data: allOrderHistories[0].allOrderData,
    });
  } catch (error) {
    console.log("🚀 ~ exports.renderadminwallets ~ error:", error);
    res.render("admincod", {
      error: "Server error in displaying this page",
      data: null,
    });
  }
};

exports.admincodremit = async (req, res) => {
  try {
    const remitData = req.body;
    console.log("🚀 ~ exports.admincodremit= ~ remitData:", remitData);

    const orderHistory = await OrderHistoryModel.findOne({
      "orderData.printwearOrderId": remitData.orderId,
    });
    if (!orderHistory) {
      return res.status(404).json({ error: "Could not find orders!" });
    }

    const orderIndex = orderHistory.orderData.findIndex(
      (order) => order.printwearOrderId == remitData.orderId,
    );

    if (orderIndex == -1)
      return res
        .status(404)
        .json({ error: "Could not find specific order details!" });

    const retail = orderHistory.orderData.at(orderIndex).retailPrice;
    const codAmount = orderHistory.orderData.at(orderIndex).CODRemittance;
    console.log(
      "🚀 ~ exports.admincodremit= ~ codAmount:",
      retail,
      codAmount,
      retail - codAmount,
    );
    if (
      retail - codAmount < remitData.remittanceAmount &&
      !orderHistory.orderData.at(orderIndex).wooOrderId
    )
      return res
        .status(400)
        .json({ error: "COD Remittance amount greater than retail price!" });

    const walletData = await WalletModel.findOne({
      userId: orderHistory.userId,
    });

    if (!walletData) {
      return res.status(404).json({ error: "Invalid customer details!" });
    }

    const transferId = otpGen.generate(10, { specialChars: false });
    // removed cashfree payout funciton as client said it was unecessary

    orderHistory.orderData.at(orderIndex).CODRemittance +=
      remitData.remittanceAmount;

    await CODModel.findOneAndUpdate(
      {
        userId: orderHistory.userId,
      },
      {
        $setOnInsert: {
          userId: orderHistory.userId,
        },
        $push: {
          remittances: {
            orderId: remitData.orderId,
            amount: remitData.remittanceAmount,
            transferId: transferId,
            completedOn: Date.now(), // --> temporary.. dont put completedon until webhook confirms the payment thing
          },
        },
      },
      { upsert: true, new: true },
    );

    walletData.transactions.push({
      amount: remitData.remittanceAmount,
      transactionType: "cod-remittance",
      transactionNote: `COD Remittance for ${remitData.orderId}`,
      transactionStatus: "success",
      walletOrderId: transferId,
    });

    walletData.balance = (
      walletData.balance + remitData.remittanceAmount
    ).toFixed(2);

    await Promise.all([
      await walletData.save({ validateBeforeSave: false }),
      await orderHistory.save({ validateBeforeSave: false }),
    ]);

    res.json({ message: "COD Remittance is successful!" });
  } catch (error) {
    if (error.response && error.response.data?.type) {
      console.log("🚀 ~ exports.admincodremit= ~ error:", error.response);
      return res
        .status(error.response.status != 200 ? error.response.status : 403)
        .json({ error: error.response.data.message });
    }
    console.log("🚀 ~ exports.admincodremit= ~ error:", error);
    res.status(500).json({ error: "Server error in remittance process" });
  }
};

exports.query = async (req, res) => {
  try {
    const content = req.body;
    console.log(content);
    if (!content.email || !content.mobile) {
      return res.status(400).json({ error: "Missing mobile or email" });
    }
    if (!content.message || content.message.length < 10)
      return res.status(400).json({ error: "Message content too small!" });
    await QueryModel.create({
      name: content.name,
      email: content.email,
      message: content.message,
      mobile: content.mobile,
    });
    res.json({ message: "Query was sent successfully!" });
  } catch (error) {
    console.log("🚀 ~ exports.query= ~ error:", error);
    res.status(500).json({
      error: "Server error in sending query. Please try again later.",
    });
  }
};
