// const express = require('express');
// const services = require("../services");
// const cors = require('cors');
// const Razorpay = require('razorpay');

// const router = express.Router();
// const razorpay = new Razorpay({
//             key_id: 'rzp_test_zW90bvvW3o3Bxn',
//             key_secret: 'wJvWrKVL6GWGxW5iHugtKrXo'
//         })
// const app = express();
// app.use(express.json);
// app.use(express.urlencoded({extended: false}));
// app.use(cors());


// router.post("/orders/checkout",async(req,res)=>{
//     try{
//         const{name, amount}=req.body;

//     const order = await razorpay.orders.create({
//         amount: Number(amount*10),
//         currency: "INR",
        
//     })
//     console.log(order);
//     res.json(order);
//     }catch(err){
//         res.send(err);
//     }
// })

// router.post("/orders/payment-verification",async(req,res)=>{
//     try{
//         const{name, amount}=req.body;

//     const order = await razorpay.orders.create({
//         amount: Number(amount*10),
//         currency: "INR",
        
//     })
//     console.log(order);
//     res.json(order);
//     }catch(err){
//         res.send(err);
//     }
// })
// module.exports = router;