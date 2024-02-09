require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');
const express = require('express')
const strings = require('./strings.json');
const mysql = require('mysql2');
const { v4: uuidv4 } = require('uuid');
const app = express();
const enc = require('./encryptions');

const secret_key = process.env.STRIPE_SECRET_KEY;

const stripe = require('stripe')(secret_key);


app.use(bodyParser.json());
app.use(express.json);
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(cors());

const dbConnection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

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

      try {
        if (results.length > 0) {
          const { uuid, Auth_token } = results[0];
          const decryptedData = enc.decryptAuthToken(Auth_token);

          if (!decryptedData || !decryptedData.exp) {
            throw new Error("Invalid token or token expiration time not found.");
          }

          const { exp } = decryptedData;
          const currentTime = Math.floor(Date.now() / 1000); // Convert milliseconds to seconds

          if (exp <= currentTime) {
            console.log("Token expired. Generating new OTP.");

            const otp = generateOTP();
            resendCooldownMap.set(whatsappNumber, Date.now());
            otpMap.set(whatsappNumber, otp);
            console.log('Stored OTP:', otpMap.get(whatsappNumber));
            return res.json({ success: true, otp });
          } else {
            // Token is valid, generate a new auth token and update it in the database

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


              return res.json({ success: true, msg: "User in section", authToken: newAuthToken });
            });
          }
        } else {
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
          return res.json({ success: true, otp });
        }
      } catch (error) {
        // Handle the case where the token is expired or invalid
        if (error.message === 'Invalid token or token expiration time not found.') {
          const otp = generateOTP();
          resendCooldownMap.set(whatsappNumber, Date.now());
          otpMap.set(whatsappNumber, otp);
          console.log('Stored OTP:', otpMap.get(whatsappNumber));
          return res.json({ success: true, msg: "User not found", otp });
        } else {
          console.error('Error occurred:', error);
          return res.status(500).json({ success: false, error: error.message });
        }
      }

    });
  } catch (error) {
    console.error('Error occurred:', error);
    return res.status(500).json({ success: false, error: error.message });
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
      const { weight, width, height, length } = req.body;
      const parcelDetails = `length:${length},width:${width}, height:${height}, weight:${weight}`
    const insertQuery = `
      INSERT INTO package_details (uuid, parcelDetails)
      VALUES (?, ?)
    `;

    const values = [uuid, parcelDetails];

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

    const { name, phone, street, city, zip, state,country } = req.body;

    // Constructing the from_address string
    const fromAddress = `${name}, ${phone}, ${street}, ${city},${state}, ${zip}, ${country}`;

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
    const decrypted = enc.decryptAuthToken(authToken);
    let uuid = decrypted.uuid;
    console.log(uuid);

    const { name, phone, street, city, state, zip, country } = req.body;

    // Constructing the to_address string
    const toAddress = `${name},${street},${zip}, ${country},${state}, ${city}, ${phone}`;

    // Check if UUID exists in the database
    const selectQuery = `
      SELECT * FROM package_details WHERE uuid = ?
    ;`
    dbConnection.query(selectQuery, [uuid], async (selectError, selectResults) => {
      if (selectError) {
        console.error('Error querying record:', selectError);
        return res.status(500).json({ success: false, error: selectError.message });
      }

      if (selectResults.length > 0) {
        const { parcelDetails, from_address } = selectResults[0];
        console.log(parcelDetails, from_address);

        // Check if parcelDetails is not null
        if (parcelDetails) {
          // Parse the JSON string to extract parcel details
          const { length, width, height, weight } = JSON.parse(parcelDetails);

          // Check if any essential dimension information is missing
          if (length && width && height && weight && from_address) {
            const parcelDetails = { length, width, height, weight };

            const amount = await enc.calculateShippingRate(from_address, toAddress, parcelDetails);

            const updateQuery = `
              UPDATE package_details SET to_address = ?, amount = ? WHERE uuid = ?
            `;

            dbConnection.query(updateQuery, [toAddress, amount, uuid], (updateError, updateResults) => {
              if (updateError) {
                console.error('Error updating record:', updateError);
                return res.status(500).json({ success: false, error: updateError.message });
              }
              console.log('Record updated successfully:', updateResults);
              res.json({ success: true, message: 'Receiver details updated successfully' });
            });
          } else {
            // Handle missing dimension information
            console.error('Missing essential dimension information');
            res.status(400).json({ success: false, error: 'Missing essential dimension information' });
          }
        } else {
          // Handle null parcelDetails
          console.error('Parcel details are null');
          res.status(400).json({ success: false, error: 'Parcel details are null' });
        }
      } else {
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

async function createPayment(req, res) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      currency: "INR",
      amount: req.body.amount,
      automatic_payment_methods: {
        enabled: "true"
      },
      payment_method: 'pm_card_visa',
    })

    res.status(200).send(paymentIntent);

  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }
}
async function product(req, res) {
  try {
    const authToken = req.headers.authorization.replace('Bearer ', '');
    const decrypted = enc.decryptAuthToken(authToken);
    let uuid = decrypted.uuid;

    // Query to retrieve Weight, height, and width from the package_details table
    const dimensionsQuery = `
      SELECT  height, width, amount FROM package_details WHERE uuid = ?;`;

    dbConnection.query(dimensionsQuery, [uuid], async (selectError, result) => {
      if (selectError) {
        console.error('Error querying dimensions:', selectError);
        return res.status(500).json({ success: false, error: selectError.message });
      }

      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Package details not found' });
      }

      const { Weight, height, width, amount } = result[0];
      console.log('Retrieved package details:', Weight, height, width, amount);

      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        console.error('Orders is not an array');
        return res.status(400).json({ success: false, error: 'Orders must be an array' });
      }

      const lineItems = orders.map((order) => ({
        price_data: {
          currency: "INR",
          product_data: {
            name: order.name
          },
          unit_amount: Math.round(order.price * 10), // Assuming order.price is the price in rupees
        },
        quantity: order.quantity
      }));

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: "http://localhost:4000/Home",
        cancel_url: "http://localhost:4000/cancel"
      });

      res.json({ id: session });
    });
  } catch (err) {
    console.error('Error in product function:', err);
    res.status(500).send(err);
  }
}

async function addNewCard(req, res) {
  try {

    const {
      customer_id,
      card_Name,
      card_ExpYear,
      card_ExpMonth,
      card_Number,
      card_CVC,
    } = req.body;

    const card_token = await stripe.tokens.create({
      card: {
        name: card_Name,
        number: card_Number,
        exp_year: card_ExpYear,
        exp_month: card_ExpMonth,
        cvc: card_CVC
      }
    });

    const card = await stripe.customers.createSource(customer_id, {
      source: `${card_token.id}`
    });

    res.status(200).send({ card: card.id });

  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }
}
async function createCharges(req, res) {
  try {

    const createCharge = await stripe.charges.create({
      receipt_email: 'mailto:tester@gmail.com',
      amount: parseInt(req.body.amount) * 100, //amount*100
      currency: 'INR',
      card: req.body.card_id,
      customer: req.body.customer_id
    });
    res.status(200).send(createCharge);
  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }

}

module.exports = {
  otpGeneration,
  userLogin,
  resendOtp,
  packageDetails,
  fromAddress,
  toAddress,
  createPayment,
  addNewCard,
  createCharges,
  product,
}

