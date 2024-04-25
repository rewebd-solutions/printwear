const jwt = require("jsonwebtoken");
const UserModel = require("../model/userModel");
const secret = process.env.JWT_SECRET;

exports.createToken = (userId, userName) => {
    const token = jwt.sign({
        id: userId,
        name: userName,
    }, secret, { expiresIn: "1d"} );
    return token;
}

exports.authorizeToken = (req, res, next) => {
    // console.log("cooks", req.cookies);
    const token = req.cookies.actk;
    // console.log(token);
    if (!token) {
      return res.redirect("/login");
    }
    try {
      const data = jwt.verify(token, secret);
      // console.log(data);
      req.userId = data.id;
      req.userName = data.name;
      return next();
    } catch {
      res.clearCookie("actk");
      return res.redirect("/login");
    }
};

exports.authorizeLogin = (req, res, next) => {
    const token = req.cookies.actk;
    if (token) return res.redirect("/dashboard");
    return next();
}

exports.decryptToken = (req, res, next) => {
  try {
    const data = jwt.verify(req.cookies.actk, secret);
    req.name = data.name;
    return next();
  } catch (error) {
    return next();
  }
}

exports.authorizeAdmin = async (req, res, next) => {
  try {
    const token = req.cookies.admtk;
    if (!token) return res.redirect("/login");

    const decoded = jwt.verify(token, secret);
    const isAdmin = await UserModel.findOne({ _id: decoded.id, name: decoded.name });
    if (!isAdmin) throw new Error("Admin Cookie has been tampered with!")
    
    return next();
  } catch (error) {
    console.log(error);
    res.clearCookie("admtk");
    res.redirect("/login");
  }
}