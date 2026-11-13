
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <time.h>
#include <Wire.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>

#define SS_PIN 5
#define RST_PIN 27
#define BUZZER_PIN 33
#define LED_HIJAU 25
#define LED_MERAH 26

const char* ssid = "NAMA_HOTSPOT";
const char* password = "PASSWORD_HOTSPOT";

const char* scriptURL = "URL_WEB_APP_KAMU";
const char* tokenRahasia = "TOKEN_RAHASIA_KAMU";

LiquidCrystal_I2C lcd(0x27, 16, 2);
MFRC522 rfid(SS_PIN, RST_PIN);

struct DataKartu {
  String uid;
  String nama;
};

DataKartu daftarKartu[50];
int jumlahKartu = 0;

unsigned long waktuUpdateKartu = 0;
const unsigned long INTERVAL_UPDATE_KARTU = 30000;

const String uidTerdaftar = "UID_CONTOH";
const String namaMahasiswa = "Nama Mahasiswa";

bool statusAbsen[50] = { false };

void tampilkanPesan(String baris1, String baris2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(baris1);
  lcd.setCursor(0, 1);
  lcd.print(baris2);
}

void bunyi(int jumlah) {
  for (int i = 0; i < jumlah; i++) {
    digitalWrite(BUZZER_PIN, LOW);
    delay(150);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(120);
  }
}

void matikanLED() {
  digitalWrite(LED_HIJAU, LOW);
  digitalWrite(LED_MERAH, LOW);
}


bool ambilKartuDariGoogleSheets() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Gagal mengambil kartu: Wi-Fi terputus");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient https;
  https.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
  https.setConnectTimeout(20000);
  https.setTimeout(20000);

  String url = String(scriptURL) + "?aksi=daftarKartu";

  Serial.print("URL yang diakses ESP32: ");
  Serial.println(url);

  Serial.println("Mengambil daftar kartu dari Google Sheets...");

  if (!https.begin(client, url)) {
    Serial.println("Gagal membuka koneksi HTTPS");
    return false;
  }

  int kodeHTTP = https.GET();

  if (kodeHTTP != HTTP_CODE_OK) {
    Serial.print("Kode HTTP: ");
    Serial.println(kodeHTTP);

    Serial.print("Detail error: ");
    Serial.println(https.errorToString(kodeHTTP));

    https.end();
    return false;
  }

  String respons = https.getString();
  https.end();

  JsonDocument dokumen;

  DeserializationError error = deserializeJson(dokumen, respons);

  if (error) {
    Serial.print("Gagal membaca JSON: ");
    Serial.println(error.c_str());
    return false;
  }

  const char* token = dokumen["token"] | "";

  if (String(token) != String(tokenRahasia)) {
    Serial.println("Token tidak cocok!");
    return false;
  }

  JsonArray kartu = dokumen["kartu"].as<JsonArray>();

  DataKartu kartuBaru[50];
  int jumlahBaru = 0;

  for (JsonObject item : kartu) {
    if (jumlahBaru >= 50) break;

    const char* uid = item["uid"] | "";
    const char* nama = item["nama"] | "";

    if (strlen(uid) == 0 || strlen(nama) == 0) {
      continue;
    }

    kartuBaru[jumlahBaru].uid = uid;
    kartuBaru[jumlahBaru].nama = nama;
    jumlahBaru++;
  }

  for (int i = 0; i < jumlahBaru; i++) {
    daftarKartu[i] = kartuBaru[i];
  }

  jumlahKartu = jumlahBaru;

  Serial.print("Jumlah kartu berhasil dimuat: ");
  Serial.println(jumlahKartu);

  for (int i = 0; i < jumlahKartu; i++) {
    Serial.print("UID: ");
    Serial.print(daftarKartu[i].uid);
    Serial.print(" | Nama: ");
    Serial.println(daftarKartu[i].nama);
  }

  return true;
}

String waktuSekarang() {
  struct tm waktu;

  if (!getLocalTime(&waktu, 5000)) {
    return "Waktu tidak tersedia";
  }

  char buffer[25];
  strftime(buffer, sizeof(buffer),
           "%Y-%m-%d %H:%M:%S", &waktu);

  return String(buffer);
}

void kirimAbsensi(String uid, String nama, String status) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Gagal kirim: Wi-Fi terputus");
    return;
  }

  String waktu = waktuSekarang();

  String json = "{";
  json += "\"token\":\"" + String(tokenRahasia) + "\",";
  json += "\"waktu\":\"" + waktu + "\",";
  json += "\"uid\":\"" + uid + "\",";
  json += "\"nama\":\"" + nama + "\",";
  json += "\"status\":\"" + status + "\"";
  json += "}";

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient https;
  https.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);

  Serial.println("Mengirim data absensi...");

  if (https.begin(client, scriptURL)) {
    https.addHeader("Content-Type", "application/json");

    int kodeHTTP = https.POST(json);

    Serial.print("Kode HTTP: ");
    Serial.println(kodeHTTP);

    if (kodeHTTP == 200 || kodeHTTP == 302) {
      Serial.println("Permintaan diterima Google Apps Script.");
      Serial.println("Periksa Google Sheets untuk memastikan data tersimpan.");
    } else if (kodeHTTP > 0) {
      Serial.print("Respons HTTP: ");
      Serial.println(kodeHTTP);
      Serial.println(https.getString());
    } else {
      Serial.print("Pengiriman gagal: ");
      Serial.println(https.errorToString(kodeHTTP));
    }

    https.end();
  } else {
    Serial.println("Gagal membuka koneksi HTTPS");
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH);

  pinMode(LED_HIJAU, OUTPUT);
  pinMode(LED_MERAH, OUTPUT);
  matikanLED();

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();

  SPI.begin(18, 19, 23, 5);
  rfid.PCD_Init();

  tampilkanPesan("Sistem Absensi", "Hubungkan Wi-Fi");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.println("Menghubungkan ke hotspot...");

  int percobaan = 0;
  while (WiFi.status() != WL_CONNECTED && percobaan < 40) {
    delay(500);
    Serial.print(".");
    percobaan++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("Wi-Fi terhubung");
    Serial.print("IP ESP32: ");
    Serial.println(WiFi.localIP());

    // Waktu Indonesia Barat (WIB, UTC+7)
    configTime(7 * 3600, 0,
               "pool.ntp.org", "time.nist.gov");

    tampilkanPesan("Wi-Fi Terhubung", "Memuat kartu...");
    delay(500);

    if (ambilKartuDariGoogleSheets()) {
      tampilkanPesan("Kartu berhasil", "dimuat");
    } else {
      tampilkanPesan("Gagal memuat", "daftar kartu");
    }

    delay(1500);
    tampilkanPesan("Sistem Absensi", "Tempelkan Kartu");
  } else {
    Serial.println();
    Serial.println("Wi-Fi gagal terhubung");
    tampilkanPesan("Wi-Fi Gagal", "Cek Hotspot");
  }

  Serial.println("SISTEM ABSENSI RFID SIAP");
  Serial.println("Nama: " + namaMahasiswa);

  Serial.println("UID: " + uidTerdaftar);

  delay(1500);
  tampilkanPesan("Sistem Absensi", "Tempelkan Kartu");
}

void loop() {

  if (millis() - waktuUpdateKartu >= INTERVAL_UPDATE_KARTU) {
    if (ambilKartuDariGoogleSheets()) {
      Serial.println("Daftar kartu berhasil diperbarui.");
    } else {
      Serial.println("Gagal memperbarui daftar kartu.");
    }

    waktuUpdateKartu = millis();
  }

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  String uid = "";

  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) uid += " ";
    uid += String(rfid.uid.uidByte[i]);
  }

  Serial.println("UID terbaca: " + uid);
  matikanLED();

  int indeksKartu = -1;

  for (int i = 0; i < jumlahKartu; i++) {
    if (uid == daftarKartu[i].uid) {
      indeksKartu = i;
      break;
    }
  }

  if (indeksKartu != -1) {
    if (statusAbsen[indeksKartu]) {
      tampilkanPesan(daftarKartu[indeksKartu].nama, "Sudah Absen");
      Serial.println("Status: SUDAH ABSEN");

      bunyi(2);

      unsigned long mulai = millis();

      while (millis() - mulai < 2500) {
        digitalWrite(LED_HIJAU, HIGH);
        delay(250);
        digitalWrite(LED_HIJAU, LOW);
        delay(250);
      }

      digitalWrite(LED_HIJAU, LOW);

    } else {
      statusAbsen[indeksKartu] = true;

      digitalWrite(LED_HIJAU, HIGH);
      tampilkanPesan(daftarKartu[indeksKartu].nama, "Absen Berhasil");

      Serial.println("Nama: " + daftarKartu[indeksKartu].nama);
      Serial.println("Status: ABSEN BERHASIL");

      bunyi(1);

      // Kirim hanya pada absensi pertama
      kirimAbsensi(uid, daftarKartu[indeksKartu].nama, "ABSEN BERHASIL");
    }

  } else {
    digitalWrite(LED_MERAH, HIGH);

    tampilkanPesan("Kartu Tidak Ada", "Di Data Absensi");
    Serial.println("Status: KARTU TIDAK TERDAFTAR");

    bunyi(3);
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(1500);

  matikanLED();
  tampilkanPesan("Sistem Absensi", "Tempelkan Kartu");
}

