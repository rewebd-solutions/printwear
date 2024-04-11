const cashfreeAppID = process.env.CASH_APP_ID;
const cashfreeSecretKey = process.env.CASH_SECRET_KEY;
const zohoRefreshToken = process.env.ZOHO_REFRESH_TOKEN;
const zohoClientID = process.env.ZOHO_CLIENT_ID;
const zohoClientSecret = process.env.ZOHO_CLIENT_SECRET;

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const ZOHO_INVOICE_TEMPLATE_ID = "650580000000000231";
const WOO_SANTO_URL = 'https://printwear.in/admin';
const OLD_PUBLIC_URL = "https://printwear.in/";

const imageFileSize = require("url-file-size");
const crypto = require("crypto")
const algorithm = "sha256"
const authServices = require("../services/auth");

const mongoose = require("mongoose");

var ProductModel = require('../model/productModel');
var StoreModel = require('../model/storeModel');
var UserModel = require("../model/userModel");
// var CartModel = require("../model/cartModel");
var ImageModel = require("../model/imageModel")
var ColorModel = require("../model/colorModel");
var DesignModel = require("../model/designModel");
var OrderModel = require("../model/orderModel");
var NewDesignModel = require("../model/newDesignModel");
var OrderHistoryModel = require("../model/orderHistory");
var LabelModel = require("../model/labelModel");

const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const otpGen = require("otp-generator")
const storageReference = require("../services/firebase");
const ZohoProductModel = require("../model/zohoProductModel");
const MockupModel = require("../model/mockupModel");
const WalletModel = require("../model/walletModel");

const SHIPROCKET_BASE_URL = process.env.SHIPROCKET_URL;
const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL;
const ZOHO_INVOICE_ORGANIZATION_ID = "60010804173";

// const pw_transaction_history = require("../../../.test_assets/wc-data/pw_transaction_history");
// // const pw_users = require("../../../.test_assets/wc-data/pw_users");
// const { detailedUsers } = require("../../../.test_assets/wc-data/pw_wc-users");
// // const pw_wc_customer_lookup = require("../../../.test_assets/wc-data/pw_wc_customer_lookup");
// // const brands = require("../../../.test_assets/wc-data/brands");
// // const design_library = require("../../../.test_assets/wc-data/design_library");
// // const mockup_design = require("../../../.test_assets/wc-data/mockup_design");
// // const pw_wc_product_meta = require("../../../.test_assets/wc-data/pw_wc_product_meta_lookup");
// // const pw_woocommerce_order_items = require("../../../.test_assets/wc-data/pw_woocommerce_order_items");
// // const user_designs = require("../../../.test_assets/wc-data/cart_history");
// // const pw_postmeta = require("../../../.test_assets/wc-data/pw_postmeta");
// // const pw_wc_order_stats = require("../../../.test_assets/wc-data/pw_wc_order_stats");
// const pw_wc_order_product_lookup = require("../../../.test_assets/wc-data/pw_wc_order_product_lookup");

// common auth endpoints
exports.register = async (req, res) => {

  // validate request
  if (!req.body) {
    res.status(400).send({ message: "Content can not be emtpy!" });
    return;
  }
  // new user
  let num = req.body.number;

  const existingUser = await UserModel.findOne({ name: req.body.name });
  if (existingUser) return res.render("login", { status: "User already exists" })

  try {
    const user = await UserModel.create({
      name: req.body.name,
      email: req.body.email,
      password: crypto.createHash(algorithm).update(req.body.password).digest("hex"),
      phone: '+91' + num.toString(),
      emailVerified: false,
      phoneVerified: false,
      profileImage: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png'
    });

    res.render("login", { status: "Account created. Log In" });
  } catch (error) {
    console.log(error);
    res.render("login", { status: "Error saving data, try again" })
  }
}

exports.login = async (req, res) => {
  // console.log(req.body);
  try {
    const check = await UserModel.findOne({ email: req.body.email })

    if (check === null) {
      return res.render("login", { status: "User does not exist" });
    }

    // toggle a boolean if pwd match or not
    let doPwdsMatch = check.password === crypto.createHash(algorithm).update(req.body.password).digest("hex");
    if (check.password === "RESET") doPwdsMatch = true; // TESTING ONLY!: if pwd is reset for woo, jsut let them in by toggling bool to true

    if (!doPwdsMatch) {
      return res.render("login", { status: "Invalid details" });
    }

    const wallet = await WalletModel.findOne({ userId: check._id });
    if (!wallet) {
      console.log(wallet);
      await WalletModel.findOneAndUpdate({ userId: check._id },
        {
          $setOnInsert: {
            userId: check._id
          },
          $push: {
            transactions: {
              transactionType: "recharge",
              amount: 0,
              transactionStatus: "success"
            }
          }
        },
        { new: true, upsert: true, });
    }

    const cookieToken = authServices.createToken(check._id, check.name);
    res.cookie("actk", cookieToken, {
      httpOnly: true,
      secure: true
    });

    return res.redirect("/dashboard");
  } catch (error) {
    console.log(error);
    return res.status(500).send("<h1>Internal server error couldn't log you in</h1>");
  }

}

exports.logout = async (req, res) => {
  return res.clearCookie("actk").redirect("/login");
}

exports.changepassword = async (req, res) => {
  try {
    // console.log(req.userId)
    if (req.body.newPwd !== req.body.confirmPwd) return res.status(400).json({ message: 'Passwords dont match' });
    const userProfile = await UserModel.findOneAndUpdate({ _id: req.userId, password: crypto.createHash(algorithm).update(req.body.currentPwd).digest("hex") }, { $set: { password: crypto.createHash(algorithm).update(req.body.newPwd).digest("hex") } }, { new: true });
    // console.log(req.body);
    // console.log(userProfile)
    if (!userProfile) return res.status(400).json({ message: 'Incorrect password' })
    return res.json(userProfile);
  } catch (error) {
    console.log(error);
    res.json({ error });
  }
}

exports.updateinfo = async (req, res) => {
  try {
    const { firstName, lastName, brandName } = req.body;
    const userInfo = await UserModel.findOneAndUpdate({ _id: req.userId }, { $set: { firstName: firstName, lastName: lastName, brandName: brandName } }, { new: true });
    if (!userInfo) return res.status(404).json({ message: 'User not found!' });
    res.status(200).json({ message: 'User info updated successfully!' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}

exports.deleteprofile = async (req, res) => {
  // first delete from userModel, then delete from all the records where the userId is there
  // first, for now just delete from userModel
  try {
    const userInfo = await UserModel.findOneAndDelete({ _id: req.userId, password: crypto.createHash(algorithm).update(req.body.password).digest("hex") }, { new: true });
    if (!userInfo) return res.status(400).json({ message: 'User not found / Incorrect password' });
    console.log('deleted user: ', JSON.stringify(userInfo));
    return res.clearCookie("actk").redirect("/login");
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Something went wrong!' });
  }
}

exports.profilepage = async (req, res) => {
  // write code to get req.userId and findOne and SSR the page
  const userData = await UserModel.findOne({ _id: req.userId });
  const storeData = await StoreModel.findOne({ userid: req.userId });
  // console.log(userData, storeData)
  const data = {
    userData: userData,
    storeData: storeData
  }
  res.render("profile", { data: data });
}



// for CRD on designgallery images
exports.uploadimage = async (req, res) => {
  try {
    // console.log(req.file);
    const fileBuffer = req.file.buffer;
    const fileReference = storageReference.child(`images/${req.userId + "_" + otpGen.generate(4) + "_" + req.file.originalname}`);
    await fileReference.put(fileBuffer, { contentType: 'image/png' });
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
          }
        }
      },
      { new: true, upsert: true }
    )

    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to upload image" });
  }
}

exports.obtainimages = async (req, res) => {
  const userId = req.userId;
  try {
    const imageData = await ImageModel.findOne({ userId: userId });
    res.status(200).json(imageData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}

exports.deleteimage = async (req, res) => {
  const imageId = req.body.imageId;
  // console.log(imageId);
  try {
    const imageToDelete = await ImageModel.findOne({ userId: req.userId, 'images._id': imageId }, { 'images.$': 1 });
    console.log(imageToDelete)
    if (imageToDelete.images[0].isWooDeleted === false) {
      imageToDelete.images[0].isWooDeleted = true;
      await imageToDelete.save({ validateBeforeSave: false });
      return res.status(200).json({ message: "Deleted successfully!" });
    }
    const fileReference = storageReference.child(`images/${req.userId + "_" + imageToDelete.images[0].name}`);
    await fileReference.delete();

    await ImageModel.findOneAndUpdate(
      {
        userId: req.userId
      },
      {
        $pull: {
          images: {
            _id: imageId
          }
        }
      }
    )
    res.status(200).json({ message: "Deleted successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }

}


// for adding products and getting products data
exports.addproduct = async (req, res) => {
  const productData = req.body;

  const mockData = { // this mockData should be parsed from the req.body and not hard coded
    colors: [
      {
        colorName: "white",
        colorSKU: "WHT",
        colorCode: "#fff",
        colorImage: {
          front: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Fhoodiemalefrontwhite.png?alt=media&token=6b8377cc-7820-4510-ad56-6a48b9d5b254",
          back: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Fhoodiemalebackwhite.png?alt=media&token=7d3ec7ea-6860-4fb9-81e4-82c8f514618e"
        },
        sizes: [
          {
            sizeSKU: "SM",
            size: "S",
            stock: 3
          },
          {
            sizeSKU: "MD",
            size: "M",
            stock: 9
          },
          {
            sizeSKU: "LG",
            size: "L",
            stock: 10
          },
        ]
      },
      {
        colorName: "black",
        colorSKU: "BLK",
        colorCode: "#313131",
        colorImage: {
          front: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Fhoodiemalefrontblack.png?alt=media&token=8500e6ef-77fc-4449-8044-45b5ba248c45",
          back: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Fhoodiemalebackblack.png?alt=media&token=b8f3c471-a0d9-4999-966e-a89e87b6b476"
        },
        sizes: [
          {
            sizeSKU: "XSM",
            size: "XS",
            stock: 10
          },
          {
            sizeSKU: "SM",
            size: "S",
            stock: 7
          },
          {
            sizeSKU: "MD",
            size: "M",
            stock: 6
          }
        ],

      },
      {
        colorName: "red",
        colorSKU: "RED",
        colorCode: "#f24660",
        colorImage: {
          front: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Fhoodiemalefrontred.png?alt=media&token=fe6afdd3-eacf-47a3-8814-8113b3b78971",
          back: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Fhoodiemalebackred.png?alt=media&token=67474d4f-e96c-4e8e-919b-91725d58689b"
        },
        sizes: [
          {
            sizeSKU: "SM",
            size: "S",
            stock: 4
          },
          {
            sizeSKU: "MD",
            size: "M",
            stock: 9
          },
          {
            sizeSKU: "LG",
            size: "L",
            stock: 0
          }
        ],

      },
    ],
    product: {
      SKU: "HOOD",
      name: "Test Hoodie",
      category: "Hoodies",
      gender: "M",
      description: "This is a test hoodie that is currently used for testing purposes",
      productImage: {
        front: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Fhoodiemalefrontwhite.png?alt=media&token=6b8377cc-7820-4510-ad56-6a48b9d5b254",
        back: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Fhoodiemalebackwhite.png?alt=media&token=7d3ec7ea-6860-4fb9-81e4-82c8f514618e",
      },
      price: {
        xs: 400,
        s: 450,
        m: 500,
        l: 550,
        xl: 600
      },
      colors: [],
      canvas: {
        front: {
          startX: 524,
          startY: 359,
          width: 490,
          height: 950
        },
        back: {
          startX: 245,
          startY: 163,
          width: 230,
          height: 450
        }
      }
    }
  }

  const productSave = new ProductModel(mockData.product);
  // console.log(productSave);
  for (let colorEntry of mockData.colors) {
    let colorData = new ColorModel(colorEntry);
    colorData.productId = productSave._id;
    productSave.colors.push(colorData._id)
    await colorData.save();
    // console.log(productSave);
  }
  await productSave.save();
  res.status(200).send("ok");
}

exports.getproducts = async (req, res) => {
  try {
    const productData = await ProductModel.find();
    const colorsData = {};

    for (let products of productData) {
      colorsData[products._id] = await ColorModel.find({ productId: products._id });
    }
    // console.log(productData, colorsData);
    res.status(200).json({
      productData,
      colorsData
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("error");
  }

}

exports.getproduct = async (req, res) => {
  console.log(req.params.id);
  try {
    const productData = await ProductModel.findOne({ _id: req.params.id });
    const colorsData = await ColorModel.find({ productId: productData._id });
    res.status(200).json({
      productData,
      colorsData
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "Product not found!" });
  }

}


// endpoint for adding design
exports.adddesign = async (req, res) => {
  const reqBody = req.body;
  const frontImage = reqBody.frontImage.substring(reqBody.frontImage.indexOf(',') + 1);
  const backImage = reqBody.backImage.substring(reqBody.backImage.indexOf(',') + 1);
  // check if color is null.. if null, then white only.. also for now obtain from req param of client
  try {
    const frontImageReference = storageReference.child(`designs/${req.userId}_${reqBody.designName || "My_design"}_front_${otpGen.generate(4, { digits: true })}.png`);
    await frontImageReference.putString(frontImage, 'base64', { ContentType: 'image/png' });
    const frontImageDownloadURL = await frontImageReference.getDownloadURL();

    const backImageReference = storageReference.child(`designs/${req.userId}_${reqBody.designName || "My_design"}_back_${otpGen.generate(4, { digits: true })}.png`);
    await backImageReference.putString(backImage, 'base64', { ContentType: 'image/png' });
    const backImageDownloadURL = await backImageReference.getDownloadURL();

    // console.log(frontImageDownloadURL, backImageDownloadURL);
    const designData = new DesignModel({
      designName: reqBody.designName || "My_design",
      baseProductId: reqBody.productId,
      color: reqBody.color,
      designImage: {
        front: frontImageDownloadURL,
        back: backImageDownloadURL
      },
      createdBy: req.userId
    });
    await designData.save();
    res.status(200).json(designData);
  } catch (error) {
    console.log(error)
    res.status(500).json({ error });
  }
}



// deleted old commented code for old schema
// utils 
const formatDate = (date, removeLast = false) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding 1 to month since it's zero-based
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return removeLast ? `${year}-${month}-${day}` : `${year}-${month}-${day} ${hours}:${minutes}`;
}
const slugify = str => str.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
const generateShiprocketToken = async () => {
  try {
    const shiprocketTokenRequest = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      body: JSON.stringify({
        "email": process.env.SHIPROCKET_EMAIL,
        "password": process.env.SHIPROCKET_SECRET
      })
    });
    const shiprocketTokenResponse = await shiprocketTokenRequest.json();
    return shiprocketTokenResponse;
  } catch (error) {
    console.log(error);
    return;
  }
}
const generateZohoToken = async () => {
  try {
    const zohoAccRequest = await fetch(`https://accounts.zoho.in/oauth/v2/token?refresh_token=${zohoRefreshToken}&client_id=${zohoClientID}&client_secret=${zohoClientSecret}&grant_type=refresh_token`, { method: "POST" });
    const zohoAccResponse = await zohoAccRequest.json();
    // console.log(zohoAccResponse);
    const zohoAPIAccessToken = zohoAccResponse.access_token;
    return zohoAPIAccessToken;
  } catch (error) {
    console.log(error);
    return false;
  }
}
//implement idempotency:
var idempotencyKeys = new Set();
function clearIdempotencyKeys() {
  setTimeout(() => {
    console.log(idempotencyKeys);
    idempotencyKeys.clear();
    console.log(idempotencyKeys);
  }, 1000 * 60 * 2);
}



// endpoints for querying shopify stores
exports.getstoredetails = async (req, res) => {
  try {
    const userId = req.userId;
    const shopifyStoreDetails = await StoreModel.findOne({ userid: userId });
    if (!shopifyStoreDetails) return res.status(404).json({ message: `Store data not found for ${req.userName}` });

    res.json({ shopify: shopifyStoreDetails.shopifyStore, woo: shopifyStoreDetails.wooCommerceStore });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error in fetching details!" });
  }
}

exports.getshopifystock = async (req, res) => {
  try {
    const userId = req.userId;

    const shopifyStoreDetails = await StoreModel.findOne({ userid: userId }, 'shopifyStore');
    const shopifyStoreData = shopifyStoreDetails.shopifyStore

    var shopifyShopStockData = [];

    // remove this one by one method and use only Promise.all method
    for (let store of shopifyStoreData) {
      const SHOPIFY_ACCESS_TOKEN = store.shopifyAccessToken;
      const SHOPIFY_SHOP_URL = store.shopifyStoreURL;
      const SHOPIFY_SHOP_NAME = store.shopName;

      const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2023-07/products.json?fields=id,title,vendor,product_type,tags,variants,options`;

      try {
        const shopifyStoreStockRequest = await fetch(shopifyEndpoint, {
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
          }
        })
        const shopifyStoreStockResponse = await shopifyStoreStockRequest.json();
        shopifyShopStockData.push({
          shopName: SHOPIFY_SHOP_NAME,
          products: shopifyStoreStockResponse.products.filter(product => product.product_type === 'tshirt').map(product => {
            return {
              id: product.id,
              name: product.title,
              tags: product.tags,
              // colors: product.options.find(option => option.name === 'Color'),
              variants: product.variants
            }
          })
        });
      } catch (error) {
        console.log(error);
        shopifyShopStockData.push({
          shopName: SHOPIFY_SHOP_NAME,
          error
        });
      }
    }
    res.json(shopifyShopStockData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}

exports.getshopifyorders = async (req, res) => {
  try {
    const userId = req.userId;
    // const userId = "64f175edd683cd124e440f23";

    const [storeDetails, designDetails] = await Promise.all([
        StoreModel.findOne({ userid: userId }),
        NewDesignModel.findOne({ userId: userId })
    ]);

    const allSKUs = designDetails.designs.map(design => design.designSKU);

    const shopifyStoreData = storeDetails.shopifyStore;

    const SHOPIFY_ACCESS_TOKEN = shopifyStoreData.shopifyAccessToken;
    const SHOPIFY_SHOP_URL = shopifyStoreData.shopifyStoreURL;
    const SHOPIFY_SHOP_NAME = shopifyStoreData.shopName;

    const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2023-07/orders.json`;

    const shopifyStoreOrderRequest = await fetch(shopifyEndpoint, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
      }
    })
    const shopifyStoreOrderResponse = await shopifyStoreOrderRequest.json();
    // console.log("🚀 ~ exports.getshopifyorders= ~ shopifyStoreOrderResponse:", shopifyStoreOrderResponse)
    const dataToSend = shopifyStoreOrderResponse.orders.filter(order => 
      order.line_items.filter(item => allSKUs.includes(item.sku)).length > 0
    )
    // console.log("🚀 ~ exports.getshopifyorders= ~ dataToSend:", dataToSend)
    res.json({ shopify: dataToSend });
    
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in fetching Shopify order data" });
  }
}

exports.getwooorders = async (req, res) => {
  try {
    const userId = req.userId;
    // const userId = "64f175edd683cd124e440f23";

    const [storeDetails, designDetails] = await Promise.all([
      StoreModel.findOne({ userid: userId }),
      NewDesignModel.findOne({ userId: userId }),
    ]);
    
    const allSKUs = designDetails.designs.map((design) => design.designSKU);
    // console.log("🚀 ~ exports.getwooorders= ~ allSKUs:", allSKUs)

    const wooCommerceStoreData = storeDetails.wooCommerceStore;
    
    if (!wooCommerceStoreData) return res.status(404).json({ message: 'No WooCommerce store found!' })
    
    const WOOCOMMERCE_SHOP_URL = wooCommerceStoreData.url;
    const WOOCOMMERCE_CONSUMER_KEY = wooCommerceStoreData.consumerKey;
    const WOOCOMMERCE_CONSUMER_SECRET = wooCommerceStoreData.consumerSecret;
    
    try {
      const encodedAuth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
      const endpoint = `https://${WOOCOMMERCE_SHOP_URL}/wp-json/wc/v3/orders`;
      const wooOrderRequest = await fetch(endpoint, {
        headers: {
          'Authorization': 'Basic ' + encodedAuth
        },
      });
      const wooOrderResponse = await wooOrderRequest.json();
      // console.log("🚀 ~ exports.getwooorders= ~ wooOrderResponse:", wooOrderResponse)
      
      const dataToSend = wooOrderResponse.filter(
        (order) =>
          order.line_items.filter((item) => allSKUs.includes(item.sku)).length > 0
      );
      // console.log("🚀 ~ exports.getwooorders= ~ dataToSend:", dataToSend)

      res.json({ woo: dataToSend });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Server error in fetching WooCommerce Orders!" });
    }

  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}



// zoho inventory hitting
exports.getZohoProductsFromInventory = async (req, res) => {
  try {
    // get acctkn then hit the API
    const zohoAccRequest = await fetch(`https://accounts.zoho.in/oauth/v2/token?refresh_token=${zohoRefreshToken}&client_id=${zohoClientID}&client_secret=${zohoClientSecret}&grant_type=refresh_token`, { method: "POST" });
    const zohoAccResponse = await zohoAccRequest.json();
    // console.log(zohoAccResponse);
    const zohoAPIAccessToken = zohoAccResponse.access_token;

    const zohoInventoryItemsResponse = { items: [] }

    const pagePromises = [1, 2, 3, 4, 5].map(async page => {
      const zohoInventoryItemsRequest = await fetch(`https://www.zohoapis.in/inventory/v1/items?organization_id=60010804173&page=${page}&per_page=400`, {
        headers: {
          'Authorization': 'Zoho-oauthtoken ' + zohoAPIAccessToken
        }
      })
      return zohoInventoryItemsRequest.json()
    })

    // regex pattern string arrays
    const shirtFilterKeywords = [
      "bw mens",
      "bw womens",
      "hoodie",
      "hoodies",
      "kids half sleeve",
      "men oversized",
      "men rn",
      "mens rn",
      "mens round neck",
      "mens full sleeve",
      "mens half sleeve",
      "mens oversize",
      "mens raglan sleeve",
      "oversize tees",
      "oversized t-shirt",
      "polo",
      "sweatshirts",
      "women boyfriend",
      "womens boyfriend",
      "womens 3/4",
      "womens half sleeve",
      "womens raglan sleeve",
      "womens rn",
      "work wear polo",
      "workwear polo",
    ];
    const colorFilterKeywords = [
      "black",
      "pink",
      "charcoal melange",
      "ecru melange",
      "grey melange",
      "mustard yellow",
      "navy blue",
      "red",
      "white",
      "army green",
      "royal blue",
      "maroon",
      "lemon yellow",
      "olive green",
      "leaf green",
      "beige",
      "yellow",
      "navy",
      "turquoise blue",
      "turquoise",
      "turcoise blue",
      "chocolate brown",
      "sky blue",
      "bottle green",
      "iris lavender"
    ]
    const colorHexCodes = {
      "black": "#000000",
      "pink": "#ffb6c1",
      "charcoal melange": "#464646",
      "ecru melange": "#F5F5DC",
      "grey melange": "#808080",
      "mustard yellow": "#FFDB58",
      "navy blue": "#000080",
      "red": "#FF0000",
      "white": "#FFFFFF",
      "army green": "#4B5320",
      "royal blue": "#4169E1",
      "maroon": "#800000",
      "lemon yellow": "#FFF44F",
      "olive green": "#556B2F",
      "leaf green": "#228B22",
      "beige": "#F5F5DC",
      "yellow": "#FFFF00",
      "navy": "#000080",
      "turquoise": "#40E0D0",
      "turcoise blue": "#00FFEF",
      "turquoise blue": "#40e0d0",
      "chocolate brown": "#7B3F00",
      "sky blue": "#87CEEB",
      "bottle green": "#006A4E",
      "iris lavender": "#897CAC"
    };
    const sizeFilterKeywords = [
      "xs",
      "s",
      "m",
      "l",
      "xl",
      "2xl",
      "3xl",
      "4xl",
      "5xl",
      "6xl",
      "0-1yrs",
      "12-13yrs",
      "10-11yrs",
      "14-15yrs",
      "16-17yrs",
      "2-3yrs",
      "3-4years",
      "4-5yrs",
      "5-6yrs",
      "6-7yrs",
      "8-9yrs",
      "9-10yrs",
      "10-11yrs",
      "11-12yrs",
      "12-13yrs",
      "13-14yrs",
      "14-15yrs",
      "15-16yrs",
      "16-17yrs",
    ]
    const dressFilterKeywords = ["shirt", "shirts", "men", "mens", "hoodie", "hoodies", "kid", "kids", "women", "womens", "tees", "tee", "polo"];

    const colorPattern = new RegExp(colorFilterKeywords.join('|'), 'i');
    const shirtPattern = new RegExp(shirtFilterKeywords.join('|'), 'i');
    const sizePattern = new RegExp(sizeFilterKeywords.join('|'), 'i');

    const imageNames = await storageReference.child("products/").listAll();
    const imageURLs = imageNames.items.map(item => ({
      image: item._delegate._location.path_.split("/")[1].toLowerCase(),
      url: Promise.resolve(item.getDownloadURL())
    }));
    const imageURLsPromise = imageURLs.map(url => url.url);

    const URLResults = await Promise.all(imageURLsPromise);
    URLResults.forEach((result, i) => {
      imageURLs[i].url = result
    })

    Promise.allSettled(pagePromises).then(results => {
      var categorizedProducts = {};
      var filterArray = {};
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          zohoInventoryItemsResponse.items.push(...result.value.items)

          // filtering out only valid items and only having necessary fields for each item
          zohoInventoryItemsResponse.items = zohoInventoryItemsResponse.items.map(item => {
            if (dressFilterKeywords.some(keyword => item.item_name.toLowerCase().includes(keyword))) return {
              item_name: item.item_name,
              actual_available_stock: item.actual_available_stock,
              brand: item.brand,
              image_document_id: item.image_document_id,
              item_id: item.item_id,
              item_name: item.item_name,
              manufacturer: item.manufacturer,
              sku: item.sku,
              purchase_rate: item.purchase_rate,
              rate: item.rate,
              decription: item.description,
              group: item.group_name
            }
          })

          // filter null products
          zohoInventoryItemsResponse.items = zohoInventoryItemsResponse.items.filter(product => {
            if (product != null) return product
          });

          // apply categorization for each product
          zohoInventoryItemsResponse.items.forEach((product, i) => {

            const { item_name, item_id, actual_available_stock, purchase_rate, sku, brand, manufacturer, description, group } = product;
            const splitItemName = item_name.split(/\s*[- ]\s*/);

            // Use the regular expression to find matching colors in the item_name
            let colorMatches = item_name.toLowerCase().match(colorPattern);
            let shirtMatches = item_name.toLowerCase().match(shirtPattern);
            let sizeMatches = splitItemName[splitItemName.length - 1].toLowerCase().match(sizePattern);
            if (shirtMatches && shirtMatches[0] === "kids half sleeve") sizeMatches = item_name.split(" - ")[1].toLowerCase().match(sizePattern);

            // if size and shirt matches, then
            if (colorMatches && shirtMatches && sizeMatches) {

              sizeMatches.forEach((sizeMatch) => {
                const size = shirtMatches[0] === "kids half sleeve" ? sizeMatch : splitItemName[splitItemName.length - 1];
                const style = shirtMatches ? item_name.substring(shirtMatches.index, shirtMatches[0].length) : null;
                const color = colorMatches ? colorMatches[0].split(" ").map(colorWord => colorWord[0].toUpperCase() + colorWord.substring(1,)).join(' ') : 'color';
                const colorCode = colorHexCodes[colorMatches ? colorMatches[0] : 'white'];

                if (!style) return;

                // Create the nested structure if it doesn't exist
                if (!categorizedProducts[style]) {
                  categorizedProducts[style] = {
                    brand,
                    manufacturer,
                    description: description ?? 'Item available for designing',
                    group: group ? group.split(" ")[0] : 'Ungrouped',
                    baseImage: {
                      front: '',
                      back: ''
                    },
                    colors: {},
                    canvas: {
                      front: {
                        startX: 0,
                        startY: 0,
                        width: 13,
                        height: 18,
                      },
                      back: {
                        startX: 0,
                        startY: 0,
                        width: 13,
                        height: 18,
                      },
                    },
                  };
                }

                if (!categorizedProducts[style]['colors'][color]) {
                  categorizedProducts[style].colors[color] = {
                    frontImage: '',
                    backImage: '',
                    colorCode,
                    sizes: {}
                  };
                }

                // Update the stock quantity for the specific size and color
                categorizedProducts[style].colors[color].sizes[size] = {
                  id: item_id,
                  name: item_name,
                  stock: actual_available_stock,
                  price: purchase_rate,
                  sku: sku,
                  dimensions: {
                    //Added extra data
                    length: 28, //inches
                    chest: 38, //inches
                    sleeve: 7.5, //inches
                    weight: 0.5, //kilograms
                  }
                };
              });
            }
          });

        } else {
          console.log(result.reason);
          categorizedProducts['error'] = result.reason;
        };
      });

      // grouping logical products together
      if (categorizedProducts["MENS ROUND NECK"]) categorizedProducts["MENS ROUND NECK"].colors = { ...categorizedProducts["MENS ROUND NECK"].colors, ...categorizedProducts["MENS RN"].colors, ...categorizedProducts["MEN RN"].colors }
      if (categorizedProducts["MENS RN"]) delete categorizedProducts["MENS RN"];
      if (categorizedProducts["MEN RN"]) delete categorizedProducts["MEN RN"];
      if (categorizedProducts["HOODIE"]) delete categorizedProducts["HOODIE"];
      if (categorizedProducts["POLO"]) delete categorizedProducts["POLO"];
      if (categorizedProducts["Women Boyfriend"]) delete categorizedProducts["Women Boyfriend"]

      // creating regex pattern to match and find cloud image product with colors
      const colorPatterns = {};
      Object.keys(categorizedProducts).forEach(key => {
        colorPatterns[key] = new RegExp(Object.keys(categorizedProducts[key].colors).join("|"), "i");
      })

      // iterate thru each pattern and find the style and color match
      Object.keys(colorPatterns).forEach(item => {
        imageURLs.forEach((imageURL, i) => {
          let nameMatch = imageURL.image.toLowerCase().match(new RegExp(item, "i"))
          let colorMatch = imageURL.image.toLowerCase().split("-").join(" ").match(colorPatterns[item])

          if (nameMatch && colorMatch) {
            let specificSelection = categorizedProducts[item]
            let specificSelectedProduct = specificSelection.colors[Object.keys(specificSelection.colors).find(x => x.toLowerCase() === colorMatch[0])];

            // match pattern la back irundhuchuna, then i assign backimage else frontimage
            if (colorMatch.input.split(/[ .]/)[colorMatch.input.split(/[ .]/).length - 2] === "back")
              specificSelectedProduct.backImage = imageURL.url;
            else specificSelectedProduct.frontImage = imageURL.url;

            // overall style baseimage
            specificSelection.baseImage.front = specificSelectedProduct.frontImage;
            specificSelection.baseImage.back = specificSelectedProduct.backImage;
          }
        });

      })
      res.json(categorizedProducts);
    })

  } catch (error) {
    console.log(error);
    res.json({ error });
  }
}

exports.getZohoProductGroups = async (req, res) => {
  try {
    // get acctkn then hit the API
    const zohoAccRequest = await fetch(`https://accounts.zoho.in/oauth/v2/token?refresh_token=${zohoRefreshToken}&client_id=${zohoClientID}&client_secret=${zohoClientSecret}&grant_type=refresh_token`, { method: "POST" });
    const zohoAccResponse = await zohoAccRequest.json();
    console.log(zohoAccResponse);
    const zohoAPIAccessToken = zohoAccResponse.access_token;

    const zohoInventoryItemGroupsRequest = await fetch(`https://www.zohoapis.in/inventory/v1/itemgroups?organization_id=60010804173`, {
      headers: {
        'Authorization': 'Zoho-oauthtoken ' + zohoAPIAccessToken
      }
    });
    const zohoInventoryItemGroupsResponse = await zohoInventoryItemGroupsRequest.json();
    res.json(zohoInventoryItemGroupsResponse);
  } catch (error) {
    console.log(error);
    res.json({ error });
  }
}


// endpoints for uploading design images
exports.createdesign = async (req, res) => {
  try {
    // console.log(req.file);
    const fileBuffer = req.files[0].buffer;
    // console.log(fileBuffer);

    // return res.json({ message: "OK" });
    // explicitly parsing JSON here because FormData() cannot accept Objects, so from client Object was stringified
    req.body.productData = JSON.parse(req.body.productData)

    let uniqueSKU = req.body.productData.product.SKU + "-" + (req.body.productData.designSKU != '' ? req.body.productData.designSKU : otpGen.generate(5, { lowerCaseAlphabets: false, specialChars: false }));
    // console.log(uniqueSKU);
    // console.log(req.body.designImageURL)

    // this is the old method where all the client images get sent to the server and everything is uploaded
    // but since, they changed it to have only one image, that too from already uploaded ones, i need not upload it again
    // hence comment the below block and write logic to find the image reference from images collection and put the URL alone here
    // no need to find reference as i can send the URL from client directly!!!

    // for(let file of fileBuffer) {
    const fileReference = storageReference.child(`designs/${req.userId + "_" + req.body.productData.designName + "_" + uniqueSKU}.png`);
    await fileReference.put(fileBuffer, { contentType: 'image/png' });
    const fileDownloadURL = await fileReference.getDownloadURL();
    //   recordOfFileNames[file.originalname] = fileDownloadURL;
    // }
    const designImageHeight = req.body.productData.designDimensions.height;
    const designImageWidth = req.body.productData.designDimensions.width;

    const designSave = await NewDesignModel.findOneAndUpdate(
      { userId: req.userId },
      {
        $push: {
          designs: {
            productId: req.body.productData.productId,
            product: { ...req.body.productData.product },
            designSKU: uniqueSKU,
            designName: req.body.productData.designName,
            price: parseFloat((req.body.productData.product.price + ((designImageHeight <= 8.0 && designImageWidth <= 8.0) ? 70.00 : ((req.body.productData.price * 2) < 70.00 ? 70.00 : (req.body.productData.price * 2))) + (req.body.neckLabel == 'null' ? 0 : 10)).toFixed(2)),
            designDimensions: { ...req.body.productData.designDimensions },
            designImage: {
              front: req.body.direction === "front" && fileDownloadURL,
              back: req.body.direction === "back" && fileDownloadURL,
            },
            designItems: [{
              itemName: req.body.designImageName,
              URL: req.body.designImageURL
            }],
            neckLabel: req.body.neckLabel == 'null' ? undefined : req.body.neckLabel
          }
        }
      },
      { upsert: true, new: true }
    )

    console.log(req.userName + " saved design");
    res.status(200).json(designSave);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error in creating new design" });
  }
}

exports.deletedesign = async (req, res) => {
  try {
    const userDesigns = await NewDesignModel.findOneAndUpdate({ userId: req.userId }, { $pull: { designs: { designSKU: req.body.designSKU } } });
    // console.log(userDesigns);
    res.send("OK");
  } catch (error) {
    console.log(error);
    res.status(500).send({ error });
  }
}

exports.getdesigns = async (req, res) => {
  try {
    const userDesigns = await NewDesignModel.findOne({ userId: req.userId });
    if (!userDesigns) return res.json({ designs: [] })
    res.json(userDesigns);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}


// create shopify product
exports.createshopifyproduct = async (req, res) => {
  const shopifyStoreData = await StoreModel.findOne({ userid: req.userId });
  if (!shopifyStoreData) return res.status(400).json({ error: 'Shopify store not connected' });
  const designData = (await NewDesignModel.findOne({ userId: req.userId })).designs.find(design => design.designSKU === req.body.designSKU)

  try {
    const SHOPIFY_ACCESS_TOKEN = shopifyStoreData.shopifyStore?.shopifyAccessToken;
    const SHOPIFY_SHOP_URL = shopifyStoreData.shopifyStore?.shopifyStoreURL;
    const SHOPIFY_SHOP_NAME = shopifyStoreData.shopifyStore?.shopName;
    // console.log(SHOPIFY_ACCESS_TOKEN + SHOPIFY_SHOP_URL)

    const productData = {
      title: designData.designName,
      product_type: 'tshirt',
      tags: ['printwear', 'custom', 'designer'],
      body_html: "<strong>" + designData.product.name + "</strong>",
      vendor: "Printwear",
      options: [
        {
          name: 'Size',
          values: [designData.product.size]
        },
        {
          name: 'Color',
          color: [designData.product.color]
        }
      ],
      variants: [
        {
          title: designData.product.size + ' / ' + designData.product.color,
          sku: designData.designSKU,
          price: (req.body.price > designData.price) ? req.body.price: designData.price.toFixed(2),
          option1: designData.product.size,
          option2: designData.product.color,
          requires_shipping: true
        }
      ],
      images: [
        {
          src: designData.designImage.front ?? designData.designImage.back
        }
      ]
    }

    const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2023-07/products.json`

    const shopifyProductCreateRequest = await fetch(shopifyEndpoint, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: JSON.stringify({
        product: productData
      })
    });
    const shopifyProductCreateResponse = await shopifyProductCreateRequest.json();

    if (shopifyProductCreateRequest.ok) {
      await NewDesignModel.findOneAndUpdate({ userId: req.userId, 'designs.designSKU': req.body.designSKU }, { $set: { 'designs.$.isAddedToShopify': true } })
      res.status(200).json({ message: "Added to shopify" })
    }

  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }

}
//create woo commerce product
exports.createwoocommerceorder = async (req, res) => {
  const storeData = await StoreModel.findOne({ userid: req.userId });
  // console.log(storeData.wooCommerceStore);
  if (!(storeData.wooCommerceStore.url)) return res.status(404).json({ error: "WooCommerce store not connected!" });
  const designData = (await NewDesignModel.findOne({ userId: req.userId })).designs.find(design => design.designSKU === req.body.designSKU)

  const consumerKey = storeData.wooCommerceStore.consumerKey;
  const consumerSecret = storeData.wooCommerceStore.consumerSecret;
  const shopURL = storeData.wooCommerceStore.url;

  const encodedAuth = btoa(`${consumerKey}:${consumerSecret}`);
  console.log(designData.designImage.front == "false" ? designData.designImage.back : designData.designImage.front)
  // const encodedAuthBuffer = Buffer.from(`${consumerKey}:${consumerSecret}`, 'base64');
  // const encodedAuth = encodedAuthBuffer.toString('base64')

  const endpoint = `https://${shopURL}/wp-json/wc/v3/products`;

  const productData = {
    name: designData.designName,
    slug: slugify(designData.designName),
    type: "simple",
    status: "publish",
    regular_price: ((req.body.price > designData.price) ? (req.body.price + ''): (designData.price + '')),
    sale_price: ((req.body.price > designData.price) ? (req.body.price + ''): (designData.price + '')),
    sku: req.body.designSKU,
    description: designData.description || 'User generated design',
    short_description: designData.product.name,
    dimensions: {
      length: designData.product.dimensions.length + '',
      width: designData.product.dimensions.chest + '',
    },
    images: [
      {
        src: designData.designImage.front == "false" ? designData.designImage.back : designData.designImage.front,
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
        options: [
          designData.product.color
        ],
      },
      {
        id: 1,
        name: "Size",
        position: 0,
        visible: true,
        variation: true,
        options: [
          designData.product.size
        ],
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

    await NewDesignModel.findOneAndUpdate({ userId: req.userId, 'designs.designSKU': req.body.designSKU }, { $set: { 'designs.$.isAddedToWoocommerce': true } })
    if (createWooProductResponse.data?.status && createWooProductResponse.data.status != 200) {
      res.status(createWooProductResponse.data.status).json({ message: createWooProductResponse.message });
      return console.log("Uploaded failed");
    }
    if (createWooProductRequest.ok) return res.json({ message: "Created successfully. WooCommerce ID: " + createWooProductResponse.id })

  } catch (err) {
    console.error(err);
    res.status(500).json({ err });
  }
};


// temp for creating zoho products, disable in prod
exports.createZohoProducts = async (req, res) => {
  const dataToPut = require("../../.test_assets/zohoproductdata")['zohoData']
  const zohoProductsData = Object.keys(dataToPut).map(dataItem => ({ style: dataItem, ...dataToPut[dataItem] }))
  // res.json(zohoProductsData);
  try {
    const created = await ZohoProductModel.create(zohoProductsData);
    // const created = await ZohoProductModel.deleteMany({});
    res.json(created);
  } catch (error) {
    res.json({ error })
  }
}

// actual endpoint to fetch zoho products from mongoDB
exports.getZohoProducts = async (req, res) => {
  try {
    const zohoProductsData = await ZohoProductModel.find({});
    const zohoProductObjects = {};
    zohoProductsData.forEach(product => zohoProductObjects[product.style] = product)
    res.json(zohoProductObjects);
  } catch (error) {
    console.log(error);
    res.json({ error });
  }
}


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
      name, description, product, image, canvas
    });
    res.json(mockupsData);
  } catch (error) {
    res.status(500).json({ error })
  }
}

exports.getmockups = async (req, res) => {
  try {
    const mockupsData = await MockupModel.find({});
    const productData = await ZohoProductModel.find({});
    // console.log(productData)
    mockupsData.forEach(mockup => {
      // console.log(productData.find(product => product._id + "" === mockup.product + ""))
      mockup.product = productData.find(product => product._id + "" === mockup.product + "")
    })
    res.status(200).json(mockupsData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}


// endpoints for creating order
exports.createorder = async (req, res) => {
  try {
    const orderExists = await OrderModel.findOne({ userId: req.userId, 'items.designId': req.body.designId });
    if (orderExists) return res.status(400).json({ message: 'Item already in cart' })
    let orderData = await OrderModel.findOne({ userId: req.userId });

    if (orderData) {
      orderData.items.push({
        designId: req.body.designId,
        productId: req.body.productId,
        price: req.body.price
      });
      let totalCost = orderData.items.reduce((total, item) => total + item.price, 0).toFixed(2);
      orderData.totalAmount = totalCost
      orderData.printwearOrderId = otpGen.generate(6, { digits: true, lowerCaseAlphabets: false, specialChars: false });
      orderData.taxes = (totalCost * 0.05).toFixed(2);
      await orderData.save();
    } else {
      const newOrder = new OrderModel({
        userId: req.userId,
        items: [{
          designId: req.body.designId,
          productId: req.body.productId,
          price: req.body.price
        }],
        totalAmount: req.body.price,
        taxes: (parseFloat(req.body.price) * 0.05).toFixed(2),
        printwearOrderId: otpGen.generate(6, { digits: true, lowerCaseAlphabets: false, specialChars: false })
      });
      await newOrder.save();
      orderData = newOrder;
    }
    // console.log(orderData);
    res.json(orderData)
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}

exports.getorders = async (req, res) => {
  try {
    const orderData = await OrderModel.findOne({ userId: req.userId });
    // console.log(req.userId, orderData)
    if (!orderData) return res.status(404).json({ message: 'No orders yet!' });
    const designsFromOrders = orderData.items.map(item => item.designId);
    // console.log(designsFromOrders);
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
              input: '$designs',
              as: 'design',
              cond: {
                $in: ['$$design._id', designsFromOrders.map(id => new mongoose.Types.ObjectId(id))],
              },
            },
          },
        },
      },
    ]);
    // console.log(designsData)
    res.json({ orderData, designsData });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching order data' });
  }
}

exports.deleteorderitem = async (req, res) => {
  try {
    // console.log(req.body.designId)
    const orderData = await OrderModel.findOne({ userId: req.userId });
    if (!orderData) return res.status(400).json({ message: "Couldn't find item" });

    orderData.items = orderData.items.filter(item => item.designId + "" != req.body.designId);
    orderData.totalAmount = orderData.items.reduce((total, item) => total + item.price, 0);
    await orderData.save();

    res.json(orderData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}

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
    // console.log(req.body)
    const orderData = await OrderModel.findOne({ userId: req.userId, 'items.designId': req.body.designId });
    if (!orderData) return res.status(400).json({ message: "Coulnd't find order" });

    const currentItem = orderData.items.findIndex(item => item.designId + "" == req.body.designId);

    if (!orderData) return res.status(400).json({ message: "Coulnd't find item" });

    orderData.items[currentItem].quantity = req.body.quantity;
    orderData.items[currentItem].price = req.body.price * req.body.quantity;

    orderData.totalAmount = orderData.items.reduce((total, item) => total + item.price, 0).toFixed(2);
    orderData.taxes = orderData.totalAmount * 0.05;

    await orderData.save();

    res.json({ totalPrice: orderData.totalAmount });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: '500 Internal Server Error' });
  }
}


// endpoints for connecting stores
const SHOPIFY_ACCESS_SCOPES = ["read_orders","read_products","write_products","write_product_listings","read_product_listings","read_all_orders"];
exports.connectShopify = async (req, res) => {
  const reqBody = req.body;
  // console.log(req.userId);
  const SHOPIFY_ACCESS_TOKEN = reqBody.access_token;
  const SHOPIFY_SHOP_URL = reqBody.store_url
  const SHOPIFY_SHOP_NAME = reqBody.store_name
  // console.log(SHOPIFY_ACCESS_TOKEN, SHOPIFY_SHOP_URL)

  const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/oauth/access_scopes.json`;
  
  // console.log("🚀 ~ exports.connectShopify= ~ shopifyEndpoint:", shopifyEndpoint)
  try {
    const fetchReq = await fetch(shopifyEndpoint, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
      }
    })
    const fetchData = await fetchReq.json();
    // console.log("🚀 ~ exports.connectShopify= ~ fetchData:", fetchData)
    if (fetchReq.status != 200) return res.status(fetchReq.status).json({ error: fetchData.errors });
    // if (fetchReq.status.toString().startsWith('5')) return res.status(fetchReq.status).json({ error: "Shopify Server Error" });
    const customerShopifyStoreAccessScopes = fetchData.access_scopes.map(scope => scope.handle);
    const isAccessSatified = (SHOPIFY_ACCESS_SCOPES.every(scope => customerShopifyStoreAccessScopes.includes(scope)))
    if (!isAccessSatified) return res.status(400).json({ error: "Provided credentials doesn't have access scopes" })
    
    const store = await StoreModel.findOneAndUpdate(
      { userid: req.userId },
      {
        $set: {
          userid: req.userId,
          shopifyStore: {
            shopName: SHOPIFY_SHOP_NAME,
            shopifyAccessToken: SHOPIFY_ACCESS_TOKEN,
            shopifyStoreURL: SHOPIFY_SHOP_URL
          }
        }
      },
      { new: true, upsert: true }
    )

    res.status(200).json({ message: "Added Shopify store successfully!" }) // idhu redirect pannidu
    // return;

  } catch (error) {
    console.log("Error in Shopify connect " + error)
    res.status(500).json({ error: 'Unable to connect Shopify store' })
    return;
  }
}
// render individual shoporder page
exports.shopifystoreorderedit = async (req, res) => {
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

    const SHOPIFY_SHOP_URL = storeData.shopifyStore.shopifyStoreURL;
    const SHOPIFY_ACCESS_TOKEN = storeData.shopifyStore.shopifyAccessToken;

    const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2023-07/orders/${shopOrderId}.json`;

    const shopifyOrderRequest = await fetch(shopifyEndpoint, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
      }
    })
    const shopifyOrderResponse = await shopifyOrderRequest.json();
    // console.log("🚀 ~ exports.shopifystoreorderedit= ~ shopifyOrderResponse:", shopifyOrderResponse)

    if (shopifyOrderResponse.errors) return res.render('storeorderedit', { error: shopifyOrderResponse.errors });
    
    const SKUs = shopifyOrderResponse.order.line_items.map(item => item.sku);
    // console.log("🚀 ~ exports.shopifystoreorderedit= ~ SKUs:", SKUs)
    
    const designData = designsData.designs.filter(design => SKUs.includes(design.designSKU))
    // console.log("🚀 ~ exports.shopifystoreorderedit= ~ designData:", designData)
    res.render('storeorderedit', { error: false, shopifyData: { order: shopifyOrderResponse.order, designs: designData } });
  } catch (error) {
    console.log("🚀 ~ exports.storeorderedit= ~ error:", error)
    return res.render('storeorderedit', { error: "Server error in fetching store details!" });
  }
}

exports.connectWooCommerce = async (req, res) => {
  const reqBody = req.body;
  console.log(reqBody);
  const WOOCOMMERCE_CONSUMER_KEY = reqBody.consumer_key;
  const WOOCOMMERCE_CONSUMER_SECRET = reqBody.consumer_secret;
  const WOOCOMMERCE_SHOP_URL = reqBody.store_url
  const WOOCOMMERCE_SHOP_NAME = reqBody.store_name

  try {
    const encodedAuth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    const endpoint = `https://${WOOCOMMERCE_SHOP_URL}/wp-json/wc/v3/orders`;
    const wooOrderRequest = await fetch(endpoint, {
      headers: {
        'Authorization': 'Basic ' + encodedAuth
      },
    });

    const wooOrderReponse = await wooOrderRequest.text();
      
    if (!wooOrderRequest.ok) return res.status(403).json({ error: 'Unable to connect to WooCommerce Store!' });

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
            consumerSecret: WOOCOMMERCE_CONSUMER_SECRET
          }
        }
      },
      { new: true, upsert: true }
    )
    // await store.save();

    res.status(200).json({ message: "Added WooCommerce store successfully!" })
    return;

  } catch (error) {
    console.log("Error in woocommerce connect " + error)
    res.status(500).json({
      error: "Server error in connecting WooCommerce Store!"
    })
    return;
  }
}

// render woocomms store order edit page
exports.woostoreorderedit = async (req, res) => {
  try {
    const shopOrderId = req.params.id;
    const [storeData, designsData] = await Promise.all([StoreModel.findOne({ userid: req.userId }), NewDesignModel.findOne({ userId: req.userId })]);
    if (!storeData)
      return res.render("storeorderedit", {
        error: "Could not find store credentials",
      });

    const WOOCOMMERCE_SHOP_URL = storeData.wooCommerceStore.url;
    const WOOCOMMERCE_CONSUMER_KEY = storeData.wooCommerceStore.consumerKey;
    const WOOCOMMERCE_CONSUMER_SECRET = storeData.wooCommerceStore.consumerSecret;

    const encodedAuth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
    const endpoint = `https://${WOOCOMMERCE_SHOP_URL}/wp-json/wc/v3/orders/${shopOrderId}`;
    const wooCommerceOrderReq = await fetch(endpoint, {
      headers: {
        'Authorization': 'Basic ' + encodedAuth
      },
    });
    const wooCommerceOrderRes = await wooCommerceOrderReq.json();
    // console.log("🚀 ~ exports.woostoreorderedit= ~ wooCommerceOrderRes:", wooCommerceOrderRes)

    if (!wooCommerceOrderReq.ok) return res.render('storeorderedit', { error: "There was an error trying to fetch WooCommerce order data" })
    const SKUs = wooCommerceOrderRes.line_items.map(item => item.sku);
    // console.log("🚀 ~ exports.woostoreorderedit= ~ SKUs:", SKUs)
    
    const designData = designsData.designs.filter(design => SKUs.includes(design.designSKU))
    // console.log("🚀 ~ exports.woostoreorderedit= ~ designData:", designData)
    res.render('storeorderedit', { error: false, shopifyData: null, wooData: { order: wooCommerceOrderRes, designs: designData } })
  } catch (error) {
    console.log("🚀 ~ exports.storeorderedit= ~ error:", error);
    return res.render("storeorderedit", {
      error: "Server error in fetching store details!",
    });
  }
};

// endpoint for creating order from shopify & woo
exports.createordershopify = async (req, res) => {
  const { shopifyId, items } = req.body;
  console.log("🚀 ~ exports.createordershopify= ~ items:", items)
  try {
    let totalAmount = items.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)
    const orderData = await OrderModel.findOneAndUpdate(
      { userId: req.userId }, 
      { $set: { 
        items: items,
        shopifyId: shopifyId,
        totalAmount,
        taxes: (totalAmount * 0.05).toFixed(2),
        printwearOrderId: otpGen.generate(6, { digits: true, lowerCaseAlphabets: false, specialChars: false })
      }},
      { new: true, upsert: true }
    );
    console.log("🚀 ~ exports.createordershopify= ~ orderData:", orderData)
    return res.json({ message: "Created order successfully!" });
  } catch (error) {
    console.log("🚀 ~ exports.createordershopify= ~ error:", error)
    res.status(500).json({ error: 'Server error in transferring Shopify order' })
  }
}

exports.createorderwoo = async (req, res) => {
  const { wooId, items } = req.body;
  console.log("🚀 ~ exports.createorderwoo= ~ items:", items)
  try {
    let totalAmount = items.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)
    const orderData = await OrderModel.findOneAndUpdate(
      { userId: req.userId }, 
      { $set: { 
        items: items,
        wooCommerceId: wooId,
        totalAmount,
        taxes: (totalAmount * 0.05).toFixed(2),
        printwearOrderId: otpGen.generate(6, { digits: true, lowerCaseAlphabets: false, specialChars: false })
      }},
      { new: true, upsert: true }
    );
    console.log("🚀 ~ exports.createorderwoo= ~ orderData:", orderData)
    return res.json({ message: "Created order successfully!" });
  } catch (error) {
    console.log("🚀 ~ exports.createorderwoo= ~ error:", error)
    res.status(500).json({ error: 'Server error in transferring WooCommerce order' })
  }
}
// render pay page for order via shopify
exports.payshoporder = async (req, res) => {
  try {
    const shopType = req.path.split("/")[2];
    // console.log("🚀 ~ exports.payshoporder= ~ shopType:", shopType)

    if (!(["shopify", "woo"].includes(shopType))) return res.render('storeorderpay', { error: "Invalid URL!" });

    const orderId = req.params.id;
    
    if (shopType == "shopify") {

      const orderData = await OrderModel.findOne({ userId: req.userId, shopifyId: orderId });
      if (!orderData) return res.render('storeorderpay', { error: "Could not find such order!" });
      if (orderData.paymentStatus == "success") return res.render('storeorderpay', { error: "This order has already been paid for!" });
  
      const storeData = await StoreModel.findOne({ userid: req.userId });
      if (!storeData) return res.render('storeorderpay', { error: "Could not find store credentials!" });
  
      const SHOPIFY_SHOP_URL = storeData.shopifyStore.shopifyStoreURL;
      const SHOPIFY_ACCESS_TOKEN = storeData.shopifyStore.shopifyAccessToken;
  
      const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2023-07/orders/${orderId}.json`;
  
      const shopifyOrderRequest = await fetch(shopifyEndpoint, {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
      });
      const { order: shopifyOrderResponse } = await shopifyOrderRequest.json();
      // console.log("🚀 ~ exports.shopifystoreorderedit= ~ shopifyOrderResponse:", shopifyOrderResponse)
      // const shopifyOrderResponse = /// --> SIMPLY FOR TESTING, if needed, copy from test_assets/shopifyorderreference.json
      if (shopifyOrderResponse.errors)
        return res.render("storeorderedit", {
          error: shopifyOrderResponse.errors,
        });
      
      const payOrderPageData = {
        id: orderId,
        orderName: shopifyOrderResponse.name,
        firstName: shopifyOrderResponse.shipping_address.first_name ?? shopifyOrderResponse.billing_address.first_name,
        lastName: shopifyOrderResponse.shipping_address.last_name ?? shopifyOrderResponse.billing_address.last_name,
        email: shopifyOrderResponse.shipping_address.email ?? shopifyOrderResponse.billing_address.email ?? shopifyOrderResponse.customer.email,
        streetLandmark: shopifyOrderResponse.shipping_address.address1 ?? shopifyOrderResponse.billing_address.address1opifyOrderResponse.shipping_address.address1 ?? shopifyOrderResponse.billing_address.address1,
        city: shopifyOrderResponse.shipping_address.city ?? shopifyOrderResponse.billing_address.city,
        phone: shopifyOrderResponse.shipping_address.phone ?? shopifyOrderResponse.billing_address.phone,
        state: shopifyOrderResponse.shipping_address.province ?? shopifyOrderResponse.billing_address.province,
        country: shopifyOrderResponse.shipping_address.country ?? shopifyOrderResponse.billing_address.country,
        pincode: shopifyOrderResponse.shipping_address.zip ?? shopifyOrderResponse.billing_address.zip,
        total: orderData.totalAmount,
        retail: shopifyOrderResponse.total_line_items_price,
        itemCount: orderData.items.length ?? 0,
        shopType: "Shopify",
        shopSlug: "shopify"
      }
  
      return res.render('storeorderpay', { error: false, data: payOrderPageData });
    } else {
      const [orderData, storeData] = await Promise.all([
        OrderModel.findOne({ userId: req.userId, wooCommerceId: orderId }),
        StoreModel.findOne({ userid: req.userId })
      ]);
      console.log("🚀 ~ exports.payshoporder= ~ orderData:", orderData)
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
      const WOOCOMMERCE_CONSUMER_SECRET = storeData.wooCommerceStore.consumerSecret;

      const encodedAuth = btoa(
        `${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`
      );
      const endpoint = `https://${WOOCOMMERCE_SHOP_URL}/wp-json/wc/v3/orders/${orderId}`;
      const wooCommerceOrderReq = await fetch(endpoint, {
        headers: {
          Authorization: "Basic " + encodedAuth,
        },
      });
      const wooCommerceOrderRes = await wooCommerceOrderReq.json();
      // console.log("🚀 ~ exports.woostoreorderedit= ~ wooCommerceOrderRes:", wooCommerceOrderRes)

      if (!wooCommerceOrderReq.ok)
        return res.render("storeorderpay", {
          error: "There was an error trying to fetch WooCommerce order data",
        });

      const payOrderPageData = {
        id: orderId,
        orderName: wooCommerceOrderRes.id,
        firstName: wooCommerceOrderRes.shipping?.first_name ?? wooCommerceOrderRes.billing?.first_name ?? '',
        lastName: wooCommerceOrderRes.shipping?.last_name ?? wooCommerceOrderRes.billing?.last_name ?? '',
        email: wooCommerceOrderRes.shipping?.email ?? wooCommerceOrderRes.billing?.email ?? '',
        streetLandmark: wooCommerceOrderRes.shipping?.address1 ?? wooCommerceOrderRes.billing?.address1 ?? wooCommerceOrderRes.shipping?.address2 ?? wooCommerceOrderRes.billing?.address2,
        city: wooCommerceOrderRes.shipping?.city ?? wooCommerceOrderRes.billing?.city ?? '',
        phone: wooCommerceOrderRes.shipping?.phone ?? wooCommerceOrderRes.billing?.phone ?? '',
        state: wooCommerceOrderRes.shipping?.state ?? wooCommerceOrderRes.billing?.state ?? '',
        country: wooCommerceOrderRes.shipping?.country ?? wooCommerceOrderRes.billing?.country ?? '',
        pincode: wooCommerceOrderRes.shipping?.postcode ?? wooCommerceOrderRes.billing?.postcode ?? '',
        total: orderData.totalAmount,
        retail: wooCommerceOrderRes.total,
        itemCount: orderData.items.length ?? 0,
        shopType: "WooCommerce",
        shopSlug: "woo"
      }
      // console.log("🚀 ~ exports.payshoporder= ~ payOrderPageData:", payOrderPageData)
      
      return res.render('storeorderpay', { error: false, data: payOrderPageData });
    }
  } catch (error) {
    console.log("🚀 ~ exports.payshoporder= ~ error:", error)
    res.render('storeorderpay', { error: "Server error in creating payment page for your order!" });
  }
}




// RENDER pages:
// render billing page
exports.billing = async (req, res) => {
  try {
    const orderData = await OrderModel.findOne({ userId: req.userId });
    if (!orderData) return res.render("billing", { orderData: { items: [] } });
    const designsFromOrders = orderData.items.map(item => item.designId);
    // console.log(designsFromOrders);
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
              input: '$designs',
              as: 'design',
              cond: {
                $in: ['$$design._id', designsFromOrders.map(id => new mongoose.Types.ObjectId(id))],
              },
            },
          },
        },
      },
    ]);
    res.render("billing", { orderData, designsData: designsData[0].designs });
  } catch (error) {
    console.log(error);
    res.send("<h1>Something went wrong :( Contact Help</h1><a href='/contact'>Help</a>");
  }
}
// render order details page
exports.orderpage = async (req, res) => {
  try {
    const orderId = req.params.id;

    // query db with specific order id
    const orderDetails = await OrderHistoryModel.findOne(
      {
        "userId": req.userId,
        "orderData": { $elemMatch: { "printwearOrderId": orderId } }
      },
      { "orderData.$": 1 },);
    // check if null, if so return a page with not found error
    if (!orderDetails) return res.render('orderpage', { orderData: null }); // go to that page and check if null and shout
    // obtain design data with ids from orderhistory
    const designIds = orderDetails.orderData[0].items.map(order => order.designId + '');
    const designDetails = await NewDesignModel.findOne({ userId: req.userId });
    let designs = designDetails.designs.filter(design => designIds.includes(design._id + ''));
    res.render('orderpage', { orderData: orderDetails, designData: designs });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error obtaining order details" });
  }
}
// render wallet recharge page
exports.recharge = async (req, res) => {
  try {
    const wallet = await WalletModel.findOne({ userId: req.userId });
    if (!wallet) {
      return res.render("recharge", { data: { userName: req.userName, error: true } });
    }
    return res.render("recharge", { data: { userName: req.userName, walletData: wallet } });
  } catch (error) {

  }
}


// endpoint for creating cashfree link
exports.getpaymentlink = async (req, res) => {
  try {
    const { firstName,
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
      cashOnDelivery
    } = req.body;

    const orderData = await OrderModel.findOne({ userId: req.userId });
    // console.log(req.body);
    // this is only for testing where i need to check multiple times if i can process a payment and cashfree demands
    // unique ID everytime i request a payment like
    // hence this is for testing only, once the logic is stable, remove it the extraId
    // let extraId = otpGen.generate(6, { digits: true, lowerCaseAlphabets: false, specialChars: false });

    let expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2);
    expiryDate = expiryDate.toISOString();

    const paymentLinkRequest = await fetch(CASHFREE_BASE_URL + "/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": cashfreeAppID,
        "x-client-secret": cashfreeSecretKey,
        "x-api-version": "2022-09-01"
      },
      body: JSON.stringify({
        order_id: orderData.printwearOrderId,
        // order_id: orderData.printwearOrderId + '-' + extraId,
        order_amount: parseFloat(((orderData.totalAmount + shippingCharge + (cashOnDelivery ? 50 : 0)) * 1.05).toFixed(2)),
        order_currency: "INR",
        order_note: `Payment for Order: ${orderData.printwearOrderId}`,
        // order_note: `Payment for Order: ${orderData.printwearOrderId + '-' + extraId}`,
        customer_details: {
          customer_id: req.userId,
          customer_name: firstName + " " + lastName,
          customer_phone: mobile,
          customer_email: email
        },
        order_expiry_time: expiryDate,
        order_meta: {
          notify_url: `${WEBHOOK_URL}createshiporder`,
          return_url: WEBHOOK_URL + "payment-success?type=purchase"
        }
      })
    });

    const paymentLinkResponse = await paymentLinkRequest.json();
    // console.log(paymentLinkResponse)

    if (paymentLinkResponse.code) return res.status(400).json({ message: 'Error creating payment link!', error: paymentLinkResponse.message });

    await OrderModel.findOneAndUpdate({ userId: req.userId }, {
      $set: {
        billingAddress: {
          firstName,
          lastName,
          mobile,
          email,
          streetLandmark,
          city,
          pincode,
          state,
          country
        },
        shippingAddress: {
          firstName,
          lastName,
          mobile,
          email,
          streetLandmark,
          city,
          pincode,
          state,
          country
        },
        CashfreeOrderId: paymentLinkResponse.cf_order_id,
        paymentLinkId: paymentLinkResponse.payment_session_id,
        paymentLink: paymentLinkResponse.payments.url,
        retailPrice: retailPrice,
        deliveryCharges: shippingCharge,
        customerOrderId: customerOrderId,
        shipRocketCourier: {
          courierId: courierId ?? -1,
          courierName: courierData?.courier_name ?? 'SELF PICKUP',
          estimatedDelivery: courierData?.etd ?? 'N/A'
        },
        cashOnDelivery: cashOnDelivery,
        totalAmount: (orderData.totalAmount + shippingCharge + (cashOnDelivery ? 50 : 0)) * 1.05
      },
    });

    res.status(200).json({ link: paymentLinkResponse.payment_session_id });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to create payment link!" });
  }
}

//endpoint for creating payment link for recharge
exports.rechargewallet = async (req, res) => {
  try {
    const { amount } = req.body;

    const UserWallet = await WalletModel.findOne({ userId: req.userId });
    const UserData = await UserModel.findById(req.userId);

    let walletRechargeOrderId = "RECHARGE_" + otpGen.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: true, digits: true, specialChars: false });

    let expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2);
    expiryDate = expiryDate.toISOString();

    const createRechargePaymentlinkRequest = await fetch(CASHFREE_BASE_URL + "/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": cashfreeAppID,
        "x-client-secret": cashfreeSecretKey,
        "x-api-version": "2022-09-01"
      },
      body: JSON.stringify({
        order_id: walletRechargeOrderId,
        // order_id: orderData.printwearOrderId + '-' + extraId,
        order_amount: parseFloat(amount).toFixed(2),
        order_currency: "INR",
        order_note: `Recharge for ${req.userName} WalletOrderId: ${walletRechargeOrderId}`,
        // order_note: `Payment for Order: ${orderData.printwearOrderId + '-' + extraId}`,
        customer_details: {
          customer_id: req.userId,
          customer_name: req.userName,
          customer_phone: UserData.phone,
          customer_email: UserData.email
        },
        order_expiry_time: expiryDate,
        order_meta: {
          notify_url: `${WEBHOOK_URL}createshiporder`,
          return_url: WEBHOOK_URL + "payment-success?type=recharge"
        }
      })
    });

    const createRechargePaymentlinkResponse = await createRechargePaymentlinkRequest.json();
    console.log(createRechargePaymentlinkResponse);

    UserWallet.transactions.push({
      walletOrderId: walletRechargeOrderId,
      amount: amount,
      transactionType: "recharge",
      cashfreeOrderId: createRechargePaymentlinkResponse.cf_order_id,
      cashfreeSessionId: createRechargePaymentlinkResponse.payment_session_id,
      transactionStatus: "pending",
    });

    await UserWallet.save();

    if (createRechargePaymentlinkResponse.code) return res.status(400).json({ message: 'Error creating payment link!', error: createRechargePaymentlinkResponse.message });
    return res.status(200).json({ paymentLink: createRechargePaymentlinkResponse.payment_session_id });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error couldn't create payment link for recharge" });
  }
}


// the brand new endpoint for creating orders
exports.placeorder = async (req, res) => {
  try {
    const { firstName,
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
      cashOnDelivery
    } = req.body;
    // validate data
    const orderData = await OrderModel.findOne({ userId: req.userId });
    const userData = await UserModel.findById(req.userId);

    if (!orderData) {
      res.status(404).json({ message: "No such order found!" });
      return console.log(`No such order data found for ${req.userId}`);
    }

    /// STEP 1: WALLET GAME
    const walletData = await WalletModel.findOne({ userId: req.userId });
    let totalPurchaseCost = (orderData.totalAmount + shippingCharge + (cashOnDelivery ? 50 : 0)) * 1.05;

    if (!walletData) return res.status(404).json({ message: "Wallet not found!" });

    if (walletData.balance < totalPurchaseCost) {
      return res.status(403).json({ message: "Not enough credits in wallet. Please recharge wallet" });
    }

    const walletOrderId = otpGen.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: true, digits: true, specialChars: false });
    walletData.balance = (walletData.balance - totalPurchaseCost).toFixed(2); // MONEY GONE!!!
    walletData.transactions.push({
      amount: totalPurchaseCost,
      transactionType: "payment",
      transactionStatus: "success",
      walletOrderId: "PAYMENT_" + walletOrderId,
      transactionNote: `Payment for Order ${orderData.printwearOrderId}`,
    }); // summa
    await walletData.save() //summa
    console.log(orderData.printwearOrderId + " Wallet operation successful!");


    /// STEP 1.5: ORDERDATA GAM
    // for now billing address same as shipping, but later ask vendor to enter billing address data
    // orderData.billingAddress = {
    //   firstName: userData.billingAddress?.firstName,
    //   lastName: userData.billingAddress?.lastName,
    //   mobile: userData.billingAddress?.phone,
    //   email: userData.billingAddress?.email,
    //   streetLandmark: userData.billingAddress?.street + ' ' + userData.billingAddress?.landmark,
    //   city: userData.billingAddress?.city,
    //   pincode: userData.billingAddress?.pincode,
    //   state: userData.billingAddress?.state,
    //   country: userData.billingAddress?.country
    // }
    orderData.billingAddress = {
      firstName,
      lastName,
      mobile,
      email,
      streetLandmark,
      city,
      pincode,
      state,
      country,
    }
    orderData.shippingAddress = {
      firstName,
      lastName,
      mobile,
      email,
      streetLandmark,
      city,
      pincode,
      state,
      country
    }
    // CashfreeOrderId: paymentLinkResponse.cf_order_id,
    // paymentLinkId: paymentLinkResponse.payment_session_id,
    // paymentLink: paymentLinkResponse.payments.url,
    orderData.retailPrice = retailPrice
    orderData.deliveryCharges = shippingCharge
    orderData.customerOrderId = customerOrderId
    orderData.shipRocketCourier = {
      courierId: courierId ?? -1,
      courierName: courierData?.courier_name ?? 'SELF PICKUP',
      estimatedDelivery: courierData?.etd ?? 'N/A'
    },
    orderData.cashOnDelivery = cashOnDelivery
    orderData.totalAmount = (orderData.totalAmount + shippingCharge + (cashOnDelivery ? 50 : 0)).toFixed(2)
    orderData.taxes = (orderData.totalAmount * 0.05).toFixed(2)

    await orderData.save();
    console.log("🚀 ~ orderData:", orderData)


    /// STEP 2: CREATE SHIPROCKET ORDER
    const designData = await NewDesignModel.findOne({ userId: req.userId });
    const labelData = await LabelModel.findOne({ userId: req.userId });
    if (courierId) { // check if order is not self pickup, courierId null means, self pickup = no need for shiprocket. 
      orderData.paymentStatus = "success";
      orderData.amountPaid = (orderData.totalAmount + orderData.taxes).toFixed(2);

      const shiprocketToken = await generateShiprocketToken();

      const SHIPROCKET_COMPANY_ID = shiprocketToken.company_id;
      const SHIPROCKET_ACC_TKN = shiprocketToken.token;

      const shiprocketOrderData = ({
        "order_id": orderData.printwearOrderId,
        "order_date": formatDate(new Date()),
        "pickup_location": "Primary",
        "channel_id": process.env.SHIPROCKET_CHANNEL_ID,
        "comment": "Order for " + orderData.shippingAddress.firstName + " " + orderData.shippingAddress.lastName,
        "billing_customer_name": orderData.billingAddress.firstName,
        "billing_last_name": orderData.billingAddress.lastName,
        "billing_address": orderData.billingAddress.streetLandmark,
        "billing_address_2": "",
        "billing_city": orderData.billingAddress.city,
        "billing_pincode": orderData.billingAddress.pincode,
        "billing_state": orderData.billingAddress.state,
        "billing_country": orderData.billingAddress.country,
        "billing_email": orderData.billingAddress.email,
        "billing_phone": orderData.billingAddress.mobile,
        "shipping_is_billing": true, // --> later change to False
        "shipping_customer_name": orderData.shippingAddress.firstName,
        "shipping_last_name": orderData.shippingAddress.lastName,
        "shipping_address": orderData.shippingAddress.streetLandmark,
        "shipping_address_2": "",
        "shipping_city": orderData.shippingAddress.city,
        "shipping_pincode": orderData.shippingAddress.pincode,
        "shipping_state": orderData.shippingAddress.state,
        "shipping_country": orderData.shippingAddress.country,
        "shipping_email": orderData.shippingAddress.email,
        "shipping_phone": orderData.shippingAddress.mobile,
        "order_items": orderData.items.map(item => {
          let currentItemDesignData = designData.designs.find(design => design._id + "" == item.designId + "");
          return {
            "name": currentItemDesignData.designName,
            "sku": currentItemDesignData.designSKU,
            "units": item.quantity,
            "selling_price": currentItemDesignData.price,
            "discount": "",
            "tax": "",
            "hsn": 441122
          }
        }),
        "payment_method": orderData.cashOnDelivery ? "COD" : "Prepaid",
        "shipping_charges": orderData.deliveryCharges,
        "giftwrap_charges": 0,
        "transaction_charges": 0,
        "total_discount": 0,
        "sub_total": orderData.totalAmount, // i changed from Retail price to totalAmount.. idk how that works
        "length": 28,
        "breadth": 20,
        "height": 0.5,
        "weight": (0.25 * (orderData.items.reduce((total, item) => total + item.quantity, 0))).toFixed(2)
      });

      console.log("Shiprocket data:");
      console.dir(shiprocketOrderData, { depth: 5 });

      const createShiprocketOrderRequest = await fetch(SHIPROCKET_BASE_URL + '/orders/create/adhoc', {
        headers: {
          "Content-Type": "application/json",
          Authorization: 'Bearer ' + SHIPROCKET_ACC_TKN
        },
        method: "POST",
        body: JSON.stringify(shiprocketOrderData)
      });
      const createShiprocketOrderResponse = await createShiprocketOrderRequest.json();
      console.log("Shiprocket order response:");
      console.log(createShiprocketOrderResponse);

      if (!createShiprocketOrderRequest.ok) throw new Error("Failed to create order");

      orderData.shipRocketOrderId = createShiprocketOrderResponse.order_id;
      orderData.shipmentId = createShiprocketOrderResponse.shipment_id;
      orderData.deliveryStatus = "received";
    }

    /// STEP 3: TRANSFER ORDERDATA TO ORDERHISTORY
    const updatedOrderHistory = await OrderHistoryModel.findOneAndUpdate({ userId: req.userId }, {
      $set: {
        userId: req.userId
      },
      $push: {
        orderData: orderData
      }
    }, { upsert: true, new: true });

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
      }
    });



    /// STEP 4: GENERATE ZOHO INVOICE
    const zohoToken = await generateZohoToken();
    if (!userData.isZohoCustomer) {
      // write endpoint to create zoho customer 
      let customerData = {
        "contact_name": userData.name,
        "company_name": userData.brandName ?? 'N/A',
        "contact_persons": [
          {
            "salutation": userData.name,
            "first_name": userData.firstName,
            "last_name": userData.lastName,
            "email": userData.email,
            "phone": userData.phone,
            "mobile": userData.phone,
            "is_primary_contact": true
          }
        ],
        "billing_address": {
          "address": userData.billingAddress.landmark,
          "street2": "",
          "city": userData.billingAddress.city,
          "state": userData.billingAddress.state,
          "zipcode": userData.billingAddress.pincode,
          "country": "India",
          "phone": userData.phone,
          "fax": "",
          "attention": ""
        },
        "language_code": "en",
        "country_code": "IN",
        "place_of_contact": "TN",
      }
      const zohoCustomerCreateRequest = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${ZOHO_INVOICE_ORGANIZATION_ID}`, {
        method: "POST",
        headers: {
          Authorization: 'Zoho-oauthtoken ' + zohoToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });
      const zohoCustomerCreateResponse = await zohoCustomerCreateRequest.json();
      console.log(zohoCustomerCreateResponse); // remove
      if (zohoCustomerCreateResponse.code == 0) {
        console.log(`zohoCustomer for ${req.userId} created!`)
        userData.isZohoCustomer = true;
        userData.zohoCustomerID = zohoCustomerCreateResponse.contact.contact_id;
        userData.zohoContactID = zohoCustomerCreateResponse.contact.primary_contact_id;
        await userData.save();
      }
    }

    const orderDetails = await OrderHistoryModel.findOne({
      "userId": req.userId,
      "orderData": { $elemMatch: { "printwearOrderId": orderData.printwearOrderId } }
    },
      { "orderData.$": 1 });
    const zohoCustomerId = userData.zohoCustomerID;
    const zohoContactId = userData.zohoContactID;
    const invoiceData = {
      "branch_id": "650580000000098357",
      "autonumbergenerationgroup_id": "650580000004188098",
      "reference_number": orderDetails.orderData[0].printwearOrderId,
      "payment_terms": 0,
      "payment_terms_label": "Due on Receipt",
      "customer_id": zohoCustomerId,
      "contact_persons": [

      ],
      "date": formatDate(new Date(orderDetails.orderData[0].createdAt), true),
      "due_date": formatDate(new Date(orderDetails.orderData[0].createdAt), true),
      "notes": "Thanks for your business with Printwear.\nPlease write to us for additional information: accounts@printwear.in",
      "terms": "Subject to Chennai jurisdiction\nNon refundable transaction\nAll grievences to be addressed within 2 days of receiving invoice\nAXIS BANK\nCOMPANY NAME- SASA PRINTWEAR PVT LTD\nACCOUNT NO - 921020008203409\nIFSC- UTIB0000211\nBRANCH - VALASARAVAKKAM CHENNAI",
      "is_inclusive_tax": false,
      "line_items":
        orderDetails.orderData[0].items.map((item, i) => {
          let currentDesignItem = designData.designs.find(design => design._id + '' == item.designId);
          return {
            "item_order": (i + 1),
            "item_id": currentDesignItem.product.id,
            "rate": currentDesignItem.price * 1.00,
            "name": currentDesignItem.product.name,
            "description": currentDesignItem.designName,
            "quantity": (item.quantity).toFixed(2),
            "discount": "0%",
            "tax_id": "650580000000013321",
            "tax_name": "SGST + CGST",
            "tax_type": "tax",
            "tax_percentage": 2.5,
            "project_id": "",
            "tags": [

            ],
            "tax_exemption_code": "",
            "account_id": "650580000000000486",
            "item_custom_fields": [

            ],
            "hsn_or_sac": "61130000",
            "gst_treatment_code": "",
            "unit": "pcs"
          }
        }),
      "allow_partial_payments": false,
      "custom_fields": [
        {
          "value": "",
          "customfield_id": "650580000000103311"
        }
      ],
      "is_discount_before_tax": "",
      "discount": 0,
      "discount_type": "",
      "shipping_charge": orderDetails.orderData[0].deliveryCharges,
      "adjustment": "",
      "adjustment_description": "Standard Shipping",
      "salesperson_id": "650580000000108050",
      "tax_exemption_code": "",
      "tax_authority_name": "",
      // "zcrm_potential_id": "",
      // "zcrm_potential_name": "",
      "pricebook_id": "",
      "template_id": ZOHO_INVOICE_TEMPLATE_ID,
      "project_id": "",
      "documents": [

      ],
      "mail_attachments": [

      ],
      // "billing_address_id": "650580000004394004",
      // "shipping_address_id": "650580000004394006",
      "gst_treatment": "business_none",
      "gst_no": "",
      "place_of_supply": "TN",
      "quick_create_payment": {
        "account_id": "650580000000000459",
        "payment_mode": "Bank Transfer"
      },
      "tds_tax_id": "650580000000013032",
      "is_tds_amount_in_percent": true,
      "taxes": [
        {
          "tax_name": "CGST",
          "tax_amount": (orderDetails.orderData[0].totalAmount + orderDetails.orderData[0].deliveryCharges) * 0.025
        },
        {
          "tax_name": "SGST",
          "tax_amount": (orderDetails.orderData[0].totalAmount + orderDetails.orderData[0].deliveryCharges) * 0.025
        },
      ],
      "tax_total": (orderDetails.orderData[0].totalAmount + orderDetails.orderData[0].deliveryCharges) * 0.05,
      payment_made: orderDetails.orderData[0].amountPaid
    }
    console.log("Zoho invoice data: ", invoiceData)

    const zohoInvoiceFormData = new FormData();
    zohoInvoiceFormData.append('JSONString', JSON.stringify(invoiceData));
    zohoInvoiceFormData.append('organization_id', ZOHO_INVOICE_ORGANIZATION_ID);
    zohoInvoiceFormData.append('is_quick_create', 'true');
    console.log(zohoInvoiceFormData);

    const zohoInvoiceCreateRequest = await fetch(`https://www.zohoapis.in/books/v3/invoices?organization_id=${ZOHO_INVOICE_ORGANIZATION_ID}&send=false`, {
      // const zohoInvoiceCreateRequest = await fetch(`https://books.zoho.in/api/v3/invoices`, {
      method: "POST",
      headers: {
        Authorization: 'Zoho-oauthtoken ' + zohoToken,
      },
      body: zohoInvoiceFormData
    });
    const zohoInvoiceCreateResponse = await zohoInvoiceCreateRequest.json();
    console.log(zohoInvoiceCreateResponse);
    if (zohoInvoiceCreateResponse.code != 0 || !zohoInvoiceCreateRequest.ok) {
      console.log(`Couldn't create invoice for ${orderData.printwearOrderId}`);
    }
    let purchaseTransactionIndex = walletData.transactions.findIndex(transaction => transaction.walletOrderId == `PAYMENT_${walletOrderId}`)
    walletData.transactions[purchaseTransactionIndex].invoiceURL = zohoInvoiceCreateResponse.invoice.invoice_url;
    await walletData.save();
    res.json({ message: "Order was successfull!" });


    // STEP 5: SEND ORDER DATA TO WOOCOMMS
    // part where i send the line item data to santo woocomms
    // should create order in woocomms
    // deleted a huge comment, if needed take from old commit

    const wooCommerceOrderData = {
      // parent_id: orderDetails.orderData[0].customerOrderId + "23",
      customer_note: `Order Reference number: ${orderDetails.orderData[0].customerOrderId}`,
      payment_method: orderDetails.orderData[0].cashOnDelivery ? "cod" : "wallet",
      payment_method_title: orderDetails.orderData[0].cashOnDelivery ? "Cash on Delivery" : "Wallet Payment",
      transaction_id: walletData.transactions[purchaseTransactionIndex].walletOrderId,
      shipping_total: orderDetails.orderData[0].deliveryCharges,
      total: orderDetails.orderData[0].amountPaid,
      total_tax: orderDetails.orderData[0].taxes,
      prices_include_tax: false,
      set_paid: orderDetails.orderData[0].cashOnDelivery ? false : true,
      status: 'received', // for santo
      // status: 'pending',
      billing: {
        first_name: orderDetails.orderData[0].billingAddress.firstName,
        last_name: orderDetails.orderData[0].billingAddress.lastName,
        address_1: orderDetails.orderData[0].billingAddress.streetLandmark,
        address_2: "",
        city: orderDetails.orderData[0].billingAddress.city,
        state: orderDetails.orderData[0].billingAddress.state,
        postcode: orderDetails.orderData[0].billingAddress.pincode + '',
        country: orderDetails.orderData[0].billingAddress.country,
        email: orderDetails.orderData[0].billingAddress.email,
        phone: orderDetails.orderData[0].billingAddress.mobile
      },
      shipping: {
        first_name: orderDetails.orderData[0].shippingAddress.firstName,
        last_name: orderDetails.orderData[0].shippingAddress.lastName,
        address_1: orderDetails.orderData[0].shippingAddress.streetLandmark,
        address_2: "",
        city: orderDetails.orderData[0].shippingAddress.city,
        state: orderDetails.orderData[0].shippingAddress.state,
        postcode: orderDetails.orderData[0].shippingAddress.pincode + '',
        country: orderDetails.orderData[0].shippingAddress.country,
        email: orderDetails.orderData[0].shippingAddress.email,
        phone: orderDetails.orderData[0].shippingAddress.mobile
      },
      "meta_data": [
        {
          "key": "billing_landmark",
          "value": orderDetails.orderData[0].billingAddress.streetLandmark
        },
        {
          "key": "shipping_landmark",
          "value": orderDetails.orderData[0].shippingAddress.streetLandmark
        },
        {
          "key": "shipping_email",
          "value": orderDetails.orderData[0].shippingAddress.email
        },
        {
          "key": "shipping_courier",
          "value": orderDetails.orderData[0].cashOnDelivery ? "COD" : orderDetails.orderData[0].shipRocketCourier.courierName
        },
        {
          "key": "shipping_type",
          "value": orderDetails.orderData[0].cashOnDelivery ? "COD" : "Standard Shipping"
        },
        {
          "key": "reference_number",
          "value": orderDetails.orderData[0].customerOrderId
        },
        {
          "key": "retail_price",
          "value": orderDetails.orderData[0].retailPrice
        },
        {
          "key": "tracking_number",
          "value": ""
        },
        {
          "key": "invoice",
          "value": zohoInvoiceCreateResponse.invoice.invoice_url
        },
        {
          "key": "is_pickup_option",
          "value": orderDetails.orderData[0].shipRocketCourier.courierId === "-1" ? "Yes" : "No"
        },
        {
          "key": "shipping_label_file",
          "value": ""
        },
        {
          "key": "printwear_cod_order_charges",
          "value": orderDetails.orderData[0].cashOnDelivery ? 50 : 0
        }
      ],
      line_items: orderDetails.orderData[0].items.map(item => {
        const currentItemDesignData = designData.designs.find(design => design._id + "" == item.designId + "");
        const neckLabelURl = currentItemDesignData.neckLabel ? labelData.labels.find(lab => lab._id + '' == currentItemDesignData.neckLabel + '').url : '';
        return {
          product_id: item.designId,
          variation_id: 0,
          name: currentItemDesignData.product.name,
          price: currentItemDesignData.product.price + '',
          subtotal: (currentItemDesignData.price * item.quantity).toFixed(2),
          total: (currentItemDesignData.price * item.quantity).toFixed(2),
          quantity: item.quantity,
          sku: currentItemDesignData.designSKU,
          meta_data: [
            {
              meta_key: 'front_design_image',
              meta_value: currentItemDesignData.designItems[0].URL
            },
            {
              meta_key: 'front_mockup_image',
              meta_value: currentItemDesignData.product.baseImage.front
            },
            {
              meta_key: 'frontimageurl',
              meta_value: currentItemDesignData.designImage.front
            },
            {
              meta_key: 'back_design_image',
              meta_value: ''
            },
            {
              meta_key: 'back_mockup_image',
              meta_value: ''
            },
            {
              meta_key: 'backimageurl',
              meta_value: ''
            },
            {
              meta_key: 'front_printing_price',
              meta_value: currentItemDesignData.price - currentItemDesignData.product.price - (currentItemDesignData.neckLabel ? 10 : 0)
            },
            {
              meta_key: 'back_printing_price',
              meta_value: 0
            },
            {
              meta_key: 'handling_fulfilement_charges',
              meta_value: 0
            },
            {
              meta_key: 'printwear_branding_charges',
              meta_value: currentItemDesignData.neckLabel ? 10 : 0
            },
            {
              meta_key: 'gst_charges',
              meta_value: currentItemDesignData.price * 0.05
            },
            {
              meta_key: 'gst_percentage',
              meta_value: 5
            },
            {
              meta_key: 'lumise_data',
              meta_value: ''
            },
            {
              meta_key: 'temp_order_data_file',
              meta_value: ''
            },
            {
              meta_key: 'brand_image_url',
              meta_value: currentItemDesignData.neckLabel ? neckLabelURl : ''
            },
            {
              meta_key: 'front_top',
              meta_value: currentItemDesignData.designDimensions.top
            },
            {
              meta_key: 'front_left',
              meta_value: currentItemDesignData.designDimensions.left
            },
            {
              meta_key: 'front_width',
              meta_value: currentItemDesignData.designDimensions.width
            },
            {
              meta_key: 'front_height',
              meta_value: currentItemDesignData.designDimensions.height
            },
            {
              meta_key: 'back_top',
              meta_value: ''
            },
            {
              meta_key: 'back_left',
              meta_value: ''
            },
            {
              meta_key: 'back_width',
              meta_value: ''
            },
            {
              meta_key: 'back_height',
              meta_value: ''
            },
            {
              meta_key: 'front_dpi',
              meta_value: ''
            },
            {
              meta_key: 'back_dpi',
              meta_value: ''
            }
          ]
        }
      }),
      shipping_lines: [
        {
          method_id: "flat_rate",
          method_title: orderDetails.orderData[0].shipRocketCourier?.courierId === "-1" ? "Self pickup" : orderDetails.orderData[0].shipRocketCourier?.courierName,
          total: orderDetails.orderData[0].shipRocketCourier?.courierId === "-1" ? '0' : orderDetails.orderData[0].deliveryCharges + '',
          total_tax: orderDetails.orderData[0].shipRocketCourier?.courierId === "-1" ? '0' : orderDetails.orderData[0].deliveryCharges * 0.05 + ''
        }
      ],
    };
    if (orderDetails.orderData[0].cashOnDelivery) wooCommerceOrderData.fee_lines = [
      {
        name: "COD Charges",
        total: 50,
        tax_status: "none",
        tax_class: "",
        total_tax: "2.5"
      }
    ]
    console.log("🚀 ~ wooCommerceOrderData:", wooCommerceOrderData)

    const consumerKey = process.env.WOO_PROD_CONSUMER_KEY;
    const consumerSecret = process.env.WOO_PROD_CONSUMER_SECRET;

    const encodedAuth = btoa(`${consumerKey}:${consumerSecret}`);
    const endpoint = `${WOO_SANTO_URL}/wp-json/wc/v3/orders`;

    const createWooOrderReq = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encodedAuth}`,
      },
      body: JSON.stringify(wooCommerceOrderData),
    })

    const createWooOrderRes = await createWooOrderReq.json();
    console.log("🚀 ~ createWooOrderRes:", createWooOrderRes)

    updatedOrderHistory.orderData.at(-1).wooOrderId = createWooOrderRes.id;
    updatedOrderHistory.orderData.at(-1).walletOrderId = walletOrderId;
    await updatedOrderHistory.save({ validateBeforeSave: false });

  } catch (error) {
    console.log("General error");
    console.log(error);
    console.log("Failed to create order for: " + req.userId + " Order Id: " + req.body.customerOrderId);
    res.status(500).json({ message: "Internal server Error" });
  }
}


// endpoint for wallet balance
exports.walletballance = async (req, res) => {
  try {
    const walletData = await WalletModel.findOne({ userId: req.userId });
    if (!walletData) return res.status(404).json({ message: "Wallet for user not found!" });
    return res.json({ balance: walletData.balance });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Couldn't fetch Wallet details!" });
  }
}


// endpoints for creating orders in shiprocket
exports.calculateshippingcharges = async (req, res) => {
  try {
    const { weight, pincode, cod } = req.body;
    //verify pincode
    // this endpoint service down
    // const pincodeRequest = await fetch("https://api.postalpincode.in/pincode/" + pincode);
    // const pincodeResponse = await pincodeRequest.json();
    // if (pincodeRequest.status == 500 || pincodeRequest.status == 503) console.log("Pincode service down!");
    // if (!pincodeResponse[0].Status == "Success") return res.status(500).json({ message: "Pincode could not be verified" });

    const pincodeRequest = await fetch("https://api.opencagedata.com/geocode/v1/json?key=518b0ac375bb4bb8bb17019ae3e63818&q=" + pincode);
    const pincodeResponse = await pincodeRequest.json();
    // if (pincodeRequest.status == 500 || pincodeRequest.status == 503) console.log("Pincode service down!");
    if (!pincodeResponse.total_results > 0 || pincodeResponse.results.findIndex(result => result.components.country == "India") == -1) return res.status(500).json({ message: "Pincode could not be verified" });

    // get couriers
    const shippingChargeRequest = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/serviceability?pickup_postcode=600087&weight=${weight}&delivery_postcode=${pincode}&cod=${cod ? 1 : 0}`, {
      headers: {
        'Authorization': 'Bearer ' + (await generateShiprocketToken()).token
      }
    });
    const shippingChargeResponse = await shippingChargeRequest.json();
    console.log(shippingChargeResponse)
    if (shippingChargeResponse.status != 200 || !shippingChargeRequest.ok) return res.status(shippingChargeResponse.status_code || shippingChargeResponse.status).json({ message: shippingChargeResponse.message });

    // the following code should be put in getpaymentlink function
    // get courier id for the order
    // const recommendedCourierID = shippingChargeResponse.data.recommended_courier_company_id;
    // const charges = shippingChargeResponse.data.available_courier_companies.find(courier => courier.courier_company_id == recommendedCourierID)["freight_charge"];
    // const orderData = await OrderModel.findOneAndUpdate({ userId: req.userId }, { $set: { deliveryCharges: charges } });
    // console.log(charges);
    res.status(200).json(shippingChargeResponse);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong!" });
  }
}


//endpoint for initiating refund
exports.initiaterefund = async (req, res) => {
  // 2 levels: CANCEL ORDER (before its even shipped), RETURN ORDER (after it is shipped)
  // for CANCEL ORDER: check if order has a courier assigned.. if so first hit shiprocket API and cancel that assigned courier
  // next hit cashfree API to initiate refund and get the status via webhook
  // else, if not assigned any courier, then simply hit cashfree API and initiate refund
  // i think shiprocket also has webhook? idk i need to see
  // for RETURN ORDER: hit shiprocket API to initiate return, then listen to the event via webhook and then update 
  // orderHistory with appropriate status and all

  const refundFunction = async (orderId) => {
    try {
      const cashfreeRefundRequest = await fetch(CASHFREE_BASE_URL + `/orders/${orderId}/refunds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": cashfreeAppID,
          "x-client-secret": cashfreeSecretKey,
          "x-api-version": "2022-09-01"
        },
        body: JSON.stringify({
          refund_amount: orderToRefund.amountPaid,
          refund_id: `refund_${orderToRefund.printwearOrderId}`,
          refund_note: 'Refund initiated by client',
          refund_speed: 'INSTANT'
        })
      });
      const cashfreeRefundResponse = await cashfreeRefundRequest.json();
      console.log("🚀 ~ refundFunction ~ cashfreeRefundResponse:", cashfreeRefundResponse)
      if (cashfreeRefundRequest.ok) {
        return { status: "refund_ok", data: cashfreeRefundResponse };
      }
      return cashfreeRefundResponse.message;
    } catch (error) {
      console.log(error);
      return { status: "Cashfree Refund error", data: null };
    }
  }

  const updateWooCommerceOrderStatus = async (wooCommerceOrderId, status) => {
    try {
      const consumerKey = process.env.WOO_PROD_CONSUMER_KEY;
      const consumerSecret = process.env.WOO_PROD_CONSUMER_SECRET;

      const encodedAuth = btoa(`${consumerKey}:${consumerSecret}`);
      const endpoint = WOO_SANTO_URL + `/wp-json/wc/v3/orders/${wooCommerceOrderId}`;

      const updateWooOrderReq = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encodedAuth}`,
        },
        body: JSON.stringify({
          status: status
        }),
      })

      const updateWooOrderRes = await updateWooOrderReq.json();
      console.log("🚀 ~ updateWooCommerceOrderStatus ~ updateWooOrderRes:", updateWooOrderRes)
      if (!updateWooOrderReq.ok) throw new Error(`Update to WooCommerce order failed for ${wooCommerceOrderId}`);
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  const cancelShiprocketOrder = async () => {
    try {
      const shiprocketToken = await generateShiprocketToken();
      const SHIPROCKET_ACC_TKN = shiprocketToken.token;

      const cancelOrderRequest = await fetch(SHIPROCKET_BASE_URL + '/orders/cancel', {
        headers: {
          "Content-Type": "application/json",
          Authorization: 'Bearer ' + SHIPROCKET_ACC_TKN
        },
        method: "POST",
        body: JSON.stringify({
          ids: [orderToRefund.shipRocketOrderId]
        })
      });
      const cancelOrderResponse = await cancelOrderRequest.json();
      console.log("🚀 ~ cancelShiprocketOrder ~ cancelOrderResponse:", cancelOrderResponse)
      if (cancelOrderRequest.status == 200 || cancelOrderRequest.status == 204) return cancelOrderResponse; // check the message, code and stuff and then send
      return true;
    } catch (error) {
      console.log(error);
      return false
    }
  }

  const createShiprocketReturnOrder = async () => {
    const shiprocketToken = await generateShiprocketToken();
    const SHIPROCKET_ACC_TKN = shiprocketToken.token;

    try {
      const returnOrderRequest = await fetch(SHIPROCKET_BASE_URL + '/orders/create/return', {
        headers: {
          "Content-Type": "application/json",
          Authorization: 'Bearer ' + SHIPROCKET_ACC_TKN
        },
        method: "POST",
        body: JSON.stringify({
          "order_id": orderToRefund.printwearOrderId,
          "order_date": formatDate(orderToRefund.createdAt),
          "channel_id": process.env.SHIPROCKET_CHANNEL_ID,
          "pickup_customer_name": orderToRefund.shippingAddress.firstName,
          "pickup_last_name": orderToRefund.shippingAddress.lastName,
          "company_name": "",
          "pickup_address": orderToRefund.shippingAddress.streetLandmark,
          "pickup_address_2": "",
          "pickup_city": orderToRefund.shippingAddress.city,
          "pickup_state": orderToRefund.shippingAddress.state,
          "pickup_country": "India",
          "pickup_pincode": orderToRefund.shippingAddress.pincode,
          "pickup_email": orderToRefund.shippingAddress.email,
          "pickup_phone": orderToRefund.shippingAddress.mobile,
          "pickup_isd_code": "",
          "shipping_customer_name": "Santhosh",
          "shipping_last_name": "Sasa",
          "shipping_address": "no 33 jai garden",
          "shipping_address_2": "3rd street valasaravakkam",
          "shipping_city": "Tiruvallur",
          "shipping_country": "India",
          "shipping_pincode": 600087,
          "shipping_state": "Tamil Nadu",
          "shipping_email": "accounts@printwear.in",
          "shipping_isd_code": "1121739",
          "shipping_phone": 9884909019,
          "order_items": [
            ...orderToRefund.items.map(item => {
              let currentDesignItem = designData.designs.find(design => design._id + "" == item.designId + "");
              return {
                "name": currentDesignItem.designName,
                "qc_enable": true,
                "qc_product_name": currentDesignItem.product.name,
                "sku": currentDesignItem.designSKU,
                "units": item.quantity,
                "selling_price": item.price,
                "discount": 0,
                "qc_brand": "",
                "qc_product_image": currentDesignItem.designImage.front ?? currentDesignItem.designImage.back
              }
            })
          ],
          "payment_method": orderToRefund.cashOnDelivery ? "COD" : "PREPAID",
          "total_discount": "0",
          "sub_total": orderToRefund.totalAmount,
          "length": designData.designs.at(0).designDimensions.height, // these are because for now temporary heights and widths, so adpiye edho oru item oda dimensions tharen
          "breadth": 1,
          "height": designData.designs.at(0).designDimensions.width,
          "weight": 0.25
        })
      });
      const returnOrderResponse = await returnOrderRequest.json();
      console.log("🚀 ~ createShiprocketReturnOrder ~ returnOrderResponse:", returnOrderResponse)
      if (returnOrderRequest.status == 200 || returnOrderRequest.status == 204) return returnOrderResponse
      return false
      // orderHistory.orderData[orderToRefundIndex].shipRocketCourier.courierAWB = shipmentAssignResponse.response.data.awb_code;
      // orderHistory.orderData[orderToRefundIndex].shipRocketCourier.courierId = shipmentAssignResponse.response.data.courier_company_id;
      // orderHistory.orderData[orderToRefundIndex].shipRocketCourier.courierName = shipmentAssignResponse.response.data.courier_name;
      // orderHistory.orderData[orderToRefundIndex].deliveryStatus = "courier_assigned";
      // orderHistory.orderData[orderToRefundIndex].paymentStatus = "success";
      // orderHistory.orderData[orderToRefundIndex].deliveryCharges = shipmentAssignResponse.response.data.freight_charges;

      // await orderHistory.save();
      // return true
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  const updateRefundWalletRecord = async (cashfreeOrderId, cashfreeSessionId) => {
    try {
      walletData.transactions.push({
        amount: orderToRefund.totalAmount,
        transactionType: "refund",
        walletOrderId: `REFUND_` + walletOrderId,
        refundAmount: orderToRefund.totalAmount,
        transactionNote: "Refund for order " + orderToRefund.printwearOrderId,
        cashfreeOrderId,
        cashfreeSessionId,
        transactionStatus: "refund_init" // later listen to webhook and change status
      });
      await walletData.save(); // i am relying on mongodb to successfully update everytime this function is called, so i dont return true
    } catch (error) {
      console.log(error);
    }
  }

  try {
    var orderHistory = await OrderHistoryModel.findOne({ userId: req.userId });
    var walletData = await WalletModel.findOne({ userId: req.userId });
    var designData = await NewDesignModel.findOne({ userId: req.userId });
    var orderToRefund = orderHistory.orderData.find(order => order.printwearOrderId == req.body.orderId);
    var orderToRefundIndex = orderHistory.orderData.findIndex(order => order.printwearOrderId == req.body.orderId);
    var walletOrderId = otpGen.generate(6, { lowerCaseAlphabets: false, specialChars: false });
    // this purchase transaction is to make sure that i correspond the walletorder id that was used to make payment for the order is 
    // inside the orderhistory data itself so when i need to make a refund i can simply refer it from orderhistory and find that specific 
    // transaction and then if refund is needed, do so by passing it to refundFunction as argument
    var purchaseTransaction = walletData.transactions.find(transaction => transaction.walletOrderId == ('PAYMENT_' + orderToRefund.walletOrderId))
    //// now that i realised that the last recharge type of transaction can only be used to refund the customer, why even have purchaseTransaction?
    let purchaseTransactionOrderId = walletData.transactions.filter(transaction => transaction.transactionType === "recharge").at(-1).walletOrderId; // this is what i need 

    if (!orderToRefund || orderToRefundIndex === -1) return res.status(404).json({ message: "Order not found!" });

    if (!purchaseTransaction) return res.status(404).json({ message: "Wallet transaction not found!" }); // if no such transaction found, then cant refund, problem with us only

    if (["pending", "received", "invoiced", "undelivered"].includes(orderToRefund.deliveryStatus)) {

      const isRefunded = await refundFunction(purchaseTransactionOrderId);
      if (!(isRefunded.status === "refund_ok" && isRefunded.data != null)) return res.status(500).json({ message: "Failed to refund order! Please contact help" })

      const isWooUpdated = await updateWooCommerceOrderStatus(orderToRefund.wooOrderId, "cancelled");
      if (!isWooUpdated) return res.status(500).json({ message: "Failed to update order status. Please try later or contact help" })

      await updateRefundWalletRecord();

      orderHistory.orderData[orderToRefundIndex].deliveryStatus = "cancelled";
      orderHistory.orderData[orderToRefundIndex].paymentStatus = "refund_init";
      await orderHistory.save({ validateBeforeSave: false });
      // call woocommerce santo endpoint to update order status
      // refund if not COD

      res.json({ message: "Order cancelled successfully!" });

    } else if (["delivered"].includes(orderToRefund.deliveryStatus) || (orderToRefund.deliveryStatus === "completed" && orderToRefund.shipRocketCourier.courierId !== "-1")) {

      let cashfreeRefundStatus = await refundFunction(purchaseTransactionOrderId);
      let shiprocketReturnCreated = await createShiprocketReturnOrder();

      if (!(cashfreeRefundStatus.status === "refund_ok" && cashfreeRefundStatus.data != null)) return res.status(500).json({ message: "Something went wrong in initiating refund!" });
      if (shiprocketReturnCreated.message || shiprocketReturnCreated.status_code !== 21) return res.status(500).json({ message: "Something went wrong in creating return order!" });

      let isWooUpdated = await updateWooCommerceOrderStatus(orderToRefund.wooOrderId, "pickup-scheduled");
      if (!isWooUpdated) return res.status(500).json({ message: "Something went wrong in updating return order" });

      orderHistory.orderData[orderToRefundIndex].deliveryStatus = "pickup-scheduled";
      orderHistory.orderData[orderToRefundIndex].paymentStatus = "refund_init";
      orderHistory.orderData[orderToRefundIndex].shipRocketReturn.orderId = shiprocketReturnCreated.order_id;
      orderHistory.orderData[orderToRefundIndex].shipRocketReturn.shipmentId = shiprocketReturnCreated.shipment_id;
      orderHistory.orderData[orderToRefundIndex].shipRocketReturn.status = shiprocketReturnCreated.status;
      await orderHistory.save({ validateBeforeSave: false });
      res.json({ message: "Return order created successfully!" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong in cancelling this order!" });
  }


  /// new comment: for now, indha rendu states dhaan iruka mudiyum... meedhi ask client what and all the actions to be done if 
  /// if an order is cancelled on various order status changes

  // if (orderToRefund.deliveryStatus == "cancelled" && (orderToRefund.paymentStatus == "refund_init" || orderToRefund.paymentStatus == "refunded")) {
  //   // assign courier automatically again
  //   // this is test.. change it to implement new billing page like /order/SDJA23/reship and there get the charges and shit

  //   // create payment link for added delivery charge
  //   // after payment made, make respective changes in webhook
  //   // maybe add a note to payment data and in /createshiporder if the note has "reship for {printwearOrderId}" then change status
  //   return res.status(200).send({ message: `Reshipping again to ${orderToRefund.billingAddress.firstName + " " + orderToRefund.billingAddress.lastName}` });
  // }

  // if (orderToRefund.deliveryStatus == "courier_assigned") {
  //   // if it is still processing and neither picked up nor delivered, simply hit SR API to remove that courier and issue refund
  //   const shiprocketToken = await generateShiprocketToken();
  //   const SHIPROCKET_ACC_TKN = shiprocketToken.token;

  //   try {
  //     const cancelSROrderRequest = await fetch(`${SHIPROCKET_BASE_URL}/orders/cancel/shipment/awbs`, {
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: 'Bearer ' + SHIPROCKET_ACC_TKN
  //       },
  //       method: "POST",
  //       body: JSON.stringify({
  //         awbs: [
  //           orderToRefund.shipRocketCourier.courierAWB
  //         ]
  //       })
  //     });
  //     const cancelSROrderResponse = await cancelSROrderRequest.json();
  //     console.log(cancelSROrderResponse);

  //     if (cancelSROrderRequest.status == 200 || cancelSROrderRequest.status == 204) {
  //       console.log(orderToRefund.printwearOrderId + " shipment cancelled");
  //       orderHistory.orderData[orderToRefundIndex].deliveryStatus = "cancelled";
  //       (orderHistory.orderData[orderToRefundIndex].shipRocketCourier.courierId != -1) && (orderHistory.orderData[orderToRefundIndex].shipRocketCourier.courierId = null);
  //       orderHistory.orderData[orderToRefundIndex].shipRocketCourier.estimatedDelivery = 'N/A';
  //       orderHistory.orderData[orderToRefundIndex].shipRocketCourier.courierAWB = null;
  //       (orderHistory.orderData[orderToRefundIndex].shipRocketCourier.courierName != 'SELF PICKUP') && (orderHistory.orderData[orderToRefundIndex].shipRocketCourier.courierName = 'unassigned');
  //       orderHistory.orderData[orderToRefundIndex].deliveryCharges = 0.0;

  //       let cashfreeRefundStatus = await refundFunction();

  //       if (cashfreeRefundStatus == 'refund_ok') {
  //         orderHistory.orderData[orderToRefundIndex].paymentStatus = "refund_init";
  //         await orderHistory.save();
  //         return res.status(200).json({ orderData: orderHistory.orderData });
  //       } else {
  //         return res.status(500).json({ message: cashfreeRefundStatus });
  //       }

  //     } else {
  //       console.log(orderToRefund.printwearOrderId + " failed to cancel order", cancelSROrderResponse);
  //       return res.status(500).json({ message: cancelSROrderResponse.message });
  //     }

  //   } catch (error) {
  //     console.log(error);
  //     return res.status(500).json({ message: "Server error in cancelling order" });
  //   }
  // }

  // once processing start pantaanga na, you cant cancel the order, so below if is waste
  // if (orderToRefund.deliveryStatus == "processing" && orderToRefund.paymentStatus == "success") {
  //   // simply call refund function
  //   let cashfreeRefundStatus = await refundFunction();

  //   if (cashfreeRefundStatus == 'refund_ok') {
  //     orderHistory.orderData[orderToRefundIndex].paymentStatus = "refund_init";
  //     if (orderHistory.orderData[orderToRefundIndex].shipRocketCourier.courierId == -1) {
  //       orderHistory.orderData[orderToRefundIndex].deliveryStatus = "cancelled";
  //     }
  //     await orderHistory.save();
  //     return res.status(200).json({ orderData: orderHistory.orderData });
  //   } else {
  //     return res.status(500).json({ message: cashfreeRefundStatus });
  //   }
  //   // listen to refund event in webhook, then change the status of the order accordingly
  //   return res.status(200).send("ok");
  // }

  // if (orderToRefund.deliveryStatus == "delivered") {
  //   // hit SR API to create a return order
  // }
}


// for now create a test endpoint for fetching order data, then later change /manageorder route to do data fetching and implement SSR
exports.getorderhistory = async (req, res) => {
  try {
    const orderHistory = await OrderHistoryModel.findOne({ userId: req.userId });
    if (!orderHistory) {
      return res.json([]);
    }
    res.json(orderHistory.orderData);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching orderhistory" });
  }
}


// new endpoint to upload new label
exports.uploadlabel = async (req, res) => {
  try {
    // console.log(req.file);
    const fileBuffer = req.file.buffer;
    const fileReference = storageReference.child(`labels/${req.userId + "_" + otpGen.generate(4) + "_" + req.file.originalname}`);
    await fileReference.put(fileBuffer, { contentType: 'image/png' });
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
            url: fileDownloadURL
          }
        }
      },
      { new: true, upsert: true }
    )

    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to upload image" });
  }
}

exports.obtainlabels = async (req, res) => {
  try {
    const labelData = await LabelModel.findOne({ userId: req.userId });
    res.status(200).json(labelData)
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: "Label data error" })
  }
}

exports.deletelabel = async (req, res) => {
  const imageId = req.body.imageId;
  // console.log(imageId);
  try {
    const imageToDelete = await LabelModel.findOne({ userId: req.userId, 'labels._id': imageId }, { 'labels.$': 1 });
    // const imageToDelete = await LabelModel.findOne({ userId: req.userId, 'labels.' })
    const fileReference = storageReference.child(`labels/${req.userId + "_" + imageToDelete.labels[0].name}`);
    await fileReference.delete();

    await LabelModel.findOneAndUpdate(
      {
        userId: req.userId
      },
      {
        $pull: {
          labels: {
            _id: imageId
          }
        }
      }
    )
    res.status(200).json({ message: "Deleted successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error deleting label" });
  }
}


// endpoint for checking if orderid is unique
exports.checkorderid = async (req, res) => {
  try {
    const currentOrderId = req.body.customerOrderId;
    const orderIDs = await OrderHistoryModel.findOne({ userId: req.userId });
    if (!orderIDs) return res.status(200).json({ message: "OK" });
    const orderIDmatches = orderIDs.orderData.map((order) => order.customerOrderId).findIndex(order => order == currentOrderId);
    // console.log(currentOrderId, orderIDmatches)
    if (orderIDmatches == -1) {
      return res.status(200).json({ message: "OK" })
    }
    return res.status(400).json({ message: "Order ID already exists!" })
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error when checking order id" })
  }
}


// endpoint for getting invoice link for the orders
exports.getinvoices = async (req, res) => {
  // temporary invoice collecting endpoint as the actual invoices must be obtained from zoho invoice only
  try {
    const walletData = await WalletModel.findOne({ userId: req.userId });
    const lastTransaction = walletData.transactions.at(-1);
    if (lastTransaction.transactionType === "recharge" && lastTransaction.amount === 0) return res.render('invoice', { walletData: null })
    res.render('invoice', { walletData });
  } catch (error) {
    console.log(error);
    res.json(error);
  }
}


//endpoint for generating zoho books invoice
exports.generateZohoBooksInvoice = async (req, res) => {
  try {
    const zohoToken = await generateZohoToken();
    console.log(zohoToken)
    // for now testing, actually obtain userid from the createshiporder userid thing, this endpoint itself is just for test
    let userid = '653e3284308b660442fd55a6';
    let testorderid = '81OIWL';
    const userData = await UserModel.findById(userid);
    if (!userData.isZohoCustomer) {
      // write endpoint to create zoho customer 
      let customerData = {
        "contact_name": userData.name,
        "company_name": userData.brandName ?? 'N/A',
        "contact_persons": [
          {
            "salutation": userData.name,
            "first_name": userData.firstName,
            "last_name": userData.lastName,
            "email": userData.email,
            "phone": userData.phone,
            "mobile": userData.phone,
            "is_primary_contact": true
          }
        ],
        "billing_address": {
          "address": userData.billingAddress.landmark,
          "street2": "",
          "city": userData.billingAddress.city,
          "state": userData.billingAddress.state,
          "zipcode": userData.billingAddress.pincode,
          "country": "India",
          "phone": userData.phone,
          "fax": "",
          "attention": ""
        },
        "language_code": "en",
        "country_code": "IN",
        "place_of_contact": "TN",
      }
      const zohoCustomerCreateRequest = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${ZOHO_INVOICE_ORGANIZATION_ID}`, {
        method: "POST",
        headers: {
          Authorization: 'Zoho-oauthtoken ' + zohoToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });
      const zohoCustomerCreateResponse = await zohoCustomerCreateRequest.json();
      res.json(zohoCustomerCreateResponse); // remove
      if (zohoCustomerCreateResponse.code == 0) {
        console.log(`zohoCustomer for ${userid} created!`)
        userData.isZohoCustomer = true;
        userData.zohoCustomerID = zohoCustomerCreateResponse.contact.contact_id;
        userData.zohoContactID = zohoCustomerCreateResponse.contact.primary_contact_id;
        await userData.save();
      }
    }

    // create item
    // not necessary because when taking data from zoho inventory i got the product id which was saved in newdesigns itself!
    // so for now, just query the designs, and for each of them simply fetch their id and use it for invoice
    // following query is for testing only, take actual data from the createshiporder data
    const orderDetails = await OrderHistoryModel.findOne(
      {
        "userId": userid,
        "orderData": { $elemMatch: { "printwearOrderId": testorderid } }
      },
      { "orderData.$": 1 });
    const designIds = orderDetails.orderData[0].items.map(item => item.designId + '');
    const designsData = await NewDesignModel.findOne({ userId: userid });
    let productIds = designsData.designs.filter(design => designIds.includes(design._id + '')).map(design => design.product.id);
    console.log(designIds, productIds)
    // create invoice request
    const zohoCustomerId = userData.zohoCustomerID;
    const zohoContactId = userData.zohoContactID;

    // const invoiceData2 = {
    //   "branch_id": "650580000000098357",
    //   "autonumbergenerationgroup_id": "650580000004188098",
    //   "payment_terms": 0,
    //   "payment_terms_label": "Due on Receipt",
    //   "customer_id": zohoCustomerId,
    //   // "contact_persons": [
    //   //   zohoContactId
    //   // ],
    //   // "invoice_number": "PW/2023-2024/16069",
    //   // "invoice_number": "INV-696969",
    //   "place_of_supply": "TN",
    //   "gst_treatment": "business_none",
    //   "gst_no": "",
    //   discount: 0.0,
    //   "date": formatDate(new Date(orderDetails.orderData[0].createdAt), true),
    //   "due_date": formatDate(new Date(orderDetails.orderData[0].createdAt), true),
    //   total: orderDetails.orderData[0].amountPaid,
    //   "line_items": [
    //     orderDetails.orderData[0].items.map((item, i) => {
    //       let currentDesignItem = designsData.designs.find(design => design._id + '' == item.designId);
    //       return {
    //         item_id: currentDesignItem.product.id,
    //         name: currentDesignItem.designName,
    //         rate: item.price * 1.00,
    //         quantity: parseFloat((+item.quantity).toFixed(2)),
    //         "item_order": i + 1,
    //         "description": "",
    //         "discount": "0%",
    //         "tax_id": "650580000000013321",
    //         "project_id": "",
    //         "tags": [

    //         ],
    //         "tax_exemption_code": "",
    //         "account_id": "650580000000000486",
    //         "item_custom_fields": [

    //         ],
    //         "hsn_or_sac": "61130000",
    //         "gst_treatment_code": "",
    //         "unit": "pcs"
    //       }
    //     })
    //   ],
    //   "shipping_charge": orderDetails.orderData[0].deliveryCharges,
    //   "notes": "Thanks for your business with Printwear.\nPlease write to us for additional information: accounts@printwear.in",
    //   "terms": "Subject to Chennai jurisdiction\nNon refundable transaction\nAll grievences to be addressed within 2 days of receiving invoice\nAXIS BANK\nCOMPANY NAME- SASA PRINTWEAR PVT LTD\nACCOUNT NO - 921020008203409\nIFSC- UTIB0000211\nBRANCH - VALASARAVAKKAM CHENNAI",
    //   "allow_partial_payments": false,
    //   "is_discount_before_tax": "",
    //   "discount": 0,
    //   "discount_type": "",
    //   "adjustment": "",
    //   "adjustment_description": "Standard Shipping",
    //   "salesperson_id": "650580000000108050",
    //   "tax_exemption_code": "",
    //   "tax_authority_name": "",
    //   "zcrm_potential_id": "",
    //   "zcrm_potential_name": "",
    //   "pricebook_id": "",
    //   "template_id": ZOHO_INVOICE_TEMPLATE_ID,
    //   "project_id": "",
    //   "documents": [

    //   ],
    //   "mail_attachments": [

    //   ],
    //   "quick_create_payment": {
    //     "account_id": "650580000000000459",
    //     "payment_mode": "Bank Transfer"
    //   },
    //   "tds_tax_id": "650580000000013032",
    //   "is_tds_amount_in_percent": true
    // }
    const invoiceData = {
      "branch_id": "650580000000098357",
      "autonumbergenerationgroup_id": "650580000004188098",
      "reference_number": testorderid,
      "payment_terms": 0,
      "payment_terms_label": "Due on Receipt",
      "customer_id": zohoCustomerId,
      "contact_persons": [

      ],
      "date": formatDate(new Date(orderDetails.orderData[0].createdAt), true),
      "due_date": formatDate(new Date(orderDetails.orderData[0].createdAt), true),
      "notes": "Thanks for your business with Printwear.\nPlease write to us for additional information: accounts@printwear.in",
      "terms": "Subject to Chennai jurisdiction\nNon refundable transaction\nAll grievences to be addressed within 2 days of receiving invoice\nAXIS BANK\nCOMPANY NAME- SASA PRINTWEAR PVT LTD\nACCOUNT NO - 921020008203409\nIFSC- UTIB0000211\nBRANCH - VALASARAVAKKAM CHENNAI",
      "is_inclusive_tax": false,
      "line_items":
        orderDetails.orderData[0].items.map((item, i) => {
          let currentDesignItem = designsData.designs.find(design => design._id + '' == item.designId);
          return {
            "item_order": 1,
            "item_id": currentDesignItem.product.id,
            "rate": currentDesignItem.price * 1.00,
            "name": currentDesignItem.product.name,
            "description": currentDesignItem.designName,
            "quantity": (item.quantity).toFixed(2),
            "discount": "0%",
            "tax_id": "650580000000013321",
            "tax_name": "SGST + CGST",
            "tax_type": "tax",
            "tax_percentage": 2.5,
            "project_id": "",
            "tags": [

            ],
            "tax_exemption_code": "",
            "account_id": "650580000000000486",
            "item_custom_fields": [

            ],
            "hsn_or_sac": "61130000",
            "gst_treatment_code": "",
            "unit": "pcs"
          }
        }),
      "allow_partial_payments": false,
      "custom_fields": [
        {
          "value": "",
          "customfield_id": "650580000000103311"
        }
      ],
      "is_discount_before_tax": "",
      "discount": 0,
      "discount_type": "",
      "shipping_charge": orderDetails.orderData[0].deliveryCharges,
      "adjustment": "",
      "adjustment_description": "Standard Shipping",
      "salesperson_id": "650580000000108050",
      "tax_exemption_code": "",
      "tax_authority_name": "",
      // "zcrm_potential_id": "",
      // "zcrm_potential_name": "",
      "pricebook_id": "",
      "template_id": ZOHO_INVOICE_TEMPLATE_ID,
      "project_id": "",
      "documents": [

      ],
      "mail_attachments": [

      ],
      // "billing_address_id": "650580000004394004",
      // "shipping_address_id": "650580000004394006",
      "gst_treatment": "business_none",
      "gst_no": "",
      "place_of_supply": "TN",
      "quick_create_payment": {
        "account_id": "650580000000000459",
        "payment_mode": "Bank Transfer"
      },
      "tds_tax_id": "650580000000013032",
      "is_tds_amount_in_percent": true,
      "taxes": [
        {
          "tax_name": "CGST",
          "tax_amount": (orderDetails.orderData[0].totalAmount) * 0.025
        },
        {
          "tax_name": "SGST",
          "tax_amount": (orderDetails.orderData[0].totalAmount) * 0.025
        },
      ],
      "tax_total": (orderDetails.orderData[0].totalAmount) * 0.05
    }
    console.log(invoiceData)

    const zohoInvoiceFormData = new FormData();
    zohoInvoiceFormData.append('JSONString', JSON.stringify(invoiceData));
    zohoInvoiceFormData.append('organization_id', ZOHO_INVOICE_ORGANIZATION_ID);
    zohoInvoiceFormData.append('is_quick_create', 'true');
    console.log(zohoInvoiceFormData);

    const zohoInvoiceCreateRequest = await fetch(`https://www.zohoapis.in/books/v3/invoices?organization_id=${ZOHO_INVOICE_ORGANIZATION_ID}&send=false`, {
      // const zohoInvoiceCreateRequest = await fetch(`https://books.zoho.in/api/v3/invoices`, {
      method: "POST",
      headers: {
        Authorization: 'Zoho-oauthtoken ' + zohoToken,
        // "Content-Type": "application/json"
      },
      body: zohoInvoiceFormData
    });
    const zohoInvoiceCreateResponse = await zohoInvoiceCreateRequest.json();
    res.json(zohoInvoiceCreateResponse);
    // console.log(zohoInvoiceCreateResponse);

  } catch (error) {
    console.log(error);
    res.send(error);
  }
}


// dummy testing endpoint for testing santo woocomms order creation
// testing done. so probably remove 
// removed, maybe need na add from git

// dummy endpoint for adding new product data in womens rn
exports.addwomens = async (req, res) => {
  try {
    const colorHexCodes = {
      "black": "#000000",
      "pink": "#ffb6c1",
      "charcoal melange": "#464646",
      "ecru melange": "#F5F5DC",
      "grey melange": "#808080",
      "mustard yellow": "#FFDB58",
      "navy blue": "#000080",
      "red": "#FF0000",
      "white": "#FFFFFF",
      "army green": "#4B5320",
      "royal blue": "#4169E1",
      "maroon": "#800000",
      "lemon yellow": "#FFF44F",
      "olive green": "#556B2F",
      "leaf green": "#228B22",
      "beige": "#F5F5DC",
      "yellow": "#FFFF00",
      "navy": "#000080",
      "turquoise": "#40E0D0",
      "turcoise blue": "#00FFEF",
      "turquoise blue": "#40e0d0",
      "chocolate brown": "#7B3F00",
      "sky blue": "#87CEEB",
      "bottle green": "#006A4E",
      "iris lavender": "#897CAC"
    };
    const { zohoProgGroups } = require("../../.test_assets/zohoProgGroups");
    const womensRN = zohoProgGroups.itemgroups.filter(itemgroup => /WOMENS RN/.test(itemgroup.group_name))
    const y = {
      "_id": "6520cee2094cfa85e4fcbd1b",
      "style": "Womens Round Neck",
      "brand": "PRINTWEAR",
      "manufacturer": "I CLOTHING",
      "description": "Item available for designing",
      "group": "WOMENS",
      "baseImage": {
        "front": "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Fwomens%20rn%20WHITE.jpg?alt=media&token=45a08662-ee07-410f-b53d-1d0c02ef5532",
        "back": "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Fwomens%20rn%20WHITE-BACK.jpg?alt=media&token=ffd62e6d-0fe5-4a88-a6d2-08dba8c6e8ee"
      },
      "colors": {

      },
      "canvas": {
        "front": {
          "startX": 0,
          "startY": 0,
          "width": 13,
          "height": 18
        },
        "back": {
          "startX": 0,
          "startY": 0,
          "width": 13,
          "height": 18
        }
      }
    }
    // womensRN.forEach(women => {
    //   women.items.forEach(item => {
    //     let colorName = item.name.split(" ")[6]
    //     actualData.colors[colorName] = {
    //       "frontImage": "",
    //       "backImage": "",
    //       "colorCode": colorHexCodes[colorName],
    //     }
    //   })
    // })
    womensRN.forEach(group => {
      const groupName = group.group_name.replace("WOMENS RN ", ""); // Extract color name

      // Convert color name to title case
      const colorName = groupName.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

      // Initialize colors object if not present
      if (!y.colors[colorName]) {
        y.colors[colorName] = {
          "frontImage": "",
          "backImage": "",
          "colorCode": colorHexCodes[colorName.toLowerCase()],
          sizes: {}
        };
      }

      // Iterate through items in the group
      group.items.forEach(item => {
        console.log(item.name);
        let sizeKey = item.name.split(' - ')[1]?.trim(); // Extract size name
        if (!sizeKey) sizeKey = item.name.split('-')[1].trim()

        if (!y.colors[colorName].sizes[sizeKey]) {
          y.colors[colorName].sizes[sizeKey] = {
            "id": item.item_id,
            "name": item.name,
            "stock": item.available_stock,
            "price": item.rate,
            "sku": item.sku,
            "dimensions": {
              "length": 28,
              "chest": 38,
              "sleeve": 7.5,
              "weight": 0.5
            }
          };
        }
      });
    });
    res.json(y);
  } catch (error) {
    console.log("🚀 ~ exports.addwomens= ~ error:", error)
    res.json({ 0: 0 })
  }
}


/// WEBHOOKS
// webhook for cashfree to hit and notify about payment
exports.createshiporder = async (req, res) => {

  console.log(req.body);

  const statusType = req.body.type;

  if (statusType === 'WEBHOOK') return res.status(200).send("OK");

  if (statusType === 'PAYMENT_CHARGES_WEBHOOK') return res.json({ message: "OK" });

  if (statusType === 'PAYMENT_SUCCESS_WEBHOOK') {
    const userid = req.body.data.customer_details.customer_id;
    const cf_order_id = req.body.data.order.order_id;

    if (idempotencyKeys.has(cf_order_id)) {
      console.log("Response 200 sent after checking idempotency");
      return res.status(200).send("OK");
    }

    res.status(200).send("OK");

    clearIdempotencyKeys();

    idempotencyKeys.add(cf_order_id);

    console.log(`PAYMENT OK for ${userid} on ${new Date().toLocaleString()}`)

    try {
      // check if CF order ID has RECHARGE_{no} in it and if so, handle wallet increase and return
      if (cf_order_id.split("_")[0] == "RECHARGE") {
        const UserWallet = await WalletModel.findOne({ userId: userid });
        if (!UserWallet) return console.log(`Couldn't find wallet for ${userid}`);

        const currentTransactionIndex = UserWallet.transactions.findIndex(transaction => transaction.walletOrderId == cf_order_id);
        console.log(currentTransactionIndex);
        if (currentTransactionIndex == -1) return console.log(`Couldn't find transaction with ID: ${cf_order_id}`);
        
        // check if that wallet already has been updated because 2nd duplicate webhook take time and pass the idempotency check
        if (UserWallet.transactions[currentTransactionIndex].transactionStatus === "success") return console.log(`[DUPLICATE] Received webhook for ${cf_order_id} and updated already.`)

        UserWallet.transactions[currentTransactionIndex].amount = req.body.data.payment.payment_amount;
        UserWallet.transactions[currentTransactionIndex].transactionStatus = "success";
        UserWallet.balance += req.body.data.payment.payment_amount;

        await UserWallet.save();
        return;
      }

    } catch (error) {
      console.log("General error");
      console.log(error);
      const userid = req.body.data.customer_details.customer_id;
      const cf_order_id = req.body.data.order.order_id;
      console.log("Failed to create order for: " + userid + "CF Order Id: " + cf_order_id);
    }
  }

  if (statusType === 'PAYMENT_FAILED_WEBHOOK') {
    const userid = req.body.data.customer_details.customer_id;
    res.send("OK");
    try {
      if (cf_order_id.split("_")[0] == "RECHARGE") {
        const UserWallet = await WalletModel.findOne({ userId: userid });
        if (!UserWallet)
          return console.log(`Couldn't find wallet for ${userid}`);

        const currentTransactionIndex = UserWallet.transactions.findIndex(
          (transaction) => transaction.walletOrderId == cf_order_id
        );
        console.log(currentTransactionIndex);
        if (currentTransactionIndex == -1)
          return console.log(
            `Couldn't find transaction with ID: ${cf_order_id}`
          );

        // check if that wallet already has been updated because 2nd duplicate webhook take time and pass the idempotency check
        if (
          UserWallet.transactions[currentTransactionIndex].transactionStatus ===
          "failed"
        )
          return console.log(
            `[DUPLICATE] Received webhook for ${cf_order_id} and updated already.`
          );

        UserWallet.transactions[currentTransactionIndex].amount =
          req.body.data.payment.payment_amount;
        UserWallet.transactions[currentTransactionIndex].transactionStatus =
          "failed";
        // UserWallet.balance += req.body.data.payment.payment_amount;

        await UserWallet.save();
        return;
      }
    } catch (error) {
      
    }
  }

  if (statusType === 'REFUND_STATUS_WEBHOOK') {
    const userid = req.body.data.customer_details.customer_id;
    console.log(`REFUND DETAILS for ${userid} on ${new Date().toLocaleString()}`);
    res.send("OK");
  }

}

// webhook for woocommerce to hit when order is updated
exports.woowebhook = async (req, res) => {
  try {
    console.log("🚀 ~ exports.woowebhook= ~ req:", req.body)
    res.send("OK");
    const wooCommerceOrderId = req.body.number;
    if (!wooCommerceOrderId) console.log("WooCommerce webhook failed. No order number.");
    const OrderHistoryData = await OrderHistoryModel.findOneAndUpdate({ "orderData": { $elemMatch: { wooOrderId: wooCommerceOrderId } } }, { $set: { "orderData.$.deliveryStatus": req.body.status } }, { new: true });
    console.log("🚀 ~ updated order history after webhook", OrderHistoryData)
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "error" });
  }
}



//// testing endpoints.. do not commit
exports.testing = async (req, res) => {
  /* can save or not toggle */
  const canSave = false;

  const extractTransactionHistoryFromUserID = () => {
    const ids = pw_users.at(2).data.map(d => d.ID);
    const isthere = pw_transaction_history.at(2).data.filter(d => ids.includes(d.user_id))
    const x = []
    // const y = new Se;
    isthere.forEach(i => {
      let ix = x.findIndex(z => z.user_id == i.user_id);
      // if (i.current_amount < 0) return;
      if (ix == -1) {
        x.push({
          user_id: i.user_id,
          transactions: [
            { ...i }
          ]
        })
      } else {
        x[ix].transactions.push(i)
      }
    })

    return x
  }
  // the following function needs to be called on every object that has gone thru the above function's filtering process
  const extractUserDataFromBigJSON = (id) => {
    let userData = detailedUsers.find(d => d.ID == id);
    return {
      name: userData.display_name,
      email: userData.user_email,
      // phone: userData.billing_phone,
      firstName: userData.first_name,
      lastName: userData.last_name,
      password: 'RESET',
      billingAddress: {
        firstName: userData.billing_first_name == "" ? userData.billing_company : userData.billing_first_name,
        lastName: userData.billing_last_name,
        state: userData.billing_state,
        city: userData.billing_city,
        pincode: userData.billing_postcode,
        phone: userData.billing_phone
      },
      phone: '+91' + userData.billing_phone,
      wooCustomerId: getCustomerIdFromUserId(id),
      wooUserId: id,
    }
  }
  const getCustomerIdFromUserId = (id) => {
    return pw_wc_customer_lookup[2].data.find(c => c.user_id == id).customer_id
  }
  const extractOrderDataFromCustomerId = (id) => {
    const orders = pw_wc_order_stats[2].data.filter(x => x.customer_id == id);
    return orders
  }
  const extractLabelDataFromUserId = (id) => {
    const brandsFromId = brands[2].data.filter(data => data.created_by == id).map(brand => ({ name: brand.brand_image_name, url: OLD_PUBLIC_URL + brand.brand_image_url }));
    const labelData = new LabelModel({})
    labelData.labels.push(...brandsFromId);
    return labelData.labels;
  }
  // const extractProductLookupFromOrderId = (id) => {
  //   // extrqact product lookup as well as the order meta with order_item_id
  //   return [...pw_woocommerce_order_items[2].data.filter(item => item.order_id == id).map(item => {
  //     if (item.order_item_type == "line_item") {
  //       let current_item_meta = pw_wc_order_product_lookup[2].data.find(x => x.order_item_id == item.order_item_id);
  //       return ({ ...item, order_meta: current_item_meta, design_meta: user_designs[2].data.find(des => des.product_id == current_item_meta.product_id && des.variation_id == current_item_meta.variation_id && des.created_by == id) })
  //     }
  //     return item
  //   })
  //   ]
  // }
  const extractDesignsFromUserId = (id) => {
    return user_designs[2].data.filter(design => design.created_by == id)
  }
  const extractProductLookupFromOrderId = (id, user_id) => {
    // extrqact product lookup as well as the order meta with order_item_id
    let designs_of_this_order = extractDesignsFromUserId(user_id).filter(x => x.order_id == id)
    return [...pw_woocommerce_order_items[2].data.filter((item) => item.order_id == id).map((item, i) => {
      if (item.order_item_type == "line_item") {
        let current_item_meta = pw_wc_order_product_lookup[2].data.find(x => x.order_item_id == item.order_item_id);
        return ({ ...item, order_meta: current_item_meta, design_meta: designs_of_this_order[i] })
      }
      return item
    })
    ]
  }
  const extractDesignImagesFromUserId = (id) => {
    return design_library[2].data.filter(x => x.created_by == id)
  }
  const extractMockupsFromUserId = (id) => {
    return mockup_design[2].data.filter(design => design.created_by == id);
  }
  const extractProductDataFromProductId = (id) => {
    return pw_wc_product_meta[2].data.find(product => product.product_id == id);
  }
  const extractOrderMetaFromOrderId = (id) => {
    const x = pw_postmeta[2].data.filter(data => data.post_id == id)
    const order_meta = {}
    x.forEach(item => {
      order_meta[item.meta_key] = item.meta_value
    })
    return order_meta
  }


  const uploadWalletData = async (userId, wooUserId) => {
    //exttract data from json
    const transData = extractTransactionHistoryFromUserID().find(x => x.user_id == wooUserId);

    // save to mongo
    const walletData = new WalletModel({
      userId: userId,
      // balance: oneUser.transactions.at(-1).current_amount,
      transactions: transData.transactions.map(transaction => {
        let orderMeta = extractOrderMetaFromOrderId(transaction.order_id)
        let x = {
          amount: transaction.amount,
          wooOrderId: transaction.order_id,
          walletOrderId: transaction.transaction_id,
          transactionStatus: "success",
          transactionNote: transaction.comments,
          transactionType: transaction.type === "credit" ? "recharge" : "payment",
          transactionDate: new Date(transaction.updated_at),
        }
        if (orderMeta.invoice_url) x.invoiceURL = orderMeta.invoice_url
        return x
      })
    })
    walletData.balance = ((transData.transactions.reduce((acc, curr) => (curr.type == "credit") ? acc + parseFloat(curr.amount) : acc - parseFloat(curr.amount), 0))).toFixed(2)
    if (canSave) await walletData.save({ validateBeforeSave: false }); // when done
    return walletData // test
  }
  const uploadLabelData = async (userId, wooUserId) => {
    const labels = new LabelModel({
      userId: userId,
      labels: extractLabelDataFromUserId(wooUserId)
    })
    if (canSave) await labels.save({ validateBeforeSave: false });
    return labels
  }
  const uploadDesignImageData = async (userId, wooUserId) => {
    const designImages = extractDesignImagesFromUserId(wooUserId);
    let imss = [];
    for (let i = 0; i < designImages.length; i++) {
      let fs = (await imageFileSize(OLD_PUBLIC_URL + designImages[i].image_url)) / 1000;
      imss.push({
        url: OLD_PUBLIC_URL + designImages[i].image_url,
        name: designImages[i].image_name,
        size: fs,
        format: designImages[i].extension,
        isWooDeleted: false
      })
    }
    // console.log("🚀 ~ imss ~ imss:", imss)
    const designImageData = new ImageModel({
      userId: userId,
      images: imss
    })
    if (canSave) await designImageData.save({ validateBeforeSave: false });
    return designImageData;
  }
  const uploadOrderData = async (userId, wooUserId, designsData) => {
    const transactions = extractTransactionHistoryFromUserID().find(x => x.user_id == wooUserId).transactions;
    // console.log("🚀 ~ uploadOrderData ~ transactions:", transactions)
    const orders = extractOrderDataFromCustomerId(getCustomerIdFromUserId(wooUserId)).map(order => {
      return {
        ...order,
        product_lookup: extractProductLookupFromOrderId(order.order_id, wooUserId),
        order_meta: extractOrderMetaFromOrderId(order.order_id)
      }
    });
    const orderHistoryData = new OrderHistoryModel({
      userId: userId,
      orderData: orders.map(order => {
        let y = transactions.find(trans => trans.order_id == order.order_id)
        // console.log("🚀 ~ uploadOrderData ~ y:", y)
        return {
          createdAt: order.date_created,
          printwearOrderId: order.order_id,
          wooOrderId: order.order_id,
          amountPaid: order.total_sales,
          deliveryCharges: order.shipping_total,
          taxes: order.tax_total,
          deliveryStatus: order.status.split("-")[1],
          totalAmount: (parseFloat(order.net_total) + parseFloat(order.shipping_total)).toFixed(2),
          walletOrderId: y?.transaction_id,
          cashOnDelivery: order.product_lookup.find(lkp => lkp.order_item_type == "fee") ? true : false,
          shipRocketCourier: {
            courierId: order.order_meta.is_pickup_option == "Yes"? "-1": null,
            courierName: order.order_meta.is_pickup_option == "Yes"? "Self pickup": order.product_lookup.find(lkp => lkp.order_item_type == "shipping")?.order_item_name,
          },
          items: order.product_lookup.filter(order => order.order_item_type == "line_item").map(order => {
            let currDesignFromMongo = designsData.designs.find(design => design.designSKU == order.design_meta.cart_id);
            return {
              designId: currDesignFromMongo?._id,
              price: currDesignFromMongo?.price,
              quantity: order?.product_qty,
            }
          }),
          paymentStatus: "success",
          billingAddress: {
            firstName: order.order_meta._billing_first_name,
            lastName: order.order_meta._billing_last_name,
            email: order.order_meta._billing_email,
            mobile: order.order_meta._billing_phone,
          },
          customerOrderId: order.order_meta.reference_number,
          shippingAddress: {
            firstName: order.order_meta._shipping_first_name,
            lastName: order.order_meta._billing_last_name,
            email: order.order_meta.shipping_email,
            mobile: order.order_meta._billing_phone,
            streetLandmark: order.order_meta._shipping_address_1 + " " + order.order_meta._shipping_address_2,
            city: order.order_meta._shipping_city,
            pincode: order.order_meta._shipping_postcode,
            state: order.order_meta._shipping_state,
            country: order.order_meta._shipping_country
          },
          cashOnDelivery: parseInt(order.order_meta.printwear_cod_order_charges) > 0? true: false
        }
      })
    })
    if (canSave) orderHistoryData.save({ validateBeforeSave: false });
    return orderHistoryData
  }
  const uploadMockupsData = async (userId, wooUserId) => {
    const mockups = extractMockupsFromUserId(wooUserId);
    // console.log("🚀 ~ uploadDesignsData ~ designs:", designs)
    // let x = []
    // const orderDataBecausePriceIsInThat = extractOrderDataFromCustomerId(getCustomerIdFromUserId(wooUserId)).map(order => x.push(...extractProductLookupFromOrderId(order.order_id)))
    mockups.forEach(mockup => {
      mockup.product = { ...extractProductDataFromProductId(mockup.product_id) }
    })
    return mockups
  }
  const uploadDesignsData = async (userId, wooUserId) => {
    const colorHexCodes = {
      "black": "#000000",
      "pink": "#ffb6c1",
      "charcoal melange": "#464646",
      "ecru melange": "#F5F5DC",
      "grey melange": "#808080",
      "mustard yellow": "#FFDB58",
      "navy blue": "#000080",
      "red": "#FF0000",
      "white": "#FFFFFF",
      "army green": "#4B5320",
      "royal blue": "#4169E1",
      "maroon": "#800000",
      "lemon yellow": "#FFF44F",
      "olive green": "#556B2F",
      "leaf green": "#228B22",
      "beige": "#F5F5DC",
      "yellow": "#FFFF00",
      "navy": "#000080",
      "turquoise": "#40E0D0",
      "turcoise blue": "#00FFEF",
      "turquoise blue": "#40e0d0",
      "chocolate brown": "#7B3F00",
      "sky blue": "#87CEEB",
      "bottle green": "#006A4E",
      "iris lavender": "#897CAC"
    };
    const designs = extractDesignsFromUserId(wooUserId);
    const designsWithProductData = designs.map(design => ({ ...design, product_meta: extractProductDataFromProductId(design.variation_id) }))
    // console.log("🚀 ~ uploadDesignsData ~ designsWithProductData:", designsWithProductData)
    const designsData = new NewDesignModel({
      userId: userId,
      designs: designsWithProductData.map(design => {
        let currColor = design.product_name.split(",")[0]?.split(" ").at(-1);
        return {
          product: {
            id: design.product_id + "-" + design.product_meta?.product_id,
            name: design.product_name,
            style: '',
            color: currColor,
            hex: colorHexCodes[currColor.toLowerCase()],
            size: design.product_name.split(",")[1].trim(),
            SKU: design.product_meta?.sku,
            price: parseFloat(design.product_meta?.min_price),
            // baseImage is missing
            // dimensions not necessary
          },
          designSKU: design.cart_id,
          designName: design.product_name,
          price: parseFloat(design.product_meta?.min_price) + parseFloat(design.front_printing_price) + parseFloat(design.back_printing_price) + 20 + parseFloat((design.is_brand == "1") ? 10 : 0),
          backPrice: design.back_printing_price == "0" ? 0 : parseFloat(design.product_meta?.min_price) + parseFloat(design.back_printing_price),
          frontPrice: design.front_printing_price == "0" ? 0 : parseFloat(design.product_meta?.min_price) + parseFloat(design.front_printing_price),
          designDimensions: {
            width: design.front_size_width,
            height: design.front_size_height,
            top: design.front_top_position,
            left: design.front_left_position,
          },
          backDesignDimensions: {
            width: design.back_size_width,
            height: design.back_size_height,
            top: design.back_top_position,
            left: design.back_left_position,
          },
          designImage: {
            front: design.front_mockup_image ? OLD_PUBLIC_URL + design.front_mockup_image : "",
            back: design.back_mockup_image ? OLD_PUBLIC_URL + design.back_mockup_image : "",
          },
          designItems: [
            {
              itemName: design.front_design_image?.split("/").at(-1),
              URL: OLD_PUBLIC_URL + design.front_design_image
            },
            design.back_design_image ? ({
              itemName: design.back_design_image.split("/").at(-1),
              URL: OLD_PUBLIC_URL + design.back_design_image
            }) : null,
          ],
          neckLabel: '',
          isMigrated: true,
          wooProductId: design.product_id,
          wooVariationId: design.variation_id
        }
      })
    });
    if (canSave) await designsData.save({ validateBeforeSave: false });
    return designsData
  }
  const uploadUserDataToMongo = async (id) => {
    // const userData = await UserModel.create(extractUserDataFromBigJSON(id)); // use in prod
    const userData = new UserModel(extractUserDataFromBigJSON(id));
    if (canSave) await userData.save({ validateBeforeSave: false });
    // console.log("🚀 ~ uploadUserDataToMongo ~ userData:", userData.toJSON())
    const mongoUserId = userData._id;
    const wooCusomterId = getCustomerIdFromUserId(id); // customer_id vaangu for orders
    console.log("🚀 ~ uploadUserDataToMongo ~ wooCusomterId:", wooCusomterId)
    const walletData = await uploadWalletData(mongoUserId, id);
    console.log("upload wallet data over for " + id + " " + userData.name)
    const labelData = await uploadLabelData(mongoUserId, id);
    console.log("upload label data over for " + id + " " + userData.name)
    const designImageData = await uploadDesignImageData(mongoUserId, id);
    console.log("upload design images data over for " + id + " " + userData.name)
    const designsData = await uploadDesignsData(mongoUserId, id);
    console.log("upload designs data over for " + id + " " + userData.name)
    const orderData = await uploadOrderData(mongoUserId, id, designsData);
    console.log("upload order data over for " + id + " " + userData.name)
    return ({ userData: userData.toObject(), walletData: walletData.toObject(), labelData: labelData.toObject(), designImageData: designImageData.toObject(), designsData: designsData.toObject(), orderData: orderData.toObject() });
  }


  const compareDates = (d1, d2) => {
    let date1 = new Date(d1).getTime();
    let date2 = new Date(d2).getTime();

    if (date1 < date2) {
      return 1
    } else if (date1 > date2) {
      return 2
    } else {
      return 3
    }
  };

  try {
    const userIdToFind = "2980";
    // const userIdToFind = "2980";
    // const userIdToFind = ["308", "2187", "6858", ] /////// USE THIS WHEN SAVING.. ADD ALL IDs to LOOP THRU

    // const firstFilterUserIDs = detailedUsers.filter(user => {
    //   let date = new Date(user.wc_last_active)
    //   let currDate = new Date(Date.now()).toLocaleDateString();
    //   let lastYearDateCutoff = new Date("2023-11-01")
    //   return (compareDates(date, lastYearDateCutoff) == 2)
    // }).map(x => x.ID + '');
    // console.log("🚀 ~ firstFilterUserIDs ~ firstFilterUserIDs:", firstFilterUserIDs)
    // const x = {}
    // const transactionsFiltered = pw_transaction_history.at(2).data.filter(y => firstFilterUserIDs.includes(y.user_id + ''));
    // const z = transactionsFiltered.forEach(y => {
    //   if (!x[y.user_id]) x[y.user_id] = [];
    //   x[y.user_id].push(y)
    // });
    let transLast5Mnths = pw_transaction_history.at(2).data.filter(trans => {
      let date = new Date(trans.date)
      let lastYearDateCutoff = new Date("2023-11-01")
      return (compareDates(date, lastYearDateCutoff) == 2)
    })

    // res.json({
    //   // user: detailedUsers.find(x => x.ID == userIdToFind),
    //   // trans: extractTransactionHistoryFromUserID().find(x => x.user_id == userIdToFind),
    //   orders: extractOrderDataFromCustomerId(getCustomerIdFromUserId(userIdToFind)).map(order => {
    //     return {
    //       ...order,
    //       product_lookup: extractProductLookupFromOrderId(order.order_id, userIdToFind),
    //       order_meta: extractOrderMetaFromOrderId(order.order_id)
    //     }
    //   }),
    //   // mockups: await uploadMockupsData('', userIdToFind),
    //   designs: await uploadDesignsData('', userIdToFind),
    //   // ord: await uploadOrderData('', userIdToFind)
    //   // labels: extractLabelDataFromUserId(userIdToFind)
    // });
    
    /////// THIS IS FOR SAVING DATA
    // for(let i=0; i<userIdToFind.length; i++) {
    //   const finalDataBeforeSavingToMongo = await uploadUserDataToMongo(userIdToFind[i])
    //   console.log(`🚀 userId: ${userIdToFind[i]} saved!`, finalDataBeforeSavingToMongo)
    // }
    // res.send("Ok")
    

  } catch (error) {
    console.log(error);
    res.send(error);
  }
}