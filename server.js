'use strict';

// dependencies
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

// middleware and handlers imports
const logger = require('./middleware/logger.js');
const timestamp = require('./middleware/timestamp.js');
const handleNotFound = require('./handlers/404.js');
const handleError = require('./handlers/500.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// SOCKET INTERACTIONS

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

  // Add your custom events here
  socket.on('custom-event', (data) => {
    console.log('Custom event received:', data);
    // Handle the event
  });
});

// API CALL

app.use(cors());
app.use(express.json());

// middlerware implementation
app.use(timestamp);
app.use(logger);

// handlers implementation
app.use('*', handleNotFound);
app.use(handleError);

// routes
app.get('/', proofOfLife);

// returns 'Hello World' when the default route is visited as a proof of life
function proofOfLife(req, res) {
  res.status(200).send('Hello World');
}

// DATABASE

// database connection
const dbURI = process.env.MONGODB_URI || 'your-default-mongodb-uri';
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

// EXPORT

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