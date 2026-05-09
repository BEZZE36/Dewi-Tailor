import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  samarkanNama,
  formatTgl,
  statusBadge,
  formatNomorAntrian,
  generateToken,
} from "./utils.js";

// ─── QR CODE GENERATION ───────────────────────────────────────────────────────

export function generateQRCode(canvasEl, orderId, qrToken) {
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/update-status.html?id=${orderId}&token=${qrToken}`;
  if (window.QRCode) {
    QRCode.toCanvas(canvasEl, url, { width: 200, margin: 2 }, (err) => {
      if (err) console.error("QR Error:", err);
    });
  }
  return url;
}

// ─── QR TOKEN ─────────────────────────────────────────────────────────────────

export { generateToken };

// ─── UPDATE STATUS VIA QR ────────────────────────────────────────────────────

export async function verifyAndLoadOrder(orderId, token) {
  if (!orderId || !token) {
    return { valid: false, error: "Parameter tidak lengkap" };
  }

  try {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return { valid: false, error: "Order tidak ditemukan" };
    }

    const data = orderSnap.data();
    if (data.qrToken !== token) {
      return { valid: false, error: "QR tidak valid atau sudah kadaluarsa" };
    }

    return { valid: true, order: { id: orderId, ...data } };
  } catch (err) {
    console.error(err);
    return { valid: false, error: "Terjadi kesalahan sistem" };
  }
}

export async function tandaiSelesai(orderId) {
  const orderRef = doc(db, "orders", orderId);
  await updateDoc(orderRef, {
    status: "selesai",
    tanggalUpdate: Timestamp.now(),
  });
}

// ─── PRINT LABEL ─────────────────────────────────────────────────────────────

export async function loadOrderForPrint(orderId) {
  const orderRef = doc(db, "orders", orderId);
  const snap = await getDoc(orderRef);
  if (!snap.exists()) return null;
  return { id: orderId, ...snap.data() };
}

export function generatePrintLabel(order, canvasEl) {
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/update-status.html?id=${order.id}&token=${order.qrToken}`;
  if (window.QRCode) {
    QRCode.toCanvas(canvasEl, url, { width: 150, margin: 1 });
  }
}
