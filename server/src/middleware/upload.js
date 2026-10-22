import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import env from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

const uploadRoot = path.isAbsolute(env.uploadDir)
  ? env.uploadDir
  : path.join(process.cwd(), env.uploadDir);
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadRoot),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, safe);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(file.mimetype)) {
    return cb(ApiError.badRequest('Only PNG, JPG, WEBP or SVG images are allowed', 'INVALID_FILE_TYPE'));
  }
  return cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.maxUploadBytes },
});

export const uploadDir = uploadRoot;
export default upload;
