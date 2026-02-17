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
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://dass-frontend.onrender.com",
    ],
    credentials: true,
  }),
);

// Socket.IO for real-time chat
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://dass-frontend.onrender.com",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
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
