const express = require('express');
const services = require(".././services");

const router = express.Router();



router.post('/resend_otp', services.resendOtp);

module.exports = router;