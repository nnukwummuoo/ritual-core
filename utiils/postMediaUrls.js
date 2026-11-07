// Stored mediaItems[].url is whatever the upload returned at the time (often a
// signed link that expires). The file itself never expires, so on every read we
// swap in a link built from the permanent publicId and served by our own proxy.

const proxyFor = (req, item) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const id = encodeURIComponent(item.publicId);
  return item.type === "video"
    ? `${base}/api/video/stream/${id}`
    : `${base}/api/image/view?publicId=${id}`;
};

const fixOne = (p, req) => {
  try {
    if (!p) return p;
    const obj = typeof p.toObject === "function" ? p.toObject() : p;
    if (!Array.isArray(obj.mediaItems) || obj.mediaItems.length === 0) return obj;
    return {
      ...obj,
      mediaItems: obj.mediaItems.map((m) =>
        m && m.publicId ? { ...m, url: proxyFor(req, m) } : m
      ),
    };
  } catch (err) {
    console.error("[withStableMediaItems] skipped one post:", err?.message || err);
    return p;
  }
};

// Accepts one post or an array of posts (plain objects or mongoose docs).
const withStableMediaItems = (postOrPosts, req) => {
  try {
    return Array.isArray(postOrPosts)
      ? postOrPosts.map((p) => fixOne(p, req))
      : fixOne(postOrPosts, req);
  } catch (err) {
    console.error("[withStableMediaItems] failed:", err?.message || err);
    return postOrPosts;
  }
};

module.exports = { withStableMediaItems };