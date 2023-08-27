const express = require('express')
const route = express.Router()
const services = require('../services/render')
const controller = require('../controller/controller');
const authServices = require("../services/auth");
route.get('/', services.homeRoutes)

route.post('/register', controller.register);
route.post('/login', controller.login);
route.get('/login', authServices.authorizeLogin, services.loginpage);
route.get("/expired", services.expired);
route.get("/logout", controller.logout);

route.get("/dashboard", authServices.authorizeToken, services.dashboardpage);

route.post('/emailverify', controller.emailverify);
route.post('/sendingotp', controller.sendotp);
route.get('/forget', services.forgetRoutes);

route.post('/verify', controller.verify);
route.post('/updatepassword', controller.updatepassword);
route.post('/uploadimage', controller.uploadimage);

route.get('/admin', services.adminpage); // it only has a form thats incomplete
route.post('/addproduct', controller.addproduct);
route.get("/displayproduct", authServices.authorizeToken, controller.displayproduct);
route.get("/designgallery", authServices.authorizeToken, services.designgallery);
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

route.post("/connect-shopify", controller.connectShopify);
route.post("/connect-woocommerce", controller.connectWooCommerce);

module.exports = route