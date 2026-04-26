/**
 * TC Plants — IoT Node Firmware
 * Supports: ESP32 and ESP8266 (select board in Arduino IDE)
 *
 * Compile & flash via Arduino IDE, then deploy the .bin to:
 *   firmware/esp32/latest.bin   (ESP32)
 *   firmware/esp8266/latest.bin (ESP8266)
 *
 * Initial WiFi config can be written over USB serial from the browser flasher,
 * or set WIFI_SSID / WIFI_PASS / WORKER_URL / DEVICE_ID below before compiling.
 *
 * Library dependencies (install via Arduino Library Manager):
 *   - ArduinoJson  (Benoit Blanchon) >= 6.21
 *   - DHT sensor library (Adafruit)  — if using DHT11/22
 *   - OneWire + DallasTemperature    — if using DS18B20
 *   - HTTPClient                     — bundled with ESP32/8266 boards package
 *   - EEPROM                         — bundled
 */

// ── Platform detection ────────────────────────────────────────────────────────
#if defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <Preferences.h>
  Preferences prefs;
  #define PLATFORM "esp32"
#else
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <EEPROM.h>
  #define PLATFORM "esp8266"
#endif

#include <ArduinoJson.h>
#include <Arduino.h>

// ── Default config (overridden by stored/serial config) ───────────────────────
#ifndef WIFI_SSID
  #define WIFI_SSID ""
#endif
#ifndef WIFI_PASS
  #define WIFI_PASS ""
#endif
#ifndef WORKER_URL
  #define WORKER_URL "https://your-worker.workers.dev"
#endif
#ifndef IOT_KEY
  #define IOT_KEY ""
#endif
#ifndef DEVICE_NAME
  #define DEVICE_NAME "TC Plants Node"
#endif
#ifndef DEVICE_LOCATION
  #define DEVICE_LOCATION "greenhouse"
#endif

// ── Runtime config (loaded from EEPROM/Preferences) ──────────────────────────
struct Config {
  char ssid[64];
  char pass[64];
  char workerUrl[128];
  char deviceId[48];
  char name[64];
  char location[32];
  char iotKey[64];
};
Config cfg;

// ── Pin descriptor (loaded from server after registration) ───────────────────
struct PinDesc {
  char id[32];
  char label[48];
  char type[16];   // output, relay, input, analog, dht, ds18b20, pwm
  int  gpioPin;
  char unit[16];
  float currentValue;
};
#define MAX_PINS 16
PinDesc pins[MAX_PINS];
int pinCount = 0;

// ── Heartbeat & command polling ───────────────────────────────────────────────
unsigned long lastHeartbeat     = 0;
unsigned long lastCmdPoll       = 0;
const unsigned long HB_INTERVAL = 30000;   // send sensor data every 30s
const unsigned long CMD_INTERVAL = 5000;   // poll for new commands every 5s

// ── Serial config input state ─────────────────────────────────────────────────
String serialBuf = "";
bool   inConfigMode = false;

// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n[TCPlants IoT] Booting…");

  loadConfig();
  connectWiFi();

  if (strlen(cfg.deviceId) == 0) {
    registerDevice();
  } else {
    Serial.print("[IoT] Device ID: ");
    Serial.println(cfg.deviceId);
  }
  fetchPinConfig();
  setupPins();
}

// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  // Check for serial config input from browser flasher
  handleSerialConfig();

  unsigned long now = millis();

  // Heartbeat: send readings + receive pending commands
  if (now - lastHeartbeat >= HB_INTERVAL) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // Fast command poll when device is online
  if (now - lastCmdPoll >= CMD_INTERVAL) {
    lastCmdPoll = now;
    pollCommands();
  }
}

// ── Config persistence ────────────────────────────────────────────────────────
void loadConfig() {
#if defined(ESP32)
  prefs.begin("tcplants", false);
  String s = prefs.getString("cfg", "");
  prefs.end();
  if (s.length() > 10) {
    StaticJsonDocument<512> doc;
    if (!deserializeJson(doc, s)) {
      strlcpy(cfg.ssid,      doc["ssid"]      | WIFI_SSID,     sizeof(cfg.ssid));
      strlcpy(cfg.pass,      doc["pass"]      | WIFI_PASS,     sizeof(cfg.pass));
      strlcpy(cfg.workerUrl, doc["worker_url"]| WORKER_URL,    sizeof(cfg.workerUrl));
      strlcpy(cfg.deviceId,  doc["device_id"] | "",            sizeof(cfg.deviceId));
      strlcpy(cfg.name,      doc["name"]      | DEVICE_NAME,   sizeof(cfg.name));
      strlcpy(cfg.location,  doc["location"]  | DEVICE_LOCATION, sizeof(cfg.location));
      strlcpy(cfg.iotKey,    doc["iot_key"]   | IOT_KEY,       sizeof(cfg.iotKey));
      return;
    }
  }
#else
  EEPROM.begin(512);
  uint8_t magic = EEPROM.read(0);
  if (magic == 0xAB) {
    char buf[480];
    for (int i=0; i<479; i++) buf[i] = EEPROM.read(i+1);
    buf[479]=0;
    StaticJsonDocument<512> doc;
    if (!deserializeJson(doc, buf)) {
      strlcpy(cfg.ssid,      doc["ssid"]       | WIFI_SSID,     sizeof(cfg.ssid));
      strlcpy(cfg.pass,      doc["pass"]       | WIFI_PASS,     sizeof(cfg.pass));
      strlcpy(cfg.workerUrl, doc["worker_url"] | WORKER_URL,    sizeof(cfg.workerUrl));
      strlcpy(cfg.deviceId,  doc["device_id"]  | "",            sizeof(cfg.deviceId));
      strlcpy(cfg.name,      doc["name"]       | DEVICE_NAME,   sizeof(cfg.name));
      strlcpy(cfg.location,  doc["location"]   | DEVICE_LOCATION, sizeof(cfg.location));
      strlcpy(cfg.iotKey,    doc["iot_key"]    | IOT_KEY,       sizeof(cfg.iotKey));
      EEPROM.end();
      return;
    }
  }
  EEPROM.end();
#endif
  // Defaults
  strlcpy(cfg.ssid,      WIFI_SSID,     sizeof(cfg.ssid));
  strlcpy(cfg.pass,      WIFI_PASS,     sizeof(cfg.pass));
  strlcpy(cfg.workerUrl, WORKER_URL,    sizeof(cfg.workerUrl));
  strlcpy(cfg.deviceId,  "",            sizeof(cfg.deviceId));
  strlcpy(cfg.name,      DEVICE_NAME,   sizeof(cfg.name));
  strlcpy(cfg.location,  DEVICE_LOCATION, sizeof(cfg.location));
  strlcpy(cfg.iotKey,    IOT_KEY,       sizeof(cfg.iotKey));
}

void saveConfig() {
  StaticJsonDocument<512> doc;
  doc["ssid"]       = cfg.ssid;
  doc["pass"]       = cfg.pass;
  doc["worker_url"] = cfg.workerUrl;
  doc["device_id"]  = cfg.deviceId;
  doc["name"]       = cfg.name;
  doc["location"]   = cfg.location;
  doc["iot_key"]    = cfg.iotKey;
  String s;
  serializeJson(doc, s);
#if defined(ESP32)
  prefs.begin("tcplants", false);
  prefs.putString("cfg", s);
  prefs.end();
#else
  EEPROM.begin(512);
  EEPROM.write(0, 0xAB);
  for (int i=0; i<(int)s.length() && i<479; i++) EEPROM.write(i+1, s[i]);
  EEPROM.commit();
  EEPROM.end();
#endif
  Serial.println("[IoT] Config saved.");
}

// ── Serial config from browser flasher ───────────────────────────────────────
void handleSerialConfig() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == 0x01) { inConfigMode = true; serialBuf = ""; continue; }  // SOH
    if (c == 0x04 && inConfigMode) {                                     // EOT
      inConfigMode = false;
      if (serialBuf.startsWith("CFG:")) {
        String json = serialBuf.substring(4);
        StaticJsonDocument<512> doc;
        if (!deserializeJson(doc, json)) {
          strlcpy(cfg.ssid,      doc["ssid"]       | cfg.ssid,     sizeof(cfg.ssid));
          strlcpy(cfg.pass,      doc["pass"]       | cfg.pass,     sizeof(cfg.pass));
          strlcpy(cfg.workerUrl, doc["worker_url"] | cfg.workerUrl, sizeof(cfg.workerUrl));
          strlcpy(cfg.name,      doc["name"]       | cfg.name,     sizeof(cfg.name));
          strlcpy(cfg.location,  doc["location"]   | cfg.location, sizeof(cfg.location));
          // Clear device ID so it re-registers with new name
          cfg.deviceId[0] = 0;
          saveConfig();
          Serial.println("[IoT] Config updated. Rebooting…");
          delay(500);
          ESP.restart();
        }
      }
      serialBuf = "";
      continue;
    }
    if (inConfigMode) serialBuf += c;
  }
}

// ── WiFi ──────────────────────────────────────────────────────────────────────
void connectWiFi() {
  if (strlen(cfg.ssid) == 0) {
    Serial.println("[IoT] No WiFi config. Waiting for serial config…");
    return;
  }
  Serial.print("[IoT] Connecting to WiFi: ");
  Serial.print(cfg.ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(cfg.ssid, cfg.pass);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis()-t < 15000) {
    delay(250); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[IoT] WiFi connected. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[IoT] WiFi failed. Will retry on next loop.");
  }
}

bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.println("[IoT] WiFi lost. Reconnecting…");
  WiFi.reconnect();
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis()-t < 8000) delay(200);
  return WiFi.status() == WL_CONNECTED;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
String httpPost(const char* path, const String& body) {
  if (!ensureWiFi()) return "";
  String url = String(cfg.workerUrl) + path;
  HTTPClient http;
#if defined(ESP32)
  http.begin(url);
#else
  WiFiClient client;
  http.begin(client, url);
#endif
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", cfg.iotKey);
  int code = http.POST(body);
  String resp = (code > 0) ? http.getString() : "";
  http.end();
  return resp;
}

String httpGet(const char* path) {
  if (!ensureWiFi()) return "";
  String url = String(cfg.workerUrl) + path;
  HTTPClient http;
#if defined(ESP32)
  http.begin(url);
#else
  WiFiClient client;
  http.begin(client, url);
#endif
  http.addHeader("X-Device-Key", cfg.iotKey);
  int code = http.GET();
  String resp = (code > 0) ? http.getString() : "";
  http.end();
  return resp;
}

// ── Device registration ───────────────────────────────────────────────────────
void registerDevice() {
  Serial.println("[IoT] Registering device…");
  StaticJsonDocument<512> doc;
  doc["name"]     = cfg.name;
  doc["location"] = cfg.location;
  doc["chip"]     = PLATFORM;
  String body;
  serializeJson(doc, body);
  String resp = httpPost("/api/iot/register", body);
  if (resp.length()) {
    StaticJsonDocument<256> res;
    if (!deserializeJson(res, resp) && res.containsKey("id")) {
      strlcpy(cfg.deviceId, res["id"], sizeof(cfg.deviceId));
      saveConfig();
      Serial.print("[IoT] Registered with ID: ");
      Serial.println(cfg.deviceId);
    } else {
      Serial.println("[IoT] Registration failed: " + resp);
    }
  }
}

// ── Fetch pin config from server ──────────────────────────────────────────────
void fetchPinConfig() {
  if (strlen(cfg.deviceId) == 0) return;
  String path = String("/api/iot/devices?id=") + cfg.deviceId;
  // Use /api/iot/devices list and find our device
  String resp = httpGet("/api/iot/devices");
  if (!resp.length()) return;
  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, resp)) return;
  JsonArray devs = doc["devices"].as<JsonArray>();
  for (JsonObject d : devs) {
    if (strcmp(d["id"], cfg.deviceId) != 0) continue;
    JsonArray pArr = d["pins"].as<JsonArray>();
    pinCount = 0;
    for (JsonObject p : pArr) {
      if (pinCount >= MAX_PINS) break;
      strlcpy(pins[pinCount].id,      p["id"]       | "?", sizeof(pins[0].id));
      strlcpy(pins[pinCount].label,   p["label"]    | "?", sizeof(pins[0].label));
      strlcpy(pins[pinCount].type,    p["type"]     | "output", sizeof(pins[0].type));
      strlcpy(pins[pinCount].unit,    p["unit"]     | "", sizeof(pins[0].unit));
      pins[pinCount].gpioPin    = p["gpio_pin"] | -1;
      pins[pinCount].currentValue = 0;
      pinCount++;
    }
    Serial.printf("[IoT] Loaded %d pins\n", pinCount);
    break;
  }
}

// ── Setup GPIO from pin descriptors ──────────────────────────────────────────
void setupPins() {
  for (int i=0; i<pinCount; i++) {
    int gpio = pins[i].gpioPin;
    if (gpio < 0) continue;
    const char* type = pins[i].type;
    if (strcmp(type,"output")==0 || strcmp(type,"relay")==0 || strcmp(type,"pwm")==0) {
      pinMode(gpio, OUTPUT);
      digitalWrite(gpio, LOW);
    } else if (strcmp(type,"input")==0) {
      pinMode(gpio, INPUT_PULLUP);
    }
    // analog, dht, ds18b20 handled per-read
  }
}

// ── Read sensor value for a pin ───────────────────────────────────────────────
float readPin(PinDesc& p) {
  int gpio = p.gpioPin;
  if (gpio < 0) return -999;
  if (strcmp(p.type,"input")==0) return digitalRead(gpio) ? 1.0 : 0.0;
  if (strcmp(p.type,"analog")==0) {
#if defined(ESP32)
    return analogRead(gpio);
#else
    return analogRead(A0);
#endif
  }
  if (strcmp(p.type,"output")==0 || strcmp(p.type,"relay")==0) {
    return digitalRead(gpio) ? 1.0 : 0.0;
  }
  // DHT and DS18B20 require additional libraries — stub returns cached value
  return p.currentValue;
}

// ── Heartbeat: send all sensor readings ──────────────────────────────────────
void sendHeartbeat() {
  if (strlen(cfg.deviceId) == 0) { registerDevice(); return; }
  DynamicJsonDocument doc(2048);
  doc["device_id"] = cfg.deviceId;
  doc["ip"]        = WiFi.localIP().toString();
  JsonArray readings   = doc.createNestedArray("readings");
  JsonObject pinStates = doc.createNestedObject("pin_states");
  String now = ""; // server fills ts from its clock
  for (int i=0; i<pinCount; i++) {
    float val = readPin(pins[i]);
    pins[i].currentValue = val;
    bool isSensor = (strcmp(pins[i].type,"input")==0 || strcmp(pins[i].type,"analog")==0 ||
                     strcmp(pins[i].type,"dht")==0   || strcmp(pins[i].type,"ds18b20")==0);
    bool isOutput = (strcmp(pins[i].type,"output")==0 || strcmp(pins[i].type,"relay")==0 ||
                     strcmp(pins[i].type,"pwm")==0);
    if (isSensor && pins[i].gpioPin >= 0) {
      JsonObject r = readings.createNestedObject();
      r["pin_id"] = pins[i].id;
      r["value"]  = val;
    }
    if (isOutput) {
      pinStates[pins[i].id] = val;
    }
  }
  String body;
  serializeJson(doc, body);
  String resp = httpPost("/api/iot/heartbeat", body);
  if (!resp.length()) return;
  // Process any commands returned in heartbeat response
  DynamicJsonDocument res(2048);
  if (!deserializeJson(res, resp)) {
    executeCommands(res["commands"].as<JsonArray>());
  }
}

// ── Poll for pending commands ─────────────────────────────────────────────────
void pollCommands() {
  if (strlen(cfg.deviceId) == 0) return;
  String path = String("/api/iot/cmd/") + cfg.deviceId;
  String resp = httpGet(path.c_str());
  if (!resp.length()) return;
  DynamicJsonDocument doc(1024);
  if (!deserializeJson(doc, resp)) {
    executeCommands(doc["commands"].as<JsonArray>());
  }
}

// ── Execute a batch of commands ───────────────────────────────────────────────
void executeCommands(JsonArray cmds) {
  for (JsonObject cmd : cmds) {
    const char* cmdId  = cmd["id"];
    const char* pinId  = cmd["pin_id"];
    const char* action = cmd["action"];
    if (!cmdId || !pinId || !action) continue;
    Serial.printf("[IoT] CMD %s: pin=%s action=%s\n", cmdId, pinId, action);
    bool success = false;
    float readback = -1;
    for (int i=0; i<pinCount; i++) {
      if (strcmp(pins[i].id, pinId) != 0) continue;
      int gpio = pins[i].gpioPin;
      if (gpio < 0) break;
      if (strcmp(action,"on")==0 || strcmp(action,"1")==0) {
        digitalWrite(gpio, HIGH); pins[i].currentValue=1; readback=1; success=true;
      } else if (strcmp(action,"off")==0 || strcmp(action,"0")==0) {
        digitalWrite(gpio, LOW);  pins[i].currentValue=0; readback=0; success=true;
      } else if (strcmp(action,"pulse")==0) {
        digitalWrite(gpio, HIGH); delay(500); digitalWrite(gpio, LOW);
        pins[i].currentValue=0; readback=0; success=true;
      } else if (strcmp(action,"toggle")==0) {
        bool cur = digitalRead(gpio);
        digitalWrite(gpio, !cur); pins[i].currentValue=!cur; readback=!cur; success=true;
      }
      break;
    }
    // Confirm execution
    confirmCommand(cmdId, success, readback);
  }
}

// ── Confirm command execution back to server ──────────────────────────────────
void confirmCommand(const char* cmdId, bool success, float readback) {
  StaticJsonDocument<128> doc;
  doc["success"]       = success;
  if (readback >= 0) doc["gpio_readback"] = readback;
  String body;
  serializeJson(doc, body);
  String path = String("/api/iot/confirm/") + cmdId;
  httpPost(path.c_str(), body);
}
