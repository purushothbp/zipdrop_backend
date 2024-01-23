const express = require('express');
const services = require("../services")

const router = express.Router();

router.post('/login', services.userLogin);


module.exports = router;