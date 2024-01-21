const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const config = require('../../config.json');
const { generateOTP } = require('../../services');
const strings = require('../../strings.json');
const app = express();
const port = config.PORT;
const cors = require('cors');

app.use(bodyParser.json());
app.use(cors());


const accessToken = config.ACCESS_TOKEN;

// Endpoint to generate OTP as WhatsApp message
app.post('/sendmessage', async (req, res) => {
  try {
    const { whatsappNumber } = req.body;

    const MAX_DIGITS = 12;
    const RESEND_COOLDOWN = 30000; // 30 seconds in milliseconds
    let resendCooldownMap = new Map(); // Map to 

    if (!whatsappNumber) {
      return res.status(400).json({ success: false, message: strings.WhatsappNumberRequired });
    }
    else if (whatsappNumber > whatsappNumber.slice(0, MAX_DIGITS)) {
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

    res.json({ success: true, otp });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/resend_otp', async (req, res) => {
  try {
    const { whatsappNumber } = req.body;

    const MAX_DIGITS = 12;
    const RESEND_COOLDOWN = 30000; // 30 seconds in milliseconds
    let resendCooldownMap = new Map(); // Map to 

    if (!whatsappNumber) {
      return res.status(400).json({ success: false, message: strings.WhatsappNumberRequired });
    }
    else if (whatsappNumber > whatsappNumber.slice(0, MAX_DIGITS)) {
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

    res.json({ success: true, otp });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});