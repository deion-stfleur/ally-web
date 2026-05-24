import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

/**
 * Public Ally sites: multi-file projects served from the API.
 * Preview drafts: /s/:slug?preview=TOKEN
 */
export default function PublishedSite() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get("preview");

  const apiRoot = useMemo(() => {
    if (!slug) return null;
    const q = preview ? `?preview=${encodeURIComponent(preview)}` : "";
    return `${API_BASE}/api/sites/${encodeURIComponent(slug)}${q}`;
  }, [slug, preview]);

  useEffect(() => {
    if (!apiRoot) return;
    window.location.replace(`${apiRoot}/index.html`);
  }, [apiRoot]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 px-4 text-slate-600">
      <p className="text-sm">Loading your page…</p>
    </div>
  );
}
