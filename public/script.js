let gameId = null;
let lo = 1, hi = 100;

const $ = (id) => document.getElementById(id);

function setMessage(text, cls = "") {
  const m = $("message");
  m.textContent = text;
  m.className = "message " + cls;
}

function updateRange(attempts) {
  $("tries").textContent = attempts;
  $("range").textContent = `${lo} – ${hi}`;
  $("meterFill").style.width = `${100 - ((hi - lo) / 99) * 100}%`;
}

async function newGame() {
  const res = await fetch("/new-game", { method: "POST" });
  gameId = (await res.json()).id;
  lo = 1; hi = 100;
  updateRange(0);
  $("meterFill").style.width = "0%";
  $("guess").value = "";
  $("guess").disabled = false;
  $("btn").disabled = false;
  $("saveBox").classList.add("hidden");
  setMessage("Make your first guess!");
  $("guess").focus();
}

async function loadScores() {
  const res = await fetch("/scores");
  const scores = await res.json();
  const list = $("scores");
  list.innerHTML = "";
  if (scores.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No scores yet. Be the first!";
    list.appendChild(li);
    return;
  }
  const medals = ["🥇", "🥈", "🥉"];
  scores.forEach((s, i) => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    left.textContent = `${medals[i] || i + 1 + "."} ${s.name}`; // textContent = safe from hacked names
    const right = document.createElement("span");
    right.textContent = `${s.attempts} tries`;
    li.append(left, right);
    list.appendChild(li);
  });
}

function confetti() {
  const colors = ["#ff3cac", "#00d2ff", "#ffd200", "#784ba0", "#7CFC00"];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDuration = 2 + Math.random() * 2.5 + "s";
    c.style.animationDelay = Math.random() * 0.6 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5500);
  }
}

async function makeGuess() {
  const guess = $("guess").value;
  if (guess === "") return;
  const res = await fetch("/guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: gameId, guess })
  });
  const data = await res.json();
  const g = Number(guess);

  if (data.invalid) {
    setMessage(data.result);
    return;
  }

  if (data.direction === "low") { lo = Math.max(lo, g + 1); setMessage("⬆ " + data.result, "low"); }
  else if (data.direction === "high") { hi = Math.min(hi, g - 1); setMessage("⬇ " + data.result, "high"); }

  if (data.won) {
    setMessage("🎉 " + data.result, "win");
    $("saveBox").classList.remove("hidden");
    $("guess").disabled = true;
    $("btn").disabled = true;
    $("name").focus();
    confetti();
  } else {
    const card = document.querySelector(".card");
    card.classList.remove("shake");
    void card.offsetWidth; // restart animation
    card.classList.add("shake");
  }

  updateRange(data.attempts);
  $("guess").value = "";
  if (!data.won) $("guess").focus();
}

async function saveScore() {
  const res = await fetch("/save-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: gameId, name: $("name").value })
  });
  const data = await res.json();
  await loadScores();
  await newGame();
  if (data.message) setMessage(data.message, "win");
}

$("btn").addEventListener("click", makeGuess);
$("guess").addEventListener("keydown", (e) => { if (e.key === "Enter") makeGuess(); });
$("saveBtn").addEventListener("click", saveScore);
$("name").addEventListener("keydown", (e) => { if (e.key === "Enter") saveScore(); });
$("restart").addEventListener("click", newGame);

newGame();
loadScores();