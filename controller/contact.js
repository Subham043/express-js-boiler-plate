const express = require('express');
const router = express.Router();
const csrf = require('csurf')
const csrfProtection = csrf({ cookie: true });
var db = require('../model/connection');
const Contacts = db.contacts;
const { body, validationResult } = require('express-validator');
const {Sequeize, Op, QueryTypes} = require('sequelize');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');

const transporter = nodemailer.createTransport(smtpTransport({
    name: 'example.com',
    host:'mail.5ine.in',
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




// conact page route.
router.get('/', csrfProtection, function (req, res) {
    let pageTitle = "Contact"
    res.render('pages/contact',{
        title: pageTitle,
        csrfToken: req.csrfToken(),
        errors: {},
        alert:'',
        name:'',
        email:'',
        phone:'',
        message:'',
        flashMsg: req.flash('info') 
    });
})



router.post('/', csrfProtection,
//custom validation for name
body('name').custom( async (value) => {
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
}),
// message must be at least 5 chars long
body('message').custom((value, { req }) => {
    if(!value.match(/^[a-z 0-9~%.:_\@\-\/\&+=,]+$/i)){
        return Promise.reject('Please enter a valid message');
    }

    // Indicates the success of this synchronous custom validator
    return true;
  }),
// body('password').isLength({ min: 5 }),
async function (req, res) {
    let pageTitle = "Contact"
    let {name,email,phone,message} = req.body;
    // Finds the validation errors in this request and wraps them in an object with handy functions
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.mapped() });
      return res.status(200).render('pages/contact',{
            title: pageTitle,
            csrfToken: req.csrfToken(),
            errors: errors.mapped(),
            alert:'',
            name,
            email,
            phone,
            message,
        });
    }else{
        try {
            await transporter.sendMail({
                from: 'test5ine@5ine.in',
                to: 'subham.5ine@gmail.com',
                subject: 'Test Email Subject',
                html: '<h1>Example HTML Message Body</h1>'
            }, (err, info) => {
                if (err) {
                    console.log('Error occurred. ' + err.message);
                    return process.exit(1);
                }
        
                console.log('Message sent: %s', info.messageId);
                // Preview only available when sending through an Ethereal account
                console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            });
            await Contacts.create({name,phone,email,message})
            return res.status(200).render('pages/contact',{
                title: pageTitle,
                csrfToken: req.csrfToken(),
                errors: {},
                alert:'success',
                name:'',
                email:'',
                phone:'',
                message:'',
            });
        } catch (error) {
            return res.status(200).render('pages/contact',{
                title: pageTitle,
                csrfToken: req.csrfToken(),
                errors: {},
                alert:'fail',
                name:'',
                email:'',
                phone:'',
                message:'',
            });
        }
        
    }
    
    
    
})

router.get('/flash', function(req, res){
    // Set a flash message by passing the key, followed by the value, to req.flash().
    req.flash('info', 'Flash is back!')
    res.redirect('/contact');
});



module.exports = router;