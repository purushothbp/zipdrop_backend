const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const config = require('./config.json');
const express = require('express')
const strings = require('./strings.json');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const crypto = require('crypto');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const app = express();

app.use(bodyParser.json());
app.use(cors());

const dbConnection = mysql.createConnection({
  host: config.DB_HOST,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database:config.DB_NAME,
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

const randomBytesAsync = promisify(crypto.randomBytes);

async function generateRandomToken(length = 256) {
  const randomBytes = await randomBytesAsync(length);
  return randomBytes.toString('hex');
}

async function generateAuthToken() {
  const authToken = await generateRandomToken();
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

    // Query to check if the user already exists in the table or not
    const checkUserQuery = `
      SELECT * FROM userlogin
      WHERE Mobile_Number = ?;
    `;

    dbConnection.query(checkUserQuery, [whatsappNumber], async (error, results) => {
      if (error) {
        console.error('Error checking user existence:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      let auth_token;
      try {
        auth_token = await generateAuthToken();
        console.log('Generated Hashed Token:', auth_token);
      } catch (error) {
        console.error('Error generating hashed token:', error.message);
        return res.status(500).json({ success: false, error: 'Error generating hashed token' });
      }

      // Generating a UUID for the user for future reference
      const uuid = uuidv4();

      // If the user exists, updating the existing record
      if (results.length > 0) {
        const updateQuery = `
          UPDATE userlogin
          SET Date = NOW(), Auth_token = ?, Otp = ?
          WHERE Mobile_Number = ?;
        `;

        const updateValues = [auth_token, otp, whatsappNumber];

        dbConnection.query(updateQuery, updateValues, (updateError, updateResults) => {
          if (updateError) {
            console.error('Error updating record:', updateError);
            return res.status(500).json({ success: false, error: updateError.message });
          }

          console.log('Record updated successfully:', updateResults);

          otpMap.delete(whatsappNumber); // Clear OTP from the temporary map
          console.log('Login successful (existing user).');

          res.json({ success: true, message: 'Login successful (existing user)', uuid, authToken: auth_token });
        });
      } else {
        // If the user does not exist, inserting a new record to the table
        const insertQuery = `
          INSERT INTO userlogin (uuid, Mobile_Number, Date, Auth_token, Otp)
          VALUES (?, ?, NOW(), ?, ?);
        `;

        const insertValues = [uuid, whatsappNumber, auth_token, otp];

        dbConnection.query(insertQuery, insertValues, (insertError, insertResults) => {
          if (insertError) {
            console.error('Error inserting record:', insertError);
            return res.status(500).json({ success: false, error: insertError.message });
          }

          console.log('Record inserted successfully:', insertResults);

          otpMap.delete(whatsappNumber);
          console.log('Login successful (new user).');

          res.json({ success: true, message: 'Login successful (new user)', authToken: auth_token });
        });
      }
    });
  } catch (error) {
    console.error('Error in /login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}



async function packageDetails(req, res) {
  try {
    const { Weight, width, height } = req.body;

    const amount = (Weight*10);

    const insertQuery = `
      INSERT INTO package_details ( Weight,  height, width, amount)
      VALUES ( ?, ?, ?, ?)
    `;

    const values = [ Weight,  height, width, amount];

    dbConnection.query(insertQuery, values, (error, results) => {
      if (error) {
        console.error('Error inserting record:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      console.log('Record inserted successfully:', results);

      res.json({ success: true, message: 'Package details stored successfully' });
    });
  } catch (error) {
    console.error('Error in /packageDetails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}




module.exports = {
  generateOTP,
  otpGeneration,
  userLogin,
  resendOtp,
  packageDetails
}