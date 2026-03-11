import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { ErrorBanner } from "../components/ErrorBanner";

type Tab = "certificates" | "issuers";

interface Certificate {
  name: string;
  namespace: string;
  secretName: string;
  issuerName: string;
  dnsNames: string[];
  notBefore: string | null;
  notAfter: string | null;
  renewalTime: string | null;
  ready: boolean;
  message: string;
  daysUntilExpiry: number | null;
}

interface Issuer {
  name: string;
  namespace: string;
  kind: string;
  type: string;
  ready: boolean;
  server: string | null;
  email: string | null;
}

function expiryColor(days: number): string {
  if (days < 0) return "text-cockpit-danger";
  if (days < 7) return "text-cockpit-danger";
  if (days < 30) return "text-cockpit-warning";
  return "text-cockpit-success";
}

function expiryLabel(days: number | null): string {
  if (days === null) return "Unknown";
  if (days < 0) return "EXPIRED";
  return `Expires in ${days} day${days === 1 ? "" : "s"}${days < 7 ? "!" : ""}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CertificatesPage() {
  const [tab, setTab] = useState<Tab>("certificates");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCertificates = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api<{ certificates: Certificate[]; error?: string }>(
        "/certificates/certificates"
      );
      setCertificates(data.certificates);
      if (data.error) setError(data.error);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIssuers = useCallback(async () => {
    try {
      const data = await api<{ issuers: Issuer[] }>("/certificates/issuers");
      setIssuers(data.issuers);
    } catch {
      /* ignore — certificates tab is primary */
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
    fetchIssuers();
  }, [fetchCertificates, fetchIssuers]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCertificates();
      fetchIssuers();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCertificates, fetchIssuers]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "certificates", label: `Certificates (${certificates.length})` },
    { key: "issuers", label: `Issuers (${issuers.length})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-cockpit-accent" /> Certificates
        </h2>
        <button
          onClick={() => {
            fetchCertificates();
            fetchIssuers();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cockpit-surface border border-cockpit-border rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-1 bg-cockpit-surface border border-cockpit-border rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-cockpit-accent/15 text-cockpit-accent"
                : "text-cockpit-text-muted hover:text-cockpit-text hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Certificates tab */}
      {tab === "certificates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {certificates.length === 0 && !loading && (
            <div className="col-span-full text-center text-cockpit-text-muted py-8">
              No certificates found. Ensure cert-manager is installed and accessible.
            </div>
          )}
          {certificates.map((cert) => (
            <div
              key={`${cert.namespace}/${cert.name}`}
              className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 space-y-3"
            >
              {/* Header: name + namespace badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{cert.name}</div>
                  <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-cockpit-accent/15 text-cockpit-accent">
                    {cert.namespace}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      cert.ready ? "bg-cockpit-success" : "bg-cockpit-danger"
                    }`}
                    title={cert.ready ? "Ready" : "Not Ready"}
                  />
                  <span className="text-[10px] text-cockpit-text-muted">
                    {cert.ready ? "Ready" : "Not Ready"}
                  </span>
                </div>
              </div>

              {/* DNS names */}
              {cert.dnsNames.length > 0 && (
                <div className="space-y-0.5">
                  {cert.dnsNames.map((dns) => (
                    <div
                      key={dns}
                      className="text-xs text-cockpit-text-muted truncate"
                      title={dns}
                    >
                      {dns}
                    </div>
                  ))}
                </div>
              )}

              {/* Expiry countdown */}
              <div
                className={`text-sm font-semibold ${
                  cert.daysUntilExpiry !== null
                    ? expiryColor(cert.daysUntilExpiry)
                    : "text-cockpit-text-muted"
                }`}
              >
                {expiryLabel(cert.daysUntilExpiry)}
              </div>

              {/* Details */}
              <div className="space-y-1 text-[11px] text-cockpit-text-muted">
                <div>
                  Issuer: <span className="text-cockpit-text">{cert.issuerName}</span>
                </div>
                <div>
                  Secret: <span className="text-cockpit-text">{cert.secretName}</span>
                </div>
                {cert.renewalTime && (
                  <div>Renews: {formatDate(cert.renewalTime)}</div>
                )}
                {cert.notAfter && (
                  <div>Expires: {formatDate(cert.notAfter)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Issuers tab */}
      {tab === "issuers" && (
        <div className="space-y-2">
          {issuers.length === 0 && !loading && (
            <div className="text-center text-cockpit-text-muted py-8">
              No issuers found.
            </div>
          )}
          {issuers.map((issuer) => (
            <div
              key={`${issuer.kind}/${issuer.namespace}/${issuer.name}`}
              className="bg-cockpit-surface border border-cockpit-border rounded-xl p-4 flex items-center gap-4"
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  issuer.ready ? "bg-cockpit-success" : "bg-cockpit-danger"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{issuer.name}</div>
                <div className="text-xs text-cockpit-text-muted">
                  {issuer.kind}
                  {issuer.namespace ? ` in ${issuer.namespace}` : ""}
                  {issuer.server ? ` \u00b7 ${issuer.server}` : ""}
                  {issuer.email ? ` \u00b7 ${issuer.email}` : ""}
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-cockpit-accent/15 text-cockpit-accent shrink-0">
                {issuer.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
