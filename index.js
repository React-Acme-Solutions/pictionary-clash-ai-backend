const server = require('./server.js');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || false;

server.start(PORT, DOMAIN);