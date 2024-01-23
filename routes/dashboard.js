const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const config = require('../config.json');
const { generateOTP } = require('../services'); // Make sure generateOTP is correctly implemented

const app = express();
const port = config.PORT;

