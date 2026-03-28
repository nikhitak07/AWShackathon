"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// backend/src/handlers/parser.ts
var parser_exports = {};
__export(parser_exports, {
  ParseError: () => ParseError,
  formatChecklist: () => formatChecklist,
  parseChecklist: () => parseChecklist,
  parseHandler: () => parseHandler,
  parseText: () => parseText
});
module.exports = __toCommonJS(parser_exports);

// node_modules/uuid/dist/esm-node/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist/esm-node/rng.js
var import_node_crypto = __toESM(require("node:crypto"));
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    import_node_crypto.default.randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// node_modules/uuid/dist/esm-node/native.js
var import_node_crypto2 = __toESM(require("node:crypto"));
var native_default = {
  randomUUID: import_node_crypto2.default.randomUUID
};

// node_modules/uuid/dist/esm-node/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// backend/src/handlers/parser.ts
var ParseError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ParseError";
  }
};
var CATEGORY_KEYWORDS = {
  Medications: ["mg", "tablet", "capsule", "pill", "dose", "medication", "drug", "prescription", "take", "inject"],
  FollowUpAppointments: ["appointment", "follow", "visit", "doctor", "clinic", "schedule", "see your", "return", "check-up"],
  DietaryRestrictions: ["eat", "food", "diet", "drink", "avoid", "sodium", "sugar", "fat", "calorie", "fluid", "water"],
  WarningSigns: ["fever", "chest pain", "bleeding", "breathing", "swelling", "pain", "emergency", "call 911", "severe", "sudden"],
  DailyActivities: ["walk", "exercise", "rest", "sleep", "shower", "bathe", "lift", "activity", "drive", "work", "stairs"]
};
var HIGH_PRIORITY_KEYWORDS = [
  "fever",
  "chest pain",
  "difficulty breathing",
  "uncontrolled bleeding",
  "severe",
  "emergency",
  "call 911"
];
function categorize(text) {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return "DailyActivities";
}
function getPriority(text) {
  const lower = text.toLowerCase();
  return HIGH_PRIORITY_KEYWORDS.some((kw) => lower.includes(kw)) ? "High" : "Routine";
}
function extractDateTime(text) {
  const match = text.match(/\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/);
  return match?.[0];
}
function parseText(rawText, userId) {
  const lines = rawText.split(/\n|•|;/).map((l) => l.trim()).filter((l) => l.length > 5);
  if (lines.length === 0) {
    throw new ParseError(
      "No checklist items could be found. Please check the image quality and try again."
    );
  }
  const items = lines.map((line) => ({
    id: v4_default(),
    text: line,
    category: categorize(line),
    priority: getPriority(line),
    dateTime: extractDateTime(line),
    completed: false
  }));
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: v4_default(),
    userId,
    createdAt: now,
    updatedAt: now,
    items
  };
}
function formatChecklist(checklist) {
  return JSON.stringify(checklist);
}
function parseChecklist(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ParseError("Invalid checklist JSON.");
  }
  const c = parsed;
  if (!c.id || !c.userId || !Array.isArray(c.items)) {
    throw new ParseError("Checklist JSON is missing required fields.");
  }
  return c;
}
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json"
};
var parseHandler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid request body." }) };
  }
  const { rawText, userId } = body;
  if (!rawText || !userId) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "rawText and userId are required." }) };
  }
  try {
    const checklist = parseText(rawText, userId);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(checklist) };
  } catch (err) {
    const message = err instanceof ParseError ? err.message : "Failed to generate checklist.";
    return { statusCode: 422, headers: CORS_HEADERS, body: JSON.stringify({ error: message }) };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ParseError,
  formatChecklist,
  parseChecklist,
  parseHandler,
  parseText
});
