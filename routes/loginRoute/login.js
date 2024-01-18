// Import necessary modules
const express = require('express');
const bodyParser = require('body-parser');
const services = require('../../services')
// const { sendOTPViaSMS, generateOTP, validateOTP } = require('../../services');

const app = express();
const port = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));


app.post('/getmessage', services.sendMessage);

// Endpoint to get OTP
app.post('/getotp', (req, res) => {
  const  mobileNumber  = req.body;

  if (!mobileNumber) {
    return res.status(400).json({ error: 'Mobile number is required' });
  }

  const generatedOTP = generateOTP();

  sendOTPViaSMS(+916382331949, generatedOTP, res) // replace '6382331949' with the actual mobile number
    .then(() => {
      res.status(200).json({ success: true, message: 'OTP sent successfully' });
    })
    .catch((error) => {
      res.status(500).json({ error: 'Error sending OTP' });
    });
  
  validateOTP('userEnteredOTP', generatedOTP,mobileNumber,  res); 
});

// Endpoint to validate OTP during login
app.post('/login', (req, res) => {
  const { mobileNumber, userEnteredOTP } = req.body;

  if (!mobileNumber || !userEnteredOTP) {
    return res.status(400).json({ error: 'Mobile number and OTP are required' });
  }

  // Validate the entered OTP
  const isValidOTP = validateOTP(userEnteredOTP, /* Fetch the stored OTP from your database */);

  if (isValidOTP) {
    console.log(`User ${mobileNumber} successfully logged in`);
    res.status(200).json({ success: true, message: 'Login successful' });
  } else {
    console.log(`Invalid OTP for user ${mobileNumber}`);
    res.status(401).json({ error: 'Invalid OTP' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
