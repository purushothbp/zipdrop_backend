const express = require('express');
const services = require(".././services");



const router = express.Router();



// Endpoint to generate OTP as WhatsApp message

router.post('/resend_otp', services.resendOtp);



module.exports = router;