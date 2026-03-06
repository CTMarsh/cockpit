/**
 * Shared TLS configuration for internal services.
 *
 * Loads CA certificates from environment variables or well-known paths
 * so that TLS verification can be enabled instead of using rejectUnauthorized: false.
 *
 * Env vars:
 *   PVE_CA_CERT  — path to Proxmox CA cert file (or inline PEM)
 *   K8S_CA_CERT  — path to k8s CA cert file (falls back to in-cluster SA CA)
 *   MINIO_CA_CERT — path to MinIO CA cert file (LE certs work with system CAs)
 */

import { readFileSync, existsSync } from "node:fs";

const SA_CA_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt";

function loadCert(envVar: string, fallbackPath?: string): string | undefined {
  const val = process.env[envVar];
  if (val) {
    // If it looks like PEM content, use directly
    if (val.startsWith("-----BEGIN")) return val;
    // Otherwise treat as file path
    try {
      return readFileSync(val, "utf-8");
    } catch {
      console.warn(`[tls] Could not read CA cert from ${envVar}=${val}`);
    }
  }
  if (fallbackPath && existsSync(fallbackPath)) {
    try {
      return readFileSync(fallbackPath, "utf-8");
    } catch {
      // not available
    }
  }
  return undefined;
}

const pveCa = loadCert("PVE_CA_CERT");
const k8sCa = loadCert("K8S_CA_CERT", SA_CA_PATH);
const minioCa = loadCert("MINIO_CA_CERT");

/** TLS options for Proxmox API calls */
export function pveTls(): { rejectUnauthorized: boolean; ca?: string } {
  if (pveCa) return { rejectUnauthorized: true, ca: pveCa };
  // Proxmox uses self-signed certs by default in homelab setups
  return { rejectUnauthorized: false };
}

/** TLS options for Kubernetes API calls */
export function k8sTls(): { rejectUnauthorized: boolean; ca?: string } {
  if (k8sCa) return { rejectUnauthorized: true, ca: k8sCa };
  // In-cluster CA not found — disable verification with warning
  console.warn("[tls] No k8s CA cert found. Set K8S_CA_CERT or run in-cluster. TLS verification disabled.");
  return { rejectUnauthorized: false };
}

/** TLS options for MinIO S3 calls */
export function minioTls(): { rejectUnauthorized: boolean; ca?: string } {
  if (minioCa) return { rejectUnauthorized: true, ca: minioCa };
  // MinIO with cert-manager/LE should work with system CAs
  // but if accessed via internal cluster DNS, the cert SAN may not match
  return { rejectUnauthorized: true };
}
