const API = "http://localhost:8080/api";
const TOKEN_KEY = "aicte_token";
const $ = (id) => document.getElementById(id);

const loginView = $("login-view");
const dashboardView = $("dashboard-view");
const loginForm = $("login-form");
const loginBtn = $("login-btn");
const loginError = $("login-error");
const passwordInput = $("password");
const checkinBtn = $("checkin-btn");
let toastTimer;

function showToast(message, type = "success") {
  const toast = $("toast");
  toast.textContent = message;
  toast.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = "toast"; }, 2800);
}
function showView(loggedIn) {
  loginView.hidden = loggedIn;
  dashboardView.hidden = !loggedIn;
}
function formatTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(API + path, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    showView(false);
    throw new Error(data.message || "Please log in again.");
  }
  if (!res.ok) throw new Error(data.message || "Request failed (" + res.status + ")");
  return data;
}

$("toggle-password").addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  $("toggle-password").textContent = show ? "Hide" : "Show";
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const username = $("username").value.trim();
  const password = passwordInput.value;
  if (!username || !password) {
    loginError.textContent = "Please enter both username and password.";
    loginError.hidden = false;
    return;
  }
  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in…";
  try {
    const data = await api("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem(TOKEN_KEY, data.token);
    loginForm.reset();
    openDashboard();
  } catch (err) {
    loginError.textContent = err.message.includes("Failed to fetch")
      ? "Could not connect. Start the Java backend on port 8080."
      : (err.message || "Login failed.");
    loginError.hidden = false;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Log in";
  }
});

$("logout-btn").addEventListener("click", async () => {
  try { await api("/logout", { method: "POST" }); } catch (_) {}
  localStorage.removeItem(TOKEN_KEY);
  showView(false);
  showToast("Logged out.");
});

function renderStatus(d) {
  $("student-name").textContent = d.student;
  $("points").textContent = d.points;
  $("target").textContent = d.target;
  $("checkin-count").textContent = d.checkins;
  const percent = Math.min(100, Math.round((d.points / d.target) * 100));
  $("bar").style.width = percent + "%";
  $("bar").classList.toggle("done", percent >= 100);
  $("progress").setAttribute("aria-valuenow", String(percent));
  $("goal-message").hidden = percent < 100;
  checkinBtn.disabled = Boolean(d.targetReached);
  checkinBtn.textContent = d.targetReached ? "Target reached" : "Check in";
  const list = $("recent-list");
  list.replaceChildren();
  if (!d.recent || d.recent.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No check-ins yet.";
    list.appendChild(li);
  } else {
    d.recent.forEach((time) => {
      const li = document.createElement("li");
      li.textContent = "✅ " + formatTime(time);
      list.appendChild(li);
    });
  }
}
async function loadStatus() {
  try { renderStatus(await api("/status")); return true; }
  catch (err) {
    if (localStorage.getItem(TOKEN_KEY)) showToast(err.message || "Could not load status.", "error");
    return false;
  }
}
async function openDashboard() {
  showView(true);
  const ok = await loadStatus();
  if (!ok && !localStorage.getItem(TOKEN_KEY)) showView(false);
}
checkinBtn.addEventListener("click", async () => {
  checkinBtn.disabled = true;
  checkinBtn.textContent = "Checking in…";
  try {
    const data = await api("/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    showToast(data.message || "Check-in recorded.");
    await loadStatus();
  } catch (err) {
    showToast(err.message || "Check-in failed. Please try again.", "error");
    await loadStatus();
  } finally {
    if (!checkinBtn.disabled) checkinBtn.textContent = "Check in";
  }
});

if (localStorage.getItem(TOKEN_KEY)) openDashboard();
else showView(false);
