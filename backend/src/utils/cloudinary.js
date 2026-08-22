"use strict";

const crypto = require("crypto");

const CLOUD_NAME = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
const API_KEY = String(process.env.CLOUDINARY_API_KEY || "").trim();
const API_SECRET = String(process.env.CLOUDINARY_API_SECRET || "").trim();

function isConfigured() {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

function assertConfigured() {
  if (!isConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
  }
}

function signParams(params) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${serialized}${API_SECRET}`)
    .digest("hex");
}

async function parseCloudinaryResponse(response, action) {
  const text = await response.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message = payload?.error?.message || `Cloudinary ${action} failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.cloudinary = payload;
    throw error;
  }

  return payload;
}

/**
 * Upload a small image buffer to Cloudinary using a signed server-side upload.
 * The API secret never leaves the backend.
 */
async function uploadImageBuffer(buffer, { publicId, folder = "fitlip/profiles", contentType = "image/jpeg" } = {}) {
  assertConfigured();

  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error("A non-empty image buffer is required");
  }

const timestamp = Math.floor(Date.now() / 1000);
const finalPublicId = publicId || `${folder}/${crypto.randomUUID()}`;

const paramsToSign = {
  folder,
  public_id: finalPublicId,
  timestamp,
  overwrite: true,
};

const form = new FormData();

form.append(
  "file",
  `data:${contentType};base64,${buffer.toString("base64")}`
);
form.append("api_key", API_KEY);
form.append("timestamp", String(timestamp));
form.append("signature", signParams(paramsToSign));
form.append("folder", folder);
form.append("public_id", finalPublicId);
form.append("overwrite", "true");

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUD_NAME)}/image/upload`;
  const response = await fetch(endpoint, { method: "POST", body: form });
  return parseCloudinaryResponse(response, "upload");
}

async function destroyImage(publicId) {
  if (!publicId || !isConfigured()) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    public_id: publicId,
    timestamp,
  };

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("timestamp", String(timestamp));
  form.append("api_key", API_KEY);
  form.append("signature", signParams(paramsToSign));
  form.append("invalidate", "true");

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUD_NAME)}/image/destroy`;
  const response = await fetch(endpoint, { method: "POST", body: form });
  return parseCloudinaryResponse(response, "delete");
}

module.exports = {
  isConfigured,
  uploadImageBuffer,
  destroyImage,
};
