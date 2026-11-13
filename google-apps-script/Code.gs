
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
  try {
    const config = getConfig_();

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Data POST tidak ditemukan.");
    }

    const data = JSON.parse(e.postData.contents);

    // Validasi token ESP32
    if (data.token !== config.API_TOKEN) {
      return ContentService.createTextOutput("Akses ditolak.");
    }

    if (!data.uid || !data.nama) {
      throw new Error("UID dan nama wajib diisi.");
    }

    const spreadsheet = getSpreadsheet_();

    // Mengambil waktu dari ESP32
    let waktu = new Date();

    if (
      data.waktu &&
      data.waktu !== "Waktu tidak tersedia"
    ) {
      const cocok = data.waktu.match(
        /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
      );

      if (cocok) {
        waktu = new Date(
          Date.UTC(
            Number(cocok[1]),
            Number(cocok[2]) - 1,
            Number(cocok[3]),
            Number(cocok[4]) - 7,
            Number(cocok[5]),
            Number(cocok[6])
          )
        );
      }
    }

    // Nama sheet berdasarkan tanggal WIB
    const zonaWaktu = "Asia/Jakarta";

    const namaSheet = Utilities.formatDate(
      waktu,
      zonaWaktu,
      "dd-MM-yyyy"
    );

    let sheet = spreadsheet.getSheetByName(namaSheet);

    // Membuat sheet baru jika belum tersedia
    if (!sheet) {
      sheet = spreadsheet.insertSheet(namaSheet);

      sheet.appendRow([
        "Waktu",
        "UID",
        "Nama",
        "Status"
      ]);

      sheet.setFrozenRows(1);
    }

    // Menyimpan data absensi
    sheet.appendRow([
      waktu,
      String(data.uid),
      String(data.nama),
      String(data.status || "")
    ]);

    // Format waktu
    const barisTerakhir = sheet.getLastRow();

    sheet.getRange(barisTerakhir, 1)
      .setNumberFormat("dd/MM/yyyy HH:mm:ss");

    return ContentService.createTextOutput(
      "Absensi berhasil disimpan ke " + namaSheet
    );

  } catch (error) {
    console.error(error);

    return ContentService.createTextOutput(
      "Error: " + error.message
    );
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

