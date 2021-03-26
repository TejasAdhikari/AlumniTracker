//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session')
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
var multer = require('multer');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB",
  { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});

var upload = multer({ storage: storage });

const userSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  company: String,
  link: String,
  phoneNumber: String,
  address: String,
  dob: String,
  img:
    {
        data: Buffer,
        contentType: String
    }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate(
      {
        googleId: profile.id,
        name: profile.displayName
      }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
});

app.get("/login", function(req, res){
  res.render("login",{key: ""});
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/secrets", function(req, res){

  if(req.isAuthenticated()){
    res.render("secrets", {Name : req.user.name});
  }
  else {
    res.redirect("/login");
  }
});

app.get("/person", function(req, res){
  if(req.isAuthenticated()){
    res.render("person", {Name : req.user.name});
  }
  else {
    res.redirect("/login");
  }
});

app.get("/myProfile", function(req, res){
  if(req.isAuthenticated()){
    res.render("myProfile", {Name : req.user.name, record : req.user});
  }
  else {
    res.redirect("/login");
  }
});

app.get("/editdetails", function(req, res, next){
  if(req.isAuthenticated()){
    var idDetails = req.user.id;
    var edit = User.findById(idDetails);
    edit.exec(function(err, data){
      if(err){
        console.log(err);
      }
      else{
        res.render("editdetails", {Name : req.user.name, record : data});
      }
    });
  }
  else {
    res.redirect("/login");
  }

});

app.post("/update", function(req, res, next){
  if(req.isAuthenticated()){
    var idDetails = req.user.id;
    var update = User.findOneAndUpdate(idDetails, {
      name: req.body.name,
      company: req.body.company,
      link: req.body.link,
      phoneNumber: req.body.phoneNumber,
      address: req.body.address,
      dob: req.body.dob
    }, {useFindAndModify: false});
    update.exec(function(err, data){
      if(err){
        console.log(err);;
      }
      res.redirect("/myProfile");
    });
  }
  else {
    res.redirect("/login");
  }

});

app.post("/register", function(req, res){

  User.register({username: req.body.username, name: req.body.name}, req.body.password, function(err, user){
    if(err){
      console.log(err);
      res.render.redirect("/register");
    }
    else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/secrets")
      });
    }
  });
});

app.post("/login", function(req, res){
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if(err){
      console.log(err);
    }
    else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/secrets");
      });
    }
  });
});

app.get("/autocomplete/", function(req, res, next){
  var regex = new RegExp(req.query["term"], 'i');
  var nameFilter = User.find({name: regex},{'name': 1}).sort({"updated_at":-1}).sort({"created_at":-1}).limit(20);
  nameFilter.exec(function(err, data){
    var result = [];
    if(!err){
      if(data && data.length && data.length > 0){
        data.forEach(user=>{
          let obj={
            id:user._id,
            label: user.name,
          };
          result.push(obj);
        });
      }
      res.jsonp(result)
    }
  });
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.listen(3000, function() {
  console.log("Server up and running on port 3000");
})
