const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function: Seed data galeri awal ke Firestore
 * Jalankan sekali: firebase deploy --only functions
 * Lalu panggil via HTTP trigger
 */
exports.seedGallery = functions.https.onRequest(async (req, res) => {
  // Hanya bisa dijalankan via GET dengan secret key
  if (req.query.secret !== "dewi-tailor-seed-2026") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const galleryItems = [
    {
      namaModel: "Kebaya Kutubaru Modern",
      kategori: "Kebaya",
      deskripsi:
        "Potongan ramping elegan dengan detail kerah kutubaru klasik. Cocok untuk wisuda, lamaran, dan pernikahan. Jahitan tangan pada detail bordir.",
      estimasiHarga: "Rp 250.000 – 400.000",
      fotoURL: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80",
      aktif: true,
    },
    {
      namaModel: "Dress Pesta A-Line",
      kategori: "Dress Pesta",
      deskripsi:
        "Siluet A-line yang memanjangkan tubuh dengan detail pinggang manis. Cocok untuk pesta pernikahan, kondangan, dan acara formal.",
      estimasiHarga: "Rp 200.000 – 350.000",
      fotoURL: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&q=80",
      aktif: true,
    },
    {
      namaModel: "Gamis Syar'i Elegan",
      kategori: "Gamis",
      deskripsi:
        "Potongan longgar namun tetap elegan dengan detail kancing depan dan lengan bishop. Nyaman untuk harian maupun kondangan.",
      estimasiHarga: "Rp 150.000 – 250.000",
      fotoURL: "https://images.unsplash.com/photo-1594938298603-c8148c4b4e5f?w=400&q=80",
      aktif: true,
    },
    {
      namaModel: "Blouse Casual Modern",
      kategori: "Blouse",
      deskripsi:
        "Kerah V clean dengan detail plisket di bagian dada. Cocok untuk kerja maupun hangout. Tersedia pilihan lengan panjang dan pendek.",
      estimasiHarga: "Rp 80.000 – 130.000",
      fotoURL: "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=400&q=80",
      aktif: true,
    },
    {
      namaModel: "Rok Lipit Formal",
      kategori: "Rok",
      deskripsi:
        "Rok midi dengan detail lipit rapi, kesan profesional dan anggun. Sangat cocok untuk busana kerja dan acara semi-formal.",
      estimasiHarga: "Rp 90.000 – 130.000",
      fotoURL: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80",
      aktif: true,
    },
    {
      namaModel: "Dress Pesta Anak",
      kategori: "Dress Anak",
      deskripsi:
        "Model princess dengan rok mengembang dan pita pinggang lebar. Tampilan mewah untuk ulang tahun, wisuda TK/SD, dan acara keluarga.",
      estimasiHarga: "Rp 100.000 – 180.000",
      fotoURL: "https://images.unsplash.com/photo-1518831959646-742c3a14ebf1?w=400&q=80",
      aktif: true,
    },
    {
      namaModel: "Gamis Anak Syar'i",
      kategori: "Gamis Anak",
      deskripsi:
        "Gamis anak longgar dengan warna cerah. Nyaman dipakai beraktivitas dan tampil anggun untuk acara keagamaan.",
      estimasiHarga: "Rp 100.000 – 170.000",
      fotoURL: "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=400&q=80",
      aktif: true,
    },
    {
      namaModel: "Jumpsuit Wanita",
      kategori: "Jumpsuit",
      deskripsi:
        "One-piece modern dengan potongan wide-leg yang trendi. Cocok untuk kasual hingga semi-formal, kesan chic & stylish.",
      estimasiHarga: "Rp 150.000 – 220.000",
      fotoURL: "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=400&q=80",
      aktif: true,
    },
    {
      namaModel: "Rok Anak Flare",
      kategori: "Rok Anak",
      deskripsi:
        "Rok flare dengan lapisan inner dan detail renda di ujung. Aktif & nyaman untuk anak-anak.",
      estimasiHarga: "Rp 75.000 – 120.000",
      fotoURL: "https://images.unsplash.com/photo-1491013516836-7db643ee125a?w=400&q=80",
      aktif: true,
    },
  ];

  try {
    const batch = db.batch();
    // Init counter
    const configRef = db.collection("config").doc("app");
    batch.set(configRef, { counterAntrian: 0 }, { merge: true });

    // Cek existing gallery
    const existing = await db.collection("gallery").limit(1).get();
    if (!existing.empty) {
      return res.status(200).json({ message: "Data sudah ada, seed dilewati." });
    }

    galleryItems.forEach((item) => {
      const ref = db.collection("gallery").doc();
      batch.set(ref, item);
    });

    await batch.commit();
    return res.status(200).json({ success: true, message: `${galleryItems.length} item galeri berhasil di-seed.` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Cloud Function: Increment counter antrian secara atomic
 * Dipanggil dari form pre-order saat pelanggan submit
 */
exports.getNextAntrian = functions.https.onCall(async (data, context) => {
  const configRef = db.collection("config").doc("app");
  try {
    const newCounter = await db.runTransaction(async (transaction) => {
      const configDoc = await transaction.get(configRef);
      const current = configDoc.exists ? (configDoc.data().counterAntrian || 0) : 0;
      const next = current + 1;
      transaction.set(configRef, { counterAntrian: next }, { merge: true });
      return next;
    });
    return { nomorAntrian: newCounter };
  } catch (error) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});
