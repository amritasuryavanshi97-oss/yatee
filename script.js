const KEY = "aicte_demo_v1";
const TARGET = 100;
const CHECKIN_POINTS = 10;
// Set your event venue to enforce GPS (e.g. { lat: 19.07, lng: 72.87, radius: 200 }).
// With lat = null, any detected location counts as "inside" (demo mode).
const VENUE = { lat: null, lng: null, radius: 200 };
const COLORS = { NSS: "#2f4fe0", Sports: "#f08a24", Innovation: "#2e8b2e", Technical: "#8b5cf6", Event: "#06b6d4" };

const $ = (id) => document.getElementById(id);
const seed = [
  { id: 1, name: "NSS Camp", category: "NSS", points: 20, status: "Approved" },
  { id: 2, name: "Sports Event", category: "Sports", points: 15, status: "Approved" },
  { id: 3, name: "Innovation Workshop", category: "Innovation", points: 25, status: "Approved" },
  { id: 4, name: "Technical Seminar", category: "Technical", points: 15, status: "Pending" },
];
let acts = JSON.parse(localStorage.getItem(KEY) || "null") || seed;
let check = { gps: false, qr: null, photo: false };
let toastTimer, watchId = null, stream = null, scanning = false;

const save = () => localStorage.setItem(KEY, JSON.stringify(acts));
const approvedPts = () => acts.filter((a) => a.status === "Approved").reduce((s, a) => s + a.points, 0);

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.className = "show";
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ""), 2800);
}
function setBox(id, msg, kind = "") { const b = $(id); b.textContent = msg; b.className = "box " + kind; }

/* ---------- Render ---------- */
function render() {
  const pts = approvedPts(), left = Math.max(0, TARGET - pts);
  $("rpts").textContent = pts;
  $("rfill").style.strokeDashoffset = 326.7 * (1 - Math.min(1, pts / TARGET));
  $("hero-title").textContent = left > 0 ? `You're ${left} points away from your ${TARGET}-point target.` : "Target reached! Great work 🎉";
  $("left").textContent = left;
  $("approved").textContent = acts.filter((a) => a.status === "Approved").length;
  const st = $("status");
  st.className = "pill " + (left === 0 ? "ok" : pts < 40 ? "bad" : "");
  st.textContent = left === 0 ? "Target met" : pts < 40 ? "Behind schedule" : "Nearing deadline";

  $("ledger").innerHTML = acts.map((a) =>
    `<tr><td>${esc(a.name)}</td><td>${esc(a.category)}</td><td>${a.points}</td><td><span class="tag ${a.status}">${a.status}</span></td></tr>`).join("");

  // donut of approved points by category
  const by = {};
  acts.filter((a) => a.status === "Approved").forEach((a) => (by[a.category] = (by[a.category] || 0) + a.points));
  const C = 2 * Math.PI * 70; let off = 0, svg = "";
  Object.entries(by).forEach(([cat, p]) => {
    const len = (p / (pts || 1)) * C;
    svg += `<circle cx="100" cy="100" r="70" fill="none" stroke="${COLORS[cat] || "#888"}" stroke-width="34" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"><title>${esc(cat)}: ${p}</title></circle>`;
    off += len;
  });
  $("donut").innerHTML = svg;
  $("legend").innerHTML = Object.keys(by).map((c) => `<span><i style="background:${COLORS[c] || "#888"}"></i>${esc(c)} (${by[c]})</span>`).join("") || "No approved points yet.";

  // faculty list
  const pend = acts.filter((a) => a.status === "Pending");
  $("pending").innerHTML = pend.length ? pend.map((a) =>
    `<tr><td>Aditi Singh</td><td>${esc(a.name)}</td><td>${esc(a.category)}</td><td>${a.points}</td>
     <td><button class="act" data-id="${a.id}" data-do="Approved">Approve</button><button class="act no" data-id="${a.id}" data-do="Rejected">Reject</button></td></tr>`).join("")
    : `<tr><td colspan="5" class="muted">No pending approvals.</td></tr>`;
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---------- Tabs ---------- */
function tab(student) {
  $("student").hidden = !student; $("faculty").hidden = student;
  $("tab-student").classList.toggle("active", student);
  $("tab-faculty").classList.toggle("active", !student);
}
$("tab-student").onclick = () => tab(true);
$("tab-faculty").onclick = () => tab(false);

$("pending").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-id]"); if (!b) return;
  const a = acts.find((x) => x.id === Number(b.dataset.id));
  if (a) { a.status = b.dataset.do; save(); render(); toast(a.name + " " + a.status.toLowerCase() + "."); }
});

/* ---------- Check-in: GPS ---------- */
function dist(a, b, c, d) {
  const R = 6371000, r = Math.PI / 180, dLa = (c - a) * r, dLo = (d - b) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
$("gps-btn").onclick = () => {
  const btn = $("gps-btn");
  if (!navigator.geolocation) return setBox("gps-msg", "Location is not supported in this browser.", "bad");
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId); watchId = null;
    btn.textContent = "Start GPS tracking"; return setBox("gps-msg", "Location tracking stopped.");
  }
  btn.textContent = "Stop tracking"; setBox("gps-msg", "Finding your location…");
  watchId = navigator.geolocation.watchPosition((p) => {
    const { latitude: la, longitude: lo } = p.coords;
    const d = VENUE.lat == null ? 0 : dist(la, lo, VENUE.lat, VENUE.lng);
    check.gps = d <= VENUE.radius;
    setBox("gps-msg", check.gps ? `✅ Inside venue (${la.toFixed(4)}, ${lo.toFixed(4)})` : `📍 ${Math.round(d)} m from the venue. Move within ${VENUE.radius} m.`, check.gps ? "ok" : "bad");
    updateSubmit();
  }, (err) => setBox("gps-msg", "Could not get location: " + err.message, "bad"), { enableHighAccuracy: true });
};

/* ---------- Check-in: QR ---------- */
function acceptQR(v) {
  if (!v.startsWith("AICTE:") || v.length < 7) { setBox("qr-msg", "That is not a valid event code.", "bad"); return false; }
  check.qr = v.slice(6).trim(); setBox("qr-msg", "✅ Event: " + check.qr, "ok"); updateSubmit(); return true;
}
// Loads a QR library on demand, trying several sources (CDNs first, then a local copy).
const LIBS = {
  jsQR: ["https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js", "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js", "jsQR.js"],
  QRCode: ["https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js", "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js", "qrcode.min.js"],
};
function loadLib(name) {
  return new Promise((resolve) => {
    if (window[name]) return resolve(true);
    let i = 0;
    const next = () => {
      if (i >= LIBS[name].length) return resolve(false);
      const s = document.createElement("script");
      s.src = LIBS[name][i++];
      s.onload = () => (window[name] ? resolve(true) : next());
      s.onerror = () => { s.remove(); next(); };
      document.head.appendChild(s);
    };
    next();
  });
}
async function makeQR(el, text) {
  el.innerHTML = "";
  if (!(await loadLib("QRCode"))) { el.textContent = "Could not load the QR library. Check your internet connection."; return; }
  el.innerHTML = "";
  new QRCode(el, { text, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
}
function stopQR() {
  scanning = false; if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null; $("video").hidden = true; $("qr-btn").textContent = "Start QR scanner";
}
$("qr-btn").onclick = async () => {
  if (scanning) { stopQR(); return setBox("qr-msg", "QR scanner inactive."); }
  const native = "BarcodeDetector" in window;
  if (!native) {
    setBox("qr-msg", "Loading scanner…");
    if (!(await loadLib("jsQR")))
      return setBox("qr-msg", "Could not load the scanner library (network may be blocking it). Type the code below instead.", "bad");
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const v = $("video"); v.srcObject = stream; v.hidden = false; await v.play();
    scanning = true; $("qr-btn").textContent = "Stop scanner"; setBox("qr-msg", "Point the camera at the QR code…");
    const det = native ? new BarcodeDetector({ formats: ["qr_code"] }) : null;
    const cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
    (async function tick() {
      if (!scanning) return;
      try {
        let val = null;
        if (det) { const r = await det.detect(v); if (r.length) val = r[0].rawValue; }
        else if (v.videoWidth) {
          cv.width = v.videoWidth; cv.height = v.videoHeight; cx.drawImage(v, 0, 0);
          const im = cx.getImageData(0, 0, cv.width, cv.height), c = jsQR(im.data, im.width, im.height);
          if (c) val = c.data;
        }
        if (val && acceptQR(val)) return stopQR();
      } catch (_) {}
      requestAnimationFrame(tick);
    })();
  } catch (e) { setBox("qr-msg", "Camera unavailable: " + e.message, "bad"); }
};
$("qr-use").onclick = () => acceptQR($("qr-code").value.trim());
$("qr-demo").onclick = () => {
  const box = $("qr-test");
  box.hidden = !box.hidden;
  $("qr-demo").textContent = box.hidden ? "Show a test QR code" : "Hide test QR code";
  if (!box.hidden) makeQR(box, "AICTE:Tech Talk");
};
$("ev-gen").onclick = () => {
  const name = $("ev-name").value.trim();
  if (!name) return toast("Enter an event name first.");
  makeQR($("ev-qr"), "AICTE:" + name);
  $("ev-text").textContent = "Code: AICTE:" + name;
};

/* ---------- Check-in: photo ---------- */
$("photo").onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const img = $("preview"); img.src = URL.createObjectURL(f); img.hidden = false;
  check.photo = true; setBox("photo-msg", "✅ Photo added.", "ok"); updateSubmit();
};

/* ---------- Submit ---------- */
function updateSubmit() {
  const ok = check.gps && check.qr && check.photo, b = $("submit");
  b.disabled = !ok;
  b.textContent = ok ? `Submit check-in for "${check.qr}"` : "Complete all three check-ins to submit";
}
$("submit").onclick = () => {
  acts.push({ id: Date.now(), name: check.qr + " (check-in)", category: "Event", points: CHECKIN_POINTS, status: "Pending" });
  save(); check = { gps: false, qr: null, photo: false };
  setBox("gps-msg", "Location not started."); setBox("qr-msg", "QR scanner inactive."); setBox("photo-msg", "No photo yet.");
  $("preview").hidden = true; $("photo").value = ""; $("qr-code").value = "";
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; $("gps-btn").textContent = "Start GPS tracking"; }
  updateSubmit(); render(); toast("Submitted. Waiting for faculty approval.");
};

$("transcript").onclick = () => window.print();

render(); updateSubmit();

/* ---------- Login ---------- */
const SESSION_KEY = "aicte_session";
const USERS = {
  aditi: { password: "demo123", name: "Aditi Singh", role: "student" },
  faculty: { password: "demo123", name: "Faculty Mentor", role: "faculty" },
};

function enter(user) {
  $("login-view").hidden = true; $("app").hidden = false;
  $("welcome").textContent = "Welcome back, " + user.name.split(" ")[0];
  const student = user.role === "student";
  $("tab-student").hidden = !student; $("tab-faculty").hidden = student;
  tab(student); render(); updateSubmit(); window.scrollTo(0, 0);
}
function leave() {
  localStorage.removeItem(SESSION_KEY);
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; $("gps-btn").textContent = "Start GPS tracking"; }
  stopQR();
  check = { gps: false, qr: null, photo: false };
  setBox("gps-msg", "Location not started."); setBox("qr-msg", "QR scanner inactive."); setBox("photo-msg", "No photo yet.");
  $("preview").hidden = true; updateSubmit();
  $("app").hidden = true; $("login-view").hidden = false; $("login-form").reset(); $("login-error").hidden = true;
}

$("toggle-pw").onclick = () => {
  const p = $("password"), show = p.type === "password";
  p.type = show ? "text" : "password"; $("toggle-pw").textContent = show ? "Hide" : "Show";
};
$("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("username").value.trim().toLowerCase(), u = USERS[name], err = $("login-error");
  if (!u || u.password !== $("password").value) {
    err.textContent = "Invalid username or password."; err.hidden = false; return;
  }
  err.hidden = true; localStorage.setItem(SESSION_KEY, name); enter(u);
});
$("logout").onclick = () => { leave(); toast("Logged out."); };

const saved = USERS[localStorage.getItem(SESSION_KEY)];
if (saved) enter(saved);
