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

// middleware and handlers imports
const logger = require('./middleware/logger.js');
const timestamp = require('./middleware/timestamp.js');
const handleNotFound = require('./handlers/404.js');
const handleError = require('./handlers/500.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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
    };
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
        io.to(gameId).emit('player-joined', socket.id);
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
      if (games[gameId].host === socket.id) {
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

  socket.on('canvas-update', (gameId, canvas) => {
    if (games[gameId]) {
      if (games[gameId].drawer === socket.id) {
        io.to(gameId).emit('canvas-update', canvas);
      } else {
        socket.emit('error', 'Only the drawer can update the canvas');
      }
    } else {
      socket.emit('error', 'Invalid game ID');
    }
  });

  socket.on('make-guess', (gameId, guess) => {
    if (games[gameId]) {
      if (games[gameId].drawer !== socket.id) {
        if (!games[gameId].finished.includes(socket.id)) {
          const game = games[gameId];
          const newGuess = guess.replace(/[^a-zA-Z]/g, '').toLowerCase();

          if (newGuess === game.word) {
            game.scores[socket.id] += 2;
            game.scores[game.drawer] += 1;
            game.finished.push(socket.id);
            io.to(gameId).emit('correct-guess', { player: socket.id });
            console.log(`Correct guess by ${socket.id} in game ${gameId}`);
          } else {
            io.to(gameId).emit('incorrect-guess', { player: socket.id, newGuess });
            console.log(`Incorrect guess by ${socket.id} in game ${gameId}
            (Guessed "${newGuess}" instead of "${games[gameId].word}")`);
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

    game.drawerIndex++;
    game.drawer = game.players[game.drawerIndex];
    game.finished = [];

    io.to(gameId).emit('new-round', { drawer: game.drawer });
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

    delete games[gameId];
  }
});

// API CALL

app.use(cors());
app.use(express.json());

// routes
app.get('/', proofOfLife);

// middlerware implementation
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

module.exports = {app, start};