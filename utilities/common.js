const httpStatus = require('http-status-codes');
const md5 = require('md5');

class Utility {
    generateOtp() {
        // generate otp of 4 digit 
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    // response formate
    response(res, message, status_code = httpStatus.OK) {
        res.status(status_code);
        res.send(message);
    }

    generateToken(length = 40) {
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@123456789";
        let text = "";

        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }

        return text;
    }

    // hash password
    hashPassword(password) {
        return md5(password);
    }
}

module.exports = new Utility();