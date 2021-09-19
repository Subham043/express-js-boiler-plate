require('dotenv').config()
const path = require('path');
const express = require('express');
const ejs = require('ejs');
var cookieParser = require('cookie-parser')
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const hpp = require('hpp');


const app = express();
const port = process.env.PORT || 8080;

app.use(helmet());

app.use(hpp());

//https://www.npmjs.com/package/express-rate-limit -> limiter docs
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  });
  
//  apply to all requests
app.use(limiter);

app.set('trust proxy', 1) // trust first proxy
var expiryDate = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
app.use(
	session({
		secret: 'secrectkey_to_be_replaced_with_uuid4',
		resave: true,
		saveUninitialized: true,
        cookie: {
            // secure: true,
            httpOnly: true,
          }
	})
);

app.use(function(req, res, next) {
    res.locals.user = req.session.user;
    next();
  });

app.use(flash());

//model-connection
require('./model/connection');

app.use(cookieParser())
app.set('views', path.join(__dirname, 'view'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: false}));


//controller-routes
let authController = require('./controller/auth.js');

app.use('/', authController);

let contactController = require('./controller/contact.js');

app.use('/contact', contactController);


app.listen(port,()=>{
    console.log(`Apps is running on port: ${port}`);
})