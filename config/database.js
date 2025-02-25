const mysql2 = require('mysql2');
require('dotenv').config();

const connection = mysql2.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

connection.connect(error => {
    if (error) {
        console.error('Database connection failed: ' + error.stack);
        return;
    }
    console.log('Connected to database.');
});

module.exports = connection;