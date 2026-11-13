# Sistem Absensi RFID Berbasis ESP32

## Deskripsi
Sistem Absensi RFID merupakan project Internet of Things (IoT) yang menggunakan ESP32 dan modul RFID RC522 untuk melakukan pencatatan kehadiran secara otomatis.

Sistem ini terintegrasi dengan Google Sheets sebagai media penyimpanan data absensi melalui koneksi Wi-Fi dan Google Apps Script.

## Teknologi dan Komponen
- ESP32 DevKit
- RFID RC522
- LCD I2C 16x2
- LED Hijau
- LED Merah
- Buzzer
- Google Sheets
- Google Apps Script
- Arduino IDE

## Fitur
- Membaca UID kartu RFID.
- Memeriksa kartu yang sudah terdaftar.
- Mendeteksi absensi ganda selama perangkat aktif.
- Menampilkan informasi melalui LCD.
- Indikator keberhasilan menggunakan LED dan buzzer.
- Mencatat waktu kehadiran secara otomatis.
- Menyimpan data absensi ke Google Sheets.
- Memperbarui daftar kartu secara otomatis dari Google Sheets.

## Struktur Repository
- `arduino/` : Program ESP32.
- `google-apps-script/` : Script integrasi Google Sheets.
- `docs/` : Dokumentasi dan foto rangkaian.
- `web/` : Source code halaman pengelolaan kartu (jika tersedia).

## Cara Penggunaan
1. Siapkan seluruh komponen sesuai dokumentasi rangkaian.
2. Buka program Arduino menggunakan Arduino IDE.
3. Sesuaikan konfigurasi Wi-Fi dan Google Apps Script.
4. Upload program ke ESP32.
5. Hubungkan ESP32 ke hotspot Wi-Fi.
6. Tempelkan kartu RFID pada modul RC522.
7. Periksa hasil pencatatan kehadiran pada Google Sheets.

## Tujuan Project
Project ini dibuat untuk menerapkan teknologi Internet of Things (IoT) dalam sistem pencatatan kehadiran yang lebih praktis, otomatis, dan terintegrasi secara online.
