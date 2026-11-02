// Photo uploads. Images are checked, saved under storage/photos/YYYY/MM/ (or,
// with PHOTO_STORAGE=database, in the photo_data table), and served publicly
// from /uploads/... (reports and their photos are public).

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { config } from "./config.js";
import { HttpError } from "./auth.js";
import { one } from "./db.js";

export const photosDir = path.join(config.storageDir, "photos");
export const photoUrlPrefix = "/uploads/";
const inDatabase = config.photoStorage === "database";

// Accepts multipart/form-data with photo fields given by name (up to five
// files each) or as { name, maxCount }.
export function photoUpload(fields) {
  const specs = fields.map(function (field) {
    return typeof field === "string" ? { name: field, maxCount: config.maxPhotosPerSet } : field;
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.maxPhotoBytes,
      files: specs.reduce(function (total, spec) {
        return total + spec.maxCount;
      }, 0),
      fields: 20,
      fieldSize: 20000,
    },
  }).fields(specs);
  // Too many photos in a field: say how many that field allows. (Too many in
  // all names no field; with a single field, that's the one.)
  return function (request, response, next) {
    upload(request, response, function (error) {
      if (error instanceof multer.MulterError && (error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT")) {
        const spec =
          specs.find(function (item) {
            return item.name === error.field;
          }) || (specs.length === 1 ? specs[0] : null);
        if (spec) {
          next(new HttpError(400, "Choose no more than " + spec.maxCount + " photos."));
          return;
        }
      }
      next(error);
    });
  };
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
// storage/photos, and the address under /uploads/) for the database. With
// PHOTO_STORAGE=database nothing is written yet: storePhotoData saves the
// bytes together with each photo's row.
export async function savePhotos(photos, prefix) {
  const now = new Date();
  const folder = String(now.getUTCFullYear()) + "/" + String(now.getUTCMonth() + 1).padStart(2, "0");
  const newPath = function (photo) {
    return folder + "/" + prefix + "-" + crypto.randomBytes(8).toString("hex") + photo.ext;
  };
  if (inDatabase) {
    return photos.map(function (photo) {
      return Object.assign({}, photo, { filePath: newPath(photo) });
    });
  }
  await fs.mkdir(path.join(photosDir, folder), { recursive: true });
  const saved = [];
  try {
    for (const photo of photos) {
      const relative = newPath(photo);
      await fs.writeFile(path.join(photosDir, relative), photo.buffer, { flag: "wx" });
      saved.push(Object.assign({}, photo, { filePath: relative }));
    }
  } catch (error) {
    await removePhotoFiles(saved);
    throw error;
  }
  return saved;
}

// Saves a photo's bytes in MySQL (PHOTO_STORAGE=database), in the same
// transaction as its photos row. Does nothing when photos are files on disk.
export async function storePhotoData(connection, photoId, photo) {
  if (!inDatabase || !photo.filePath) {
    return;
  }
  await connection.query("INSERT INTO photo_data (photo_id, file_path, mime_type, data) VALUES (?, ?, ?, ?)", [
    photoId,
    photo.filePath,
    photo.mime,
    photo.buffer,
  ]);
}

// A photo kept in MySQL, by its path under /uploads/, or null.
export async function photoFromDatabase(filePath) {
  if (!inDatabase) {
    return null;
  }
  return one("SELECT mime_type, data FROM photo_data WHERE file_path = ?", [filePath]);
}

export async function removePhotoFiles(photos) {
  // Photos in MySQL are removed with their rows (or never saved when a
  // transaction fails).
  if (inDatabase) {
    return;
  }
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
