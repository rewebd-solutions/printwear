const cashfreeAppID = process.env.CASH_APP_ID;
const cashfreeSecretKey = process.env.CASH_SECRET_KEY;
const zohoRefreshToken = process.env.ZOHO_REFRESH_TOKEN;
const zohoClientID = process.env.ZOHO_CLIENT_ID;
const zohoClientSecret = process.env.ZOHO_CLIENT_SECRET;

const WEBHOOK_URL = process.env.WEBHOOK_URL;

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

const SHIPROCKET_BASE_URL = process.env.SHIPROCKET_URL;
const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL;
const ZOHO_INVOICE_ORGANIZATION_ID = 60010804173;

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

  const user = UserModel.create({
    name: req.body.name,
    email: req.body.email,
    password: crypto.createHash(algorithm).update(req.body.password).digest("hex"),
    phone: '+91' + num.toString(),
    emailVerified: false,
    phoneVerified: false,
    profileImage: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png'
  })
    .then(() => {
      //res.send(data)
      res.render("login", { status: "Account created. Log In" });
    })
    .catch(err => {
      console.log(err);
      res.render("login", { status: "Error saving data, try again" })
    });
}

exports.login = async (req, res) => {
  // console.log(req.body);
  const check = await UserModel.findOne({ email: req.body.email })

  if (check === null) {
    return res.render("login", { status: "User does not exist" });
  }

  if (check.password === crypto.createHash(algorithm).update(req.body.password).digest("hex")) {
    // console.log("inga vardhu")
    const cookieToken = authServices.createToken(check._id, check.name);
    res.cookie("actk", cookieToken, {
      httpOnly: true,
      secure: true
    });
    // console.log("cookie set");
    return res.redirect("/dashboard");
  }
  else {
    return res.render("login", { status: "Invalid details" });
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
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding 1 to month since it's zero-based
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
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

    const shopifyStoreDetails = await StoreModel.findOne({ userid: userId });
    const shopifyStoreData = shopifyStoreDetails.shopifyStore;

    const SHOPIFY_ACCESS_TOKEN = shopifyStoreData.shopifyAccessToken;
    const SHOPIFY_SHOP_URL = shopifyStoreData.shopifyStoreURL;
    const SHOPIFY_SHOP_NAME = shopifyStoreData.shopName;

    const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2023-07/orders.json`;

    try {
      const shopifyStoreOrderRequest = await fetch(shopifyEndpoint, {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        }
      })
      const shopifyStoreOrderResponse = await shopifyStoreOrderRequest.json();
      res.json(shopifyStoreOrderResponse);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error });
    }

  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}

// endpoints for connecting stores
exports.connectShopify = async (req, res) => {
  const reqBody = req.body;
  // console.log(req.userId);
  const SHOPIFY_ACCESS_TOKEN = reqBody.access_token;
  const SHOPIFY_SHOP_URL = reqBody.store_url
  const SHOPIFY_SHOP_NAME = reqBody.store_name
  // console.log(SHOPIFY_ACCESS_TOKEN + SHOPIFY_SHOP_URL)

  const shopifyEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2023-07/orders.json?status=open&fields=created_at,id,name,total-price,contact-email`

  try {
    const fetchReq = await fetch(shopifyEndpoint, {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
      }
    })
    const fetchData = await fetchReq.json();
    // console.log(fetchData);

    if (!fetchReq.ok) return res.status(400).json({ error: "Couldn't find store" });

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

    res.status(200).render('connectstore', { status: "Added Shopify Store" }); // idhu redirect pannidu
    return;

  } catch (error) {
    console.log("Error in Shopify connect " + error)
    res.status(400).json({ error })
    return;
  }
}

exports.connectWooCommerce = async (req, res) => {
  const reqBody = req.body;
  // console.log(reqBody);
  const WOOCOMMERCE_CONSUMER_KEY = reqBody.consumer_key;
  const WOOCOMMERCE_CONSUMER_SECRET = reqBody.consumer_secret;
  const WOOCOMMERCE_SHOP_URL = reqBody.store_url
  const WOOCOMMERCE_SHOP_NAME = reqBody.store_name

  try {
    //do the thing to create woo obj
    const api = new WooCommerceRestApi({
      url: "https://" + WOOCOMMERCE_SHOP_URL + "/",
      consumerKey: WOOCOMMERCE_CONSUMER_KEY,
      consumerSecret: WOOCOMMERCE_CONSUMER_SECRET,
      version: "wc/v3"
    });
    const orders = await api.get("orders", {
      status: 'cancelled',
      per_page: '2',
    });

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

    res.status(200).render('connectstore', { status: "Added WooCommerce Store" });
    return;

  } catch (error) {
    console.log("Error in woocommerce connect " + error)
    res.status(400).json({
      message: error
    })
    return;
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
    const fileBuffer = req.file.buffer;
    // console.log(fileBuffer);
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
    res.status(200).json({ message: "Design successful!" });
  } catch (error) {
    console.log(error);
    res.status(500);
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
    res.json(userDesigns);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}

// create shopify order
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
          price: designData.price.toFixed(2),
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
    regular_price: designData.price + '',
    sale_price: designData.price + '',
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

// temp for creating zoho products
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
      orderData.items.push(
        {
          designId: req.body.designId,
          productId: req.body.productId,
          price: req.body.price
        });
      orderData.totalAmount = orderData.items.reduce((total, item) => total + item.price, 0).toFixed(2);
      orderData.printwearOrderId = otpGen.generate(6, { digits: true, lowerCaseAlphabets: false, specialChars: false });
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

    await orderData.save();

    res.json({ totalPrice: orderData.totalAmount });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: '500 Internal Server Error' });
  }
}


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
      courierData
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
        order_amount: parseFloat((orderData.totalAmount + orderData.deliveryCharges).toFixed(2)),
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
          return_url: WEBHOOK_URL + "manageorder"
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
        //just for testing.. remove the below line after testing done
        // printwearOrderId: orderData.printwearOrderId,
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
        }
      },
    });

    res.status(200).json({ link: paymentLinkResponse.payment_session_id });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to create payment link!" });
  }
}

// endpoints for creating orders in shiprocket
exports.calculateshippingcharges = async (req, res) => {
  try {
    const { weight, pincode } = req.body;
    //verify pincode
    const pincodeRequest = await fetch("https://api.postalpincode.in/pincode/" + pincode);
    const pincodeResponse = await pincodeRequest.json();
    if (!pincodeResponse[0].Status == "Success") return res.status(500).json({ message: "Pincode could not be verified" });

    // get couriers
    const shippingChargeRequest = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/serviceability?pickup_postcode=600087&weight=${weight}&delivery_postcode=${pincode}&cod=0`, {
      headers: {
        'Authorization': 'Bearer ' + (await generateShiprocketToken()).token
      }
    });
    const shippingChargeResponse = await shippingChargeRequest.json();
    console.log(shippingChargeResponse)
    if (shippingChargeResponse.status != 200) return res.status(shippingChargeResponse.status_code || shippingChargeResponse.status).json({ message: shippingChargeResponse.message });

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


// webhook for cashfree to hit and notify about payment
exports.createshiporder = async (req, res) => {
  // every 10 days token refersh.. thru .env manually
  // get ordermodel and update amountPaid. and payment success.

  console.log(req.body);

  const statusType = req.body.type;

  if (statusType === 'WEBHOOK') return res.status(200).send("OK");

  if (statusType === 'PAYMENT_CHARGES_WEBHOOK') return res.json({ message: "OK" });

  if (statusType === 'PAYMENT_SUCCESS_WEBHOOK') {
    const userid = req.body.data.customer_details.customer_id;
    const cf_order_id = req.body.data.order.order_id;

    if (idempotencyKeys.has(cf_order_id)) {
      return res.status(200).send("OK");
    }

    clearIdempotencyKeys();

    idempotencyKeys.add(cf_order_id);

    console.log(`PAYMENT OK for ${userid} on ${new Date().toLocaleString()}`)

    try {
      const orderData = await OrderModel.findOne({ userId: userid, printwearOrderId: req.body.data.order.order_id });

      if (!orderData) return res.json({ message: "ok" });

      const designData = await NewDesignModel.findOne({ userId: userid });
      const labelData = await LabelModel.findOne({ userId: userid });
      // i think i did this for fooling cashfree webhook hitting twice but didnt work ig
      // let orderId = orderData.printwearOrderId;
      // orderData.printwearOrderId = null;
      // await orderData.save();

      let customerOrderId = orderData.customerOrderId;

      orderData.paymentStatus = "success";
      orderData.amountPaid = req.body.data.payment.payment_amount;

      // create shiprocket order based on webhook status
      // once created, remove existing order data all the way to orderHistory collection.
      // remove OrderModel's printwearOrderId, cashfree stuff, essentially just empty the whole thing
      // before creating shiprocket order, create wordpress woocommerce order for santhosh with shirt design details and then get id for each one
      // then give shiprocket that data
      // after shiprocket and wocoomerce

      const shiprocketToken = await generateShiprocketToken();

      const SHIPROCKET_COMPANY_ID = shiprocketToken.company_id;
      const SHIPROCKET_ACC_TKN = shiprocketToken.token;

      // console.log(SHIPROCKET_ACC_TKN, SHIPROCKET_COMPANY_ID)

      const shiprocketOrderData = ({
        "order_id": customerOrderId,
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
        "shipping_is_billing": false,
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
        "payment_method": "Prepaid",
        "shipping_charges": orderData.deliveryCharges,
        "giftwrap_charges": 0,
        "transaction_charges": 0,
        "total_discount": 0,
        "sub_total": orderData.retailPrice,
        "length": 28,
        "breadth": 20,
        "height": 0.5,
        "weight": (0.25 * (orderData.items.reduce((total, item) => total + item.quantity, 0))).toFixed(2)
      });

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
      console.log(createShiprocketOrderResponse);

      if (!createShiprocketOrderRequest.ok) throw new Error("Failed to create order");

      orderData.shipRocketOrderId = createShiprocketOrderResponse.order_id;
      orderData.shipmentId = createShiprocketOrderResponse.shipment_id;
      orderData.deliveryStatus = "processing";

      if (orderData.shipRocketCourier.courierId != -1) {
        const shipmentAssignRequest = await fetch(SHIPROCKET_BASE_URL + '/courier/assign/awb', {
          headers: {
            "Content-Type": "application/json",
            Authorization: 'Bearer ' + SHIPROCKET_ACC_TKN
          },
          method: "POST",
          body: JSON.stringify({
            shipment_id: createShiprocketOrderResponse.shipment_id,
            courier_id: orderData.shipRocketCourier.courierId
          })
        });
        const shipmentAssignResponse = await shipmentAssignRequest.json();
        console.log(shipmentAssignResponse);
        orderData.shipRocketCourier.courierAWB = shipmentAssignResponse.response.data.awb_code;;
      }

      // let dummyReeponse = {
      //   "awb_assign_status": 1,
      //   "response": {
      //     "data": {
      //       "courier_company_id": 196,
      //       "awb_code": "X45281487",
      //       "cod": 0,
      //       "order_id": 449785485,
      //       "shipment_id": 447954568,
      //       "awb_code_status": 1,
      //       "assigned_date_time": {
      //         "date": "2023-12-10 13:04:37.000000",
      //         "timezone_type": 3,
      //         "timezone": "Asia/Kolkata"
      //       },
      //       "applied_weight": 0.25,
      //       "company_id": 1249024,
      //       "courier_name": "DTDC 500GMS",
      //       "child_courier_name": null,
      //       "freight_charges": 38.37,
      //       "routing_code": "",
      //       "rto_routing_code": "",
      //       "invoice_no": "Retail00661",
      //       "transporter_id": "88AAACD8017H1ZX",
      //       "transporter_name": "",
      //       "shipped_by": {
      //         "shipper_company_name": "Sasa",
      //         "shipper_address_1": "no 33 jai garden",
      //         "shipper_address_2": "3rd street valasaravakkam",
      //         "shipper_city": "Tiruvallur",
      //         "shipper_state": "Tamil Nadu",
      //         "shipper_country": "India",
      //         "shipper_postcode": "600087",
      //         "shipper_first_mile_activated": 0,
      //         "shipper_phone": "9884909019",
      //         "lat": "13.03865525403214",
      //         "long": "80.17112016677858",
      //         "shipper_email": "accounts@printwear.in",
      //         "extra_info": {
      //           "vendor_name": null
      //         },
      //         "rto_company_name": "Sasa",
      //         "rto_address_1": "no 33 jai garden",
      //         "rto_address_2": "3rd street valasaravakkam",
      //         "rto_city": "Tiruvallur",
      //         "rto_state": "Tamil Nadu",
      //         "rto_country": "India",
      //         "rto_postcode": "600087",
      //         "rto_phone": "9884909019",
      //         "rto_email": "accounts@printwear.in"
      //       }
      //     }
      //   },
      //   "no_pickup_popup": 0,
      //   "quick_pick": 0
      // }

      // implement orderhistory
      await OrderHistoryModel.findOneAndUpdate({ userId: userid }, {
        $set: {
          userId: userid
        },
        $push: {
          orderData: orderData
        }
      }, { upsert: true, new: true });

      // await orderData.save();
      // console.dir(orderHistory._doc, { depth: 5 });

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
          shipRocketCourier: 1
        }
      });


      // part where i send the line item data to santo woocomms
      const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
      const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

      const encodedAuth = btoa(`${consumerKey}:${consumerSecret}`);
      const endpoint = `https://print-wear.in/wp-json/wc/v3/products`;

      const productData = orderData.items.map(item => {
        let currentItemDesignData = designData.designs.find(design => design._id + "" == item.designId + "");
        let neckLabelURl = currentItemDesignData.neckLabel ? labelData.labels.find(lab => lab._id + '' == currentItemDesignData.neckLabel + '').url : '';
        return {
          name: currentItemDesignData.designName,
          slug: slugify(currentItemDesignData.designName),
          type: "simple",
          status: "publish",
          regular_price: currentItemDesignData.price + '',
          sale_price: currentItemDesignData.price + '',
          sku: currentItemDesignData.designSKU,
          description: currentItemDesignData.description || 'User generated design. Neck label:' + neckLabelURl,
          short_description: currentItemDesignData.product.name,
          dimensions: {
            length: currentItemDesignData.product.dimensions.length + '',
            width: currentItemDesignData.product.dimensions.chest + '',
          },
          images: [
            {
              src: currentItemDesignData.designImage.front == "false" ? currentItemDesignData.designImage.back : currentItemDesignData.designImage.front,
              name: currentItemDesignData.designName + " image",
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
                currentItemDesignData.product.color
              ],
            },
            {
              id: 1,
              name: "Size",
              position: 0,
              visible: true,
              variation: true,
              options: [
                currentItemDesignData.product.size
              ],
            },
          ],
        }
      });

      console.log(productData);

      // creating multiple POST request for each line item in the order and sending parallel requests
      const woocommerceProductCreateRequests = productData.map(async dataObject => {
        let intermediateRequest = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${encodedAuth}`,
          },
          body: JSON.stringify(dataObject),
        })
        return intermediateRequest.json();
      });

      Promise.all(woocommerceProductCreateRequests)
        .then(responseArray => {
          console.log(responseArray);
        })
        .catch(error => {
          console.log(error);
        })

    } catch (error) {
      console.log(error);
      res.status(500).json({ error });
    }
  }

  if (statusType === 'PAYMENT_FAILED_WEBHOOK') {
    const userid = req.body.data.customer_details.customer_id;
    const orderData = await OrderModel.findOne({ userId: userid, printwearOrderId: req.body.data.order.order_id });
    if (!orderData) return res.send("OK");

    console.log(`PAYMENT FAILED! for ${userid} on ${new Date().toLocaleString()}`);
    orderData.paymentStatus = "failed";

    await OrderHistoryModel.findOneAndUpdate({ userId: userid }, {
      $set: {
        userId: userid
      },
      $push: {
        orderData: orderData
      }
    }, { upsert: true, new: true });

    // await orderData.save();
    // console.dir(orderHistory._doc, { depth: 5 });

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
        shipRocketCourier: 1
      }
    });

    return res.send("OK");
    // return await orderData.save();
  }

  if (statusType === 'REFUND_STATUS_WEBHOOK') {
    const userid = req.body.data.customer_details.customer_id;
    console.log(`REFUND DETAILS for ${userid} on ${new Date().toLocaleString()}`);
    return res.send("OK");
  }

}

//endpoint for initiating refund
exports.initiaterefund = async (req, res) => {
  // 3 levels: CANCEL ORDER (before its even shipped), RETURN ORDER (after it is shipped)
  // for CANCEL ORDER: check if order has a courier assigned.. if so first hit shiprocket API and cancel that assigned courier
  // next hit cashfree API to initiate refund and get the status via webhook
  // else, if not assigned any courier, then simply hit cashfree API and initiate refund
  // i think shiprocket also has webhook? idk i need to see
  // for RETURN ORDER: hit shiprocket API to initiate return, then listen to the event via webhook and then update 
  // orderHistory with appropriate status and all

  const refundFunction = async () => {
    try {
      const cashfreeRefundRequest = await fetch(CASHFREE_BASE_URL + `/orders/${orderToRefund.printwearOrderId}/refunds`, {
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
      console.log(cashfreeRefundResponse);
      if (cashfreeRefundRequest.ok) {
        return "refund_ok";
      }
      return cashfreeRefundResponse.message;
    } catch (error) {
      console.log(error);
      return "Cashfree Refund error";
    }
  }

  const orderHistory = await OrderHistoryModel.findOne({ userId: req.userId });
  const orderToRefund = orderHistory.orderData.find(order => order.printwearOrderId == req.body.orderId);
  const orderToRefundIndex = orderHistory.orderData.findIndex(order => order.printwearOrderId == req.body.orderId);
  // console.log(orderToRefund);
  if (orderToRefund.deliveryStatus == "processing") {
    // if it is still processing and neither picked up nor delivered, simply hit SR API to cancel that order and issue refund
    const shiprocketToken = await generateShiprocketToken();
    const SHIPROCKET_ACC_TKN = shiprocketToken.token;

    try {
      const cancelSROrderRequest = await fetch(`${SHIPROCKET_BASE_URL}/orders/cancel`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: 'Bearer ' + SHIPROCKET_ACC_TKN
        },
        method: "POST",
        body: JSON.stringify({
          ids: [
            orderToRefund.shipRocketOrderId
          ]
        })
      });
      const cancelSROrderResponse = await cancelSROrderRequest.json();
      console.log(cancelSROrderResponse);

      if (cancelSROrderResponse.status_code == 200 || cancelSROrderResponse.status == 200) {
        console.log(orderToRefund.printwearOrderId + " order cancelled");
        orderHistory.orderData[orderToRefundIndex].deliveryStatus = "cancelled";

        let cashfreeRefundStatus = await refundFunction();

        if (cashfreeRefundStatus == 'refund_ok') {
          orderHistory.orderData[orderToRefundIndex].paymentStatus = "refund_init";
          await orderHistory.save();
          return res.status(200).json({ orderData: orderHistory.orderData });
        } else {
          return res.status(500).json({ message: cashfreeRefundStatus });
        }

      } else {
        console.log(orderToRefund.printwearOrderId + " failed to cancel order", cancelSROrderResponse);
        return res.status(cancelSROrderResponse.status_code || cancelSROrderResponse.status).json({ message: cancelSROrderResponse.message });
      }

    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "Server error in cancelling order" });
    }
  }

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
    const orderIDmatches = orderIDs.orderData.find((order) => order.customerOrderId == currentOrderId);
    console.log(orderIDmatches)
    if (!orderIDmatches) {
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
    const orderHistory = await OrderHistoryModel.findOne({ userId: req.userId });
    const orderIds = orderHistory.orderData.map(order => order.shipRocketOrderId);

    const shiprocketToken = await generateShiprocketToken();
    const SHIPROCKET_ACC_TKN = shiprocketToken.token;

    const SRinvoiceRequest = await fetch(`${SHIPROCKET_BASE_URL}/orders/print/invoice`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: 'Bearer ' + SHIPROCKET_ACC_TKN
      },
      method: "POST",
      body: JSON.stringify({
        ids: orderIds
      })
    });

    const SRinvoiceResponse = await SRinvoiceRequest.json();
    console.log(SRinvoiceResponse);
    res.json(SRinvoiceResponse);
    
  } catch (error) {
    console.log(error);
    res.json(error);
  }
}


//endpoint for generating zoho books invoice
exports.generateZohoBooksInvoice = async (req, res) => {
  try {
    const zohoToken = await generateZohoToken();
    // console.log(zohoToken)
    // the following was just for testing.. listing all invoices and holy shit its 393KB!
    // const zohoInvoiceRequest = await fetch(`https://www.zohoapis.in/books/v3/invoices?organization_id=${ZOHO_INVOICE_ORGANIZATION_ID}`, {
    //   headers: {
    //     Authorization: 'Zoho-oauthtoken ' + zohoToken
    //   }
    // });
    // const zohoInvoiceResponse = await zohoInvoiceRequest.json();

    // for now testing, actually obtain userid from the createshiporder userid thing, this endpoint itself is just for test
    let userid = '653e3284308b660442fd55a6';
    const userData = await UserModel.findById(userid);
    // if (!userData.isZohoCustomer) {
    //   // write endpoint to create zoho customer 
    //   let customerData = {
    //     "contact_name": userData.name,
    //     "company_name": userData.brandName ?? 'N/A',
    //     // "custom_fields": [
    //     //   {
    //     //     "value": "GBGD078",
    //     //     "index": 1
    //     //   }
    //     // ],
    //     "billing_address": {
    //       "attention": "Mr.John",
    //       "address": "4900 Hopyard Rd, Suite 310",
    //       "street2": "Suite 310",
    //       "state_code": "CA",
    //       "city": "Pleasanton",
    //       "state": "CA",
    //       "zip": 94588,
    //       "country": "U.S.A",
    //       "fax": 1234,
    //       "phone": "1234"
    //     },
    //     "shipping_address": {
    //       "attention": "Mr.John",
    //       "address": "4900 Hopyard Rd, Suite 310",
    //       "street2": "Suite 310",
    //       "state_code": "CA",
    //       "city": "Pleasanton",
    //       "state": "CA",
    //       "zip": 94588,
    //       "country": "U.S.A",
    //       "fax": 1234,
    //       "phone": "1234"
    //     },
    //     "contact_persons": [
    //       {
    //         "salutation": userData.name,
    //         "first_name": userData.firstName,
    //         "last_name": userData.lastName,
    //         "email": userData.email,
    //         "phone": userData.phone,
    //         "mobile": userData.phone,
    //         "is_primary_contact": true
    //       }
    //     ],
    //     // "default_templates": {
    //     //   "invoice_template_id": 460000000052069,
    //     //   "invoice_template_name": "Standard Template",
    //     // },
    //     "language_code": "en",
    //     // "notes": "Payment option : Through check",
    //     // "vat_reg_no": "string",
    //     // "tax_reg_no": 12345678912345,
    //     "country_code": "IN",
    //     // "vat_treatment": "string",
    //     // "tax_treatment": "string",
    //     // "tax_regime": "general_legal_person",
    //     // "is_tds_registered": true,
    //     "place_of_contact": "TN",
    //     // "gst_no": "22AAAAA0000A1Z5",
    //     // "gst_treatment": "business_gst",
    //     // "tax_authority_name": "string",
    //     // "tax_exemption_code": "string",
    //     // "avatax_exempt_no": "string",
    //     // "avatax_use_code": "string",
    //     // "tax_exemption_id": 11149000000061054,
    //     // "tax_authority_id": 11149000000061052,
    //     // "tax_id": 11149000000061058,
    //     // "tds_tax_id": "982000000557012",
    //     // "is_taxable": true,
    //     // "facebook": "zoho",
    //     // "twitter": "zoho"
    //   }
    //   const zohoCustomerCreateRequest = await fetch(`https://www.zohoapis.in/invoice/v3/contacts`, {
    //     method: "POST",
    //     headers: {
    //       Authorization: 'Zoho-oauthtoken ' + zohoToken,
    //       'X-com-zoho-invoice-organizationid': ZOHO_INVOICE_ORGANIZATION_ID,
    //       'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify(customerData)
    //   });
    //   const zohoCustomerCreateResponse = await zohoCustomerCreateRequest.json();
    //   console.log(zohoCustomerCreateResponse)
    //   if (zohoCustomerCreateResponse.code == 0) {
    //     userData.isZohoCustomer = true;
    //     userData.zohoCustomerID = zohoCustomerCreateResponse.contact.contact_id;
    //   }
    // }
    const invoiceData = {
      "customer_id": userData._id,
      "contact_persons": [
        userData._id
      ],
      // "currency_id": 982000000000190,
      // "invoice_number": "INV-00063",
      "place_of_supply": "TN",
      // "vat_treatment": "string",
      // "tax_treatment": "vat_registered",
      // "gst_treatment": "business_gst",
      // "gst_no": "22AAAAA0000A1Z5",
      // "cfdi_usage": "acquisition_of_merchandise",
      "reference_number": " ",
      // "template_id": 460000000052069,
      "date": "2023-12-10",
      "payment_terms": 15,
      "payment_terms_label": "Net 15",
      "due_date": "2013-12-03",
      "discount": 0,
      "is_discount_before_tax": true,
      "discount_type": "item_level",
      "is_inclusive_tax": false,
      "exchange_rate": 1,
      "recurring_invoice_id": " ",
      "invoiced_estimate_id": " ",
      "salesperson_name": " ",
      "custom_fields": [
        {
          "customfield_id": "46000000012845",
          "value": "Normal"
        }
      ],
      "line_items": [
        {
          "item_id": 982000000030049,
          "project_id": 90300000087378,
          "time_entry_ids": [],
          "product_type": "goods",
          "hsn_or_sac": 80540,
          "sat_item_key_code": 71121206,
          "unitkey_code": "E48",
          "warehouse_id": "",
          "expense_id": " ",
          "expense_receipt_name": "string",
          "name": "Hard Drive",
          "description": "500GB, USB 2.0 interface 1400 rpm, protective hard case.",
          "item_order": 1,
          "bcy_rate": 120,
          "rate": 120,
          "quantity": 1,
          "unit": " ",
          "discount_amount": 0,
          "discount": 0,
          "tags": [
            {
              "tag_id": 982000000009070,
              "tag_option_id": 982000000002670
            }
          ],
          "tax_id": 982000000557028,
          "tds_tax_id": "982000000557012",
          "tax_name": "VAT",
          "tax_type": "tax",
          "tax_percentage": 12.5,
          // "tax_treatment_code": "uae_others",
          "header_name": "Electronic devices"
        }
      ],
      "payment_options": {
        "payment_gateways": [
          {
            "configured": true,
            "additional_field1": "standard",
            "gateway_name": "paypal"
          }
        ]
      },
      "allow_partial_payments": false,
      "custom_body": " ",
      "custom_subject": " ",
      "notes": "Looking forward for your business.",
      "terms": "Terms & Conditions apply",
      "shipping_charge": 0,
      "adjustment": 0,
      "adjustment_description": " ",
      "reason": " ",
      "tax_authority_id": 11149000000061,
      "tax_exemption_id": 11149000000061,
      "avatax_use_code": "string",
      "avatax_exempt_no": "string",
      "tax_id": 982000000557028,
      "expense_id": " ",
      "salesorder_item_id": " ",
      "avatax_tax_code": "string",
      "time_entry_ids": []
    }

    const zohoInvoiceCreateRequest = await fetch(`https://www.zohoapis.in/books/v3/invoices?organization_id=${ZOHO_INVOICE_ORGANIZATION_ID}`, {
      method: "POST",
      headers: {
        Authorization: 'Zoho-oauthtoken ' + zohoToken
      },
      body: JSON.stringify(invoiceData)
    });
    const zohoInvoiceCreateResponse = await zohoInvoiceCreateRequest.json();
    res.json(zohoInvoiceCreateResponse);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
}