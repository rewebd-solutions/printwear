const express = require('express')
const multer = require("multer");
const route = express.Router()
const services = require('../services/render')
const controller = require('../controller/controller');
const authServices = require("../services/auth");

const upload = multer({ storage: multer.memoryStorage() });

route.get('/', services.homeRoutes)

route.post('/register', controller.register);
route.post('/login', controller.login);
route.get('/login', authServices.authorizeLogin, services.loginpage);
route.get("/expired", services.expired);
route.get("/logout", controller.logout);

route.post('/emailverify', controller.emailverify);
route.post('/sendingotp', controller.sendotp);
route.get('/forget', services.forgetRoutes);
route.post('/verify', controller.verify);
route.post('/updatepassword', controller.updatepassword);

route.post('/uploadimage', authServices.authorizeToken, upload.single('image'), controller.uploadimage);
route.get("/obtainimages", authServices.authorizeToken, controller.obtainimages);
route.post("/deleteimage", authServices.authorizeToken, controller.deleteimage);

route.post('/addproduct', controller.addproduct); // adding a product by us, not user
route.get("/getproducts", controller.getproducts);// get request that retrieves all product info → for use in stock inventory
route.get("/getproduct", controller.getproduct);

route.get('/admin', services.adminpage); // it only has a form thats incomplete

route.get("/dashboard", authServices.authorizeToken, services.dashboardpage);
route.get("/designgallery", authServices.authorizeToken, services.designgallery); // user oda uploaded images kaatum
route.get("/manageorder", authServices.authorizeToken, services.manageorder); 
route.get("/stock", authServices.authorizeToken, services.stock);
route.get("/connectstore", authServices.authorizeToken, services.connectstore);
route.get("/contact", authServices.authorizeToken, services.contact);
route.get("/mockupgenerator", authServices.authorizeToken, services.mockupgenerator);
route.get("/productlib", authServices.authorizeToken, services.productlib);
route.get("/invoice", authServices.authorizeToken, services.invoice);

route.get('/cart/:id', controller.addtocartitems);
route.get('/cart', controller.showCartItems);
route.post('/update/:id', controller.update);
route.get('/cart_item_del/:id', controller.cart_item_del);
route.get('/cart_clone/:id', controller.cart_clone);
route.post('/my-endpoint', controller.addtocartMock);

route.post("/create-ship-order", controller.createshiporder);

route.post("/connect-shopify", controller.connectShopify);
route.post("/connect-woocommerce", controller.connectWooCommerce);

module.exports = route