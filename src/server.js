const express = require('express');
const cors = require('cors');
const loginRoute = require("../routes/login");
const resend_otp = require("../routes/resendOtp");
const sendOtp = require("../routes/sendotpRoute");
const package_details = require("../routes/package_details");
const from_address = require("../routes/fromAddress");
const to_address = require("../routes/toAddress");
const orders = require("../routes/razorpay");
require('dotenv').config();


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use('/', sendOtp);
app.use('/', resend_otp);
app.use('/', loginRoute);
app.use('/', package_details);
app.use('/', from_address);
app.use('/', to_address);

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});