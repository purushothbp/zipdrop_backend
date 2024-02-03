const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const config = require('./config.json');
const express = require('express')
const strings = require('./strings.json');
const mysql = require('mysql2');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const jwt = require ('jsonwebtoken');
const Razorpay = require('razorpay');
const app = express();
const enc = require('./encryptions');

app.use(bodyParser.json());
app.use(express.json);
app.use(express.urlencoded({extended: false}));
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


async function otpGeneration(req, res) {
  try {
    const { whatsappNumber } = req.body;
    console.log(whatsappNumber);

    if (!whatsappNumber || isNaN(Number(whatsappNumber))) {
      return res.status(400).json({ success: false, message: "WhatsApp number must be a valid number." });
    }

    if (whatsappNumber.length !== MAX_DIGITS) {
      return res.status(400).json({ success: false, message: strings.InvalidNumber });
    }

    const checkUserQuery = `
      SELECT uuid, Auth_token FROM userlogin
      WHERE Mobile_Number = ?;
    `;

    dbConnection.query(checkUserQuery, [whatsappNumber], async (error, results) => {
      if (error) {
        console.error('Error checking user existence:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      if (results.length > 0) {
        console.log('User found. Navigating to package_details page.');
        const { uuid, Auth_token } = results[0];
        return res.json({ success: true, message: 'User found. Navigating to package_details page.', uuid, authToken: Auth_token });
      }

      // If the user does not exist, generate OTP and return it
      const cooldownTimestamp = resendCooldownMap.get(whatsappNumber);
      if (cooldownTimestamp && Date.now() - cooldownTimestamp < RESEND_COOLDOWN) {
        const remainingCooldown = RESEND_COOLDOWN - (Date.now() - cooldownTimestamp);
        return res.status(400).json({
          success: false,
          message: `Resend OTP cooldown active. Please wait ${remainingCooldown / 1000} seconds.`,
        });
      }

      const otp = enc.generateOTP;
      const url = config.Api_Url;
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

    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function resendOtp(req, res) {
  try {
    const { whatsappNumber } = req.body;

    if (!whatsappNumber || isNaN(Number(whatsappNumber))) {
      return res.status(400).json({ success: false, message: "WhatsApp number must be a valid number." });
    }

    if (whatsappNumber.length !== MAX_DIGITS) {
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

    const otp = enc.generateOTP;
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

    // Check if whatsappNumber and otp are provided and are numbers
    if (!whatsappNumber || isNaN(Number(whatsappNumber)) || whatsappNumber.length !== MAX_DIGITS || !otp || isNaN(Number(otp))) {
      console.log('Invalid input. Returning error.');
      return res.status(400).json({ success: false, message: "Invalid input. WhatsApp number and OTP must be valid numbers." });
    }

    const storedOTP = otpMap.get(whatsappNumber);

    if (!storedOTP || otp !== storedOTP) {
      console.log('Invalid OTP. Returning error.');
      return res.status(400).json({ success: false, message: strings.InvalidOTP });
    }

    // Query to check if the user already exists in the table or not
    const checkUserQuery = `
      SELECT uuid FROM userlogin
      WHERE Mobile_Number = ?;
    `;

    dbConnection.query(checkUserQuery, [whatsappNumber], async (error, results) => {
      if (error) {
        console.error('Error checking user existence:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      let auth_token;
      let uuid;

      try {
        auth_token = await enc.generateAuthToken;
        console.log('Generated Hashed Token:', auth_token);
      } catch (error) {
        console.error('Error generating hashed token:', error.message);
        return res.status(500).json({ success: false, error: 'Error generating hashed token' });
      }

      // If the user exists, get the existing UUID
      if (results.length > 0) {
        uuid = results[0].uuid;

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

          res.json({ success: true, message: 'Login successful (existing user)', authToken: auth_token });
        });
      } else {
        // If the user does not exist, inserting a new record to the table
        uuid = uuidv4();

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

          res.json({ success: true, message: 'Login successful (new user)', uuid, authToken: auth_token });
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
    const authToken = req.headers.authorization.replace('Bearer ', '');
    const decrypted = await enc.decryptAuthToken;
    console.log(decrypted);
    const {  Weight, width, height } = req.body;

    const amount = Weight * 10;

    const insertQuery = `
      INSERT INTO package_details (authToken, Weight, height, width, amount)
      VALUES (?, ?, ?, ?, ?)
    `;

    const values = [authToken, Weight, height, width, amount];

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

async function fromAddress(req, res) {
  try {
    // Retrieve authToken from headers
    const authToken = req.headers.authorization.replace('Bearer ', ''); // Extracting token from Authorization header

    const { name, mobileNumber, address, city, pincode, locality } = req.body;

    // Constructing the from_address string
    const fromAddress = `${name}, ${mobileNumber}, ${address}, ${city}, ${pincode}, ${locality}`;

    // Check if UUID exists in the database
    const selectQuery = `
      SELECT * FROM package_details WHERE authToken = ?
    `;
    dbConnection.query(selectQuery, [authToken], (selectError, selectResults) => {
      if (selectError) {
        console.error('Error querying record:', selectError);
        return res.status(500).json({ success: false, error: selectError.message });
      }

      if (selectResults.length > 0) {
        // UUID exists, update the from_address column
        const updateQuery = `
          UPDATE package_details SET from_address = ? WHERE authToken = ?
        `;
        dbConnection.query(updateQuery, [fromAddress, authToken], (updateError, updateResults) => {
          if (updateError) {
            console.error('Error updating record:', updateError);
            return res.status(500).json({ success: false, error: updateError.message });
          }
          console.log('Record updated successfully:', updateResults);
          res.json({ success: true, message: 'Sender details updated successfully' });
        });
      } else {
        // UUID doesn't exist, insert a new row
        const insertQuery = `
          INSERT INTO package_details (authToken, from_address) VALUES (?, ?)
        `;
        dbConnection.query(insertQuery, [authToken, fromAddress], (insertError, insertResults) => {
          if (insertError) {
            console.error('Error inserting record:', insertError);
            return res.status(500).json({ success: false, error: insertError.message });
          }
          console.log('Record inserted successfully:', insertResults);
          res.json({ success: true, message: 'Sender details stored successfully' });
        });
      }
    });
  } catch (error) {
    console.error('Error in /from_address:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}


async function toAddress(req, res) {
  try {
    const authToken = req.headers.authorization.replace('Bearer ', '');
    const {  name, mobileNumber, address, city, pincode, locality } = req.body;

    // Constructing the to_address string
    const toAddress = `${name}, ${mobileNumber}, ${address}, ${city}, ${pincode}, ${locality}`;

    // Check if UUID exists in the database
    const selectQuery = `
      SELECT * FROM package_details WHERE authToken = ?
    `;
    dbConnection.query(selectQuery, [authToken], (selectError, selectResults) => {
      if (selectError) {
        console.error('Error querying record:', selectError);
        return res.status(500).json({ success: false, error: selectError.message });
      }

      if (selectResults.length > 0) {
        // UUID exists, update the to_address column
        const updateQuery = `
          UPDATE package_details SET to_address = ? WHERE authToken = ?
        `;
        dbConnection.query(updateQuery, [toAddress, authToken], (updateError, updateResults) => {
          if (updateError) {
            console.error('Error updating record:', updateError);
            return res.status(500).json({ success: false, error: updateError.message });
          }
          console.log('Record updated successfully:', updateResults);
          res.json({ success: true, message: 'Receiver details updated successfully' });
        });
      } else {
        // UUID doesn't exist, insert a new row
        const insertQuery = `
          INSERT INTO package_details (authToken, to_address) VALUES (?, ?)
        `;
        dbConnection.query(insertQuery, [authToken, toAddress], (insertError, insertResults) => {
          if (insertError) {
            console.error('Error inserting record:', insertError);
            return res.status(500).json({ success: false, error: insertError.message });
          }
          console.log('Record inserted successfully:', insertResults);
          res.json({ success: true, message: 'Receiver details stored successfully' });
        });
      }
    });
  } catch (error) {
    console.error('Error in /to_address:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function orders(req, res){
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    const options = req.body;
    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).send("Error");
    }

    res.json(order);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error");
  }

}


module.exports = {
  otpGeneration,
  userLogin,
  resendOtp,
  packageDetails,
  fromAddress,
  toAddress,
  orders
}