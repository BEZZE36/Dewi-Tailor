import { db } from "./firebase-config.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  samarkanNama,
  formatTgl,
  statusBadge,
  formatNomorAntrian,
} from "./utils.js";

let unsubscribe = null;
let allOrders = [];
let isFirstLoad = true;

/* ─── Banner Sedang Dikerjakan ───────────────────────────────────────────── */
function renderBannerDikerjakan(orders) {
  const content = document.getElementById("banner-content");
  if (!content) return;

  const dikerjakan = orders.filter((o) => o.status === "dikerjakan");

  if (dikerjakan.length === 0) {
    content.innerHTML = `
      <div class="flex items-center gap-3 opacity-70 animate-fadein">
        <span class="text-2xl">✂️</span>
        <span class="text-lg font-medium">Belum ada yang sedang dikerjakan saat ini</span>
      </div>`;
    return;
  }

  content.innerHTML = dikerjakan.map((o, i) => `
    <div class="banner-item flex items-center gap-4 animate-fadein" style="animation-delay:${i * 0.1}s">
      <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center font-bold text-xl">
        #${formatNomorAntrian(o.nomorAntrianDinamis)}
      </div>
      <div>
        <div class="font-bold text-lg">${samarkanNama(o.nama)}</div>
        <div class="text-sm opacity-70">✂️ ${o.jenisPakaian || "-"}</div>
      </div>
    </div>
  `).join('<div class="hidden md:block text-white/30 text-2xl mx-4">|</div>');
}

/* ─── Statistik ──────────────────────────────────────────────────────────── */
function renderStatistik(orders) {
  const aktif = orders.filter((o) => o.status !== "selesai");
  const menunggu = orders.filter((o) => o.status === "menunggu").length;
  const dikerjakan = orders.filter((o) => o.status === "dikerjakan").length;

  animateCounter("stat-aktif", aktif.length);
  animateCounter("stat-menunggu", menunggu);
  animateCounter("stat-dikerjakan", dikerjakan);
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const step = (timestamp) => {
    if (!start.startTime) start.startTime = timestamp;
    const elapsed = timestamp - (el._startTime || timestamp);
    el._startTime = el._startTime || timestamp;
    const progress = Math.min(elapsed / duration, 1);
    el.textContent = Math.floor(start + (target - start) * easeOut(progress));
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  el._startTime = null;
  requestAnimationFrame(step);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/* ─── Tabel & Cards ──────────────────────────────────────────────────────── */
function renderTabel(orders) {
  const tbody = document.getElementById("antrian-tbody");
  const cardList = document.getElementById("antrian-cards");
  // Urutkan berdasarkan nomor antrian dinamis
  const sorted = [...orders].sort((a, b) => a.nomorAntrianDinamis - b.nomorAntrianDinamis);

  if (sorted.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center py-16 text-gray-400 italic">Belum ada data antrian</td></tr>`;
    if (cardList) cardList.innerHTML = `<div class="text-center py-16 text-gray-400 italic">Belum ada data antrian</div>`;
    return;
  }

  if (tbody) {
    tbody.innerHTML = sorted.map((o, i) => `
      <tr class="antrian-row border-b border-cream/30 hover:bg-warm-white/50 dark:hover:bg-white/5 transition-colors ${o.status === "dikerjakan" ? "bg-primary/5" : ""}"
          style="animation: slideInRow 0.3s ease ${i * 0.05}s both">
        <td class="px-8 py-5 font-bold text-primary">#${formatNomorAntrian(o.nomorAntrianDinamis)}</td>
        <td class="px-8 py-5 font-medium dark:text-gray-200">${samarkanNama(o.nama)}</td>
        <td class="px-8 py-5 text-gray-600 dark:text-gray-400">${o.jenisPakaian || "-"}</td>
        <td class="px-8 py-5">${statusBadge(o.status)}</td>
        <td class="px-8 py-5 text-gray-600 dark:text-gray-400">${formatTgl(o.estimasiSelesai)}</td>
      </tr>
    `).join("");
  }

  if (cardList) {
    cardList.innerHTML = sorted.map((o, i) => `
      <div class="antrian-card p-6 border-b border-cream/30 dark:bg-white/5 ${o.status === "dikerjakan" ? "bg-primary/5" : ""}"
           style="animation: slideInRow 0.3s ease ${i * 0.05}s both">
        <div class="flex justify-between items-start mb-3">
          <span class="font-bold text-primary text-lg">#${formatNomorAntrian(o.nomorAntrianDinamis)}</span>
          ${statusBadge(o.status)}
        </div>
        <div class="font-semibold mb-1 dark:text-gray-200">${samarkanNama(o.nama)}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">✂️ ${o.jenisPakaian || "-"}</div>
        <div class="text-sm text-gray-400 dark:text-gray-500 mt-2">📅 ${formatTgl(o.estimasiSelesai)}</div>
      </div>
    `).join("");
  }
}

/* ─── Real-time Flash Indicator ─────────────────────────────────────────── */
function flashUpdate() {
  const indicator = document.getElementById("realtime-indicator");
  if (!indicator) return;
  indicator.classList.add("opacity-0");
  setTimeout(() => {
    indicator.classList.remove("opacity-0");
    indicator.classList.add("scale-110");
    setTimeout(() => indicator.classList.remove("scale-110"), 200);
  }, 100);
}

/* ─── Init ───────────────────────────────────────────────────────────────── */
function initAntrian() {
  // Ambil semua order, filter akan dilakukan di client-side untuk mendukung "Reset 1 Hari"
  const q = query(collection(db, "orders"), orderBy("tanggalMasuk", "asc"));

  unsubscribe = onSnapshot(q, (snapshot) => {
    const rawOrders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    
    // LOGIKA RESET 1 HARI & ANTRIAN DINAMIS
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Filter: Ambil yang BELUM selesai, ATAU yang SELESAI HARI INI
    const filtered = rawOrders.filter(o => {
      if (o.status !== "selesai") return true;
      if (!o.tanggalSelesai) return false;
      const tglSelesai = o.tanggalSelesai.toDate ? o.tanggalSelesai.toDate() : new Date(o.tanggalSelesai);
      tglSelesai.setHours(0,0,0,0);
      return tglSelesai.getTime() === today.getTime();
    });

    // 2. Mapping: Berikan Nomor Antrian Dinamis (#0001, #0002...) berdasarkan urutan masuk
    allOrders = filtered.map((o, index) => ({
      ...o,
      nomorAntrianDinamis: index + 1
    }));

    renderBannerDikerjakan(allOrders);
    renderStatistik(allOrders);
    renderTabel(allOrders);
    updateLastRefresh();
    if (!isFirstLoad) flashUpdate();
    isFirstLoad = false;
  }, (error) => {
    console.error("Real-time listener error:", error);
    const el = document.getElementById("last-refresh");
    if (el) el.textContent = "⚠️ Koneksi terputus";
  });
}

function updateLastRefresh() {
  const el = document.getElementById("last-refresh");
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString("id-ID");
  }
}

document.addEventListener("DOMContentLoaded", initAntrian);
window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });
