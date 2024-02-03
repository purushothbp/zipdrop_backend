
const crypto = require('crypto');


function generateAuthToken(uuid, whatsappNumber) {
    const secret = 'zipdrop'; 
    const data = uuid + '|' + whatsappNumber;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(data);
    return hmac.digest('hex');
  }
function verifyAuthToken(authToken) {
    const secret = 'zipdrop';
    const decipher = crypto.createDecipheriv('aes256', secret);
    let decrypted = decipher.update(authToken, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const [uuid, whatsappNumber, timestamp] = decrypted.split('|');
    const expirationTime = 30 * 60 * 1000; // 30 minutes in milliseconds
    const currentTime = Date.now();
    if (currentTime - parseInt(timestamp) > expirationTime) {
        return { valid: false, message: 'Token has expired' };
    }
    return { valid: true, uuid, whatsappNumber };
}

function decryptAuthToken(authToken) {
    const secret = 'zipdrop';
    const decipher = crypto.createDecipheriv('aes256', secret);
    let decrypted = decipher.update(authToken, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const [uuid, whatsappNumber] = decrypted.split('|');
    return { uuid, whatsappNumber };
}

  module.exports = {
    generateAuthToken,
    verifyAuthToken,
    decryptAuthToken
  }