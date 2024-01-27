const express = require('express');
const services = require("../services")

const router = express.Router();

router.post('/from_address', services.fromAddress);


module.exports = router;