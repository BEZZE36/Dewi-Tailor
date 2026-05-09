// Utility functions for Dewi Tailor

/**
 * Samarkan nama: 2 karakter pertama + "***"
 * Contoh: "Siti Rahma" → "Si***"
 */
export function samarkanNama(nama) {
  if (!nama || nama.length === 0) return "***";
  return nama.slice(0, 2) + "***";
}

/**
 * Format tanggal ke Indonesia
 * Contoh: timestamp → "15 Mei 2026"
 */
export function formatTgl(timestamp) {
  if (!timestamp) return "-";
  let date;
  if (timestamp && typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === "string" || typeof timestamp === "number") {
    date = new Date(timestamp);
  } else {
    return "-";
  }
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Format tanggal pendek
 * Contoh: "15 Mei 2026"
 */
export function formatTglPendek(timestamp) {
  if (!timestamp) return "-";
  let date;
  if (timestamp && typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format harga ke Rupiah
 * Contoh: 250000 → "Rp 250.000"
 */
export function formatRupiah(number) {
  if (number === null || number === undefined || number === "") return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  })
    .format(number)
    .replace("IDR", "Rp");
}

/**
 * Hitung posisi antrian
 * Berapa order di depan yang belum selesai
 */
export function posisiAntrian(orders, orderId) {
  const activeOrders = orders
    .filter((o) => o.status !== "selesai")
    .sort((a, b) => a.nomorAntrian - b.nomorAntrian);
  const idx = activeOrders.findIndex((o) => o.id === orderId);
  return idx === -1 ? 0 : idx;
}

/**
 * Status config dengan label dan warna
 */
export const statusConfig = {
  menunggu: { label: "Menunggu", color: "#F59E0B", bg: "bg-amber", textColor: "text-amber" },
  dikerjakan: { label: "Sedang Dikerjakan", color: "#06B6D4", bg: "bg-cyan", textColor: "text-cyan" },
  fitting: { label: "Fitting / Revisi", color: "#F97316", bg: "bg-orange", textColor: "text-orange" },
  selesai: { label: "Selesai", color: "#10B981", bg: "bg-emerald", textColor: "text-emerald" },
};

/**
 * Status badge HTML
 */
export function statusBadge(status) {
  const cfg = statusConfig[status] || { label: status, color: "#94A3B8" };
  return `<span style="background:${cfg.color}22;color:${cfg.color};border:1px solid ${cfg.color}44" class="status-badge">${cfg.label}</span>`;
}

/**
 * Status bayar badge HTML
 */
export function statusBayarBadge(statusBayar) {
  if (statusBayar === "lunas") {
    return `<span style="background:#22C55E22;color:#22C55E;border:1px solid #22C55E44" class="status-badge">Lunas</span>`;
  }
  return `<span style="background:#EF444422;color:#EF4444;border:1px solid #EF444444" class="status-badge">Belum Lunas</span>`;
}

/**
 * Generate token 32 karakter
 */
export function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Format nomor antrian dengan padding
 */
export function formatNomorAntrian(no) {
  return String(no).padStart(4, "0");
}

/**
 * Cek apakah tanggal hari ini
 */
export function isToday(timestamp) {
  if (!timestamp) return false;
  let date;
  if (timestamp && typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else {
    date = new Date(timestamp);
  }
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Label jenis pakaian
 */
export function labelJenisPakaian(kategori, jenis) {
  return jenis || "-";
}

/**
 * Label metode bayar
 */
export function labelMetodeBayar(metode) {
  const map = {
    tunai: "Tunai",
    transfer: "Transfer Bank",
    qris: "QRIS",
  };
  return map[metode] || metode || "-";
}
