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

const fixItems = (items, req) =>
  Array.isArray(items)
    ? items.map((m) => (m && m.publicId ? { ...m, url: proxyFor(req, m) } : m))
    : items;

// Accepts one post or an array of posts (plain objects or mongoose docs).
const withStableMediaItems = (postOrPosts, req) => {
  const fixOne = (p) => {
    if (!p) return p;
    const obj = typeof p.toObject === "function" ? p.toObject() : p;
    if (!Array.isArray(obj.mediaItems) || obj.mediaItems.length === 0) return obj;
    return { ...obj, mediaItems: fixItems(obj.mediaItems, req) };
  };
  return Array.isArray(postOrPosts) ? postOrPosts.map(fixOne) : fixOne(postOrPosts);
};

module.exports = { withStableMediaItems };