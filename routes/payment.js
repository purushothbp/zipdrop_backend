const express = require('express');
const services = require("../services");
const cors = require('cors');


const router = express.Router();

const app = express();
app.use(express.json);
app.use(express.urlencoded({extended: false}));
app.use(cors());

router.post('/create-customer', services.createCustomer);
router.post('/add-card', services.addNewCard);
router.post('/create-charges', services.createCharges);
router.get('/success', (req,res)=>{
  res.send("payment success going to homepage");
})
router.get('/cancel', (req,res)=>{
  res.send("Payment cancelled, order has not placed ");
})



module.exports = router;