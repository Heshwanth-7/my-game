const express = require("express");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  await pool.query(`CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    attempts INTEGER NOT NULL
  )`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS scores_name_unique ON scores (LOWER(name))`);
}

const games = new Map();

app.post("/new-game", (req, res) => {
  const id = crypto.randomUUID();
  games.set(id, { secret: Math.floor(Math.random() * 100) + 1, attempts: 0, won: false });
  res.json({ id });
});

app.post("/guess", (req, res) => {
  const game = games.get(req.body.id);
  if (!game) return res.status(400).json({ result: "Start a new game first." });
  if (game.won) return res.json({ result: "You already won! Save your score.", won: true, attempts: game.attempts });

  const guess = Number(req.body.guess);
  if (!Number.isInteger(guess) || guess < 1 || guess > 100) {
    return res.json({ result: "Enter a whole number from 1 to 100.", invalid: true, attempts: game.attempts });
  }

  game.attempts++;
  if (guess === game.secret) {
    game.won = true;
    return res.json({ result: `Correct in ${game.attempts} tries!`, won: true, attempts: game.attempts });
  }
  res.json({
    result: guess < game.secret ? "Too low!" : "Too high!",
    direction: guess < game.secret ? "low" : "high",
    won: false,
    attempts: game.attempts
  });
});

app.post("/save-score", async (req, res) => {
  try {
    const game = games.get(req.body.id);
    if (!game || !game.won) return res.status(400).json({ error: "You haven't won." });

    const name = String(req.body.name || "").trim().slice(0, 20) || "Anonymous";
    const found = await pool.query("SELECT attempts FROM scores WHERE LOWER(name) = LOWER($1)", [name]);
    let message;

    if (found.rows.length === 0) {
      await pool.query("INSERT INTO scores (name, attempts) VALUES ($1, $2)", [name, game.attempts]);
      message = "Score saved!";
    } else if (game.attempts < found.rows[0].attempts) {
      await pool.query("UPDATE scores SET attempts = $1 WHERE LOWER(name) = LOWER($2)", [game.attempts, name]);
      message = `New personal best! ${found.rows[0].attempts} → ${game.attempts} tries`;
    } else {
      message = `Your best is still ${found.rows[0].attempts} tries. Try to beat it!`;
    }

    games.delete(req.body.id);
    res.json({ ok: true, message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save score." });
  }
});

app.get("/scores", async (req, res) => {
  try {
    const result = await pool.query("SELECT name, attempts FROM scores ORDER BY attempts ASC, id ASC LIMIT 10");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

setup()
  .then(() => app.listen(process.env.PORT || 3000, () => console.log("Game running")))
  .catch((err) => { console.error("Database setup failed:", err.message); process.exit(1); });