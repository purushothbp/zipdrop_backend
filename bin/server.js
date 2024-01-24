const express = require('express');
const cors = require('cors');
const config = require('../config.json');
const PORT = config.PORT;
const loginRoute = require("../routes/login");
const resend_otp = require("../routes/resendOtp");
const sendOtp = require("../routes/sendotpRoute");
const package_details = require("../routes/package_details")

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use('/', sendOtp);
app.use('/', resend_otp);
app.use('/', loginRoute);
app.use('/', package_details)

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});