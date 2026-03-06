/**
 * Minimal S3-compatible client for MinIO.
 * Uses AWS Signature V4 via Bun's built-in crypto.
 * Zero external dependencies.
 */

import { minioTls } from "../tls-config";

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "";
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "";
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "";
const MINIO_REGION = process.env.MINIO_REGION || "us-east-1";

export function s3Available(): boolean {
  return !!(MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY);
}

function hmacSHA256(key: ArrayBuffer | string, data: string): ArrayBuffer {
  const crypto = globalThis.crypto || require("crypto").webcrypto;
  const keyBuf = typeof key === "string" ? new TextEncoder().encode(key) : new Uint8Array(key);
  const h = new Bun.CryptoHasher("sha256", keyBuf);
  h.update(data);
  return h.digest().buffer as ArrayBuffer;
}

function sha256Hex(data: string | Uint8Array): string {
  const h = new Bun.CryptoHasher("sha256");
  h.update(data);
  return h.digest("hex");
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getSignatureKey(date: string): ArrayBuffer {
  const kDate = hmacSHA256("AWS4" + MINIO_SECRET_KEY, date);
  const kRegion = hmacSHA256(kDate, MINIO_REGION);
  const kService = hmacSHA256(kRegion, "s3");
  return hmacSHA256(kService, "aws4_request");
}

interface S3RequestOptions {
  method: string;
  bucket?: string;
  key?: string;
  query?: Record<string, string>;
  body?: Uint8Array | string;
  contentType?: string;
}

export async function s3Request(opts: S3RequestOptions): Promise<Response> {
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, "").slice(0, 8);
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z/, "Z");

  let path = "/";
  if (opts.bucket) path += opts.bucket;
  if (opts.key) path += "/" + opts.key;
  if (opts.bucket && !opts.key) path += "/";

  const queryStr = opts.query
    ? Object.entries(opts.query)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";

  const bodyBytes = opts.body
    ? typeof opts.body === "string"
      ? new TextEncoder().encode(opts.body)
      : opts.body
    : new Uint8Array(0);
  const payloadHash = sha256Hex(bodyBytes);

  const url = new URL(MINIO_ENDPOINT);
  const host = url.host;

  const headers: Record<string, string> = {
    host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };
  if (opts.contentType) headers["content-type"] = opts.contentType;

  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((k) => `${k}:${headers[k]}\n`)
    .join("");

  const canonicalRequest = [
    opts.method,
    path,
    queryStr,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${MINIO_REGION}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(dateStamp);
  const signature = toHex(hmacSHA256(signingKey, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${MINIO_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const fetchUrl = `${MINIO_ENDPOINT}${path}${queryStr ? "?" + queryStr : ""}`;
  return fetch(fetchUrl, {
    method: opts.method,
    headers: { ...headers, authorization },
    body: bodyBytes.length > 0 ? (bodyBytes as unknown as BodyInit) : undefined,
    // @ts-ignore — Bun supports this
    tls: minioTls(),
  });
}

// ── High-level helpers ──

export async function listBuckets(): Promise<string[]> {
  const res = await s3Request({ method: "GET" });
  if (!res.ok) return [];
  const text = await res.text();
  const names = [...text.matchAll(/<Name>([^<]+)<\/Name>/g)].map((m) => m[1]);
  return names;
}

export async function listObjects(bucket: string, prefix = "", maxKeys = 1000): Promise<{ key: string; size: number; lastModified: string }[]> {
  const query: Record<string, string> = { "list-type": "2", "max-keys": String(maxKeys) };
  if (prefix) query.prefix = prefix;
  const res = await s3Request({ method: "GET", bucket, query });
  if (!res.ok) return [];
  const text = await res.text();
  const objects: { key: string; size: number; lastModified: string }[] = [];
  const contentRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;
  while ((match = contentRegex.exec(text)) !== null) {
    const block = match[1];
    const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1] || "";
    const size = Number(block.match(/<Size>([^<]+)<\/Size>/)?.[1] || 0);
    const lastModified = block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] || "";
    objects.push({ key, size, lastModified });
  }
  return objects;
}

export async function getObject(bucket: string, key: string): Promise<Response> {
  return s3Request({ method: "GET", bucket, key });
}

export async function putObject(bucket: string, key: string, body: Uint8Array, contentType = "application/octet-stream"): Promise<boolean> {
  const res = await s3Request({ method: "PUT", bucket, key, body, contentType });
  return res.ok;
}

export async function deleteObject(bucket: string, key: string): Promise<boolean> {
  const res = await s3Request({ method: "DELETE", bucket, key });
  return res.ok || res.status === 204;
}

export async function createBucket(bucket: string): Promise<boolean> {
  const res = await s3Request({ method: "PUT", bucket });
  return res.ok;
}

export async function deleteBucket(bucket: string): Promise<boolean> {
  const res = await s3Request({ method: "DELETE", bucket });
  return res.ok || res.status === 204;
}

/** Common prefixes — simulates folder listing */
export async function listPrefixes(bucket: string, prefix = "", delimiter = "/"): Promise<{ prefixes: string[]; objects: { key: string; size: number; lastModified: string }[] }> {
  const query: Record<string, string> = { "list-type": "2", delimiter };
  if (prefix) query.prefix = prefix;
  const res = await s3Request({ method: "GET", bucket, query });
  if (!res.ok) return { prefixes: [], objects: [] };
  const text = await res.text();

  const prefixes = [...text.matchAll(/<Prefix>([^<]+)<\/Prefix>/g)]
    .map((m) => m[1])
    .filter((p) => p !== prefix); // Exclude the current prefix itself

  const objects: { key: string; size: number; lastModified: string }[] = [];
  const contentRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;
  while ((match = contentRegex.exec(text)) !== null) {
    const block = match[1];
    const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1] || "";
    const size = Number(block.match(/<Size>([^<]+)<\/Size>/)?.[1] || 0);
    const lastModified = block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] || "";
    if (key !== prefix) objects.push({ key, size, lastModified });
  }
  return { prefixes, objects };
}
