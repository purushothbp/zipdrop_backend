const strings = require('./strings.json');


// Function to generate OTP
function generateOTP() {
  const min = 100000; 
  const max = 999999; 
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  return otp.toString(); // Convert to string if needed
}

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
  validateOTP
}