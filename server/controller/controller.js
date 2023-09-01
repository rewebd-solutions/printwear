const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const twilio = require('twilio')(accountSid, authToken);
const crypto = require("crypto")
const algorithm = "sha256"
const authServices = require("../services/auth");

var ProductModel = require('../model/productModel');
var StoreModel = require('../model/storeModel');
var UserModel = require("../model/userModel");
var CartModel = require("../model/cartModel");
var ImageModel = require("../model/imageModel")
var ColorModel = require("../model/colorModel");

const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
var nodemailer = require('nodemailer');
const otpGen = require("otp-generator")
const storageReference = require("../services/firebase");

//variables
var cur_user = null;
var OTP = null;
let sec = false;
var number = null;
var idemail = null;

const SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external";

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
  const data = {
    userData: userData,
    storeData: storeData
  }
  res.render("profile", { data: data });
}


// endpoints for verification OTP and authentication not sure if it works
exports.emailverify = async (req, res) => {
  console.log("EmailVerify method");

  const exiting = await UserModel.findOne({ email: req.body.email });
  if (exiting === null) {
    res.render("forgetpassword", { success: "USER DOES NOT EXIST" });
  }
  else if (exiting.email === req.body.email) {
    res.redirect(307, "/sendingotp");
    idemail = req.body.email;
    number = exiting.number;
  }
  else {
    res.render("forgetpassword", { success: "USER DOES NOT EXIST" });
  }
}

exports.sendotp = (req, res) => {
  var email = req.body.email;
  // console.log(email.toString());
  send_otp(email);
}

function GenOTP() {
  OTP = Math.floor(1000 + Math.random() * 9000).toString();
  // console.log('Generated OTP:', OTP);  
}
function startime() {
  timer = setInterval(() => {
    sec = true;
  }, 300000);
}

function send_otp(email) {
  GenOTP();
  console.log("gone to function")
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'sujaysy0006@gmail.com',
      pass: 'teqcsgojmzndgupt'
    }
  });
  var mailOptions = {
    from: 'sujaysy0006@gmail.com',
    to: email,
    subject: 'OTP via',
    text: 'OPT IS :' + OTP
  };

  ////sending sms

  console.log(number);
  twilio.messages
    .create({
      from: "+15673611428",
      to: `${number}`,
      body: `this is testing otp is ${OTP}`,
    })
    .then(function (res) { console.log("message has sent!") })
    .catch(function (err) {
      console.log(err);
    });

  ///sending sms


  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}
startime();

exports.verify = (req, res) => {
  var username = req.body.OTP;
  if (!sec) {
    if (username === OTP) {
      // console.log("entered the forgot_password page");
      res.render("newpassword", { success: "" });
    } else {
      res.render("forgetpassword", { success: "Please Enter a Valid OTP" });
    }
  } else {
    console.log("time finished")
  }
}

exports.updatepassword = async (req, res) => {
  console.log(idemail);
  console.log(req.body.newpassword);
  console.log(req.body.confirmpassword)


  if (req.body.newpassword === req.body.confirmpassword) {
    // exiting.password=req.body.newpassword;
    await UserModel.findOneAndUpdate({ email: idemail, }, { password: crypto.createHash(algorithm).update(req.body.newpassword).digest("hex"), }, { upsert: true, new: true })
    res.redirect("/loginpage");
  }
  else {
    res.render("newpassword", { success: "Both the Passwords are Different" });
  }
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
          front: "obtainfromfirebasecloud",
          back: "jadad"
        },
        sizes: [
          {
            sizeSKU: "MD",
            size: "M",
            stock: 5
          },
          {
            sizeSKU: "SM",
            size: "S",
            stock: 7
          },
          {
            sizeSKU: "LG",
            size: "L",
            stock: 12
          },
        ]
      },
      {
        colorName: "black",
        colorSKU: "BLK",
        colorCode: "#000",
        colorImage: {
          front: "obtainfromfirebasecloud",
          back: "jadad"
        },
        sizes: [
          {
            sizeSKU: "XSM",
            size: "XS",
            stock: 15
          },
          {
            sizeSKU: "SM",
            size: "S",
            stock: 17
          },
          {
            sizeSKU: "MD",
            size: "M",
            stock: 16
          },
          {
            sizeSKU: "XLG",
            size: "XL",
            stock: 10
          }
        ],

      },
      {
        colorName: "red",
        colorSKU: "RED",
        colorCode: "#ff000",
        colorImage: {
          front: "obtainfromfirebasecloud",
          back: "jadad"
        },
        sizes: [
          {
            sizeSKU: "SM",
            size: "S",
            stock: 1
          },
          {
            sizeSKU: "MD",
            size: "M",
            stock: 0
          },
          {
            sizeSKU: "LG",
            size: "L",
            stock: 11
          }
        ],

      },
    ],
    product: {
      SKU: "TEE",
      name: "Test TShirt",
      category: "TShirts",
      gender: "M",
      description: "This is a test shirt that is currently used for testing purposes",
      productImage: {
        front: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Ftshirtmale.png?alt=media&token=c8b089e4-5e4d-43a8-9912-db50c7b34dd2",
        back: "https://firebasestorage.googleapis.com/v0/b/printwear-design.appspot.com/o/products%2Ftshirtmaleback.png?alt=media&token=c923de8e-a570-4fc1-9a95-d3ff060d961c",
      },
      price: {
        xs: 300,
        s: 350,
        m: 400,
        l: 450,
        xl: 500
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
    console.log(err);
    res.status(500).send("error");
  }

}

exports.getproduct = async (req, res) => {
  const productData = ProductModel.findOne({ _id: req.body.productId });
  const colorsData = ColorModel.find({ productId: productData._id });
  res.status(200).json({
    productData,
    colorsData
  });
}


// temporary dummy endpoints for mockup to cart
exports.dummycheckout = async (req, res) => {
  const frontImage = req.body.frontImage;
  const backImage = req.body.backImage;
  const frontBuffer = Uint8Array.from(Buffer.from(frontImage, "base64")); 
  console.log(frontBuffer);
  const fileReference = storageReference.child(`products/${req.userId + "_" + req.body.designName + '.png'}`);
  await fileReference.put(frontBuffer);
  const fileDownloadURL = await fileReference.getDownloadURL();
  console.log(fileDownloadURL);
  res.redirect("mycart"); // res.render dhaan
}

// endpoints for creating orders in shiprocket
exports.createshiporder = async (req, res) => {
  // every 10 days token refersh.. thru .env manually
  // write code to obtain orders data from my mongo
  // apo ordersModel nu onnu create panni, once checkout is done, put the stuff in that collection
  try {
    const createShipOrderReq = await fetch(SHIPROCKET_BASE_URL + '/orders/create/adhoc', {
      headers: {
        "Content-Type": "application/json",
        Authorization: 'Bearer ' + process.env.SHIPTKN
      },
      method: "POST",
      body: JSON.stringify({ // for this obtain data from ordersModel from mongo and populate respectively
        order_id: "threatofcumblast",
        order_date: "2023-08-31 14:50",
        pickup_location: "Primary",
        channel_id: "",
        comment: "Reseller: Sachin",
        billing_customer_name: "Sachin",
        billing_last_name: "Sharon",
        billing_address: "No.8, 10th Street, Vinobaji Nagar, Hastinapuram",
        billing_address_2: "Near Hokage House",
        billing_city: "Kanchipuram",
        billing_pincode: "600064",
        billing_state: "Tamil Nadu",
        billing_country: "India",
        billing_email: "sreesachin11226@gmail.com",
        billing_phone: "9362667920",
        shipping_is_billing: true,
        shipping_customer_name: "",
        shipping_last_name: "",
        shipping_address: "",
        shipping_address_2: "",
        shipping_city: "",
        shipping_pincode: "",
        shipping_country: "",
        shipping_state: "",
        shipping_email: "",
        shipping_phone: "",
        order_items: [
          {
            name: "MyDesign",
            sku: "TEEWHTXS",
            units: 2,
            selling_price: "320",
            discount: "",
            tax: "",
            hsn: 441122
          }
        ],
        payment_method: "Prepaid",
        shipping_charges: 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: 0,
        sub_total: 640,
        length: 10,
        breadth: 15,
        height: 20,
        weight: 2.5
      })
    });

    const createShipOrderData = await createShipOrderReq.json();
    res.status(200).json(createShipOrderData);

  } catch (error) {
    res.status(500).json(error);
  }

  /* {
  "order_id": 398711668,
  "shipment_id": 396917638,
  "status": "NEW",
  "status_code": 1,
  "onboarding_completed_now": 0,
  "awb_code": "",
  "courier_company_id": "",
  "courier_name": ""
  }*/ // once order is done, its the returned value
  
}

let FRONTIMAGE = null;
let BACKIMAGE = null;
let num = 0;

exports.addtocartMock = async (req, res) => {

  console.log("indside mock hiiiiii");
  const frontImage = req.body.frontImage;
  const backImage = req.body.backImage;
  if (frontImage != undefined) {
    FRONTIMAGE = frontImage;
    num = num + 1;
  } else if (backImage != undefined) {
    BACKIMAGE = backImage;
    num = num + 1;
  }
  console.log(num);
  if (num == 2) {
    storeitems(FRONTIMAGE, BACKIMAGE);
  }
  // const variable = req.body.variable;

  // const add_to = new CartModel({
  //   Frontimage: myVariable,
  //   // Backimage: variable
  // })
  // await add_to.save();
  // const userCart1 = await UserCartModel.create({ user: cur_user, cart: add_to._id});
  // await userCart1.save(); 

}

async function storeitems(FRONTIMAGE, BACKIMAGE) {
  console.log("inside store items");
  const add_to = new CartModel({
    Frontimage: FRONTIMAGE,
    Backimage: BACKIMAGE,
    price: 0
  })
  await add_to.save();
  const userCart1 = await CartModel.create({ user: cur_user, cart: add_to._id });
  await userCart1.save();
  num = 0;

}

////adding cart items////
exports.addtocartitems = async (req, res) => {
  // console.log(cur_user+" dsjhflkjsd");

  const object_id = req.params.id;
  const ad = await ProductModel.find({ _id: object_id });
  const add = ad[0];
  // console.log(myVariable,"YOOOOOASDFOOASDOFOASDOFOASDFOOASDFOASDF")

  // const istrue = await CartModel.findOne({_id:object_id})
  console.log("not found")
  // if(istrue === null){ 
  const add_to = new CartModel({
    name: add.name,
    // Frontimage: myVariable,
    price: 0,
    // quantity: add.quantity,
    // _id:object_id
  })

  await add_to.save();
  // console.log(add_to._id + ' saved successfully'); 

  const istrue = await UserCartModel.findOne({ user: cur_user, cart: object_id });
  // console.log(istrue+"***o"); 

  // if(istrue === null){ 
  const userCart1 = await UserCartModel.create({ user: cur_user, cart: add_to._id, quantity: 3 });
  await userCart1.save();
  // } 
  // } 

  // res.redirect('/product');
  res.redirect(307, "/showproduct");

};



exports.showCartItems = async (req, res) => {

  const userCart = await UserCartModel.find({ user: cur_user });
  // console.log(userCart+"ooooo");
  const cart = await CartModel.find();

  // console.log(userCart.length+"ooooo");
  res.render('cart', { userCart: userCart, cart: cart });

}

var size_S_price = 2;
var size_M_price = 2;
var size_L_price = 2;
var size_XL_price = 2;
var size_XXL_price = 2;

exports.update = async (req, res) => {
  const object_id = req.params.id;
  console.log(object_id + " updated");

  const price = (req.body.s * size_S_price) + (req.body.m * size_M_price) + (req.body.xl * size_XL_price) + (req.body.l * size_L_price) + (req.body.xxl * size_XXL_price);

  const updatecart = await CartModel.findOne({ _id: object_id });
  console.log(updatecart);
  updatecart.price = price;
  updatecart.S = req.body.s;
  updatecart.M = req.body.m;
  updatecart.L = req.body.l;
  updatecart.XL = req.body.xl;
  updatecart.XXL = req.body.xxl;
  updatecart.address = req.body.address;
  await updatecart.save();
  console.log(updatecart);




  //   await CartModel.findByIdAndUpdate({_id: object_id}, { address: req.body.address,S:req.body.s ,M:req.body.m,XL: req.body.xl ,
  //     XXL: req.body.xxl ,L: req.body.l ,price:price}, 
  //                             async (err, docs)=> {
  //     if (err){
  //         console.log(err)
  //     }
  //     else{

  //         console.log("Updated User : ", docs);
  //         await docs.save();
  //     }
  // });
  res.redirect("/cart")


}

exports.cart_item_del = async (req, res) => {
  const delete_id = req.params.id;
  console.log(delete_id + " deleted");
  await CartModel.deleteOne({ _id: delete_id });
  await UserCartModel.deleteOne({ user: cur_user, cart: delete_id });

  // console.log(userCart.length+"ooooo");
  res.redirect('/cart');
}

exports.cart_clone = async (req, res) => {

  clone_id = req.params.id;
  user_id = cur_user;

  const exis = await CartModel.find({ _id: clone_id });
  const exist = exis[0];


  const add_to = new CartModel({
    name: exist.name,
    price: exist.price,
    S: exist.S,
    M: exist.M,
    L: exist.L,
    XL: exist.XL,
    XXL: exist.XXL,
    address: exist.address,
    Frontimage: exist.Frontimage,
    Backimage: exist.Backimage

  })

  await add_to.save();

  const userCart1 = await UserCartModel.create({ user: cur_user, cart: add_to._id, quantity: 3 });
  await userCart1.save();

  res.redirect('/cart');

};


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

    const store = await StoreModel.findOneAndUpdate(
      { userid: req.userId },
      {
        $set: {
          // _id: 
          userid: req.userId,
          shopifyStores: [
            {
              shopName: SHOPIFY_SHOP_NAME,
              shopifyAccessToken: SHOPIFY_ACCESS_TOKEN,
              shopifyStoreURL: SHOPIFY_SHOP_URL
            }
          ],
        }
      },
      { new: true, upsert: true }
    )

    res.status(200).render('connectstore', { status: "Added Shopify Store"}); // idhu redirect pannidu
    return;

  } catch (error) {
    console.log("Error in Shopify connect " + error)
    res.status(400).json({
      message: error
    })
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
    // console.log(orders);

    const store = await StoreModel.findOneAndUpdate(
      { userid: req.userId },
      {
        $set: {
          // _id: 
          userid: req.userId,
          wooCommerceStores: [
            {
              shopName: WOOCOMMERCE_SHOP_NAME,
              url: WOOCOMMERCE_SHOP_URL,
              consumerKey: WOOCOMMERCE_CONSUMER_KEY,
              consumerSecret: WOOCOMMERCE_CONSUMER_SECRET
            }
          ],
        }
      },
      { new: true, upsert: true }
    )
    // await store.save();

    res.status(200).render('connectstore', { status: "Added WooCommerce Store"});
    return;

  } catch (error) {
    console.log("Error in woocommerce connect " + error)
    res.status(400).json({
      message: error
    })
    return;
  }
}