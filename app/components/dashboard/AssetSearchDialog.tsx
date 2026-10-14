"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Listing } from "../../models/Listing";
import { AssetPicker } from "./AssetPicker";

/**
 * ASSET SEARCH DIALOG — the top bar's search: finds one of census' listings by name, ticker or
 * ISIN and opens its page. Esc or a click outside closes it.
 */
export function AssetSearchDialog({ onPick, onClose }: { onPick: (listing: Listing) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-[#1c1917]/30 px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Search securities" className="w-full max-w-lg rounded-[1.75rem] bg-[#F7F5EF] border border-[rgba(196,154,60,0.25)] shadow-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-[#78716c]">Search securities</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 text-[#a8a29e] hover:text-[#1c1917] hover:bg-[#E0DACC] rounded-xl transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <AssetPicker
          value={null}
          onChange={(listing) => listing && onPick(listing)}
          label="Security"
          placeholder="Name, ticker or ISIN"
          autoFocus
        />
      </div>
    </div>,
    document.body,
  );
}
