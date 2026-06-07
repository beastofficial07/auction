/**
 * Image upload utility
 * - If CLOUDINARY_CLOUD_NAME is set → uploads go to Cloudinary (permanent, CDN-served)
 * - Otherwise → falls back to local disk storage (ephemeral on Railway, fine for dev)
 *
 * getImageUrl() always returns a usable URL string or null.
 */

'use strict';

const isCloudinaryConfigured = () => !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const getMulterStorage = (multer, uploadPath) => {
  if (isCloudinaryConfigured()) {
    try {
      const cloudinary = require('cloudinary').v2;
      const { CloudinaryStorage } = require('multer-storage-cloudinary');

      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      console.log('☁️  Using Cloudinary storage (cloud_name:', process.env.CLOUDINARY_CLOUD_NAME, ')');

      return new CloudinaryStorage({
        cloudinary,
        params: {
          folder:          'beast-cricket',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
          transformation:  [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
        },
      });
    } catch (e) {
      console.warn('⚠️  Cloudinary packages not installed, falling back to local storage:', e.message);
    }
  }

  // Fallback: local disk
  console.log('💾 Using local disk storage for uploads:', uploadPath);
  const multerLib = require('multer');
  return multerLib.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename:    (req, file, cb) => {
      const ext  = require('path').extname(file.originalname).toLowerCase();
      const name = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
      cb(null, name);
    },
  });
};

/**
 * Resolve the public-facing URL for an uploaded file.
 * - Cloudinary: file.path is already a full https:// URL
 * - Local disk : build a /uploads/<filename> path
 * Returns null if no file was uploaded.
 */
const getImageUrl = (file) => {
  if (!file) return null;

  // Cloudinary storage sets file.path to the full CDN URL
  if (file.path && file.path.startsWith('http')) {
    console.log('☁️  Cloudinary URL:', file.path);
    return file.path;
  }

  // Local disk storage — file.filename is the saved filename
  if (file.filename) {
    const url = `/uploads/${file.filename}`;
    console.log('💾 Local storage URL:', url);
    return url;
  }

  // Fallback: try file.path as a relative path
  if (file.path) {
    const pathLib = require('path');
    const filename = pathLib.basename(file.path);
    const url = `/uploads/${filename}`;
    console.log('💾 Local storage URL (from path):', url);
    return url;
  }

  console.warn('⚠️  Could not determine image URL from file object:', JSON.stringify(file));
  return null;
};

module.exports = { isCloudinaryConfigured, getMulterStorage, getImageUrl };
