// Shared Kubernetes API client — used by sysmon and k8s modules
// Auth: K8S_TOKEN env var > in-cluster service account token

const K8S_API = process.env.K8S_API || "https://kubernetes.default.svc";
const SA_TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";

let cachedToken: string | null = null;

async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  const envToken = process.env.K8S_TOKEN || "";
  if (envToken) {
    cachedToken = envToken;
    return envToken;
  }

  try {
    const token = await Bun.file(SA_TOKEN_PATH).text();
    cachedToken = token.trim();
    return cachedToken;
  } catch {
    return null;
  }
}

function fetchOpts(token: string, method = "GET", body?: any, contentType?: string): RequestInit & { tls?: any } {
  return {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": contentType || "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    // @ts-ignore — Bun supports this for self-signed certs
    tls: { rejectUnauthorized: false },
  };
}

/** Make a JSON request to the k8s API. Returns parsed JSON or null on failure. */
export async function k8sApi(path: string, method = "GET", body?: any): Promise<any> {
  const token = await getToken();
  if (!token) return null;

  // PATCH requests to k8s API need strategic-merge-patch content type
  const ct = method === "PATCH" ? "application/strategic-merge-patch+json" : undefined;

  try {
    const res = await fetch(`${K8S_API}${path}`, fetchOpts(token, method, body, ct));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Make a request that returns the raw Response (for streaming logs, watch). Returns null if no token. */
export async function k8sStream(path: string): Promise<Response | null> {
  const token = await getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${K8S_API}${path}`, fetchOpts(token));
    if (!res.ok) return null;
    return res;
  } catch {
    return null;
  }
}

/** Check if k8s API is reachable */
export async function k8sAvailable(): Promise<boolean> {
  const data = await k8sApi("/api/v1/namespaces?limit=1");
  return data !== null;
}
