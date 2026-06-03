"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

export function MarketplaceUpgradeLinkButton({ userId }: { userId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function copyLink() {
    setStatus("loading");
    try {
      const response = await fetch(
        `/api/admin/tesla-upgrade-link?user_id=${encodeURIComponent(userId)}`
      );
      const payload = (await response.json()) as {
        upgrade_url?: string;
        error?: string;
      };
      if (!response.ok || !payload.upgrade_url) {
        throw new Error(payload.error || "Could not generate link.");
      }
      await navigator.clipboard.writeText(payload.upgrade_url);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const label =
    status === "loading"
      ? "..."
      : status === "copied"
        ? "Copied"
        : status === "error"
          ? "Failed"
          : "Copy link";

  return (
    <button
      type="button"
      onClick={copyLink}
      disabled={status === "loading"}
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      title="Copy email link for Tesla location upgrade (no login required)"
    >
      <Link2 className="h-3 w-3" />
      {label}
    </button>
  );
}
