// Photo uploads. Images are checked, saved under storage/photos/YYYY/MM/, and
// served publicly from /uploads/... (reports and their photos are public).

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { config } from "./config.js";
import { HttpError } from "./auth.js";

export const photosDir = path.join(config.storageDir, "photos");
export const photoUrlPrefix = "/uploads/";

// Accepts multipart/form-data with up to five files per field.
export function photoUpload(fields) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.maxPhotoBytes,
      files: fields.length * config.maxPhotosPerSet,
      fields: 20,
      fieldSize: 20000,
    },
  }).fields(
    fields.map(function (name) {
      return { name: name, maxCount: config.maxPhotosPerSet };
    }),
  );
}

// Identifies the image from its first bytes rather than trusting the name.
function imageType(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: ".jpg", mime: "image/jpeg" };
  }
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: ".png", mime: "image/png" };
  }
  if (buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { ext: ".webp", mime: "image/webp" };
  }
  return null;
}

function cleanName(name, fallback) {
  const base = path.basename(String(name || "")).replace(/[^\w.\- ()]+/g, "_").trim();
  return (base || fallback).slice(0, 160);
}

// Checks every uploaded file before anything is saved.
export function checkPhotos(files) {
  return (files || []).map(function (file, index) {
    const type = imageType(file.buffer);
    if (!type) {
      throw new HttpError(400, cleanName(file.originalname, "A file") + " isn't a JPEG, PNG, or WebP photo.");
    }
    return {
      buffer: file.buffer,
      name: cleanName(file.originalname, "photo-" + (index + 1) + type.ext),
      ext: type.ext,
      mime: type.mime,
      size: file.size,
    };
  });
}

// Writes checked photos to storage; returns their paths (relative to
// storage/photos) for the database.
export async function savePhotos(photos, prefix) {
  const now = new Date();
  const folder = String(now.getUTCFullYear()) + "/" + String(now.getUTCMonth() + 1).padStart(2, "0");
  await fs.mkdir(path.join(photosDir, folder), { recursive: true });
  const saved = [];
  try {
    for (const photo of photos) {
      const relative = folder + "/" + prefix + "-" + crypto.randomBytes(8).toString("hex") + photo.ext;
      await fs.writeFile(path.join(photosDir, relative), photo.buffer, { flag: "wx" });
      saved.push(Object.assign({}, photo, { filePath: relative }));
    }
  } catch (error) {
    await removePhotoFiles(saved);
    throw error;
  }
  return saved;
}

export async function removePhotoFiles(photos) {
  await Promise.all(
    photos.map(function (photo) {
      const relative = photo.filePath || photo.file_path;
      return relative ? fs.rm(path.join(photosDir, relative), { force: true }).catch(function () {}) : null;
    }),
  );
}

export function photoUrl(filePath) {
  return photoUrlPrefix + filePath;
}
