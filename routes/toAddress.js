const express = require('express');
const services = require("../services")

const router = express.Router();

router.post('/to_address', services.toAddress);


module.exports = router;


