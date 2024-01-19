const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const config = require('../../config.json');
const { generateOTP } = require('../../services'); // Make sure generateOTP is correctly implemented

const app = express();
const port = config.PORT;

// Parse JSON bodies
app.use(bodyParser.json());

// Replace with your Wati access token
const accessToken = config.ACCESS_TOKEN;

// Endpoint to generate OTP and send WhatsApp message
app.post('/sendmessage', async (req, res) => {
    try {
      const { whatsappNumber } = req.body;
      
  
      if (!whatsappNumber) {
        return res.status(400).json({ success: false, error: "WhatsApp number is required in the request body." });
      }
  
      const otp = generateOTP();
      const apiUrl = `https://app-server.wati.io/api/v1/sendSessionMessage/${whatsappNumber}`;
      console.log(whatsappNumber)
  
      const response = await axios.post(
        apiUrl,
        { messageText: `Your OTP for zipdrop is ${otp}` },
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
