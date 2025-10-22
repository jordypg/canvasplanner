const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory store for cursor positions
const cursors = new Map();

// Cleanup stale cursors (older than 10 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, cursor] of cursors.entries()) {
    if (now - cursor.timestamp > 10000) {
      cursors.delete(sessionId);
    }
  }
}, 5000);

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: '/canvasplanner/socket.io/',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send current cursors to newly connected client
    socket.emit('cursors:init', Array.from(cursors.values()));

    // Handle cursor updates
    socket.on('cursor:update', (data) => {
      console.log('Received cursor update:', data);
      const cursorData = {
        ...data,
        timestamp: Date.now(),
      };

      cursors.set(data.sessionId, cursorData);
      console.log('Current cursors count:', cursors.size);

      // Broadcast to all other clients
      socket.broadcast.emit('cursor:update', cursorData);
      console.log('Broadcasted cursor update');
    });

    // Handle cursor removal
    socket.on('cursor:remove', (data) => {
      cursors.delete(data.sessionId);
      socket.broadcast.emit('cursor:remove', data);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
