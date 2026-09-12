require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const eventRoutes = require("./routes/events");
const assistantRoutes = require("./routes/assistant");
const { createChatService } = require("./services/chatService");

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  express.json({
    limit: "100kb",
  })
);

const sessionMiddleware = session({
  name: "tableforall.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,

  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions",
  }),

  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});

app.use(sessionMiddleware);

app.use("/api/auth", authRoutes);
app.use("/api/events", assistantRoutes);
app.use("/api/events", eventRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    server: "running",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "not connected",
  });
});

// Unknown API routes should return JSON instead of an HTML page.
app.use("/api", (req, res) => {
  res.status(404).json({
    message: "That API route does not exist.",
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Request error:", error.name);
  res.status(500).json({ message: "The request could not be completed." });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 20 * 1024,
});

// Socket.IO and Express resolve the same signed, Mongo-backed session.
io.engine.use(sessionMiddleware);
createChatService(io);

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing from .env");
    process.exit(1);
  }

  if (!process.env.SESSION_SECRET) {
    console.error("SESSION_SECRET is missing from .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("Connected to MongoDB");

    httpServer.listen(PORT, () => {
      console.log(`TableForAll is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Could not start TableForAll:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, httpServer, io, sessionMiddleware, startServer };
