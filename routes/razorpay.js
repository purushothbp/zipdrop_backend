// const express = require('express');
// const services = require("../services");
// const config = require("../config.json");
// const cors = require('cors');
// const Razorpay = require('razorpay');


// const router = express.Router();
// const PORT  = config.PORT;
// const app = express();
// app.use(express.json);
// app.use(express.urlencoded({extended: false}));
// app.use(cors());


// app.post("/orders", async (req, res) => {
//     try {
//       const razorpay = new Razorpay({
//         key_id: config.RAZORPAY_KEY_ID,
//         key_secret: config.RAZORPAY_SECRET_KEY,
//       });
//       console.log(RAZORPAY_KEY_ID, RAZORPAY_SECRET_KEY);
  
//       const options = req.body;
//       const order = await razorpay.orders.create(options);
  
//       if (!order) {
//         return res.status(500).send("Error");
//       }
  
//       res.json(order);
//     } catch (err) {
//       console.log(err);
//       res.status(500).send("Error");
//     }
//   });

// app.listen(PORT, () => {
//     console.log(`Server is running on http://localhost:${PORT}`);
//   });