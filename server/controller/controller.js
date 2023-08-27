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
    phoneVerified: false
  })
  .then(() => {
    //res.send(data)
    res.render("login", { status: "Account created. Log In"});
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
//OTP FUNCTIONS DON'T TOUCH 
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

////////////////////////////////////////////////////////////////////////



//////////////////////////

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

exports.uploadimage = async (req, res) => {
  try {
    // console.log(req.file.originalname);
    const fileBuffer = req.file.buffer;
    const fileReference = storageReference.child(`images/${req.file.originalname}`);
    await fileReference.put(fileBuffer);
    const fileDownloadURL = await fileReference.getDownloadURL();
    // console.log(fileDownloadURL);
    const fileSave = await ImageModel.create({
      userId: req.userId,
      front: fileDownloadURL
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
      res.status(404).json({"message": "Not found!"});
    }
}

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


exports.addproduct = async (req, res) => {
  const product = new ProductModel(({
    name: req.body.name,
    price: req.body.price,
    quantity: req.body.quantity
  }))
  await product.save();
  // console.log(product);
  // req.flash('message','product added', {ttl:5000} );  

  ProductModel.find({}, function (err, data) {
    res.render('product', {
      // message:req.flash('message'),
      x: data
    });
  });
}

//////////////////////////
//displaying product////

///////finding product////
exports.displayproduct = (req, res) => {

    ProductModel.find()
    .then(user => {
      res.send(user)
    })
    .catch(err => {
      res.status(500).send({ message: err.message || "Error Occurred while retriving user information" })
    })
  // }


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

exports.connectShopify = async (req, res) => {
  const reqBody = req.body;
  // console.log(reqBody);
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
      { userid: cur_user },
      {
        $set: {
          // _id: 
          userid: cur_user,
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

    res.status(200).json(fetchData); // idhu redirect pannidu
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
      url: "https://print-wear.in/",
      consumerKey: "ck_0702bbbdb96b62819b29cb97190e17b1be8157f9",
      consumerSecret: "cs_474830f832be9377fe371b09946e0a216b4cb90d",
      version: "wc/v3"
    });
    const orders = await api.get("orders", {
      status: 'cancelled',
      per_page: '2',
    });
    // console.log(orders);

    const store = await StoreModel.findOneAndUpdate(
      { userid: cur_user },
      {
        $set: {
          // _id: 
          userid: cur_user,
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

    res.status(200).json(orders.data);
    return;

  } catch (error) {
    console.log("Error in woocommerce connect " + error)
    res.status(400).json({
      message: error
    })
    return;
  }
}