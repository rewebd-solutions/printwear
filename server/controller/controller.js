const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const cashfreeAppID = process.env.CASH_APP_ID;
const cashfreeSecretKey = process.env.CASH_SECRET_KEY;
const zohoRefreshToken = process.env.ZOHO_REFRESH_TOKEN;
const zohoClientID = process.env.ZOHO_CLIENT_ID;
const zohoClientSecret = process.env.ZOHO_CLIENT_SECRET;

const WEBHOOK_URL = "https://3df3-2401-4900-360f-b50-1857-ca35-3253-7725.ngrok-free.app/";

const crypto = require("crypto")
const algorithm = "sha256"
const authServices = require("../services/auth");

var ProductModel = require('../model/productModel');
var StoreModel = require('../model/storeModel');
var UserModel = require("../model/userModel");
var CartModel = require("../model/cartModel");
var ImageModel = require("../model/imageModel")
var ColorModel = require("../model/colorModel");
var DesignModel = require("../model/designModel");
var OrderModel = require("../model/orderModel");

var NewDesignModel = require("../model/newDesignModel");

const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
var nodemailer = require('nodemailer');
const otpGen = require("otp-generator")
const storageReference = require("../services/firebase");
const ZohoProductModel = require("../model/zohoProductModel");

const SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external";
const CASHFREE_BASE_URL = 'https://sandbox.cashfree.com/pg';

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
    const cookieToken = authServices.createToken(check._id);
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
    const fileReference = storageReference.child(`images/${req.userId + "_" + req.file.originalname}`);
    await fileReference.put(fileBuffer);
    const fileDownloadURL = await fileReference.getDownloadURL();
    // console.log(fileDownloadURL);
    const fileSave = await ImageModel.create({
      userId: req.userId,
      front: {
        url: fileDownloadURL,
        name: req.file.originalname,
        size: req.file.size / 1000,
        format: req.file.mimetype.split("/")[1],
      }
    });
    // console.log(fileSave);
    res.status(200).redirect("designgallery");
  } catch (error) {
    console.log(error);
    res.status(500);
  }
}

exports.obtainimages = async (req, res) => {
  const userId = req.userId;
  try {
    const imageData = await ImageModel.find({ userId: userId });
    res.status(200).json(imageData);
  } catch (error) {
    console.log(error);
    res.status(404).json({ "message": "Not found!" });
  }
}

exports.deleteimage = async (req, res) => {
  const userId = req.body.imageId;
  const imageName = req.body.imageName;
  const imageId = req.body.imageIdX;
  // console.log(imageId);
  try {
    const fileReference = storageReference.child(`images/${userId + "_" + imageName}`);
    await fileReference.delete();
    await ImageModel.findOneAndDelete({ _id: imageId });
    res.status(200);
    res.redirect("/designgallery");
  } catch (error) {
    console.log(error);
    res.redirect("/designgallery");
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

// exports.getdesigns = async (req, res) => {
//   try {
//     const designsData = await DesignModel.find({ createdBy: req.userId });
//     const productDataIDs = new Set(designsData.map(designData => designData.baseProductId + ''));
//     const productData = await ProductModel.find({ _id: { $in: [...productDataIDs] } });
//     const colorIDs = new Set(designsData.map(designData => designData.color));
//     const colorsData = await ColorModel.find({ _id: { $in: [...colorIDs] } });
//     const cartData = await CartModel.findOne({ userId: req.userId });
//     // console.log(colorsData);
//     const newDesignsData = designsData.map(design => {
//       // console.log(cartData.items.find(cartItem => cartItem.design+'' === design._id+''))
//       return {
//         design: design,
//         product: productData.find(product => product._id + '' === design.baseProductId + ''),
//         color: colorsData.find(color => color._id + '' === design.color + ''),
//         availableInCart: cartData?.items.find(cartItem => cartItem.design + '' === design._id + '') ? true : false
//       }
//     })
//     // console.log(newDesignsData);
//     res.json(newDesignsData);
//   } catch (error) {
//     console.log(error);
//     res.json({ error });
//   }
// }

// exports.deletedesign = async (req, res) => {
//   try {
//     console.log(req.userId, req.body.designId)
//     await CartModel.findOneAndUpdate({ userId: req.userId }, { $pull: { items: { design: req.body.designId } } });
//     await DesignModel.findOneAndDelete({ _id: req.body.designId });
//     // console.log("done")
//     res.status(200).json({ message: "Deleted" });
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ error: err });
//   }
// }


// cart endpoints
// exports.addtocart = async (req, res) => {
//   const cartItem = {
//     design: req.body.designId,
//     productId: req.body.productId,
//     quantity: req.body.quantity,
//   };
//   const selectedProduct = await ProductModel.findOne({ _id: cartItem.productId });

//   if (!selectedProduct) {
//     return res.status(404).json({ message: 'Invalid Product ID!' });
//   }
//   try {
//     let designCost = 0;
//     const designCostArray = Object.entries(cartItem.quantity).map(x => {
//       return selectedProduct.price[x[0].toLowerCase()] * x[1]
//     });
//     designCostArray.forEach(cost => designCost += cost);

//     cartItem.price = designCost;
//     var totalAmount = 0;

//     var cartData = await CartModel.findOne({ userId: req.userId })
//     if (cartData) {
//       cartData.items.push(cartItem);
//       // perform a function to calculate total product price
//       // console.log(cartData);
//     } else {
//       cartData = new CartModel({
//         userId: req.userId,
//         items: [cartItem]
//       });
//       // console.log(cartData);
//     }

//     cartData.items.forEach(item => totalAmount += item.price);
//     cartData.totalAmount = totalAmount;
//     await cartData.save();

//     res.json(cartData);
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ message: "Something went wrong!" });
//   }
// }

// exports.getcart = async (req, res) => {
//   try {
//     const cartItems = await CartModel.findOne({ userId: req.userId });
//     if (!cartItems) return res.status(200).json({ items: [] });
//     const newCartItems = {
//       ...cartItems._doc
//     }
//     const cartProductIDs = new Set(cartItems.items.map(item => item.productId));
//     const cartDesignIDs = new Set(cartItems.items.map(item => item.design));
//     const cartProducts = await ProductModel.find({ _id: { $in: [...cartProductIDs] } });
//     const cartDesignData = await DesignModel.find({ _id: { $in: [...cartDesignIDs] } });
//     const cartColorIDs = new Set(cartDesignData.map(cartDesign => cartDesign.color));
//     const cartColorsData = await ColorModel.find({ _id: { $in: [...cartColorIDs] } });
//     // pull in colors from DB and push it along

//     let newCartItemWithProducts = cartItems.items.map(cartItem => {
//       return {
//         ...cartItem._doc,
//         product: cartProducts.find(cartProduct => cartProduct._id + '' === cartItem.productId + ''),
//         designData: cartDesignData.find(cartDesign => cartDesign._id + '' === cartItem.design + ''),
//       }
//     })
//     newCartItems.items = newCartItemWithProducts;
//     newCartItemWithProducts = newCartItems.items.map(cartItem => {
//       return {
//         ...cartItem,
//         color: cartColorsData.find(cartColor => cartColor._id + '' === cartItem.designData.color)
//       }
//     });
//     newCartItems.items = newCartItemWithProducts;
//     newCartItemWithProducts = newCartItems.items.map(cartItem => {
//       return {
//         ...cartItem,
//         sku: `${cartItem.product.SKU}-${cartItem.color.colorSKU}`
//       }
//     })
//     newCartItems.items = newCartItemWithProducts;
//     // console.log(newCartItems);
//     res.json(newCartItems);
//   } catch (error) {
//     console.log(error);
//     res.json({ error });
//   }
// }

// exports.deletecartitem = async (req, res) => {
//   // console.log(req.body.cartId);
//   try {
//     await CartModel.updateOne({ _id: req.body.cartId }, { $pull: { items: { _id: req.body.itemId } } });
//     const cartData = await CartModel.findOne({ _id: req.body.cartId });
//     let totalAmount = 0;
//     cartData.items.map(cartItem => totalAmount += cartItem?.price);
//     cartData.totalAmount = totalAmount;
//     await cartData.save();
//     // console.log(x)
//     res.status(200).json({ message: "success!" });
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ error });
//   }
// }


// orders ku eldhu
exports.createorder = async (req, res) => {
  const orderItem = req.body;
  // obtain all items array and then add it along with calculated SKU

  try {
    const userData = await UserModel.findOne({ _id: req.userId });

    if (!userData) throw new Error("Invalid User");

    const cartData = await CartModel.findOne({ userId: userData._id });

    let cartQtyChange = orderItem.items.map(item => {
      return {
        quantity: item.quantity,
        cartItemId: item.cartItemId,
        price: item.price,
      }
    });

    let x = cartData.items.map(item => {
      let thatItem = cartQtyChange.find(cq => cq.cartItemId === item._id + '')
      return {
        ...item._doc,
        quantity: thatItem.quantity,
        price: thatItem.price
      }
    });

    // console.log(cartQtyChange, x);

    cartData.items = x;

    cartData.totalAmount = orderItem.totalAmount;

    await cartData.save();

    // console.log(cartData);

    const orderData = new OrderModel({
      userId: req.userId,
      cartId: orderItem.cartId,
      items: orderItem.items.map(item => {
        return {
          cartItemId: item.cartItemId,
          shippingAddress: item.shippingAddress,
          sku: item.sku
        }
      }),
      totalAmount: orderItem.totalAmount,
      billingAddress: orderItem.billingAddress
    });

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
        order_id: `${orderItem.billingAddress.firstName.split(" ").join("_")}_${orderItem.billingAddress.lastName.split(" ").join("_")}_${orderData._id}_${otpGen.generate(6, { specialChars: false })}`,
        order_amount: orderData.totalAmount,
        order_currency: "INR",
        order_note: `Payment for Order: ${orderData._id}`,
        customer_details: {
          customer_id: req.userId,
          customer_name: userData.name,
          customer_phone: userData.phone,
          customer_email: userData.email
        },
        order_expiry_time: expiryDate
        // link_meta: {
        //   notify_url: WEBHOOK_URL + "createshiporder"
        // }
      })
    });
    const paymentLinkResponse = await paymentLinkRequest.json();
    console.log(paymentLinkResponse)
    orderData.CFOrderId = paymentLinkResponse.cf_order_id;
    orderData.myOrderId = paymentLinkResponse.order_id;
    // // orderData.paymentLinkId = paymentLinkResponse.link_id;

    await orderData.save();
    res.status(200).json(paymentLinkResponse);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error });
  }
}


// create payment link
// exports.createpaymentlink = async (req, res) => {
//   try {
//     const paymentLinkRequest = await fetch(CASHFREE_BASE_URL + "/links", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "x-client-id": cashfreeAppID,
//         "x-client-secret": cashfreeSecretKey,
//         "x-api-version": "2023-08-01"
//       }, 
//       body: JSON.stringify({
//         link_id: '33dnd2ds',
//         link_amount: 45.12,
//         link_currency: "INR",
//         link_purpose: "payment",
//         customer_details: {
//           customer_name: '123ndf32r',
//           customer_phone: '9150940153'
//         },
//         link_partial_payments: false,
//         link_notify: {
//           send_email: false,
//           send_sms: true
//         }
//       })
//     });
//     const paymentLinkResponse = await paymentLinkRequest.json();
//     res.json(paymentLinkResponse);
//   } catch (error) {
//     console.log(error);
//     res.json({error});
//   }
// }


// utils 
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding 1 to month since it's zero-based
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}


// endpoints for creating orders in shiprocket
exports.createshiporder = async (req, res) => {
  // every 10 days token refersh.. thru .env manually
  // write code to obtain orders data from my mongo
  // apo ordersModel nu onnu create panni, once checkout is done, put the stuff in that collection
  console.log(req.body);
  const statusType = req.body.type;

  if (statusType === 'WEBHOOK') return res.status(200).send("OK");

  if (statusType === 'PAYMENT_CHARGES_WEBHOOK') return res.status(200).send("OK");


  if (statusType === 'PAYMENT_SUCCESS_WEBHOOK') {
    const orderId = req.body.data.order.order_id;

    const orderData = await OrderModel.findOne({ myOrderId: orderId });
    const cartData = await CartModel.findOne({ _id: orderData.cartId });

    orderData.paymentStatus = "success";
    orderData.amountPaid = orderData.totalAmount;
    res.status(200).send("OK");
    await orderData.save();

    // write function to hit shiprocket API
    try {
      const shipAccReq = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({
          "email": "printwearshiprocket@gmail.com",
          "password": "shiprocketpassword"
        })
      });

      const shipAccResponse = await shipAccReq.json();

      const SHIPROCKET_COMPANY_ID = shipAccResponse.company_id;
      const SHIPROCKET_ACC_TKN = shipAccResponse.token;

      // console.log(SHIPROCKET_ACC_TKN, SHIPROCKET_COMPANY_ID)

      const shipRocketOrderRequests = orderData.items.map(async item => {
        let orderId = item.cartItemId + "_" + otpGen.generate(6, { specialChars: false });
        // let currCartItem = cartData.items.find({ _id: item.cartId });
        let reqData = {
          "order_id": orderId,
          "order_date": formatDate(new Date()),
          "pickup_location": "Primary",
          "channel_id": 4248923,
          "comment": `Order for ${orderData.billingAddress.firstName} ${orderData.billingAddress.lastName}`,
          "billing_customer_name": `${orderData.billingAddress.firstName}`,
          "billing_last_name": `${orderData.billingAddress.lastName}`,
          "billing_address": `${orderData.billingAddress.streetLandmark}`,
          "billing_address_2": "",
          "billing_city": `${orderData.billingAddress.city}`,
          "billing_pincode": `${orderData.billingAddress.pincode}`,
          "billing_state": `${orderData.billingAddress.state}`,
          "billing_country": `India`,
          "billing_email": `${orderData.billingAddress.email}`,
          "billing_phone": `${orderData.billingAddress.mobile}`,
          "shipping_is_billing": false,
          "shipping_customer_name": `${item.shippingAddress.firstName}`,
          "shipping_last_name": `${item.shippingAddress.lastName}`,
          "shipping_address": `${item.shippingAddress.streetLandmark}`,
          "shipping_address_2": "",
          "shipping_city": `${item.shippingAddress.city}`,
          "shipping_pincode": `${item.shippingAddress.pincode}`,
          "shipping_country": `India`,
          "shipping_state": `${item.shippingAddress.state}`,
          "shipping_email": `${item.shippingAddress.email}`,
          "shipping_phone": `${item.shippingAddress.mobile}`,
          "order_items": [
            {
              "name": `${item.sku}`,
              "sku": `${item.sku}`,
              "units": 1,
              "selling_price": 500,
              "discount": "",
              "tax": "",
              "hsn": 441122
            }
          ],
          "payment_method": "Prepaid",
          "shipping_charges": 0,
          "giftwrap_charges": 0,
          "transaction_charges": 0,
          "total_discount": 0,
          "sub_total": orderData.totalAmount,
          "length": 10,
          "breadth": 15,
          "height": 20,
          "weight": 2.5
        }
        console.log(reqData);
        try {
          const response = await fetch(SHIPROCKET_BASE_URL + '/orders/create/adhoc', {
            headers: {
              "Content-Type": "application/json",
              Authorization: 'Bearer ' + SHIPROCKET_ACC_TKN
            },
            method: "POST",
            body: JSON.stringify(reqData)
          });
          if (!response.ok) throw new Error("Failed to create order");
          const orderResponse = await response.json();
          console.log(orderResponse);
          let indexToModify = orderData.items.findIndex(x => x.cartItemId === item.cartItemId)
          orderData.items[indexToModify].SRorderId = orderResponse.order_id;
          return orderResponse;
        } catch (error) {
          console.error('Error creating order:', error);
          throw error;
        }
      })
      await orderData.save();

      Promise.allSettled(shipRocketOrderRequests).then(results => {
        console.log(results);
        const allFulfilled = results.every(result => result.status === 'fulfilled');

        if (allFulfilled) {
          // All orders were created successfully
          console.log('All orders created successfully.');
          // Send a 200 response here
        } else {
          // At least one order failed to create
          console.error('One or more orders failed to create.');
          // Send an error response here
        }
      });

    } catch (error) {
      console.log(error);
      res.status(500).json({ error });
    }
  }

  if (statusType === 'PAYMENT_FAILED_WEBHOOK') {
    orderData.paymentStatus = "failed";
    res.status(200).send("OK");
    return await orderData.save();
  }

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

    if (!fetchReq.ok) return res.status(400).json({error: "Couldn't find store"});

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
    res.status(400).json({error})
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

          if(nameMatch && colorMatch){
            let specificSelection = categorizedProducts[item]
            let specificSelectedProduct = specificSelection.colors[Object.keys(specificSelection.colors).find(x => x.toLowerCase() === colorMatch[0])];

            // match pattern la back irundhuchuna, then i assign backimage else frontimage
            if (colorMatch.input.split(/[ .]/)[colorMatch.input.split(/[ .]/).length-2] === "back")
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
    const fileBuffer = req.files;

    // explicitly parsing JSON here because FormData() cannot accept Objects, so from client Object was stringified
    req.body.productData = JSON.parse(req.body.productData)

    let uniqueSKU = req.body.productData.product.SKU + "-" + otpGen.generate(4, { specialChars: false, upperCaseAlphabets: true, lowerCaseAlphabets: false })

    let recordOfFileNames = {}; // map of filename:url

    for(let file of fileBuffer) {
      const fileReference = storageReference.child(`images/${req.userId + "_" + req.body.productData.designName + "_" + uniqueSKU + "_" + file.originalname}`);
      await fileReference.put(file.buffer, { contentType: 'image/png' });
      const fileDownloadURL = await fileReference.getDownloadURL();
      recordOfFileNames[file.originalname] = fileDownloadURL;
    }

    const designSave = await NewDesignModel.findOneAndUpdate(
      { userId: req.userId },
      {
        $push: { designs: {
            product: {...req.body.productData.product},
            designSKU: uniqueSKU,
            desingName: req.body.productData.designName,
            price: req.body.productData.product.price + (req.body.productData.price * 2),
            designImage: {
                front: req.body.direction === "front" && recordOfFileNames["DesignImage-"+req.body.direction+".png"],
                back: req.body.direction === "back" && recordOfFileNames["DesignImage-"+req.body.direction+".png"]
            },
            designName: req.body.productData.designName,
            designItems: Object.keys(recordOfFileNames).map(item => {
                return {
                  itemName: item,
                  URL: recordOfFileNames[item]
                }
            })
        }}
      },
      { upsert: true, new: true }
    )

    console.log(designSave);
    res.status(200).send("OK")
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
    res.status(500).send({error});
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
exports.createshopifyorder = async (req, res) => {
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
          src: designData.designImage.front?? designData.designImage.back
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
    // console.log(shopifyProductCreateResponse)
    // const productIDtoChange = shopifyProductCreateResponse.product.id;
    
    // const shopifyImageUploadEndpoint = `https://${SHOPIFY_SHOP_URL}/admin/api/2023-07/products/${productIDtoChange}/images.json`
    // const shopifyProductImageRequest = await fetch(shopifyImageUploadEndpoint, {
    //   headers: {
    //     'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    //     'Content-Type': 'application/json'
    //   },
    //   method: 'POST',
    //   body: JSON.stringify({
    //     image: 
    //   })
    // });
    // const shopifyProductImageResponse = await shopifyProductImageRequest.json();
    // console.log(shopifyProductImageResponse)

    res.json(shopifyProductCreateResponse)
  } catch (error) {
    console.log(error);
    res.status(500).json({error});
  }
  
}

exports.createwoocommerceorder = async (req, res) => {
  const storeData = await StoreModel.findOne({ userid: req.userId });
  console.log(storeData.wooCommerceStore);
  if (!(storeData.wooCommerceStore.url)) return res.status(404).json({error: "WooCommerce store not connected!"});
  const designData = (await NewDesignModel.findOne({ userId: req.userId })).designs.find(design => design.designSKU === req.body.designSKU)

  // const encodedAuth = btoa(`${consumerKey}:${consumerSecret}`);
  const consumerKey = storeData.wooCommerceStore.consumerKey;
  const consumerSecret = storeData.wooCommerceStore.consumerSecret;
  const shopURL = storeData.wooCommerceStore.url;
  const encodedAuthBuffer = Buffer.from(`${consumerKey}:${consumerSecret}`, 'base64');
  const encodedAuth = encodedAuthBuffer.toString('base64')

  const endpoint = `https://${shopURL}/wp-json/wc/v3/products`;

  const productData = {
    name: "Bruh shirt",
    slug: "bruh-shirt",
    type: "simple",
    status: "publish",
    regular_price: "399",
    sale_price: "299",
    sku: "one-piece-is-real",
    description:
      "This is a one piece sweatshirt. One piece is one of the big 3 of anime, a greate anime with an amazing storyline..",
    short_description: "Official One pix Merchandise",
    dimensions: {
      length: "7",
      width: "38",
      height: "28",
    },
    images: [
      {
        src: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/images%2F64f175edd683cd124e440f23_NUMBER_2_PWSSDWSSM-001SS-M2TT_DesignImage-front.png?alt=media&token=afe56335-b54e-4ff7-8f49-1bb72aeb4628",
        name: "bruh",
      },
    ],
    attributes: [
      {
        id: 1,
        name: "size",
        position: 0,
        visible: true,
        variation: true,
        options: [
          "S"
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
    if(createWooProductRequest.ok)
        console.log("Uploaded Successfully");
    res.json(createWooProductResponse)
  } catch (err) {
    console.error(err);
    res.status(500).json({err});
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