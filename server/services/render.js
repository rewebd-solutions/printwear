const session = require('express-session');
var nodemailer = require('nodemailer');
var multer = require('multer');

exports.homeRoutes = (req, res) => {
    res.render("index");
    //res.sendFile(__dirname+'/mockup.html');
}

exports.loginpage = (req, res) => {
    res.render("login", { success: '' });
}

exports.dashboardpage = (req, res) => {
    res.render("dashboard");
}

exports.adminpage = (req, res) => {
    res.render("admin");
}

exports.forgetRoutes = (req, res) => {
    res.render('forgetpassword', { success: "" });
}

exports.designgallery = (req, res) => {
    res.render('design');
}

exports.connectstore = (req, res) => {
    res.render('connectstore');
}
exports.contact = (req, res) => {
    res.render("contact");
}

exports.mockupgenerator = (req, res) => {
    res.render('mockupgenerator');
}

//OTP FUNCTIONS DON'T TOUCH 

//verifying otp


////finding number with email id




///finding number with email id