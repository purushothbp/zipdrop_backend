require('dotenv').config();
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const express = require('express')
const strings = require('./strings.json');
const mysql = require('mysql2');
const { promisify } = require('util');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const app = express();
const enc = require('./encryptions');

app.use(bodyParser.json());
app.use(express.json);
app.use(express.urlencoded({ extended: false }));
app.use(cors());

const dbConnection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const accessToken = process.env.ACCESS_TOKEN;
const MAX_DIGITS = 12; //number of digits need to present in mobileNumber
const RESEND_COOLDOWN = 30000; // 30 seconds in milliseconds
let resendCooldownMap = new Map();
let otpMap = new Map();

// Function to generate OTP
function generateOTP() {
  const min = 100000;
  const max = 999999;
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(otp)
  return otp.toString();
}


async function otpGeneration(req, res) {
  try {
    const { whatsappNumber } = req.body;

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
        const { uuid, Auth_token, whatsappNumber } = results[0];
        const { exp } = enc.decryptAuthToken(Auth_token);

        const currentTime = new Date().getTime();

        if (exp <= currentTime) {
          console.log(exp)
          console.log(currentTime)

          console.log("Token expired. Generating new OTP.");

          const otp = generateOTP();
          resendCooldownMap.set(whatsappNumber, Date.now());
          otpMap.set(whatsappNumber, otp);
          console.log('Stored OTP:', otpMap.get(whatsappNumber));
          return res.json({ success: true, otp });
        } else {
          // Token is valid, generate a new auth token and update it in the database
          console.log('Token valid. Generating new auth token.');

          const newAuthToken = enc.generateAuthToken(uuid, whatsappNumber);

          // Update the database with the new auth token
          const updateAuthTokenQuery = `
            UPDATE userlogin
            SET Auth_token = ?
            WHERE Mobile_Number = ?;
          `;

          dbConnection.query(updateAuthTokenQuery, [newAuthToken, whatsappNumber], (error, updateResults) => {
            if (error) {
              console.error('Error updating auth token:', error);
              return res.status(500).json({ success: false, error: error.message });
            }

            console.log('Auth token updated successfully.');

            return res.json({ success: true, message: 'User found. Navigating to package_details page.', authToken: newAuthToken });
          });
        }
      }


      else {
        // If the user does not exist, generate OTP and return it
        const cooldownTimestamp = resendCooldownMap.get(whatsappNumber);
        if (cooldownTimestamp && Date.now() - cooldownTimestamp < RESEND_COOLDOWN) {
          const remainingCooldown = RESEND_COOLDOWN - (Date.now() - cooldownTimestamp);
          return res.status(400).json({
            success: false,
            message: `Resend OTP cooldown active. Please wait ${remainingCooldown / 1000} seconds.`,
          });
        }

        const otp = generateOTP();

        resendCooldownMap.set(whatsappNumber, Date.now());
        otpMap.set(whatsappNumber, otp);
        res.json({ success: true, otp });
      }

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

    const otp = generateOTP();

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

    if (!whatsappNumber || isNaN(Number(whatsappNumber)) || whatsappNumber.length !== MAX_DIGITS || !otp || isNaN(Number(otp))) {
      console.log('Invalid input. Returning error.');
      return res.status(400).json({ success: false, message: "Invalid input. WhatsApp number and OTP must be valid numbers." });
    }

    const storedOTP = otpMap.get(whatsappNumber);
    console.log('Stored OTP:', storedOTP);
    console.log('Received OTP:', otp);

    if (!storedOTP || otp !== storedOTP) {
      console.log('Invalid OTP. Returning error.');
      return res.status(400).json({ success: false, message: strings.InvalidOTP });
    }

    // Query to check if the user already exists in the table or not
    const checkUserQuery = `
      SELECT uuid, auth_token FROM userlogin
      WHERE Mobile_Number = ?;
    `;

    dbConnection.query(checkUserQuery, [whatsappNumber], async (error, results) => {
      if (error) {
        console.error('Error checking user existence:', error);
        return res.status(500).json({ success: false, error: error.message });
      }

      let auth_token;
      let uuid;

      if (results.length > 0) {
        uuid = results[0].uuid;
      } else {
        uuid = await uuidv4();
      }

      try {
        auth_token = await enc.generateAuthToken(uuid, whatsappNumber);
      } catch (error) {
        console.error('Error generating hashed token:', error.message);
        return res.status(500).json({ success: false, error: 'Error generating hashed token' });
      }

      const operation = results.length > 0 ? 'updated' : 'inserted';

      const query = results.length > 0 ? `
        UPDATE userlogin
        SET Date = NOW(), Auth_token = ?, Otp = ?
        WHERE Mobile_Number = ?;
      ` : `
        INSERT INTO userlogin (uuid, Mobile_Number, Date, Auth_token, Otp)
        VALUES (?, ?, NOW(), ?, ?);
      `;

      const values = results.length > 0 ? [auth_token, otp, whatsappNumber] : [uuid, whatsappNumber, auth_token, otp];

      dbConnection.query(query, values, (queryError, queryResults) => {
        if (queryError) {
          console.error(`Error ${operation} record:`, queryError);
          return res.status(500).json({ success: false, error: queryError.message });
        }

        console.log(`Record ${operation} successfully:`, queryResults);
        otpMap.delete(whatsappNumber); // Clear OTP from the temporary map
        const message = `Login successful (${operation === 'data updated' ? 'new user' : 'existing user'})`;
        res.json({ success: true, message, uuid, authToken: auth_token });
      });
    });
  } catch (error) {
    console.error('Error in /login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function packageDetails(req, res) {
  try {
    const authToken = req.headers.authorization.replace('Bearer ', '');
    const decrypted = await enc.decryptAuthToken(authToken);
    let uuid = decrypted.uuid;
    console.log(uuid);
    const { Weight, width, height } = req.body;

    const amount = Weight * 10;
    const insertQuery = `
      INSERT INTO package_details (uuid, Weight, height, width, amount)
      VALUES (?, ?, ?, ?, ?)
    `;

    const values = [uuid, Weight, height, width, amount];

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
    const decrypted = await enc.decryptAuthToken(authToken);
    let uuid = decrypted.uuid;
    console.log(uuid);

    const { name, mobileNumber, address, city, pincode, locality } = req.body;

    // Constructing the from_address string
    const fromAddress = `${name}, ${mobileNumber}, ${address}, ${city}, ${pincode}, ${locality}`;

    // Check if UUID exists in the database
    const selectQuery = `
      SELECT * FROM package_details WHERE uuid = ?
    `;
    dbConnection.query(selectQuery, [uuid], (selectError, selectResults) => {
      if (selectError) {
        console.error('Error querying record:', selectError);
        return res.status(500).json({ success: false, error: selectError.message });
      }

      if (selectResults.length > 0) {
        // UUID exists, update the from_address column
        const updateQuery = `
          UPDATE package_details SET from_address = ? WHERE uuid = ?
        `;
        dbConnection.query(updateQuery, [fromAddress, uuid], (updateError, updateResults) => {
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
          INSERT INTO package_details (uuid, from_address) VALUES (?, ?)
        `;
        dbConnection.query(insertQuery, [uuid, fromAddress], (insertError, insertResults) => {
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
    const decrypted = await enc.decryptAuthToken(authToken);
    let uuid = decrypted.uuid;
    console.log(uuid);

    const { name, mobileNumber, address, city, pincode, locality } = req.body;

    // Constructing the to_address string
    const toAddress = `${name}, ${mobileNumber}, ${address}, ${city}, ${pincode}, ${locality}`;

    // Check if UUID exists in the database
    const selectQuery = `
      SELECT * FROM package_details WHERE uuid = ?
    `;
    dbConnection.query(selectQuery, [uuid], (selectError, selectResults) => {
      if (selectError) {
        console.error('Error querying record:', selectError);
        return res.status(500).json({ success: false, error: selectError.message });
      }

      if (selectResults.length > 0) {
        // UUID exists, update the to_address column
        const updateQuery = `
          UPDATE package_details SET to_address = ? WHERE uuid = ?
        `;
        dbConnection.query(updateQuery, [toAddress, uuid], (updateError, updateResults) => {
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
          INSERT INTO package_details (uuid, to_address) VALUES (?, ?)
        `;
        dbConnection.query(insertQuery, [uuid, toAddress], (insertError, insertResults) => {
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

async function orders (req, res) {
  var OrderID;
  var instance = new Razorpay({
      key_id: 'rzp_test_hcBEyLK2rKpWkS',
      key_secret: 'AilD2hmREnc2HEDIuIBYzu6O'
  })
  var options = {
      amount: req.body.amount,
      receipt: req.body.receipt,
      currency: "INR",
      payment_capture: '0'
  }
  instance.orders.create(options, function (err, order) {
      res.send(order)
  })

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

