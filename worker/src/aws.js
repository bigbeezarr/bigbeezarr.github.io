// Client minimal Amazon Rekognition (signature AWS SigV4 faite à la main, sans dépendance).
const enc = new TextEncoder();
const hexOf = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join("");
const sha256 = async data => hexOf(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
async function hmacRaw(key, msg) {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}

// Signature générique (vérifiée contre l'exemple officiel AWS, voir test/sigv4.test.mjs).
export async function signV4({ method, url, headers, body = "", accessKeyId, secretAccessKey, region, service, amzDate }) {
  const u = new URL(url);
  amzDate = amzDate || new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const h = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])), host: u.host, "x-amz-date": amzDate };
  const names = Object.keys(h).sort();
  const canonHeaders = names.map(k => `${k}:${h[k]}\n`).join("");
  const signed = names.join(";");
  const query = [...u.searchParams.entries()].sort(([a, x], [b, y]) => a < b ? -1 : a > b ? 1 : x < y ? -1 : 1)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonical = [method, u.pathname || "/", query, canonHeaders, signed, await sha256(body)].join("\n");
  const scope = `${date}/${region}/${service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonical)].join("\n");
  let k = await hmacRaw("AWS4" + secretAccessKey, date);
  k = await hmacRaw(k, region); k = await hmacRaw(k, service); k = await hmacRaw(k, "aws4_request");
  const signature = hexOf(await hmacRaw(k, toSign));
  return { ...h, authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}` };
}

export const faceConfigured = env => !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);

export class AwsError extends Error {
  constructor(type, message, status) { super(message || type); this.type = type; this.status = status; }
}

async function call(env, target, payload) {
  const region = env.AWS_REGION || "ca-central-1";
  const url = env.AWS_ENDPOINT || `https://rekognition.${region}.amazonaws.com/`;
  const body = JSON.stringify(payload);
  const headers = await signV4({
    method: "POST", url, body, region, service: "rekognition",
    accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    headers: { "content-type": "application/x-amz-json-1.1", "x-amz-target": `RekognitionService.${target}` },
  });
  delete headers.host;
  const res = await fetch(url, { method: "POST", headers, body });
  const text = await res.text();
  let data = {}; try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok) {
    const type = String(data.__type || res.headers.get("x-amzn-ErrorType") || "AwsError").split("#").pop().split(":")[0];
    throw new AwsError(type, data.message || data.Message || text.slice(0, 200), res.status);
  }
  return data;
}

function toBase64(bytes) {
  const b = new Uint8Array(bytes); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

export const collectionId = (env, galleryId) => `${env.FACE_COLLECTION_PREFIX || "bbz"}-${galleryId}`;

export async function ensureCollection(env, galleryId) {
  try { await call(env, "CreateCollection", { CollectionId: collectionId(env, galleryId) }); }
  catch (e) { if (e.type !== "ResourceAlreadyExistsException") throw e; }
}
export async function deleteCollection(env, galleryId) {
  try { await call(env, "DeleteCollection", { CollectionId: collectionId(env, galleryId) }); }
  catch (e) { if (e.type !== "ResourceNotFoundException") throw e; }
}
export async function indexFaces(env, galleryId, photoId, bytes) {
  const r = await call(env, "IndexFaces", {
    CollectionId: collectionId(env, galleryId), ExternalImageId: photoId,
    Image: { Bytes: toBase64(bytes) }, MaxFaces: 100, QualityFilter: "AUTO", DetectionAttributes: ["DEFAULT"],
  });
  return (r.FaceRecords || []).map(f => f.Face.FaceId);
}
export async function searchByImage(env, galleryId, bytes, threshold) {
  try {
    const r = await call(env, "SearchFacesByImage", {
      CollectionId: collectionId(env, galleryId), Image: { Bytes: toBase64(bytes) },
      FaceMatchThreshold: threshold, MaxFaces: 4096, QualityFilter: "AUTO",
    });
    return (r.FaceMatches || []).map(m => ({ faceId: m.Face.FaceId, photoId: m.Face.ExternalImageId, similarity: m.Similarity }));
  } catch (e) {
    if (e.type === "InvalidParameterException") throw new AwsError("NoFace", "no face found", 422);
    if (e.type === "InvalidImageFormatException" || e.type === "ImageTooLargeException") throw new AwsError("BadImage", e.message, 415);
    throw e;
  }
}
export async function deleteFaces(env, galleryId, faceIds) {
  for (let i = 0; i < faceIds.length; i += 4096) {
    try { await call(env, "DeleteFaces", { CollectionId: collectionId(env, galleryId), FaceIds: faceIds.slice(i, i + 4096) }); }
    catch (e) { if (e.type !== "ResourceNotFoundException") throw e; }
  }
}
