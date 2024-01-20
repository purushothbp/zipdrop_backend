const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const config = require('../../config.json');
const { generateOTP } = require('../../services');
const strings = require('../../strings.json');
const app = express();
const port = config.PORT;

app.use(bodyParser.json());

const accessToken = config.ACCESS_TOKEN;

// Endpoint to generate OTP as WhatsApp message
app.post('/sendmessage', async (req, res) => {
    try {
      const { whatsappNumber } = req.body;
  
      const MAX_DIGITS = 12;

      if (!whatsappNumber) {
        return res.status(400).json({ success: false, message:strings.WhatsappNumberRequired});
      }
      else if (whatsappNumber > whatsappNumber.slice(0, MAX_DIGITS)) {
        return res.status(400).json({ success: false, message: strings.InvalidNumber});
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
