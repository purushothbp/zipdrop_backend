const jwt = require('jsonwebtoken')
require('dotenv').config();



function generateAuthToken(uuid, whatsappNumber) {
    const secret = process.env.SECRET_FOR_ENCR_DECR;
    const expirationTime = Math.trunc(new Date().getTime() / 1000) + 60;
    const token = jwt.sign({ uuid, whatsappNumber }, secret, {expiresIn: expirationTime});
    console.log("token: ", token);
    return token;
}


function decryptAuthToken(token) {
    const secret = 'zipdrop';
    try {
        const decryptedData = jwt.verify(token, secret);
        console.log(decryptedData);
        return decryptedData;
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}


module.exports = {
    generateAuthToken,
    decryptAuthToken
}

// generateAuthToken("kagre6ttrby32w","916382331949")

//  decryptAuthToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjoia2FncmU2dHRyYnkzMnd8OTE2MzgyMzMxOTQ5IiwiaWF0IjoxNzA2OTUyODQ4LCJleHAiOjE3MDY5NTQ2NDh9.H05z4Zi85ODBGaWdeyhXr8MuOoemDvg_4x13lBR7DsI");