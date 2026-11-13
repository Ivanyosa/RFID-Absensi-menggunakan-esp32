
function getConfig_() {
  const properties = PropertiesService.getScriptProperties();

  const config = {
    ADMIN_PIN: properties.getProperty("ADMIN_PIN"),
    API_TOKEN: properties.getProperty("API_TOKEN"),
    SPREADSHEET_ID: properties.getProperty("SPREADSHEET_ID")
  };

  if (!config.ADMIN_PIN || !config.API_TOKEN || !config.SPREADSHEET_ID) {
    throw new Error(
      "Konfigurasi belum lengkap. Periksa Script Properties."
    );
  }

  return config;
}


function getSpreadsheet_() {
  const config = getConfig_();

  return SpreadsheetApp.openById(config.SPREADSHEET_ID);
}


function getSheetKartu_() {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName("Kartu");

  if (!sheet) {
    throw new Error("Sheet Kartu tidak ditemukan.");
  }

  return sheet;
}


// ================================================
// 3. CEK PIN ADMIN
// ================================================

function cekPinAdmin_(pin) {
  const config = getConfig_();

  if (String(pin || "") !== config.ADMIN_PIN) {
    throw new Error("PIN admin salah.");
  }
}


// ================================================
// 4. RESPONSE JSON
// ================================================

function responseJSON_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


// ================================================
// 5. MENERIMA DATA ABSENSI DARI ESP32
// ================================================


function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    // 1. Periksa konfigurasi
    const config = getConfig_();

    // 2. Periksa data POST
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Data POST tidak ditemukan.");
    }

    // 3. Baca JSON
    let data;

    try {
      data = JSON.parse(e.postData.contents);
    } catch (error) {
      throw new Error("Format JSON tidak valid.");
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Format data tidak valid.");
    }

    // 4. Validasi API Token
    if (
      typeof data.token !== "string" ||
      data.token !== config.API_TOKEN
    ) {
      return responseJSON_({
        ok: false,
        message: "Akses ditolak."
      });
    }

    // 5. Validasi UID
    const uid = String(data.uid || "").trim();

    const polaUID = /^\d{1,3}( \d{1,3}){3,9}$/;

    if (!polaUID.test(uid)) {
      throw new Error("Format UID tidak valid.");
    }

    const byteUID = uid.split(" ").map(Number);

    if (byteUID.some(byte => byte < 0 || byte > 255)) {
      throw new Error("Nilai UID tidak valid.");
    }

    // 6. Validasi status absensi
    if (data.status !== "ABSEN BERHASIL") {
      throw new Error("Status absensi tidak valid.");
    }

    // 7. Validasi waktu dari ESP32
    const zonaWaktu = "Asia/Jakarta";
    let waktu = new Date();

    if (
      data.waktu &&
      data.waktu !== "Waktu tidak tersedia"
    ) {
      if (typeof data.waktu !== "string") {
        throw new Error("Format waktu tidak valid.");
      }

      const cocok = data.waktu.match(
        /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
      );

      if (!cocok) {
        throw new Error("Format waktu tidak valid.");
      }

      const tahun = Number(cocok[1]);
      const bulan = Number(cocok[2]);
      const tanggal = Number(cocok[3]);
      const jam = Number(cocok[4]);
      const menit = Number(cocok[5]);
      const detik = Number(cocok[6]);

      if (
        tahun < 2000 ||
        bulan < 1 || bulan > 12 ||
        tanggal < 1 || tanggal > 31 ||
        jam < 0 || jam > 23 ||
        menit < 0 || menit > 59 ||
        detik < 0 || detik > 59
      ) {
        throw new Error("Nilai waktu tidak valid.");
      }

      // Konversi WIB ke UTC
      waktu = new Date(
        Date.UTC(
          tahun,
          bulan - 1,
          tanggal,
          jam - 7,
          menit,
          detik
        )
      );

      // Pastikan tanggal dan waktu benar-benar valid
      const waktuValid = Utilities.formatDate(
        waktu,
        zonaWaktu,
        "yyyy-MM-dd HH:mm:ss"
      );

      if (waktuValid !== data.waktu) {
        throw new Error("Tanggal atau waktu tidak valid.");
      }
    }

    // 8. Kunci proses agar tidak terjadi absensi ganda bersamaan
    lock.waitLock(10000);

    // 9. Ambil spreadsheet dan daftar kartu
    const spreadsheet = getSpreadsheet_();
    const sheetKartu = getSheetKartu_();

    const daftarKartu = sheetKartu.getDataRange().getValues();

    let namaTerdaftar = "";

    for (let i = 1; i < daftarKartu.length; i++) {
      const uidSheet = String(daftarKartu[i][0] || "").trim();

      if (uidSheet === uid) {
        namaTerdaftar = String(daftarKartu[i][1] || "").trim();
        break;
      }
    }

    // 10. Pastikan UID terdaftar
    if (!namaTerdaftar) {
      throw new Error("Kartu tidak terdaftar.");
    }

    // 11. Tentukan sheet berdasarkan tanggal WIB
    const namaSheet = Utilities.formatDate(
      waktu,
      zonaWaktu,
      "dd-MM-yyyy"
    );

    let sheetAbsensi = spreadsheet.getSheetByName(namaSheet);

    // Buat sheet baru jika belum tersedia
    if (!sheetAbsensi) {
      sheetAbsensi = spreadsheet.insertSheet(namaSheet);

      sheetAbsensi.getRange(1, 1, 1, 4).setValues([[
        "Waktu",
        "UID",
        "Nama",
        "Status"
      ]]);

      sheetAbsensi.setFrozenRows(1);
    }

    // 12. Cegah UID absen lebih dari sekali pada tanggal yang sama
    const barisTerakhir = sheetAbsensi.getLastRow();

    if (barisTerakhir >= 2) {
      const daftarUIDAbsen = sheetAbsensi
        .getRange(2, 2, barisTerakhir - 1, 1)
        .getDisplayValues();

      const sudahAbsen = daftarUIDAbsen.some(row =>
        String(row[0]).trim() === uid
      );

      if (sudahAbsen) {
        throw new Error("Kartu ini sudah melakukan absensi hari ini.");
      }
    }

    // 13. Simpan absensi
    const barisBaru = sheetAbsensi.getLastRow() + 1;

    const rangeBaru = sheetAbsensi.getRange(
      barisBaru,
      1,
      1,
      4
    );

    // Format kolom UID, Nama, dan Status sebagai teks biasa
    sheetAbsensi.getRange(barisBaru, 2, 1, 3)
      .setNumberFormat("@");

    rangeBaru.setValues([[
      waktu,
      uid,
      namaTerdaftar,
      "ABSEN BERHASIL"
    ]]);

    sheetAbsensi.getRange(barisBaru, 1)
      .setNumberFormat("dd/MM/yyyy HH:mm:ss");

    SpreadsheetApp.flush();

    // 14. Berhasil
    return responseJSON_({
      ok: true,
      message: "Absensi berhasil disimpan.",
      nama: namaTerdaftar,
      uid: uid,
      sheet: namaSheet
    });

  } catch (error) {
    console.error(error);

    return responseJSON_({
      ok: false,
      message: error.message
    });

  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

// ================================================
// 6. HALAMAN UTAMA WEB ADMIN
// ================================================

function doGet(e) {
  try {
    // Permintaan daftar kartu dari ESP32
    if (
      e &&
      e.parameter &&
      e.parameter.aksi === "daftarKartu"
    ) {
      const config = getConfig_();

      // Validasi token ESP32
      if (e.parameter.token !== config.API_TOKEN) {
        return responseJSON_({
          error: "Akses ditolak."
        });
      }

      return ambilDaftarKartuESP32_();
    }

    // Menampilkan halaman admin
    return HtmlService
      .createHtmlOutputFromFile("Index")
      .setTitle("Admin Absensi RFID");

  } catch (error) {
    console.error(error);

    return ContentService.createTextOutput(
      "Error: " + error.message
    );
  }
}


function ambilDaftarKartuESP32_() {
  const sheet = getSheetKartu_();

  const data = sheet.getDataRange().getValues();

  const kartu = data.slice(1)
    .filter(row => row[0] && row[1])
    .map(row => ({
      uid: String(row[0]).trim(),
      nama: String(row[1]).trim()
    }));

  // Tidak mengirim token kembali ke ESP32
  return responseJSON_({
    kartu: kartu
  });
}


// ================================================
// 8. MENAMPILKAN DAFTAR KARTU DI WEB ADMIN
// ================================================

function daftarKartu(pin) {
  cekPinAdmin_(pin);

  const sheet = getSheetKartu_();

  const data = sheet.getDataRange().getValues();

  return data.slice(1)
    .filter(row => row[0] && row[1])
    .map(row => ({
      uid: String(row[0]).trim(),
      nama: String(row[1]).trim()
    }));
}


// ================================================
// 9. MENAMBAHKAN KARTU RFID
// ================================================

function tambahKartu(uid, nama, pin) {
  cekPinAdmin_(pin);

  const sheet = getSheetKartu_();

  uid = String(uid || "").trim();
  nama = String(nama || "").trim();

  if (!uid || !nama) {
    throw new Error("UID dan nama wajib diisi.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = sheet.getDataRange().getValues();

    const sudahAda = data.slice(1).some(row =>
      String(row[0]).trim() === uid
    );

    if (sudahAda) {
      throw new Error("UID kartu sudah terdaftar.");
    }

    sheet.appendRow([uid, nama]);

    return "Kartu berhasil ditambahkan.";

  } finally {
    lock.releaseLock();
  }
}


// ================================================
// 10. MENGHAPUS KARTU RFID
// ================================================

function hapusKartu(uid, pin) {
  cekPinAdmin_(pin);

  const sheet = getSheetKartu_();

  uid = String(uid || "").trim();

  if (!uid) {
    throw new Error("UID kartu wajib diisi.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === uid) {
        sheet.deleteRow(i + 1);

        return "Kartu berhasil dihapus.";
      }
    }

    throw new Error("UID kartu tidak ditemukan.");

  } finally {
    lock.releaseLock();
  }
}

