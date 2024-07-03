'use strict';

// dependencies
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Chance = require('chance');
const chance = new Chance();
const words = require('./words.json');
require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');
const multer = require('multer');

// env variables
const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;

// middleware and handlers imports
const logger = require('./middleware/logger.js');
const timestamp = require('./middleware/timestamp.js');
const handleNotFound = require('./handlers/404.js');
const handleError = require('./handlers/500.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// GAMES
const games = {};

// SOCKET INTERACTIONS
io.on('connection', (socket) => {
  console.log(`User ${socket.id} connected`);

  socket.on('disconnect', () => {
    console.log(`User ${socket.id} disconnected`);
  });

  socket.on('create', () => {
    const gameId = chance.guid();
    games[gameId] = {
      players: [socket.id],
      drawer: null,
      drawerIndex: -1,
      word: null,
      finished: [],
      scores: {},
      canvas: null,
    };
    games[gameId].scores[socket.id] = 0;
    socket.join(gameId);
    socket.emit('game-created', gameId);
    console.log(`Game created with ID: ${gameId}`);
  });

  socket.on('join', (gameId) => {
    if (games[gameId]) {
      if (!games[gameId].players.includes(socket.id)) {
        games[gameId].players.push(socket.id);
        games[gameId].scores[socket.id] = 0;
        socket.join(gameId);
        io.to(gameId).emit('player-list', { list: games[gameId].players, newPlayer: socket.id });
        console.log(`User ${socket.id} joined game: ${gameId}`);
      } else {
        socket.emit('error', 'Player has already joined this game');
      }
    } else {
      socket.emit('error', 'Invalid game ID');
    }
  });

  socket.on('start-game', (gameId) => {
    if (games[gameId]) {
      if (games[gameId].players[0] === socket.id) {
        startRound(gameId);
        io.to(gameId).emit('game-started');
        console.log(`Game ${gameId} started by host ${socket.id}`);
      } else {
        socket.emit('error', 'Only the host can start the game');
      }
    } else {
      socket.emit('error', 'Invalid game ID');
    }
  });

  socket.on('canvas-update', (payload) => {
    if (games[payload.ID]) {
      if (games[payload.ID].drawer === socket.id) {
        games[payload.ID].canvas = payload.canvas;
        io.to(payload.ID).emit('canvas-update', payload.canvas);
        console.log(`Canvas updated for game ${payload.ID}`);
      } else {
        socket.emit('error', 'Only the drawer can update the canvas');
      }
    } else {
      socket.emit('error', 'Invalid game ID');
    }
  });

  socket.on('make-guess', (payload) => {
    if (games[payload.ID]) {
      if (games[payload.ID].drawer !== socket.id) {
        if (!games[payload.ID].finished.includes(socket.id)) {
          const game = games[payload.ID];
          const newGuess = payload.guess.replace(/[^a-zA-Z]/g, '').toLowerCase();

          if (newGuess === game.word) {
            game.scores[socket.id] += 2;
            game.scores[game.drawer] += 1;
            game.finished.push(socket.id);
            io.to(payload.ID).emit('correct-guess', socket.id);
            console.log(`Correct guess by ${socket.id} in game ${payload.ID}`);
          } else {
            io.to(payload.ID).emit('incorrect-guess', { player: socket.id, guess: newGuess });
            console.log(`Incorrect guess by ${socket.id} in game ${payload.ID}
            (Guessed "${newGuess}" instead of "${games[payload.ID].word}")`);
          }
        } else {
          socket.emit('error', 'User has already guessed correctly');
        }
      } else {
        socket.emit('error', 'The drawer cannot guess');
      }
    } else {
      socket.emit('error', 'Invalid game ID');
    }
  });

  function randomWord() {
    return words[Math.floor(Math.random() * 50)];
  }

  function startRound(gameId) {
    const game = games[gameId];

    if (game.drawerIndex === game.players.length - 1) {
      endGame(gameId);
      return;
    }

    game.word = randomWord().replace(/[^a-zA-Z]/g, '').toLowerCase();
    console.log(`New word for game ${gameId}: ${game.word}`);

    game.drawerIndex++;
    game.drawer = game.players[game.drawerIndex];
    game.finished = [];

    io.to(gameId).emit('new-round', game.drawer);
    io.to(game.drawer).emit('draw', game.word);

    setTimeout(() => {
      startRound(gameId);
    }, 30000); // 30 seconds
  }

  function endGame(gameId) {
    const game = games[gameId];

    const winner = Object.keys(game.scores).reduce((a, b) => game.scores[a] > game.scores[b] ? a : b);
    io.to(gameId).emit('game-ended', winner);
    console.log(`Game ${gameId} ended. Winner: ${winner}`);

    // Emit an event to prompt the frontend to send the PNG
    io.to(gameId).emit('send-canvas', gameId);

    delete games[gameId];
  }

  async function sendImageToAI(imagePath) {
    const imageData = fs.readFileSync(imagePath);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: imageData
    });

    if (response.ok) {
      const result = await response.json();
      console.log('AI Response:', result);
      // Do something with the AI response if needed
    } else {
      console.log('Failed to send image to AI API:', response.statusText);
    }
  }

  // Endpoint to handle file upload
  app.post('/upload', upload.single('file'), async (req, res) => {
    console.log(`NEW REQUEST
    METHOD: ${req.method}
    PATH: ${req.path}
    TIME: ${new Date().toString()}
    QUERY: ${JSON.stringify(req.query)}`);

    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const filePath = req.file.path;
      console.log(`File uploaded: ${filePath}`);
      await sendImageToAI(filePath);
      res.status(200).json({ message: 'File uploaded and processed successfully' });
    } catch (error) {
      console.error('Error processing file:', error);
      res.status(500).json({ error: 'Failed to process file' });
    }
  });
});

// API CALL
app.use(cors());
app.use(express.json());

// routes
app.get('/', proofOfLife);

// middleware implementation
app.use(timestamp);
app.use(logger);

// handlers implementation
app.use('*', handleNotFound);
app.use(handleError);

// returns 'Hello World' when the default route is visited as a proof of life
function proofOfLife(req, res) {
  res.status(200).send('Hello World');
}

// DATABASE
// database connection
// const dbURI = process.env.MONGODB_URI || 'your-default-mongodb-uri';
// mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('MongoDB connected'))
//   .catch((err) => console.log('MongoDB connection error:', err));

// EXPORT
function start(port, domain) {
  server.listen(port, () => {
    if (domain) {
      console.log(`Server is running at ${domain}:${port}`);
    } else {
      console.log(`Server is running on port ${port}`);
    }
  });
}

module.exports = { app, start };
