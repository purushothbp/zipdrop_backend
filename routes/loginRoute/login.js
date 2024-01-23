const express = require('express');
const services = require("../../services")



const router = express.Router();



// Endpoint to generate OTP as WhatsApp message
router.post('/sendmessage',services.otpGeneration);

router.post('/resend_otp', services.resendOtp);

router.post('/login', services.userLogin);


module.exports = router;