const express = require('express');
const dotenv = require('dotenv');
const app = express();
const routing = require('./module/app-routing');

// Load environment variables
dotenv.config();

// Middleware to parse JSON
app.use(express.json());

// Database Connection
const db = require('./config/database');

// Routes
routing.v1(app);

// Server
const port = process.env.PORT || 3001;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});