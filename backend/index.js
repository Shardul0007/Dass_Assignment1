const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

mongoose.connect(process.env.MONGO_URL);
const db = mongoose.connection;
db.on("error", (error) => console.log(error));
db.once("open", () => console.log("database connected"));

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT;

// Increase JSON body limit for base64 images
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const cors = require("cors");

const parseCorsOrigins = (v) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const explicitAllowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...parseCorsOrigins(process.env.CORS_ORIGINS),
]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // non-browser clients
  if (explicitAllowedOrigins.has(origin)) return true;

  // Allow Render hosted frontends (subdomains)
  try {
    const u = new URL(origin);
    if (u.protocol === "https:" && u.hostname.endsWith(".onrender.com")) {
      return true;
    }
  } catch {
    // ignore invalid origin
  }
  return false;
};

app.use(
  cors({
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
  }),
);

// Socket.IO for real-time chat
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Deployment/debug helper to confirm the running version on Render
app.get("/api/version", (req, res) => {
  res.status(200).json({
    commit:
      process.env.RENDER_GIT_COMMIT ||
      process.env.GIT_COMMIT ||
      process.env.COMMIT_SHA ||
      null,
    service: process.env.RENDER_SERVICE_NAME || null,
    time: new Date().toISOString(),
    corsOrigins: Array.from(explicitAllowedOrigins),
  });
});

// Store io instance for use in routes
app.set("io", io);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join event room for real-time discussion
  socket.on("join-event", (eventId) => {
    socket.join(`event-${eventId}`);
    console.log(`Socket ${socket.id} joined event-${eventId}`);
  });

  // Leave event room
  socket.on("leave-event", (eventId) => {
    socket.leave(`event-${eventId}`);
    console.log(`Socket ${socket.id} left event-${eventId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const userRouter = require("./src/routes/user");
const adminRouter = require("./src/routes/admin");
const organizerRouter = require("./src/routes/organizer");
const participantRouter = require("./src/routes/participant");
const eventRouter = require("./src/routes/events");

app.use("/api/users", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/organizer", organizerRouter);
app.use("/api/participant", participantRouter);
app.use("/api/events", eventRouter);

server.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
