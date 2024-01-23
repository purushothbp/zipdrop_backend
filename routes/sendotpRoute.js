const express = require('express');
const services = require(".././services");

const router = express.Router();

router.post('/sendmessage',services.otpGeneration);

module.exports = router;