
exports.homeRoutes = (req, res) => {
    res.render("index");
    //res.sendFile(__dirname+'/mockup.html');
}

exports.loginpage = (req, res) => {
    // if (req.id) return res.redirect("/dashboard");
    res.render("login", { status: '' });
}

exports.expired = (req, res) => {
    res.render("expired");
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
    res.render('design', { status: "" });
}

exports.manageorder = (req, res) => {
    res.render("manageorder");
}

exports.stock = (req, res) => {
    res.render("stock", { value: 1});
}

exports.invoice = (req, res) => {
    res.render("invoice");
}

exports.productlib = (req, res) => {
    res.render("productlib");
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