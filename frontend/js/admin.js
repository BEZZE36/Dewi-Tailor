import { db, auth } from "./firebase-config.js";
import {
  collection, query, orderBy, onSnapshot, doc, updateDoc,
  getDoc, addDoc, deleteDoc, Timestamp, runTransaction, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  samarkanNama, formatTgl, formatTglPendek, statusBadge, statusBayarBadge,
  formatRupiah, formatNomorAntrian, isToday, generateToken,
} from "./utils.js";

const IMGBB_KEY = "7e8ec6b8394b0c43f47ed50e2e57af2e";
const SERVICE_ID = "service_iem0a2q";
const TEMPLATE_ID = "template_ko5cbn5";

let unsubscribeOrders = null;
let unsubscribeGallery = null;
let unsubscribeReviews = null;
let allOrders = [];
let allGallery = [];
let allReviews = [];
let currentEditOrderId = null;
let currentQROrderId = null;
let currentGalleryId = null;
let currentReplyId = null;
let reviewFilter = 'semua';
let adminEmail = "";

// ─── AUTH: Email OTP Verifikasi ─────────────────────────────────────────────

const ADMIN_SESSION_KEY = "adminVerified";

function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Cek apakah user ini adalah admin di Firestore
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const isAdmin = userSnap.exists() && userSnap.data().role === 'admin';
      
      if (isAdmin || sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") {
        sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
        showDashboard();
        initDashboard();
      } else {
        await signOut(auth);
        showLogin();
      }
    } else {
      showLogin();
    }
  });
}

function showLogin() {
  const loginOverlay = document.getElementById("login-overlay");
  const dashboard = document.getElementById("dashboard-wrapper");
  if (loginOverlay) loginOverlay.style.display = "flex";
  if (dashboard) dashboard.style.display = "none";
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function showDashboard() {
  const loginOverlay = document.getElementById("login-overlay");
  const dashboard = document.getElementById("dashboard-wrapper");
  if (loginOverlay) loginOverlay.style.display = "none";
  if (dashboard) dashboard.style.display = "block";
}

function showOTPStep() {
  document.getElementById("login-step-1").style.display = "none";
  document.getElementById("login-step-2").style.display = "block";
  document.getElementById("login-overlay").style.display = "flex";
  document.getElementById("dashboard-wrapper").style.display = "none";
  document.getElementById("otp-hint-admin").textContent = `Kode dikirim ke email admin`;
  setupOTPAdmin();
}

// Step 1: Login dengan Password
document.getElementById("login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const btn = document.getElementById("btn-login");
  const err = document.getElementById("login-error");
  
  btn.disabled = true;
  btn.innerHTML = 'Memproses...';
  err.textContent = "";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // initAuth akan otomatis mengarahkan ke dashboard jika role=admin
  } catch (error) {
    console.error(error);
    err.textContent = "Email atau Password salah.";
    btn.disabled = false;
    btn.textContent = "Masuk (Password)";
  }
});

window.requestAdminOTP = async () => {
  const email = document.getElementById("login-email").value.trim();
  const err = document.getElementById("login-error");
  const btn = document.querySelector('button[onclick="requestAdminOTP()"]');
  if (!email) { err.textContent = "Masukkan email dulu."; return; }

  try {
    if(btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }
    adminEmail = email;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await setDoc(doc(db, "mail_otps", email), {
      otp: otp,
      createdAt: Timestamp.now(),
      expiresAt: new Timestamp(Math.floor(Date.now()/1000) + 600, 0)
    });
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, { to_email: email, to_name: "Admin", otp: otp });
    showOTPStep();
  } catch (error) {
    err.textContent = "Gagal kirim OTP.";
    console.error(error);
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = 'Minta OTP'; }
  }
};

// Step 2: Verifikasi OTP
document.getElementById("pin-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const otpInput = [...document.querySelectorAll('.otp-admin')].map(i => i.value).join('');
  const err = document.getElementById("pin-error");
  const btn = document.getElementById("pin-verify-btn");
  
  if (otpInput.length < 6) { err.textContent = "Masukkan 6 digit kode."; return; }

  btn.disabled = true;
  btn.textContent = "Memverifikasi...";
  err.textContent = "";

  try {
    const snap = await getDoc(doc(db, "mail_otps", adminEmail));
    if (!snap.exists()) throw new Error("OTP tidak ditemukan. Kirim ulang.");
    
    const data = snap.data();
    if (data.otp !== otpInput) throw new Error("Kode OTP salah.");
    if (data.expiresAt.toDate() < new Date()) throw new Error("Kode kadaluarsa.");

    // OTP Valid!
    await deleteDoc(doc(db, "mail_otps", adminEmail));

    // Login ke Firebase (Admin harus sudah terdaftar di Firebase Auth)
    const adminPass = "DewiTailorAdmin123!"; 
    
    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPass);
    } catch(authErr) {
      if(authErr.code === 'auth/user-not-found') {
        await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
      } else { throw authErr; }
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    
    // Paksa set role admin di Firestore
    const user = auth.currentUser;
    await setDoc(doc(db, "users", user.uid), {
      username: "Admin",
      email: adminEmail,
      role: "admin",
      uid: user.uid
    }, { merge: true });

    showDashboard();
    initDashboard();
  } catch (error) {
    err.textContent = error.message;
    btn.disabled = false;
    btn.textContent = "Verifikasi & Masuk";
  }
});

// Toggle show/hide password
document.getElementById("toggle-password")?.addEventListener("click", () => {
  const input = document.getElementById("login-password");
  const btn = document.getElementById("toggle-password");
  input.type = input.type === "password" ? "text" : "password";
  btn.innerHTML = input.type === "password"
    ? '<i data-lucide="eye" class="w-4 h-4"></i>'
    : '<i data-lucide="eye-off" class="w-4 h-4"></i>';
  if (window.lucide) lucide.createIcons();
});

function showLogin() {
  // Redirect ke halaman rahasia jika belum terverifikasi
  window.location.href = "index.html";
}

function showDashboard() {
  const loading = document.getElementById("loading-overlay");
  if (loading) loading.style.display = "none";
  document.getElementById("dashboard-wrapper").style.display = "block";
}

document.getElementById("logout-btn")?.addEventListener("click", async () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  if (unsubscribeOrders) unsubscribeOrders();
  if (unsubscribeGallery) unsubscribeGallery();
  if (unsubscribeReviews) unsubscribeReviews();
  await signOut(auth);
});

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

document.querySelectorAll("[data-section]").forEach((el) => {
  el.addEventListener("click", () => {
    navigateTo(el.getAttribute("data-section"));
    document.getElementById("sidebar")?.classList.remove("open");
  });
});

function navigateTo(section) {
  document.querySelectorAll(".section-page").forEach((s) => (s.style.display = "none"));
  const target = document.getElementById(`section-${section}`);
  if (target) { target.style.display = "block"; target.style.animation = "fadeUp .4s ease"; }
  document.querySelectorAll("[data-section]").forEach((el) =>
    el.classList.toggle("active", el.getAttribute("data-section") === section)
  );
}

document.getElementById("hamburger-btn")?.addEventListener("click", () => {
  document.getElementById("sidebar")?.classList.toggle("open");
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function initDashboard() {
  // Hubungkan tombol navigasi secara eksplisit
  document.querySelectorAll("[data-section]").forEach((el) => {
    el.onclick = () => {
      navigateTo(el.getAttribute("data-section"));
      document.getElementById("sidebar")?.classList.remove("open");
    };
  });

  document.getElementById("hamburger-btn")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("open");
  });

  if (window.lucide) lucide.createIcons();

  navigateTo("overview");
  initOrdersListener();
  initGalleryListener();
  initReviewsListener();
}

function initOrdersListener() {
  const q = query(collection(db, "orders"), orderBy("nomorAntrian", "asc"));
  unsubscribeOrders = onSnapshot(q, (snapshot) => {
    allOrders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderOverview();
    renderOrdersTable();
  });
}

function initGalleryListener() {
  const q = query(collection(db, "gallery"), orderBy("namaModel", "asc"));
  unsubscribeGallery = onSnapshot(q, (snapshot) => {
    allGallery = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderGalleryAdmin();
  });
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  let startTime = null;
  const step = (ts) => {
    if (!startTime) startTime = ts;
    const p = Math.min((ts - startTime) / 600, 1);
    el.textContent = Math.floor(start + (target - start) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

function renderOverview() {
  const now = new Date();
  const twoDays = new Date(now.getTime() + 2 * 86400000);
  animateCounter("stat-total-aktif", allOrders.filter((o) => o.status !== "selesai").length);
  animateCounter("stat-selesai-hari-ini", allOrders.filter((o) => o.status === "selesai" && isToday(o.tanggalUpdate || o.tanggalMasuk)).length);
  animateCounter("stat-deadline-dekat", allOrders.filter((o) => {
    if (o.status === "selesai" || !o.estimasiSelesai) return false;
    const d = o.estimasiSelesai.toDate ? o.estimasiSelesai.toDate() : new Date(o.estimasiSelesai);
    return d <= twoDays && d >= now;
  }).length);
  animateCounter("stat-belum-estimasi", allOrders.filter((o) => !o.estimasiSelesai && o.status !== "selesai").length);
}

// ─── ORDERS TABLE ─────────────────────────────────────────────────────────────

let filterStatus = "semua", sortMode = "terbaru", searchQuery = "";

function getFilteredOrders() {
  let orders = [...allOrders];
  if (searchQuery) { const q = searchQuery.toLowerCase(); orders = orders.filter((o) => (o.nama||"").toLowerCase().includes(q) || (o.jenisPakaian||"").toLowerCase().includes(q)); }
  if (filterStatus !== "semua") orders = orders.filter((o) => o.status === filterStatus);
  const toDate = (v) => v ? (v.toDate ? v.toDate() : new Date(v)) : new Date("9999-12-31");
  if (sortMode === "terbaru") orders.sort((a, b) => b.nomorAntrian - a.nomorAntrian);
  else if (sortMode === "terlama") orders.sort((a, b) => a.nomorAntrian - b.nomorAntrian);
  else if (sortMode === "estimasi") orders.sort((a, b) => toDate(a.estimasiSelesai) - toDate(b.estimasiSelesai));
  return orders;
}

function renderOrdersTable() {
  const orders = getFilteredOrders();
  const tbody = document.getElementById("orders-tbody");
  const cardList = document.getElementById("orders-cards");
  if (orders.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-16 text-admin-muted italic">Tidak ada order</td></tr>`;
    if (cardList) cardList.innerHTML = `<div class="text-center py-16 text-admin-muted italic p-8">Tidak ada order</div>`;
    return;
  }
  if (tbody) {
    tbody.innerHTML = orders.map((o, i) => `
      <tr class="border-b border-admin-border hover:bg-white/5 transition-colors" style="animation:slideInRow .3s ease ${i*.04}s both">
        <td class="px-5 py-4 font-bold text-admin-accent">#${formatNomorAntrian(o.nomorAntrian)}</td>
        <td class="px-5 py-4"><div class="font-medium">${o.nama||"-"}</div><div class="text-xs text-admin-muted">${o.noHP||""}</div></td>
        <td class="px-5 py-4 text-admin-muted">${o.jenisPakaian||"-"}</td>
        <td class="px-5 py-4 text-admin-muted">${formatTglPendek(o.tanggalMasuk)}</td>
        <td class="px-5 py-4 text-admin-muted">${formatTgl(o.estimasiSelesai)}</td>
        <td class="px-5 py-4">${statusBadge(o.status)}</td>
        <td class="px-5 py-4">${statusBayarBadge(o.statusBayar)}</td>
        <td class="px-5 py-4"><button class="bg-admin-accent/10 text-admin-accent hover:bg-admin-accent hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all" onclick="openQRModal('${o.id}')">📱 QR</button></td>
        <td class="px-5 py-4"><button class="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all" onclick="openEditModal('${o.id}')">✏️ Edit</button></td>
      </tr>`).join("");
  }
  if (cardList) {
    cardList.innerHTML = orders.map((o, i) => `
      <div class="p-6 border-b border-admin-border" style="animation:slideInRow .3s ease ${i*.04}s both">
        <div class="flex justify-between items-start mb-2"><span class="font-bold text-admin-accent">#${formatNomorAntrian(o.nomorAntrian)}</span><div class="flex gap-2">${statusBadge(o.status)} ${statusBayarBadge(o.statusBayar)}</div></div>
        <div class="font-semibold">${o.nama||"-"}</div>
        <div class="text-sm text-admin-muted mb-3">✂️ ${o.jenisPakaian||"-"} · 📅 ${formatTgl(o.estimasiSelesai)}</div>
        <div class="flex gap-3">
          <button class="flex-1 bg-admin-accent/10 text-admin-accent border border-admin-accent/20 py-2 rounded-lg text-sm font-bold" onclick="openQRModal('${o.id}')">📱 QR</button>
          <button class="flex-1 bg-white/10 py-2 rounded-lg text-sm font-bold" onclick="openEditModal('${o.id}')">✏️ Edit</button>
        </div>
      </div>`).join("");
  }
}

document.getElementById("search-order")?.addEventListener("input", (e) => { searchQuery = e.target.value; renderOrdersTable(); });
document.getElementById("filter-status")?.addEventListener("change", (e) => { filterStatus = e.target.value; renderOrdersTable(); });
document.getElementById("sort-order")?.addEventListener("change", (e) => { sortMode = e.target.value; renderOrdersTable(); });

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────

window.openEditModal = function (orderId) {
  const order = allOrders.find((o) => o.id === orderId);
  if (!order) return;
  currentEditOrderId = orderId;
  document.getElementById("edit-status").value = order.status || "menunggu";
  document.getElementById("edit-status-bayar").value = order.statusBayar || "belum_lunas";
  document.getElementById("edit-metode-bayar").value = order.metodeBayar || "tunai";
  document.getElementById("edit-harga").value = order.harga || "";
  document.getElementById("edit-catatan").value = order.catatan || "";
  if (order.estimasiSelesai) {
    const d = order.estimasiSelesai.toDate ? order.estimasiSelesai.toDate() : new Date(order.estimasiSelesai);
    document.getElementById("edit-estimasi").value = d.toISOString().split("T")[0];
  } else document.getElementById("edit-estimasi").value = "";
  document.getElementById("edit-modal").style.display = "flex";
};
window.closeEditModal = function () { document.getElementById("edit-modal").style.display = "none"; currentEditOrderId = null; };

document.getElementById("edit-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentEditOrderId) return;
  const btn = document.getElementById("edit-save-btn");
  btn.disabled = true; btn.textContent = "Menyimpan...";
  try {
    const estimasiVal = document.getElementById("edit-estimasi").value;
    const hargaVal = document.getElementById("edit-harga").value;
    await updateDoc(doc(db, "orders", currentEditOrderId), {
      status: document.getElementById("edit-status").value,
      statusBayar: document.getElementById("edit-status-bayar").value,
      metodeBayar: document.getElementById("edit-metode-bayar").value,
      catatan: document.getElementById("edit-catatan").value,
      harga: hargaVal ? Number(hargaVal) : null,
      estimasiSelesai: estimasiVal ? Timestamp.fromDate(new Date(estimasiVal)) : null,
      tanggalUpdate: Timestamp.now(),
    });
    closeEditModal(); showToast("Order berhasil diperbarui ✅");
  } catch (err) { showToast("Gagal memperbarui ❌"); console.error(err); }
  finally { btn.disabled = false; btn.textContent = "Simpan Perubahan"; }
});

// ─── QR MODAL ─────────────────────────────────────────────────────────────────

window.openQRModal = function (orderId) {
  const order = allOrders.find((o) => o.id === orderId);
  if (!order) return;
  currentQROrderId = orderId;
  const qrUrl = `${window.location.origin}/update-status.html?id=${orderId}&token=${order.qrToken}`;
  document.getElementById("qr-no-antrian").textContent = `#${formatNomorAntrian(order.nomorAntrian)}`;
  document.getElementById("qr-nama").textContent = order.nama || "-";
  document.getElementById("qr-jenis").textContent = order.jenisPakaian || "-";
  document.getElementById("qr-estimasi").textContent = formatTgl(order.estimasiSelesai);
  const canvas = document.getElementById("qr-canvas");
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  if (window.QRCode) QRCode.toCanvas(canvas, qrUrl, { width: 200, margin: 2 });
  document.getElementById("qr-modal").style.display = "flex";
};
window.closeQRModal = function () { document.getElementById("qr-modal").style.display = "none"; currentQROrderId = null; };
window.printLabel = function () { if (currentQROrderId) window.open(`/print-label.html?id=${currentQROrderId}`, "_blank"); };

// ─── GALLERY ──────────────────────────────────────────────────────────────────

function renderGalleryAdmin() {
  const grid = document.getElementById("gallery-admin-grid");
  if (!grid) return;
  if (allGallery.length === 0) { grid.innerHTML = `<div class="col-span-full text-center py-20 text-admin-muted italic">Belum ada item galeri</div>`; return; }
  grid.innerHTML = allGallery.map((item, i) => `
    <div class="bg-admin-bg rounded-2xl border border-admin-border overflow-hidden hover:border-admin-accent transition-all hover:-translate-y-1" style="animation:fadeUp .4s ease ${i*.06}s both">
      <div class="aspect-[4/3] overflow-hidden bg-admin-card relative">
        <img src="${item.fotoURL||''}" alt="${item.namaModel}" class="w-full h-full object-cover ${!item.aktif?'opacity-30':''}" onerror="this.src='https://placehold.co/300x200/1E293B/94A3B8?text=No+Image'">
        <span class="absolute top-3 left-3 bg-admin-accent text-white text-xs font-bold px-3 py-1 rounded-full">${item.kategori||""}</span>
        ${!item.aktif?'<div class="absolute inset-0 flex items-center justify-center"><span class="bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full">NONAKTIF</span></div>':''}
      </div>
      <div class="p-5">
        <div class="font-bold mb-1">${item.namaModel||"-"}</div>
        <div class="text-admin-accent text-sm font-semibold mb-4">${item.estimasiHarga||"-"}</div>
        <div class="flex items-center justify-between">
          <label class="toggle-switch"><input type="checkbox" ${item.aktif?"checked":""} onchange="toggleGalleryAktif('${item.id}',this.checked)"><span class="slider"></span></label>
          <div class="flex gap-2">
            <button class="p-2 rounded-lg bg-white/5 hover:bg-admin-accent hover:text-white transition-all" onclick="openGalleryModal('${item.id}')">✏️</button>
            <button class="p-2 rounded-lg bg-white/5 hover:bg-red-500 hover:text-white transition-all" onclick="deleteGalleryItem('${item.id}')">🗑️</button>
          </div>
        </div>
      </div>
    </div>`).join("");
}

window.toggleGalleryAktif = async (id, aktif) => await updateDoc(doc(db, "gallery", id), { aktif });
window.deleteGalleryItem = async (id) => { if (!confirm("Hapus item ini?")) return; await deleteDoc(doc(db, "gallery", id)); showToast("Dihapus ✅"); };

window.openGalleryModal = function (itemId = null) {
  currentGalleryId = itemId;
  document.getElementById("gallery-form").reset();
  if (itemId) {
    const item = allGallery.find((g) => g.id === itemId);
    if (item) {
      document.getElementById("g-nama").value = item.namaModel || "";
      document.getElementById("g-kategori").value = item.kategori || "";
      document.getElementById("g-deskripsi").value = item.deskripsi || "";
      document.getElementById("g-harga").value = item.estimasiHarga || "";
      document.getElementById("g-foto").value = item.fotoURL || "";
      document.getElementById("g-aktif").checked = item.aktif !== false;
    }
    document.getElementById("gallery-modal-title").textContent = "Edit Item Galeri";
  } else {
    document.getElementById("gallery-modal-title").textContent = "Tambah Item Galeri";
    document.getElementById("g-aktif").checked = true;
  }
  document.getElementById("gallery-modal").style.display = "flex";
  // Reset foto tab to URL mode
  setFotoTab('url');
  // File preview listener
  document.getElementById('g-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('g-preview');
    const placeholder = document.getElementById('upload-placeholder');
    const reader = new FileReader();
    reader.onload = (ev) => {
      preview.src = ev.target.result;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  });
};
window.setFotoTab = function(tab) {
  const isUrl = tab === 'url';
  document.getElementById('foto-url-panel').classList.toggle('hidden', !isUrl);
  document.getElementById('foto-file-panel').classList.toggle('hidden', isUrl);
  document.getElementById('tab-url').className = `flex-1 py-2 rounded-xl text-xs font-bold transition-all ${isUrl ? 'bg-admin-accent text-white' : 'bg-admin-bg border border-admin-border text-admin-muted'}`;
  document.getElementById('tab-file').className = `flex-1 py-2 rounded-xl text-xs font-bold transition-all ${!isUrl ? 'bg-admin-accent text-white' : 'bg-admin-bg border border-admin-border text-admin-muted'}`;
};
window.closeGalleryModal = function () { document.getElementById("gallery-modal").style.display = "none"; currentGalleryId = null; };

document.getElementById("gallery-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("gallery-save-btn");
  btn.disabled = true; btn.textContent = "Menyimpan...";
  try {
    let fotoURL = document.getElementById("g-foto").value.trim();
    const fileInput = document.getElementById('g-file');
    const isFileMode = !document.getElementById('foto-file-panel').classList.contains('hidden');

    if (isFileMode && fileInput?.files[0]) {
      const file = fileInput.files[0];
      if (file.size > 5 * 1024 * 1024) {
        showToast('File terlalu besar. Maks 5MB ❌');
        btn.disabled = false; btn.textContent = 'Simpan'; return;
      }
      btn.textContent = 'Mengupload foto...';
      // Show progress bar (simulated for ImgBB)
      const progressBar = document.getElementById('upload-progress-bar');
      const bar = document.getElementById('upload-bar');
      const pct = document.getElementById('upload-pct');
      progressBar?.classList.remove('hidden');
      // Simulate progress
      let progress = 0;
      const sim = setInterval(() => {
        progress = Math.min(progress + 10, 90);
        if (bar) bar.style.width = progress + '%';
        if (pct) pct.textContent = progress + '%';
      }, 200);
      // Upload to ImgBB
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
        method: 'POST', body: formData,
      });
      clearInterval(sim);
      if (bar) bar.style.width = '100%';
      if (pct) pct.textContent = '100%';
      if (!res.ok) throw new Error('ImgBB upload failed');
      const json = await res.json();
      fotoURL = json.data?.url || json.data?.display_url;
      if (!fotoURL) throw new Error('URL tidak diterima dari ImgBB');
    }

    if (!fotoURL) {
      showToast('Masukkan URL atau upload foto ❌');
      btn.disabled = false; btn.textContent = 'Simpan'; return;
    }
    const data = {
      namaModel: document.getElementById("g-nama").value,
      kategori: document.getElementById("g-kategori").value,
      deskripsi: document.getElementById("g-deskripsi").value,
      estimasiHarga: document.getElementById("g-harga").value,
      fotoURL,
      aktif: document.getElementById("g-aktif").checked,
    };
    if (currentGalleryId) await updateDoc(doc(db, "gallery", currentGalleryId), data);
    else await addDoc(collection(db, "gallery"), data);
    closeGalleryModal(); showToast("Galeri berhasil disimpan ✅");
  } catch (err) { showToast("Gagal menyimpan: " + err.message + " ❌"); console.error(err); }
  finally { btn.disabled = false; btn.textContent = "Simpan"; }
});

// ─── TOAST ────────────────────────────────────────────────────────────────────

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// ─── REVIEWS ──────────────────────────────────────────────────────────────────

function initReviewsListener() {
  const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
  unsubscribeReviews = onSnapshot(q, (snapshot) => {
    allReviews = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderReviews();
    updatePendingBadge();
  });
}

function updatePendingBadge() {
  const pending = allReviews.filter(r => r.status === 'pending').length;
  const badge = document.getElementById('badge-pending');
  if (!badge) return;
  if (pending > 0) { badge.textContent = pending; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}

function renderReviews() {
  const list = document.getElementById('reviews-list');
  if (!list) return;
  let reviews = reviewFilter === 'semua' ? allReviews : allReviews.filter(r => r.status === reviewFilter);
  if (reviews.length === 0) {
    list.innerHTML = `<div class="text-center py-20 text-admin-muted italic">Belum ada ulasan</div>`;
    return;
  }
  list.innerHTML = reviews.map((r, i) => {
    const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
    const sBadge = r.status === 'approved'
      ? '<span class="bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full">✓ Disetujui</span>'
      : '<span class="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full">⏳ Pending</span>';
    const tgl = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'}) : '-';
    const replyHtml = r.balasan
      ? `<div class="bg-admin-bg border border-admin-accent/30 rounded-xl p-4"><p class="text-xs font-bold text-admin-accent mb-1">💬 Balasan Admin</p><p class="text-sm">${r.balasan}</p></div>`
      : '';
    const approveBtn = r.status !== 'approved'
      ? `<button onclick="approveReview('${r.id}')" class="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-500 hover:text-white transition-all">✓ Setujui</button>`
      : `<button onclick="unapproveReview('${r.id}')" class="bg-white/5 text-admin-muted px-4 py-2 rounded-lg text-sm font-bold hover:bg-white/10 transition-all">Sembunyikan</button>`;
    return `
    <div class="bg-admin-card border border-admin-border rounded-2xl p-6 space-y-4" style="animation:fadeUp .3s ease ${i*.05}s both">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-admin-accent/20 flex items-center justify-center text-admin-accent font-bold text-lg">${(r.nama||'?')[0].toUpperCase()}</div>
          <div>
            <div class="font-bold">${r.nama || 'Anonim'}</div>
            <div class="text-admin-muted text-xs">${tgl}</div>
          </div>
        </div>
        <div class="flex items-center gap-3">${sBadge}<span class="text-yellow-400 font-bold tracking-widest text-sm">${stars}</span></div>
      </div>
      <p class="text-admin-muted leading-relaxed">"${r.komentar || ''}"</p>
      ${replyHtml}
      <div class="flex flex-wrap gap-3 pt-2 border-t border-admin-border">
        ${approveBtn}
        <button onclick="openReplyModal('${r.id}')" class="bg-admin-accent/20 text-admin-accent border border-admin-accent/30 px-4 py-2 rounded-lg text-sm font-bold hover:bg-admin-accent hover:text-white transition-all">💬 Balas</button>
        <button onclick="deleteReview('${r.id}')" class="bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-500 hover:text-white transition-all ml-auto">🗑️ Hapus</button>
      </div>
    </div>`;
  }).join('');
}

window.approveReview = async (id) => {
  await updateDoc(doc(db, 'reviews', id), { status: 'approved' });
  showToast('Ulasan disetujui & ditampilkan ✅');
};
window.unapproveReview = async (id) => {
  await updateDoc(doc(db, 'reviews', id), { status: 'pending' });
  showToast('Ulasan disembunyikan');
};
window.deleteReview = async (id) => {
  if (!confirm('Hapus ulasan ini secara permanen?')) return;
  await deleteDoc(doc(db, 'reviews', id));
  showToast('Ulasan dihapus ✅');
};
window.openReplyModal = function(id) {
  currentReplyId = id;
  const r = allReviews.find(x => x.id === id);
  if (!r) return;
  document.getElementById('reply-preview').innerHTML = `
    <div class="flex items-center gap-3 mb-3">
      <div class="w-8 h-8 rounded-full bg-admin-accent/20 flex items-center justify-center text-admin-accent font-bold">${(r.nama||'?')[0].toUpperCase()}</div>
      <div><div class="font-semibold text-sm">${r.nama || 'Anonim'}</div><div class="text-yellow-400 text-xs">${'★'.repeat(r.rating||5)}</div></div>
    </div>
    <p class="text-admin-muted text-sm italic">"${r.komentar}"</p>`;
  document.getElementById('reply-text').value = r.balasan || '';
  document.getElementById('reply-modal').style.display = 'flex';
};
window.closeReplyModal = function() { document.getElementById('reply-modal').style.display = 'none'; currentReplyId = null; };
window.submitReply = async function() {
  if (!currentReplyId) return;
  const text = document.getElementById('reply-text').value.trim();
  if (!text) { showToast('Tulis balasan terlebih dahulu'); return; }
  const btn = document.getElementById('reply-save-btn');
  btn.disabled = true; btn.textContent = 'Mengirim...';
  try {
    await updateDoc(doc(db, 'reviews', currentReplyId), { balasan: text, balasanAt: Timestamp.now() });
    closeReplyModal(); showToast('Balasan berhasil dikirim ✅');
  } catch(e) { showToast('Gagal mengirim ❌'); }
  finally { btn.disabled = false; btn.textContent = 'Kirim Balasan'; }
};

document.getElementById('filter-review')?.addEventListener('change', (e) => {
  reviewFilter = e.target.value;
  renderReviews();
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", initAuth);
