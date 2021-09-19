const express = require('express');
const router = express.Router();
const csrf = require('csurf')
const csrfProtection = csrf({ cookie: true });
const bcrypt = require('bcryptjs')
var db = require('../model/connection');
const Users = db.users;
const { body, validationResult } = require('express-validator');
const {Sequeize, Op, QueryTypes} = require('sequelize');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');

const transporter = nodemailer.createTransport(smtpTransport({
    name: `${process.env.EMAILNAME}`,
    host: `${process.env.EMAILHOST}`,
    secureConnection: true,
    tls: {
      rejectUnauthorized: false
    },
    port: 465,
    auth: {
        user: 'test5ine@5ine.in',
        pass: '5ine123#@!',
  }
}));

//middleware
const myLogger = function (req, res, next) {
    if(req.session.user){
        res.redirect('/contact')
    }else{
        next()
    }
}



// login page route.
router.get('/', csrfProtection, myLogger, function (req, res) {
    let pageTitle = "Login"
    return res.status(200).render('auth/login',{
        title: pageTitle,
        csrfToken: req.csrfToken(),
        successMsg: req.flash('success'),
        errorMsg: req.flash('error'),
        email:'',
        password:'',
        errors: {},
    });
})

router.post('/', csrfProtection, myLogger,
//custom validation for email
body('email').custom( async (value) => {
    if(!value.match(/^([A-Z|a-z|0-9](\.|_){0,1})+[A-Z|a-z|0-9]\@([A-Z|a-z|0-9])+((\.){0,1}[A-Z|a-z|0-9]){2}\.[a-z]{2,3}$/)){
        return Promise.reject('Please enter a valid email');
    }
    let user = await Users.findAll({
        attributes:['email'],
        where:{
            email:value,
            verified:1,
        }
    })
    if(user.length == 0){
        return Promise.reject('E-mail doesnot exists!');
    }
}),
body('password').custom((value, { req }) => {
    if(!value.match(/^[a-z 0-9~%.:_\@\-\/\&+=,]+$/i)){
        return Promise.reject('Please enter a valid password');
    }

    // Indicates the success of this synchronous custom validator
    return true;
}),
async function (req, res) {
    let pageTitle = "Login"
    let {email,password} = req.body;
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(200).render('auth/login',{
            title: pageTitle,
            csrfToken: req.csrfToken(),
            successMsg: req.flash('success'),
            errorMsg: req.flash('error'),
            email,
            password:'',
            errors: errors.mapped(),
        });
    }else{
        let user = await Users.findAll({
            attributes:['id','email','password'],
            where:{
                email:email,
                verified:1,
            }
        });
        
        if(bcrypt.compareSync(password, user[0].dataValues.password)){
            req.session.user = user[0].dataValues.id;
            req.flash('success', 'logged in')
        }else{
            req.flash('error', 'Invalid Password')
        }
        return res.status(200).render('auth/login',{
            title: pageTitle,
            csrfToken: req.csrfToken(),
            successMsg: req.flash('success'),
            errorMsg: req.flash('error'),
            email:'',
            password:'',
            errors: {},
        });
    }
    
})

// register page route.
router.get('/register', csrfProtection, myLogger, function (req, res) {
    let pageTitle = "Register"
    return res.status(200).render('auth/register',{
        title: pageTitle,
        csrfToken: req.csrfToken(),
        errors: {},
        successMsg: req.flash('success'),
        errorMsg: req.flash('error'),
        fname:'',
        email:'',
        phone:'',
        password:'',
        cpassword:''
    });
})

router.post('/register', csrfProtection, myLogger,
//custom validation for name
body('fname').custom( async (value) => {
    if(!value.match(/^[a-zA-Z\s]*$/)){
        return Promise.reject('Please enter a valid name');
    }
}),
//custom validation for phone
body('phone').custom( async (value) => {
    if(!value.match(/^[0-9\s]*$/)){
        return Promise.reject('Please enter a valid phone number');
    }
    if(value.length<10 || value.length>10){
        return Promise.reject('Please enter a valid phone number');
    }
}),
//custom validation for email
body('email').custom( async (value) => {
    if(!value.match(/^([A-Z|a-z|0-9](\.|_){0,1})+[A-Z|a-z|0-9]\@([A-Z|a-z|0-9])+((\.){0,1}[A-Z|a-z|0-9]){2}\.[a-z]{2,3}$/)){
        return Promise.reject('Please enter a valid email');
    }
    let user = await Users.findAll({
        attributes:['email'],
        where:{
            email:value,
        }
    })
    if(user.length > 0){
        return Promise.reject('E-mail already in use');
    }
}),
// password must be at least 5 chars long
body('cpassword').custom((value, { req }) => {
    if (value !== req.body.password) {
        return Promise.reject('Password confirmation does not match password');
    }

    // Indicates the success of this synchronous custom validator
    return true;
  }),
// body('password').isLength({ min: 5 }),
async function (req, res) {
    let pageTitle = "Register"
    let {fname,email,phone,password,cpassword} = req.body;
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.mapped() });
      return res.status(200).render('auth/register',{
            title: pageTitle,
            csrfToken: req.csrfToken(),
            errors: errors.mapped(),
            successMsg: req.flash('success'),
            errorMsg: req.flash('error'),
            fname,
            email,
            phone,
            password,
            cpassword
        });
    }else{
        const hashPassword = bcrypt.hashSync(password, 10);
        const otp = (Math.floor(100000 + Math.random() * 900000));
        try {
            let userData = await Users.create({fname,phone,email,password:hashPassword,otp})
            await transporter.sendMail({
                from: 'test5ine@5ine.in',
                to: email,
                subject: 'Email Verification',
                html: `<h3>Your otp is ${otp}</h3><br>
                <a href="http://localhost:${process.env.PORT}/verify/${userData.dataValues.id}">Click here to verify</a>`
            }, async (err, info) => {
                if (err) {
                    console.log(err)
                    await Users.destroy({
                        where:{
                            id:userData.dataValues.id
                        }
                    })
                    req.flash('error', 'Oops!! Something went wrong please try again.')
                    return res.status(200).render('auth/register',{
                        title: pageTitle,
                        csrfToken: req.csrfToken(),
                        errors: {},
                        successMsg: req.flash('success'),
                        errorMsg: req.flash('error'),
                        fname:'',
                        email:'',
                        phone:'',
                        password:'',
                        cpassword:''
                    });
                }else{
                    req.flash('success', 'Kindly check your email in order to verify your email')
                    return res.status(200).render('auth/register',{
                        title: pageTitle,
                        csrfToken: req.csrfToken(),
                        errors: {},
                        successMsg: req.flash('success'),
                        errorMsg: req.flash('error'),
                        fname:'',
                        email:'',
                        phone:'',
                        password:'',
                        cpassword:''
                    });
                }
            });
        } catch (error) {
            req.flash('error', 'Oops!! Something went wrong please try again.')
            return res.status(200).render('auth/register',{
                title: pageTitle,
                csrfToken: req.csrfToken(),
                errors: {},
                successMsg: req.flash('success'),
                errorMsg: req.flash('error'),
                fname:'',
                email:'',
                phone:'',
                password:'',
                cpassword:''
            });
            console.log(error)
        }
        
    }
    
    
    
})

// otp page route.
router.get('/verify/:userId', csrfProtection, myLogger, async function (req, res) {
    let pageTitle = "OTP"
    let id = req.params.userId;
    let data = await Users.findAll({
        where:{
            id:id,
            verified:0,
        }
    })
    if(data.length==0){
        req.flash('error', 'invalid user id')
        return res.redirect('/')
    }
    return res.status(200).render('auth/otp',{
        title: pageTitle,
        csrfToken: req.csrfToken(),
        otp:'',
        id,
        errors: {},
        successMsg: req.flash('success'),
        errorMsg: req.flash('error'),
    });
})

// otp page route.
router.post('/verify/:userId', csrfProtection, myLogger,
body('otp').custom( async (value) => {
    if(!value.match(/^[0-9\s]*$/)){
        return Promise.reject('Please enter a valid otp');
    }
    if(value.length<6 || value.length>6){
        return Promise.reject('Please enter a valid otp');
    }
}),
async function (req, res) {
    let pageTitle = "OTP"
    let id = req.params.userId;
    let data = await Users.findAll({
        where:{
            id:id,
            verified:0,
        }
    })
    if(data.length==0){
        req.flash('error', 'invalid user id')
        return res.redirect('/')
    }
    let {otp} = req.body;
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.mapped() });
      return res.status(200).render('auth/otp',{
            title: pageTitle,
            csrfToken: req.csrfToken(),
            errors: errors.mapped(),
            successMsg: req.flash('success'),
            errorMsg: req.flash('error'),
            otp,
            id,
        });
    }else{
        let data = await Users.findAll({
            where:{
                id:id,
                verified:0,
                otp
            }
        })
        if(data.length>0){
            const otp = (Math.floor(100000 + Math.random() * 900000));
            await Users.update({otp,verified:1,},{
                where:{
                    id:id
                }
            })
            req.flash('success', 'Email verified')
            return res.redirect('/')
        }else{
            req.flash('error', 'invalid user id')
            return res.status(200).render('auth/otp',{
                title: pageTitle,
                csrfToken: req.csrfToken(),
                otp:'',
                errors: {},
                successMsg: req.flash('success'),
                errorMsg: req.flash('error'),
                id,
            });
        }
        
    }
})

router.get('/logout', (req ,res)=>{
    req.session.destroy(function(err){
        if(err){
            console.log(err);
        }else{
            return res.redirect('/');
        }
    })
})






module.exports = router;