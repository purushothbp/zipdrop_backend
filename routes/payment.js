const express = require('express');
const services = require("../services");
const cors = require('cors');


const router = express.Router();

const app = express();
app.use(express.json);
app.use(express.urlencoded({extended: false}));
app.use(cors());

router.post('/create-payment', services.createPayment);
router.post('/add-card', services.addNewCard);
router.post('/product-info',services.product);

router.get('/success', (req,res)=>{
  res.send("payment success going to homepage");
})
router.get('/cancel', (req,res)=>{
  res.send("Payment cancelled, order has not placed ");
})



module.exports = router;