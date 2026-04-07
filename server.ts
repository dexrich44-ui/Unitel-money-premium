import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("unitel_money.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    answers TEXT,
    prize_total INTEGER DEFAULT 0,
    comment TEXT,
    likes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/user/start", (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone is required" });
    
    const stmt = db.prepare("INSERT INTO users (phone) VALUES (?)");
    const info = stmt.run(phone);
    res.json({ userId: info.lastInsertRowid });
  });

  app.post("/api/user/update", (req, res) => {
    const { userId, answers, prizeTotal, comment } = req.body;
    
    if (answers) {
      const stmt = db.prepare("UPDATE users SET answers = ? WHERE id = ?");
      stmt.run(JSON.stringify(answers), userId);
    }
    
    if (prizeTotal !== undefined) {
      const stmt = db.prepare("UPDATE users SET prize_total = ? WHERE id = ?");
      stmt.run(prizeTotal, userId);
    }

    if (comment) {
      const stmt = db.prepare("UPDATE users SET comment = ? WHERE id = ?");
      stmt.run(comment, userId);
    }

    res.json({ success: true });
  });

  app.get("/api/comments", (req, res) => {
    const stmt = db.prepare("SELECT id, phone, comment, likes, created_at FROM users WHERE comment IS NOT NULL ORDER BY created_at DESC LIMIT 10");
    const comments = stmt.all();
    res.json(comments);
  });

  app.post("/api/comment/like", (req, res) => {
    const { commentId } = req.body;
    if (!commentId) return res.status(400).json({ error: "Comment ID is required" });
    
    const stmt = db.prepare("UPDATE users SET likes = likes + 1 WHERE id = ?");
    stmt.run(commentId);
    res.json({ success: true });
  });

  app.get("/api/leaderboard", (req, res) => {
    const stmt = db.prepare(`
      SELECT phone, prize_total, likes 
      FROM users 
      WHERE prize_total > 0 OR likes > 0
      ORDER BY prize_total DESC, likes DESC 
      LIMIT 10
    `);
    const leaderboard = stmt.all();
    res.json(leaderboard);
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
