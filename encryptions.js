const jwt = require('jsonwebtoken')
require('dotenv').config();
const EasyPostClient = require('@easypost/api');
const client = new EasyPostClient(process.env.EASYPOST_API_KEY);

function generateAuthToken(uuid, whatsappNumber) {
    const secret = process.env.SECRET_FOR_ENCR_DECR;
    const expirationTime = '10h';
    const token = jwt.sign({ uuid, whatsappNumber }, secret, {expiresIn: expirationTime});
    return expirationTime,token;
}


function decryptAuthToken(token) {
    const secret = 'zipdrop';
    try {
        const decryptedData = jwt.verify(token, secret);
        return decryptedData;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

async function calculateShippingRate(fromAddress, toAddress, parcelDetails) {

    try {
      const shipmentDetails = {
        to_address: toAddress,
        from_address: fromAddress,
        parcel: parcelDetails,
      };

      const rates = await client.BetaRate.retrieveStatelessRates(shipmentDetails);
      console.log(" ====>", rates);

      if (rates && rates.length > 0) { // Check if rates array is not empty
        const calculatedRate = rates[0].rate  || 100;
        return calculatedRate;
      } else {
        return 150;
      }
    } catch (error) {
      console.error(`Error calculating shipping rate (attempt ${retryCount + 1}/${maxRetries}):`, error);
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`Retrying (${retryCount}/${maxRetries})...`);
      } else {
        console.error('Maximum retry attempts reached. Unable to calculate shipping rate.');
        throw new Error('Maximum retry attempts reached. Unable to calculate shipping rate.');
      }
    }
  
}



module.exports = {
    generateAuthToken,
    decryptAuthToken,
    calculateShippingRate
}


// // Example usage
// (async () => {
//     const fromAddress = {
//       street1: '417 Montgomery Street',
//       street2: 'FL 5',
//       city: 'San Francisco',
//       state: 'CA',
//       zip: '94104',
//       country: 'US',
//       company: 'EasyPost',
//       phone: '415-123-4567',
//     };
  
//     const toAddress = {
//       name: 'Dr. Steve Brule',
//       street1: '179 N Harbor Dr',
//       city: 'Redondo Beach',
//       state: 'CA',
//       zip: '90277',
//       country: 'US',
//       email: 'dr_steve_brule@gmail.com',
//       phone: '4155559999',
//     };
  
//     const parcelDetails = {
//       length: 20.2,
//       width: 10.9,
//       height: 5,
//       weight: 65.9,
//     };
  
//     try {
//       const rate = await calculateShippingRate(fromAddress, toAddress, parcelDetails);
//       console.log('Shipping rate:', rate);
//     } catch (error) {
//       console.error('Failed to calculate shipping rate:', error);
//     }
//   })();