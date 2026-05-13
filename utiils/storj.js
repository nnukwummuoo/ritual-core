/**
 * Storj Storage Helper (buffers + optional media processing)
 * Replaces Appwrite functionality with Storj S3-compatible storage
 */

const AWS = require('aws-sdk');
const axios = require('axios');
const { processVideo, compressImage } = require("./compress");

// -----------------------------
// Configuration (env required)
// -----------------------------

// Try to load dotenv if not already loaded
if (!process.env.STORJ_ACCESS_KEY_ID) {
  try {
    console.log('[Storj Debug] Attempting to load dotenv...');
    const result = require('dotenv').config();
    console.log('[Storj Debug] Dotenv result:', result);
  } catch (e) {
    console.log('[Storj Debug] Dotenv error:', e.message);
  }
}

const STORJ_ACCESS_KEY_ID = process.env.STORJ_ACCESS_KEY_ID;
const STORJ_SECRET_ACCESS_KEY = process.env.STORJ_SECRET_ACCESS_KEY;
const STORJ_ENDPOINT = process.env.STORJ_ENDPOINT;
const STORJ_BUCKET_DEFAULT = process.env.STORJ_BUCKET_DEFAULT || "post";
const STORJ_BUCKET_POST = process.env.STORJ_BUCKET_POST || "post";
const STORJ_BUCKET_PROFILE = process.env.STORJ_BUCKET_PROFILE || "profile";
const STORJ_BUCKET_CREATOR = process.env.STORJ_BUCKET_CREATOR || "creator";
const STORJ_BUCKET_CREATOR_APPLICATION = process.env.STORJ_BUCKET_CREATOR_APPLICATION || "creator-application";
const STORJ_BUCKET_MESSAGE = process.env.STORJ_BUCKET_MESSAGE || "message";
const STORJ_PUBLIC_ACCESS_GRANT = process.env.STORJ_PUBLIC_ACCESS_GRANT || "";
const STORJ_LINKSHARE_API = process.env.STORJ_LINKSHARE_API || "https://api.link.storjshare.io";

// ✅ How long signed URLs stay valid — 7 days (max allowed by Storj)
const SIGNED_URL_EXPIRES_SECONDS = 7 * 24 * 60 * 60;

if (!STORJ_ACCESS_KEY_ID || !STORJ_SECRET_ACCESS_KEY || !STORJ_ENDPOINT) {
  console.error('[Storj Config Debug] Environment variables status:');
  console.error('STORJ_ACCESS_KEY_ID:', STORJ_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
  console.error('STORJ_SECRET_ACCESS_KEY:', STORJ_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
  console.error('STORJ_ENDPOINT:', STORJ_ENDPOINT ? 'SET' : 'NOT SET');
  console.error('Current working directory:', process.cwd());
  console.error('Node environment:', process.env.NODE_ENV);

  throw new Error(
    "[Storj Config] Missing one of STORJ_ACCESS_KEY_ID / STORJ_SECRET_ACCESS_KEY / STORJ_ENDPOINT env vars. " +
    "Please check your .env file or system environment variables."
  );
}

// -----------------------------
// Storj S3 Client (AWS SDK v2)
// -----------------------------
const s3Client = new AWS.S3({
  endpoint: STORJ_ENDPOINT,
  region: 'us-east-1',
  accessKeyId: STORJ_ACCESS_KEY_ID,
  secretAccessKey: STORJ_SECRET_ACCESS_KEY,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
});

// -----------------------------
// Utils
// -----------------------------
const getBucketName = (folder) => {
  switch (folder) {
    case 'post':             return STORJ_BUCKET_POST;
    case 'profile':          return STORJ_BUCKET_PROFILE;
    case 'creator':          return STORJ_BUCKET_CREATOR;
    case 'creator-application': return STORJ_BUCKET_CREATOR_APPLICATION;
    case 'message':          return STORJ_BUCKET_MESSAGE;
    default:                 return STORJ_BUCKET_DEFAULT;
  }
};

const isBucketNotFound = (err) =>
  (err && (err.code === 'NoSuchBucket' || err.code === 'NotFound' || (err.message && String(err.message).toLowerCase().includes('bucket does not exist'))));

async function getBucketForUpload(folder) {
  const primary = getBucketName(folder);
  if (primary === STORJ_BUCKET_POST) return primary;
  try {
    await s3Client.headBucket({ Bucket: primary }).promise();
    return primary;
  } catch (err) {
    if (isBucketNotFound(err)) {
      console.warn("[storj] Bucket not found:", primary, "- using fallback bucket:", STORJ_BUCKET_POST);
      return STORJ_BUCKET_POST;
    }
    throw err;
  }
}

const generateUniqueFileName = (originalName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const extension = (originalName || "image.jpg").split('.').pop();
  return `${timestamp}-${random}.${extension}`;
};

const getFileUrl = (bucket, key) => {
  return `${STORJ_ENDPOINT}/${bucket}/${key}`;
};

// ✅ Get a signed URL (actually accessible by browser — no auth needed)
function getSignedUrl(bucket, key, expiresSeconds = SIGNED_URL_EXPIRES_SECONDS) {
  try {
    return s3Client.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: key,
      Expires: Math.max(60, Math.min(7 * 24 * 3600, Number(expiresSeconds) || SIGNED_URL_EXPIRES_SECONDS)),
    });
  } catch (err) {
    console.error('[getSignedUrl] Error:', err?.message || err);
    return '';
  }
}

// Attempt Linkshare public URL — falls back to signed URL
async function getBestPublicUrl(bucket, key) {
  // 1. Try Linkshare if access grant is configured
  if (STORJ_PUBLIC_ACCESS_GRANT) {
    try {
      const body = {
        access: STORJ_PUBLIC_ACCESS_GRANT,
        paths: [`sj://${bucket}/${key}`],
        public: true,
      };
      const res = await axios.post(`${STORJ_LINKSHARE_API}/api/v1/share`, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      });
      const data = res.data;
      const url = Array.isArray(data) ? data[0]?.url : data?.url;
      if (typeof url === 'string' && url.startsWith('http')) {
        return url;
      }
    } catch (err) {
      console.warn('[getBestPublicUrl] Linkshare failed, falling back to signed URL:', err?.message || err);
    }
  }

  // 2. ✅ Fall back to signed URL — this is always accessible by the browser
  const signed = getSignedUrl(bucket, key);
  if (signed) {
    console.log('[getBestPublicUrl] Using signed URL for:', key);
    return signed;
  }

  // 3. Last resort — raw endpoint URL (likely won't load in browser without auth)
  console.warn('[getBestPublicUrl] Signed URL also failed, using raw endpoint URL for:', key);
  return getFileUrl(bucket, key);
}

// -----------------------------
// Media Processing
// -----------------------------
async function processBufferByMime(buffer, filename, mimetype) {
  if (mimetype && mimetype.startsWith("image/")) {
    return compressImage(buffer);
  }
  return buffer;
}

// -----------------------------
// saveFile (from disk path)
// -----------------------------
async function saveFile(file, filePath, folder = STORJ_BUCKET_DEFAULT) {
  if (!filePath) return { public_id: "", file_link: "" };

  const bucket = getBucketName(folder);

  try {
    const fs = require('fs');
    const path = require('path');

    const buffer = fs.readFileSync(filePath);
    const originalname = path.basename(filePath);
    const processedBuffer = await processBufferByMime(buffer, originalname, undefined);
    const key = generateUniqueFileName(originalname);

    const params = {
      Bucket: bucket,
      Key: key,
      Body: processedBuffer,
      ContentType: undefined,
    };

    await s3Client.putObject(params).promise();

    try { fs.unlinkSync(filePath); } catch (_) { }

    const fileUrl = await getBestPublicUrl(bucket, key);
    return { public_id: key, file_link: fileUrl };
  } catch (error) {
    console.error('[saveFile] Error:', error?.message || error);
    return { public_id: "", file_link: "" };
  }
}

// -----------------------------
// uploadSingleFileToCloudinary (buffer → Storj)
// -----------------------------
async function uploadSingleFileToCloudinary(file, folder = STORJ_BUCKET_DEFAULT) {
  const bucket = await getBucketForUpload(folder);
  if (!file) return { public_id: "", file_link: "" };

  try {
    const processedBuffer = await processBufferByMime(file.buffer, file.originalname, file.mimetype);
    const key = generateUniqueFileName(file.originalname);

    const params = {
      Bucket: bucket,
      Key: key,
      Body: processedBuffer,
      ContentType: file.mimetype,
    };

    await s3Client.putObject(params).promise();

    const fileUrl = await getBestPublicUrl(bucket, key);
    return { public_id: key, file_link: fileUrl };
  } catch (error) {
    console.error('[uploadSingleFileToCloudinary] Error:', error?.message || error);
    return { public_id: "", file_link: "" };
  }
}

// -----------------------------
// uploadManyFilesToCloudinary (buffers → Storj)
// -----------------------------
async function uploadManyFilesToCloudinary(files, folder = STORJ_BUCKET_DEFAULT) {
  const bucket = await getBucketForUpload(folder);
  if (!files || files.length === 0) return [];

  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const buffer = file.buffer;
        if (!buffer) {
          console.error("[uploadManyFilesToCloudinary] No buffer on file:", file.originalname || file.fieldname);
          return { public_id: "", file_link: "", filename: file.originalname || "" };
        }

        let processedBuffer;
        try {
          processedBuffer = await processBufferByMime(buffer, file.originalname, file.mimetype);
        } catch (processErr) {
          console.warn("[uploadManyFilesToCloudinary] processBufferByMime failed, using original buffer:", processErr?.message);
          processedBuffer = buffer;
        }

        const key = generateUniqueFileName(file.originalname || "image.jpg");

        const params = {
          Bucket: bucket,
          Key: key,
          Body: processedBuffer,
          ContentType: file.mimetype,
        };

        await s3Client.putObject(params).promise();

        // ✅ Use getBestPublicUrl — signed URL fallback ensures browser can load the image
        const fileUrl = await getBestPublicUrl(bucket, key);

        if (!fileUrl) {
          console.error("[uploadManyFilesToCloudinary] Could not get a public URL for:", key);
          return { public_id: key, file_link: "", filename: file.originalname };
        }

        console.log(`[uploadManyFilesToCloudinary] Uploaded ${file.originalname} → ${fileUrl}`);

        return {
          public_id: key,
          file_link: fileUrl,
          filename: file.originalname,
        };
      } catch (error) {
        const errStr = (error && (error.code || error.message || String(error))) || 'Unknown';
        console.error("[uploadManyFilesToCloudinary] File upload error:", file.originalname, errStr);
        return { public_id: "", file_link: "", filename: file.originalname };
      }
    })
  );

  return results;
}

// -----------------------------
// deleteFile (single)
// -----------------------------
async function deleteFile(publicId, folder = STORJ_BUCKET_DEFAULT) {
  const bucket = getBucketName(folder);
  if (!publicId) { console.warn("[deleteFile] No public_id provided"); return false; }

  try {
    await s3Client.deleteObject({ Bucket: bucket, Key: publicId }).promise();
    console.log(`[deleteFile] Successfully deleted ${publicId} from ${bucket}`);
    return true;
  } catch (error) {
    const errStr = (error && (error.code || error.message || String(error))) || 'Unknown';
    console.error(`[deleteFile] Error deleting ${publicId}:`, errStr);
    return false;
  }
}

// -----------------------------
// updateSingleFileToCloudinary
// -----------------------------
async function updateSingleFileToCloudinary(oldPublicId, newFile, folder = STORJ_BUCKET_DEFAULT) {
  try {
    if (oldPublicId) await deleteFile(oldPublicId, folder);
    return await uploadSingleFileToCloudinary(newFile, folder);
  } catch (error) {
    return { public_id: "", file_link: "" };
  }
}

// -----------------------------
// updateManyFileToCloudinary
// -----------------------------
async function updateManyFileToCloudinary(oldPublicIds = [], newFiles = [], folder = STORJ_BUCKET_DEFAULT) {
  try {
    if (Array.isArray(oldPublicIds) && oldPublicIds.length > 0) {
      await Promise.all(oldPublicIds.filter(Boolean).map(id => deleteFile(id, folder).catch(() => false)));
    }
    if (Array.isArray(newFiles) && newFiles.length > 0) {
      return await uploadManyFilesToCloudinary(newFiles, folder);
    }
    return [];
  } catch (error) {
    return [];
  }
}

// -----------------------------
// normalizeS3Key
// -----------------------------
function normalizeS3Key(publicId) {
  if (!publicId || typeof publicId !== 'string') return null;

  const trimmed = publicId.trim();
  if (!trimmed) return null;

  // If full URL, extract only the file name from pathname
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed);
      const pathSegments = u.pathname.split('/').filter(Boolean);

      return pathSegments.length > 0
        ? pathSegments[pathSegments.length - 1]
        : null;
    } catch {
      return null;
    }
  }

  // Remove signed URL query params if present
  return trimmed.split("?")[0];
}

// -----------------------------
// previewFile
// -----------------------------
async function previewFile(publicId, folder = STORJ_BUCKET_DEFAULT) {
  const key = normalizeS3Key(publicId);
  if (!key) return null;
  const bucket = getBucketName(folder);
  try {
    const response = await s3Client.headObject({ Bucket: bucket, Key: key }).promise();
    return {
      size: response.ContentLength,
      lastModified: response.LastModified,
      contentType: response.ContentType,
      etag: response.ETag,
    };
  } catch (error) {
    const errMsg = (error && (error.code || error.message || String(error))) || 'Unknown';
    if (error && error.code === 'NotFound') {
      if (process.env.DEBUG_PREVIEW_FILE) console.warn(`[previewFile] Not found: ${key}`);
    } else {
      console.error(`[previewFile] Error getting info for ${key}:`, errMsg);
    }
    return null;
  }
}

// -----------------------------
// streamFile
// -----------------------------
async function streamFile(publicId, folder = STORJ_BUCKET_DEFAULT, start, end) {
  const key = normalizeS3Key(publicId);
  if (!key) return null;
  const bucket = getBucketName(folder);

   console.log("PUBLIC ID:", publicId);
  console.log("NORMALIZED KEY:", key);
  console.log("BUCKET:", bucket);
  
  try {
    const params = { Bucket: bucket, Key: key };
    if (typeof start === 'number') {
      params.Range = `bytes=${start}-${typeof end === 'number' ? end : ''}`;
    }
    const response = await s3Client.getObject(params).promise();
    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(response.Body);
    stream.push(null);
    return {
      body: stream,
      contentType: response.ContentType || 'application/octet-stream',
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      etag: response.ETag,
      contentRange: response.ContentRange,
      acceptRanges: response.AcceptRanges,
    };
  } catch (error) {
    console.log("STREAM FILE ERROR:");
  console.log(error);
    return null;
  }
}

// -----------------------------
// getSignedViewUrl (public export)
// -----------------------------
function getSignedViewUrl(publicId, folder = STORJ_BUCKET_DEFAULT, expiresSeconds = SIGNED_URL_EXPIRES_SECONDS) {
  const bucket = getBucketName(folder);
  if (!publicId) return '';
  return getSignedUrl(bucket, publicId, expiresSeconds);
}

// -----------------------------
// Exports
// -----------------------------
module.exports = {
  uploadSingleFileToCloudinary,
  uploadManyFilesToCloudinary,
  saveFile,
  deleteFile,
  updateSingleFileToCloudinary,
  updateManyFileToCloudinary,
  previewFile,
  streamFile,
  getSignedViewUrl,
  getFileUrl,
  getBucketName,
};