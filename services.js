const strings = require('./strings.json');
const otpGenerator = require('otp-generator'); // Add this line to import otpGenerator
const twilio = require('twilio');

const accountSid = 'AC93d609a590c51b8f09792fdb13e57288';
const authToken = '307915201686054446a8b06b959c668c';
const twilioPhoneNumber = 'whatsapp:+916382331949';

const client = new twilio(accountSid, authToken);

const sendMessage = async (req, res) => {
  try {
    client.messages.create({
      body: req.body.message,
      from: twilioPhoneNumber,
      to: 'whatsapp' + req.body.to

    })
      .then(message => console.log('message sent'));
    return res.status(200).json({ success: true, message: "mesage sent" });
  }
  catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

// Function to send OTP via SMS using Twilio
function sendOTPViaSMS(to, generatedOTP, res) {
  client.messages
    .create({
      body: `Your OTP is: ${generatedOTP}`,
      from: twilioPhoneNumber,
      to: to,
    })
    .then(() => {
      console.log(`OTP sent successfully to ${to}`);
      // Assuming you have access to `res` in this scope
      res.status(200).json({ success: true, message: strings.OtpSent });
    })
    .catch((error) => {
      console.error('Error sending OTP:', error.message);
      res.status(500).json({ message: strings.O });
    });
}

// Function to generate OTP
function generateOTP() {
  const min = 100000; // Minimum 6-digit number
  const max = 999999; // Maximum 6-digit number
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  return otp.toString(); // Convert to string if needed
}




// Function to validate OTP
function validateOTP(userEnteredOTP, generatedOTP, mobileNumber, res) {
  // Validate the entered OTP
  const isValidOTP = otpGenerator.validate(userEnteredOTP, generatedOTP);

  if (isValidOTP) {
    res.status(200).json({ success: true, message: strings });
  } else {
    console.log(`Invalid OTP for user ${mobileNumber}`);
    res.status(401).json({ error: 'Invalid OTP' });
  }
  return isValidOTP;
}


module.exports = {
  generateOTP,
  sendOTPViaSMS,
  validateOTP,
  sendMessage
}