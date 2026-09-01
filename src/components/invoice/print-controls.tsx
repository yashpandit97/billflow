"use client";

import { useEffect } from "react";

export function PrintControls({ backHref }: { backHref: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1") {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className="no-print mx-auto mb-4 flex max-w-[800px] justify-end gap-2">
      <a
        href={backHref}
        className="rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted/50"
      >
        Back
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
      >
        Print invoice
      </button>
    </div>
  );
}
