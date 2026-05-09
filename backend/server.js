const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { graphqlAuth } = require('./middleware/auth');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/document');
const shareRoutes = require('./routes/share');

// Import GraphQL schema
const schema = require('./graphql/schema');

// Import socket handler
const documentSocket = require('./socket/documentSocket');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Declare PORT before use
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/share', shareRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Initialize Apollo Server for GraphQL
// Apollo Server v4+ uses expressMiddleware instead of applyMiddleware
const startApolloServer = async () => {
  const apolloServer = new ApolloServer({
    schema,
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      return error;
    }
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true
    }),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        const token = req.headers.authorization || '';
        try {
          if (token) {
            const authData = await graphqlAuth(token);
            return authData;
          }
          return {};
        } catch (error) {
          return {};
        }
      }
    })
  );

  console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
};

// Initialize WebSocket handlers
documentSocket(io);

// Start Apollo Server, then listen
startApolloServer().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`REST API: http://localhost:${PORT}/api`);
    console.log(`Socket.io running on port ${PORT}`);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});