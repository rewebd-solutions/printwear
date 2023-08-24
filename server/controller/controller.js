const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilio = require('twilio')(accountSid, authToken);
const crypto = require("crypto")
const algorithm = "sha256"
// const mongoose=require('mongoose');
//var Userdb=require('../model/model');
 var Product=require('../model/productmodel');
 var Store = require('../model/storemodel');
// var Cart=require('../model/cartmodel');
const axios = require('axios');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
// const MongoStore = require('connect-mongo')(session);
var cur_user = null;

// const app = express();
// app.use(session({
//   secret: 'mysecretkey',
//   resave: false,
//   saveUninitialized: false,
//   // store: new MongoStore({ mongooseConnection: mongoose.connection })
// }));


var nodemailer = require('nodemailer');
var multer=require('multer');

const otpGen = require("otp-generator")

///////////model//////////

var cartSchema = new mongoose.Schema({
  name: String,
  price: Number,
  S: Number,
  M: Number,
  L:Number,
  XL:Number,
  XXL:Number,
  address: String,
  Frontimage: String,
  Backimage: String,
});

const Cart = mongoose.model('Cart', cartSchema);
////////////////////////////////
var schema=new mongoose.Schema({
  name:{
       type: String,
       required: true
  },
  email:{
      type:String,
      required:true,
      unique:true
  },
  number:{
      type:String,
      required:true
  },
  password:{
      type:String,
      required:true
  },
  image: {
      data:Buffer,
      contentType:String
  }
})

const Userdb=mongoose.model('User',schema);
/////
const userCartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cart'
  },
  quantity: Number
});
const UserCart = mongoose.model('UserCart', userCartSchema);



//variables
var OTP=null;
let sec=false;
var number=null;
var idemail=null;





exports.register=async(req,res)=>{

    // validate request
    if(!req.body){
        res.status(400).send({ message : "Content can not be emtpy!"});
        return;
    }
    // new user
    let num=req.body.number;

    const user = new Userdb({
        name: req.body.name,
        email : req.body.email,
        password: crypto.createHash(algorithm).update(req.body.password).digest("hex"),
        number:'+91'+ num.toString()
    })

    // save user in the database
    user
        .save(user)
        .then(data => {
            //res.send(data)
            res.render("design");
        })
        .catch(err =>{
            res.render("login",{success:"USER ALREADY EXISTS"})
        });
}

exports.login=async(req, res)=>{
  // console.log(req.body.email);
  // console.log(req.body.password);
    // try{
        const check = await Userdb.findOne({email:req.body.email})
        // console.log(check.password);
        // console.log(req.body.password);
        if(check===null){
          res.render("login",{success:"USER DOES NOT EXIST"});
        }
        else{
       
        if(check.password=== crypto.createHash(algorithm).update(req.body.password).digest("hex")){
          // res.render("home",{username:check.name});
          cur_user = check._id ; 
          // console.log(cur_user +" askf")
          res.render("design");
          //res.redirect(307,"/showproduct"); 
          // res.render("showproduct",{object_id : check._id});
          
       
        }
        else{
            res.render("login",{success:"INVALID DETAILS"});
            
        }
      }

    // }
    // catch{
    //      res.send("WRONG DETAILSsss");
    // }
}

exports.emailverify=async(req, res)=>{
    console.log("EmailVerify method");
    // console.log(req.body.email);
        const exiting = await Userdb.findOne({email:req.body.email});
        if(exiting===null){
          res.render("forgetpassword",{success:"USER DOES NOT EXIST"});
        }
       else if(exiting.email===req.body.email){
            res.redirect(307,"/sendingotp");
            idemail=req.body.email;
            number=exiting.number;
        }
        else{
          res.render("forgetpassword",{success:"USER DOES NOT EXIST"});
    }
}
//////


//sending otp

exports.sendotp=(req,res) => {
    var email = req.body.email;
    // console.log(email.toString());
    send_otp(email);
}
//OTP FUNCTIONS DON'T TOUCH 
function GenOTP() {
    OTP = Math.floor(1000 + Math.random() * 9000).toString();
    // console.log('Generated OTP:', OTP);  
    }
function startime(){
        timer = setInterval(() => {
          sec=true;
        }, 300000);
 }

 function send_otp(email){ 
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
    text: 'OPT IS :'+OTP
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
  
  
  transporter.sendMail(mailOptions, function(error, info){
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

exports.updatepassword = async(req, res) =>{
    console.log(idemail);
    console.log(req.body.newpassword);
    console.log(req.body.confirmpassword)
   

        if(req.body.newpassword===req.body.confirmpassword){
            // exiting.password=req.body.newpassword;
          await  Userdb.findOneAndUpdate({email:idemail,},{password:crypto.createHash(algorithm).update(req.body.newpassword).digest("hex"),},{upsert:true,new:true})
            res.redirect("/loginpage");
        }
        else{
          res.render("newpassword",{success:"Both the Passwords are Different"});
        }
}

//saving image in the database
var fs = require('fs');

//. . . 

var upload = multer({ dest: 'upload/'});
var type = upload.single('recfile');

exports.upload=async(type,req,res) => {
    var tmp_path = req.files.path;
    var target_path = 'uploads/' + req.files.name;
  fs.readFile(tmp_path, function(err, data)
  {
    fs.writeFile(target_path, data, function (err)
    {
      res.render('complete');
    })
  });

}


///verifying otp
exports.verify = (req, res) => {
    var username = req.body.OTP;
    if(!sec){
    if(username === OTP){
      // console.log("entered the forgot_password page");
      res.render("newpassword",{success: ""});
    }else{
      res.render("forgetpassword",{success:"Please Enter a Valid OTP"});
    }
  }else {
    console.log("time finished")
  }
}



////admin side add to cart/////
exports.addproduct=async (req, res) => {
  const product = new Product(({
    name : req.body.name,
    price: req.body.price,
    quantity: req.body.quantity
  }))
  await product.save();
  // console.log(product);
  // req.flash('message','product added', {ttl:5000} );  

  Product.find({}, function(err, data) {
    res.render('product', {
        // message:req.flash('message'),
        x: data
    });
});
}


//////////////////////////
//displaying product////
exports.showproduct=(req,res) => {
  console.log('ppppp')
  axios.get("http://localhost:3000/displayproduct")
  .then(function(response) {
      // console.log(response.data);
     res.render('product',{x: response.data});
  // res.render("indexx");
  })

  .catch(err =>{
        res.send(err);
  } )
}

///////finding product////
exports.displayproduct = (req, res)=>{

  // if(req.query.id){
  //     const id = req.query.id;

  //     Product.findById(id)
  //         .then(data =>{
  //             if(!data){
  //                 res.status(404).send({ message : "Not found user with id "+ id})
  //             }else{
  //                 res.send(data)
  //             }
  //         })
  //         .catch(err =>{
  //             res.status(500).send({ message: "Erro retrieving user with id " + id})
  //         })

  // }else{
      Product.find()
          .then(user => {
              res.send(user)
          })
          .catch(err => {
              res.status(500).send({ message : err.message || "Error Occurred while retriving user information" })
          })
  // }

  
}
let FRONTIMAGE = null;
let BACKIMAGE = null;
let num = 0;

exports.addtocartMock = async(req,res) =>{

  console.log("indside mock hiiiiii");
  const frontImage = req.body.frontImage;
  const backImage = req.body.backImage;
  if(frontImage != undefined){
    FRONTIMAGE = frontImage;
    num = num + 1;
  } else if(backImage != undefined){
    BACKIMAGE = backImage;
    num = num + 1;
  }
  console.log(num);
  if(num == 2){
  storeitems(FRONTIMAGE, BACKIMAGE);
  } 
  // const variable = req.body.variable;

  // const add_to = new Cart({
  //   Frontimage: myVariable,
  //   // Backimage: variable
  // })
  // await add_to.save();
  // const userCart1 = await UserCart.create({ user: cur_user, cart: add_to._id});
  // await userCart1.save(); 

}

async function storeitems(FRONTIMAGE, BACKIMAGE){
  console.log("inside store items"); 
    const add_to = new Cart({
    Frontimage: FRONTIMAGE,
    Backimage: BACKIMAGE,
    price:0
  })
    await add_to.save();
    const userCart1 = await UserCart.create({ user: cur_user, cart: add_to._id});
    await userCart1.save(); 
    num = 0;
  
}

////adding cart items////
exports.addtocartitems=async(req, res) => {
  // console.log(cur_user+" dsjhflkjsd");

  const object_id = req.params.id;
  const ad = await Product.find({_id:object_id});
  const add = ad[0];
  // console.log(myVariable,"YOOOOOASDFOOASDOFOASDOFOASDFOOASDFOASDF")

  // const istrue = await Cart.findOne({_id:object_id})
console.log("not found")
  // if(istrue === null){ 
  const add_to = new Cart({
    name: add.name,
    // Frontimage: myVariable,
    price: 0,
    // quantity: add.quantity,
    // _id:object_id
  })

  await add_to.save(); 
  // console.log(add_to._id + ' saved successfully'); 

  const istrue = await UserCart.findOne({user:cur_user,cart:object_id}); 
  // console.log(istrue+"***o"); 

  // if(istrue === null){ 
  const userCart1 = await UserCart.create({ user: cur_user, cart: add_to._id, quantity: 3 });
  await userCart1.save(); 
  // } 
// } 

// res.redirect('/product');
res.redirect(307,"/showproduct");
  
};



exports.showCartItems = async(req,res) => {
  
  const userCart = await UserCart.find({user:cur_user});
  // console.log(userCart+"ooooo");
  const cart = await Cart.find();

  // console.log(userCart.length+"ooooo");
  res.render('cart',{userCart:userCart , cart:cart});

}

var size_S_price = 2;
var size_M_price = 2;
var size_L_price = 2;
var size_XL_price = 2;
var size_XXL_price = 2;

exports.update = async(req, res) => {
    const object_id = req.params.id;
    console.log(object_id + " updated");

  const price = (req.body.s*size_S_price)+(req.body.m*size_M_price) +(req.body.xl*size_XL_price)+(req.body.l*size_L_price) +(req.body.xxl*size_XXL_price);
    
    const updatecart = await Cart.findOne({_id:object_id}); 
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


   

//   await Cart.findByIdAndUpdate({_id: object_id}, { address: req.body.address,S:req.body.s ,M:req.body.m,XL: req.body.xl ,
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

exports.cart_item_del = async(req, res) => {
  const delete_id = req.params.id;
  console.log(delete_id + " deleted");
  await Cart.deleteOne({_id:delete_id});
  await UserCart.deleteOne({user:cur_user,cart:delete_id});

  // console.log(userCart.length+"ooooo");
  res.redirect('/cart');
}

exports.cart_clone = async(req,res) => {

  clone_id = req.params.id;
  user_id = cur_user; 

  const exis = await Cart.find({_id:clone_id});
  const exist = exis[0];


  const add_to = new Cart({
    name: exist.name,
    price: exist.price,
    S:exist.S,
    M:exist.M,
    L:exist.L,
    XL:exist.XL,
    XXL:exist.XXL,
    address:exist.address,
    Frontimage:exist.Frontimage,
    Backimage:exist.Backimage

  })

  await add_to.save(); 
  
  const userCart1 = await UserCart.create({ user: cur_user, cart:add_to._id,  quantity: 3 });
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

    const store = new Store({
      // _id: 
      userid: cur_user,
      shopifyStores: [
        {
          shopName: SHOPIFY_SHOP_NAME,
          shopifyAccessToken: SHOPIFY_ACCESS_TOKEN,
          shopifyStoreURL: SHOPIFY_SHOP_URL
        }
      ],
    })
    await store.save();
    
    res.status(200).json(fetchData);
    return;

  } catch (error) {
    console.log("Error in Shopify connect " + error)
    res.status(400).json({
      message: error
    })
    return;
  }
}