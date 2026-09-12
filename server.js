require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const eventRoutes = require("./routes/events");

const app = express();
const PORT = process.env.PORT || 3000;

// Allow the server to receive JSON.
app.use(express.json());

// Activate the event API routes.
app.use("/api/events", eventRoutes);

// Serve files from the public folder.
app.use(express.static(path.join(__dirname, "public")));

// Check whether the server and database are working.
app.get("/api/health", (req, res) => {
  res.json({
    server: "running",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "not connected",
  });
});

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing from .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`TableForAll is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  }
}

startServer();