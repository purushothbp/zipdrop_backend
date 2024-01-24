const express = require('express');
const services = require("../services")

const router = express.Router();

router.post('/package_details', services.packageDetails);


module.exports = router;