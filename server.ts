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
  socketId: string;
  roomId: string;
};

type ChatUser = {
  id: string;
  name: string;
};

type ChatMessage =
  | string
  | {
      type: "flashcard";
      question: string;
      answer: string;
    }
  | {
      type: "flashcards";
      cards: Array<{
        question: string;
        answer: string;
      }>;
    };

type SharedResource = {
  type: "image" | "pdf" | "link";
  url?: string;
  file?: string;
  name?: string;
  user?: ChatUser;
  timestamp?: Date;
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
];

const allowedOrigins = [
  ...DEFAULT_ALLOWED_ORIGINS,
  process.env.FRONTEND_URL,
  process.env.VERCEL_FRONTEND_URL,
].filter((origin): origin is string => Boolean(origin));

const users: RoomUser[] = [];

function addUser(socketId: string, user: ChatUser, roomId: string) {
  const existingIndex = users.findIndex((roomUser) => roomUser.socketId === socketId);
  if (existingIndex !== -1) {
    users.splice(existingIndex, 1);
  }

  const newUser = {
    socketId,
    id: user.id,
    name: user.name,
    roomId,
  };
  users.push(newUser);
  return newUser;
}

function removeUser(socketId: string) {
  const index = users.findIndex((roomUser) => roomUser.socketId === socketId);
  if (index !== -1) {
    return users.splice(index, 1)[0];
  }

  return undefined;
}

function getUsersInRoom(roomId: string) {
  return users.filter((roomUser) => roomUser.roomId === roomId);
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        const isAllowedOrigin =
          allowedOrigins.includes(origin) ||
          /^https:\/\/.*\.vercel\.app$/.test(origin);

        if (isAllowedOrigin) {
          callback(null, true);
          return;
        }

        callback(new Error(`Socket.IO CORS blocked origin: ${origin}`));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  const PORT = process.env.PORT || 3000;

  // Socket.IO Logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, user }: { roomId?: string; user?: ChatUser }) => {
      if (!roomId || !user?.id) {
        return;
      }

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.user = addUser(socket.id, user, roomId);

      console.log("Joining room:", roomId, user);
      console.log("Users in room:", getUsersInRoom(roomId));

      io.to(roomId).emit("user-joined", {
        socketId: socket.id,
        roomId,
        user,
      });
      io.to(roomId).emit("room-users", getUsersInRoom(roomId));

      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on("send-message", ({ roomId, message, user }: { roomId?: string; message?: ChatMessage; user?: ChatUser }) => {
      if (!roomId || !message || !user?.id) {
        return;
      }

      const msg = {
        roomId,
        text: message,
        userId: user.id,
        userName: user.name,
        type:
          typeof message === "object" && message.type === "flashcards"
            ? "flashcards"
            : typeof message === "object" && message.type === "flashcard"
              ? "flashcard"
              : "text",
        timestamp: new Date(),
      };

      io.to(roomId).emit("receiveMessage", msg);
    });

    socket.on("send-resource", ({ roomId, resource }: { roomId?: string; resource?: SharedResource }) => {
      if (!roomId || !resource?.type || (!resource.url && !resource.file)) {
        return;
      }

      io.to(roomId).emit("newResource", {
        ...resource,
        timestamp: new Date(),
      });
    });

    socket.on("leave-room", ({ roomId }: { roomId?: string } = {}) => {
      const targetRoomId = roomId || (socket.data.roomId as string | undefined);
      const removedUser = removeUser(socket.id);

      if (removedUser) {
        socket.leave(removedUser.roomId);
      }

      if (targetRoomId) {
        io.to(targetRoomId).emit("room-users", getUsersInRoom(targetRoomId));
      }
    });

    socket.on("disconnect", () => {
      const disconnectedUser = removeUser(socket.id);

      if (disconnectedUser) {
        io.to(disconnectedUser.roomId).emit("room-users", getUsersInRoom(disconnectedUser.roomId));
      }

      console.log("User disconnected:", socket.id);
    });

    socket.on("whiteboard-draw", (data) => {
      socket.to(data.roomId).emit("whiteboard-update", data.lines);
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

  httpServer.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
