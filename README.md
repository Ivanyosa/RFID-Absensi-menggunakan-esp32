# RFID Attendance System using ESP32

An RFID-based attendance system built with ESP32 and RC522. The system uses Google Apps Script as a backend to manage registered RFID cards and process attendance data.

## Overview

This project provides an RFID attendance system with a web-based administration panel. ESP32 reads RFID cards and communicates with Google Apps Script to retrieve registered card information and submit attendance records.

The administration panel allows authorized administrators to add, view, and remove registered RFID cards.

## Features

- RFID card identification using RC522.
- ESP32-based attendance processing.
- Automatic synchronization of registered cards.
- Web-based administration panel.
- Add and remove registered RFID cards.
- Attendance records organized by date.
- LCD display for attendance status.
- LED and buzzer feedback.
- Server-side validation of attendance requests.
- Prevention of duplicate attendance submissions.

## Hardware Requirements

- ESP32 Development Board
- RC522 RFID Reader
- RFID Card or Keychain
- LCD I2C 16x2
- Active Buzzer
- Green LED
- Red LED
- Breadboard
- Jumper Wires

## Pin Configuration

| Component | ESP32 Pin |
|---|---|
| RC522 SDA / SS | GPIO 5 |
| RC522 RST | GPIO 27 |
| RC522 SCK | GPIO 18 |
| RC522 MISO | GPIO 19 |
| RC522 MOSI | GPIO 23 |
| LCD SDA | GPIO 21 |
| LCD SCL | GPIO 22 |
| Buzzer | GPIO 33 |
| Green LED | GPIO 25 |
| Red LED | GPIO 26 |

## Software Requirements

- Arduino IDE
- ESP32 Board Package
- MFRC522 Library
- ArduinoJson Library
- LiquidCrystal I2C Library
- Google Apps Script
- Google Sheets

## Project Structure

```text
RFID-Absensi-menggunakan-esp32/
│
├── arduino/
│   └── absensi.ino
│
├── google-apps-script/
│   ├── Code.gs
│   └── Index.html
│
└── README.md
```

## System Workflow

1. ESP32 connects to a Wi-Fi network.
2. ESP32 retrieves registered RFID card information from the backend.
3. A user scans an RFID card.
4. ESP32 checks whether the card UID exists in its registered card list.
5. If registered, ESP32 submits the attendance data to Google Apps Script.
6. The backend validates the API Token, UID, attendance status, and timestamp.
7. The backend checks the registered card list and prevents duplicate attendance.
8. Valid attendance data is processed by the backend.

## Backend Configuration

The Google Apps Script backend uses Script Properties to store sensitive configuration values.

The following properties are required:

| Property | Description |
|---|---|
| `ADMIN_PIN` | Administrator authentication PIN |
| `API_TOKEN` | Token used to authenticate ESP32 requests |
| `SPREADSHEET_ID` | Spreadsheet identifier |

Sensitive configuration values should not be hardcoded into publicly accessible source files.

The RFID card registration sheet uses the following columns:

| Column | Description |
|---|---|
| A | RFID UID |
| B | Cardholder Name |

## Arduino Configuration

Before uploading the firmware, configure the following values in `absensi.ino`:

```cpp
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

const char* scriptURL = "YOUR_APPS_SCRIPT_WEB_APP_URL";
const char* tokenRahasia = "YOUR_API_TOKEN";
```

Use placeholder values in the public repository. Never commit actual Wi-Fi credentials, API Tokens, or private deployment information.

## Security Considerations

Security is an important consideration in this project.

The backend implements several basic security measures:

- Administrator PIN verification is performed on the server side.
- API Token validation is used to authenticate ESP32 requests.
- Submitted RFID UIDs are checked against registered cards.
- Cardholder names are retrieved from the registered card list rather than trusted from the ESP32 request.
- Invalid attendance statuses and malformed timestamps are rejected.
- Duplicate attendance submissions are prevented on the server side.
- Script Properties are used to store backend configuration values separately from the source code.

### Known Security Limitations

This project is intended as an educational prototype and should not be considered a fully hardened production security system.

The following limitations remain:

- API Tokens embedded in ESP32 firmware can potentially be extracted.
- HTTPS certificate verification is disabled in the current ESP32 implementation.
- The GET endpoint currently sends its API Token through a URL query parameter.
- The administrator authentication does not currently implement rate limiting or account lockout.
- ESP32 attendance timestamps are supplied by the device and are not independently verified against server time.
- The ESP32 currently checks the HTTP status code but does not fully validate the backend JSON response.

These limitations should be considered before using the system with real personal information or in a production environment.

## Important Notes for GitHub

Before publishing this project:

- Replace all Wi-Fi credentials with placeholders.
- Never upload actual API Tokens or administrator PINs.
- Never publish private Spreadsheet IDs or deployment information.
- Do not include real student names, RFID UIDs, or attendance records.
- Use sample or fictional data when demonstrating the project.
- Keep private configuration values outside the public repository.
- Rotate any credentials or tokens accidentally exposed in a public commit.

Removing a secret from the latest version of a file does not remove it from Git history. Exposed credentials should be replaced, not merely deleted from the current source.

## Disclaimer

This project was developed for educational and learning purposes to demonstrate RFID-based attendance processing, ESP32 communication, and backend integration using Google Apps Script.

It is not intended to be used as a production-grade attendance or authentication system without additional security improvements.
