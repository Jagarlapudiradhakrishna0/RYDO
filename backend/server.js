const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

require('dotenv').config();

const rideRoutes = require('./routes/rideRoutes');
const authRoutes = require('./routes/authRoutes');
const initializeRideSocket = require('./socket/rideSocket');

/* =====================================================
   APP
===================================================== */

const app = express();

/* =====================================================
   HTTP SERVER
===================================================== */

const server = http.createServer(app);

/* =====================================================
   SOCKET.IO
===================================================== */

const io = new Server(server, {
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
   REGISTER IO ON APP (accessible in routes)
===================================================== */

app.set('io', io);

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

    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
    ],
  })
);

app.use(express.json());

/* =====================================================
   REQUEST LOGGER & PERFORMANCE MONITOR
===================================================== */

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[PERF HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

/* =====================================================
   MONGODB CONNECTION
===================================================== */

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error(
    'RYDO: MONGODB_URI is not configured in .env'
  );
} else {
  mongoose.connection.on('connected', () => {
    console.log('RYDO: MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error('RYDO: MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('RYDO: MongoDB disconnected. Reconnection will be attempted.');
  });

  mongoose
    .connect(mongoUri, {
      maxPoolSize: 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => {
      console.log(
        'RYDO: MongoDB connected (pool: min 10, max 50)'
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
}

/* =====================================================
   HOME
===================================================== */

app.get('/', (req, res) => {
  res.json({
    success: true,

    message:
      'RYDO backend is running',

    status:
      'online',

    socket:
      'enabled',
  });
});

/* =====================================================
   SOCKET STATUS
===================================================== */

app.get('/socket-status', (req, res) => {
  res.json({
    success: true,

    message:
      'RYDO Socket.IO server is running',

    connectedClients:
      io.engine.clientsCount,
  });
});

/* =====================================================
   API HEALTH
===================================================== */

app.get('/api/health', (req, res) => {
  res.json({
    success: true,

    message:
      'RYDO backend is running',
  });
});

/* =====================================================
   API ROUTES
===================================================== */

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/rides',
  rideRoutes
);

/* =====================================================
   404 HANDLER
===================================================== */

app.use((req, res) => {
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
});

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

    if (res.headersSent) {
      return next(error);
    }

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

console.log(
  '================================'
);
console.log(
  'RYDO: Starting backend...'
);
console.log(
  `RYDO: Port: ${PORT}`
);
console.log(
  '================================'
);

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      '================================================'
    );
    console.error(
      'RYDO ERROR:'
    );
    console.error(
      `Port ${PORT} is already in use.`
    );
    console.error(
      'Another RYDO backend process may already be running.'
    );
    console.error(
      ''
    );
    console.error(
      'To check what process is using port ' + PORT + ', run:'
    );
    console.error(
      `netstat -ano | findstr :${PORT}`
    );
    console.error(
      ''
    );
    console.error(
      'Then identify the process with:'
    );
    console.error(
      'tasklist | findstr <PID>'
    );
    console.error(
      '================================================'
    );
    process.exit(1);
  } else {
    console.error(
      'RYDO: Server error:',
      error
    );
    process.exit(1);
  }
});

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

/* =====================================================
   GRACEFUL SHUTDOWN
===================================================== */

const gracefulShutdown = async (signal) => {
  console.log(`\nRYDO: Received ${signal}. Starting graceful shutdown...`);
  try {
    io.close(() => {
      console.log('RYDO: Socket.IO connections closed.');
    });

    server.close(async () => {
      console.log('RYDO: HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        console.log('RYDO: MongoDB connection closed cleanly.');
        process.exit(0);
      } catch (dbErr) {
        console.error('RYDO: Error closing MongoDB connection:', dbErr);
        process.exit(1);
      }
    });

    // Force shutdown after 10s if hanging
    setTimeout(() => {
      console.error('RYDO: Forced shutdown after 10s timeout.');
      process.exit(1);
    }, 10000).unref();
  } catch (err) {
    console.error('RYDO: Shutdown error:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));