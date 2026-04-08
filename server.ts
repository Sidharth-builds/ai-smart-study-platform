import express, { Request } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { extractTextFromPDF, calculateWeightedScores } from "./src/lib/mlEngine.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

type RoomUser = {
  id: string;
  name: string;
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });
  const roomUsers = new Map<string, RoomUser[]>();

  const PORT = 3000;

  // Socket.IO Logic
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("joinRoom", ({ roomId, user }) => {
      if (!roomId || !user?.id) {
        return;
      }

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.user = user;

      const users = roomUsers.get(roomId) || [];
      const nextUsers = users.some((existingUser) => existingUser.id === user.id)
        ? users.map((existingUser) => (existingUser.id === user.id ? user : existingUser))
        : [...users, user];

      roomUsers.set(roomId, nextUsers);
      io.to(roomId).emit("roomUsers", nextUsers);

      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on("sendMessage", ({ roomId, message, user }) => {
      if (!roomId || !message || !user?.id) {
        return;
      }

      io.to(roomId).emit("message", {
        roomId,
        text: message,
        userId: user.id,
        userName: user.name,
      });
    });

    socket.on("whiteboard-draw", (data) => {
      socket.to(data.roomId).emit("whiteboard-update", data.lines);
    });

    socket.on("disconnect", () => {
      const disconnectedRoomId = socket.data.roomId as string | undefined;
      const disconnectedUser = socket.data.user as RoomUser | undefined;

      if (disconnectedRoomId && disconnectedUser) {
        const users = roomUsers.get(disconnectedRoomId) || [];
        const nextUsers = users.filter((user) => user.id !== disconnectedUser.id);

        if (nextUsers.length > 0) {
          roomUsers.set(disconnectedRoomId, nextUsers);
        } else {
          roomUsers.delete(disconnectedRoomId);
        }

        io.to(disconnectedRoomId).emit("roomUsers", nextUsers);
      }

      console.log("User disconnected:", socket.id);
    });
  });

  // API Routes
  app.use(express.json());
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "AI Smart Study API is running" });
  });

  // ML Prediction Routes
  app.post("/api/upload-paper", upload.single("file"), async (req: MulterRequest, res) => {
    try {
      let text = "";
      if (req.file) {
        if (req.file.mimetype === "application/pdf") {
          text = await extractTextFromPDF(req.file.buffer);
        } else {
          text = req.file.buffer.toString();
        }
      } else if (req.body.text) {
        text = req.body.text;
      }

      // Split text into questions
      // Improved splitting logic: look for question numbers or significant line breaks
      let questions = text
        .split(/\n(?=\d+[\.\)])|(?<=\n)\d+[\.\)]/)
        .map(q => q.trim())
        .filter(q => q.length > 15); // Minimum length for a question

      // Fallback if splitting failed to find multiple questions
      if (questions.length <= 1 && text.length > 50) {
        questions = text.split(/\n\n+/).map(q => q.trim()).filter(q => q.length > 15);
      }
      
      console.log(`Extracted ${questions.length} questions from paper`);
      
      res.json({ 
        success: true, 
        questions,
        text,
        subject: req.body.subject,
        year: parseInt(req.body.year) || new Date().getFullYear()
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process paper" });
    }
  });

  app.post("/api/analyze-questions", (req, res) => {
    const { papers } = req.body;
    if (!papers || !Array.isArray(papers)) {
      return res.status(400).json({ error: "Invalid papers data" });
    }

    const { topicScores, topicFrequency } = calculateWeightedScores(papers);
    
    // Convert scores to probabilities (simple normalization)
    const maxScore = Math.max(...Object.values(topicScores), 1);
    const predictedTopics = Object.entries(topicScores).map(([name, score]) => ({
      name,
      score,
      frequency: topicFrequency[name],
      probability: Math.min(Math.round((score / maxScore) * 100), 99)
    })).sort((a, b) => b.score - a.score);

    res.json({ success: true, predictedTopics });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
