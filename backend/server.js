const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

require('dotenv').config();

const rideRoutes =
  require('./routes/rideRoutes');

const initializeRideSocket =
  require('./socket/rideSocket');

/* =====================================================
   APP
===================================================== */

const app = express();

/* =====================================================
   HTTP SERVER
===================================================== */

const server =
  http.createServer(app);

/* =====================================================
   SOCKET.IO
===================================================== */

const io =
  new Server(server, {
    cors: {
      origin: '*',

      methods: [
        'GET',
        'POST',
        'PATCH',
        'PUT',
        'DELETE',
        'OPTIONS',
      ],
    },

    transports: [
      'websocket',
      'polling',
    ],
  });

/* =====================================================
   INITIALIZE RYDO SOCKET
===================================================== */

initializeRideSocket(io);

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  cors({
    origin: '*',
    methods: [
      'GET',
      'POST',
      'PATCH',
      'PUT',
      'DELETE',
      'OPTIONS',
    ],
  })
);

app.use(
  express.json()
);

/* =====================================================
   REQUEST LOGGER
===================================================== */

app.use(
  (req, res, next) => {
    console.log(
      `RYDO: ${req.method} ${req.originalUrl}`
    );

    next();
  }
);

/* =====================================================
   MONGODB CONNECTION
===================================================== */

mongoose
  .connect(
    process.env.MONGODB_URI
  )
  .then(() => {
    console.log(
      'RYDO: MongoDB connected'
    );
  })
  .catch((error) => {
    console.error(
      'RYDO: MongoDB connection failed'
    );

    console.error(
      error.message
    );
  });

/* =====================================================
   HOME
===================================================== */

app.get(
  '/',
  (req, res) => {
    res.json({
      success: true,

      message:
        'RYDO backend is running',

      status:
        'online',

      socket:
        'enabled',
    });
  }
);

/* =====================================================
   SOCKET STATUS
===================================================== */

app.get(
  '/socket-status',
  (req, res) => {
    res.json({
      success: true,

      message:
        'RYDO Socket.IO server is running',

      connectedClients:
        io.engine.clientsCount,
    });
  }
);

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      success: true,
      message:
        'RYDO backend is running',
    });
  }
);

/* =====================================================
   API ROUTES
===================================================== */

app.use(
  '/api/rides',
  rideRoutes
);

/* =====================================================
   404 HANDLER
===================================================== */

app.use(
  (req, res) => {
    console.log(
      'RYDO: Unknown endpoint:',
      req.method,
      req.originalUrl
    );

    res.status(404).json({
      success: false,

      message:
        `Endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  }
);

/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      'RYDO: Global server error'
    );

    console.error(error);

    res.status(500).json({
      success: false,

      message:
        'Internal server error',
    });
  }
);

/* =====================================================
   SERVER
===================================================== */

const PORT =
  process.env.PORT || 5000;

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      '================================'
    );

    console.log(
      'RYDO BACKEND'
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `API: http://localhost:${PORT}`
    );

    console.log(
      `Socket.IO: http://localhost:${PORT}`
    );

    console.log(
      'Socket.IO status: ENABLED'
    );

    console.log(
      '================================'
    );
  }
);