'use strict';

// dependencies
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// middleware and handlers imports
const logger = require('./middleware/logger.js');
const timestamp = require('./middleware/timestamp.js');
const handleNotFound = require('./handlers/404.js');
const handleError = require('./handlers/500.js');

const app = express();

app.use(cors());

// middlerware implementation
app.use(timestamp);
app.use(logger);

// routes
app.get('/', proofOfLife);

// handlers implementation
app.use('*', handleNotFound);
app.use(handleError);

// ROUTE FUNCTIONS

// returns 'Hello World' when the default route is visited as a proof of life
function proofOfLife(req, res) {
  res.status(200).send('Hello World');
}

function start(port, domain) {
  app.listen(port, () => {
    if (domain) {
      console.log(`Server is running at ${domain}:${port}`);
    } else {
      console.log(`Server is running on port ${port}`);
    }
  });
}

module.exports = {app, start};