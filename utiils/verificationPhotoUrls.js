// Builds permanent image URLs for verification photos.
//
// Stored links are either raw Storj URLs (private, can't be opened by a browser)
// or signed URLs (expire after <= 7 days). The files themselves never expire, and
// /api/image/view streams them with the server's own credentials using the stored
// public id, so we always hand the frontend that proxy URL instead.

const BUCKET = process.env.STORJ_BUCKET_CREATOR_APPLICATION || "creator-application";

const proxyUrl = (req, publicId) => {
  const base = `${req.protocol}://${req.get("host")}`;
  return `${base}/api/image/view?publicId=${encodeURIComponent(publicId)}&bucket=${encodeURIComponent(BUCKET)}`;
};

// Accepts a mongoose document or a plain object; never mutates it, never saves.
const withStablePhotoLinks = (doc, req) => {
  if (!doc) return doc;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };

  const idKey = obj.idPhotofile?.idPhotofilepublicid;
  if (idKey) {
    obj.idPhotofile = { ...obj.idPhotofile, idPhotofilelink: proxyUrl(req, idKey) };
  }

  const holdingKey = obj.holdingIdPhotofile?.holdingIdPhotofilepublicid;
  if (holdingKey) {
    obj.holdingIdPhotofile = { ...obj.holdingIdPhotofile, holdingIdPhotofilelink: proxyUrl(req, holdingKey) };
  }

  return obj;
};

module.exports = { withStablePhotoLinks };