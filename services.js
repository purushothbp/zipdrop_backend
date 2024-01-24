const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const config = require('./config.json');
const express = require('express')
const strings = require('./strings.json');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const app = express();

app.use(bodyParser.json());
app.use(cors());

const dbConnection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Zipdrop@123',
  database: 'zipdrop',
});

const accessToken = config.ACCESS_TOKEN;
const MAX_DIGITS = 12; //number of digits need to present in mobileNumber
const RESEND_COOLDOWN = 30000; // 30 seconds in milliseconds
let resendCooldownMap = new Map();
let otpMap = new Map();


// Function to generate OTP
function generateOTP() {
  const min = 100000; 
  const max = 999999; 
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  return otp.toString(); 
}
async function generateAuthToken() {
  const authToken = generateRandomToken();
  const saltRounds = 10;

  try {
    const hashedToken = await bcrypt.hash(authToken, saltRounds);
    return hashedToken;
  } catch (error) {
    throw new Error('Error hashing the authentication token');
  }
}

async function otpGeneration(req, res)  {
  try {
    const { whatsappNumber } = req.body;
    console.log(whatsappNumber);
    if (!whatsappNumber) {
      return res.status(400).json({ success: false, message: strings.WhatsappNumberRequired });
    }
    else if (!whatsappNumber || whatsappNumber.length !== MAX_DIGITS) {
      return res.status(400).json({ success: false, message: strings.InvalidNumber });
    }
    const cooldownTimestamp = resendCooldownMap.get(whatsappNumber);
    if (cooldownTimestamp && Date.now() - cooldownTimestamp < RESEND_COOLDOWN) {
      const remainingCooldown = RESEND_COOLDOWN - (Date.now() - cooldownTimestamp);
      return res.status(400).json({
        success: false,
        message: `Resend OTP cooldown active. Please wait ${remainingCooldown / 1000} seconds.`,
      });
    }

    const otp = generateOTP();
    const url = config.Api_Url
    const apiUrl = `${url}/${whatsappNumber}?messageText=${otp}`;


    const response = await axios.post(
      apiUrl,
      {},
      {
        headers: {
          Authorization: accessToken,
          'Content-Type': 'application/json',
        },
      }
    );
    resendCooldownMap.set(whatsappNumber, Date.now());

    otpMap.set(whatsappNumber, otp);
    res.json({ success: true, otp });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function resendOtp (req, res) {
  try {
    const { whatsappNumber } = req.body;

    if (!whatsappNumber) {
      return res.status(400).json({ success: false, message: strings.WhatsappNumberRequired });
    }
    else if (!whatsappNumber || whatsappNumber.length !== MAX_DIGITS) {
      return res.status(400).json({ success: false, message: strings.InvalidNumber });
    }
    const cooldownTimestamp = resendCooldownMap.get(whatsappNumber);
    if (cooldownTimestamp && Date.now() - cooldownTimestamp < RESEND_COOLDOWN) {
      const remainingCooldown = RESEND_COOLDOWN - (Date.now() - cooldownTimestamp);
      return res.status(400).json({
        success: false,
        message: `Resend OTP cooldown active. Please wait ${remainingCooldown / 1000} seconds.`,
      });
    }

    const otp = generateOTP();
    const url = config.Api_Url
    const apiUrl = `${url}/${whatsappNumber}?messageText=${otp}`;

    const response = await axios.post(
      apiUrl,
      {},
      {
        headers: {
          Authorization: accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    resendCooldownMap.set(whatsappNumber, Date.now());
    otpMap.set(whatsappNumber, otp);
    res.json({ success: true, otp });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function userLogin(req, res) {
  try {
    const { whatsappNumber, otp } = req.body;

    console.log('Received login request:', { whatsappNumber, otp });

    if (!whatsappNumber || whatsappNumber.length !== MAX_DIGITS || !otp) {
      console.log('Invalid input. Returning error.');
      return res.status(400).json({ success: false, message: strings.InvalidInput });
    }

    const storedOTP = otpMap.get(whatsappNumber);

    if (!storedOTP || otp !== storedOTP) {
      console.log('Invalid OTP. Returning error.');
      return res.status(400).json({ success: false, message: strings.InvalidOTP });
    }

    const insertQuery = `
      INSERT INTO userlogin (Mobile_Number, Date, Auth_token, Otp)
      VALUES (?, NOW(), ?, ?)
    ;`

    const auth_token = generateAuthToken(); // Implement a function to generate Auth Token
    const values = [whatsappNumber, auth_token, otp];

    // Execute the INSERT query
    dbConnection.query(insertQuery, values, (error, results) => {
      if (error) {
        console.error('Error inserting record:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      console.log('Record inserted successfully:', results);

      otpMap.delete(whatsappNumber); // Clear OTP from the temporary map
      console.log('Login successful.');

      res.json({ success: true, message: 'Login successful' });
    });
  } catch (error) {
    console.error('Error in /login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  generateOTP,
  otpGeneration,
  userLogin,
  resendOtp
}