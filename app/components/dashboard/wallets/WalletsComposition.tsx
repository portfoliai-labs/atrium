// components/dashboard/wallets/WalletsComposition.tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useWallets } from "../../../context/WalletsContext";
import { formatCurrency } from "../../../lib/format";
import { KIND_LABELS, WALLET_KINDS, walletColor } from "../../../lib/wallets";
import type { WalletKind } from "../../../models/Wallet";
import { MODULE_BODY, Module, ModuleHead } from "../PerformanceSection";

const KIND_COLORS: Record<WalletKind, string> = {
  current_account: "#2a78d6", credit_card: "#e34948", savings: "#1baf7a", cash: "#eda100",
};

interface Item {
  key: string;
  label: string;
  sub?: string;
  value: number;
  currency: string;
  // Counted in the donut and the shares: in the total's currency, and worth something.
  counted: boolean;
  color: string;
  onOpen?: () => void;
}

/**
 * WALLETS COMPOSITION — All wallets' Composition, as All portfolios' is by portfolio: every
 * wallet (not archived) on a donut and in a list, each with its balance and share, a slice or a
 * row opening that wallet; or, to read only, by kind (current accounts, cards, savings, cash).
 * Shares are of the total in `currency` (the user's reference one): a wallet in another currency
 * is listed in its own but takes no share, and neither does a card in debt.
 */
export function WalletsComposition({ currency, onOpen }: { currency: string; onOpen: (uuid: string) => void }) {
  const { wallets } = useWallets();
  const [breakdown, setBreakdown] = useState<"wallet" | "kind">("wallet");
  const [hovered, setHovered] = useState<string | null>(null);

  const active = useMemo(() => wallets.map((w, i) => ({ w, color: walletColor(w, i) })).filter(({ w }) => !w.archived), [wallets]);
  const items = useMemo((): Item[] => {
    if (breakdown === "kind") {
      return WALLET_KINDS.map((kind) => {
        const own = active.filter(({ w }) => w.kind === kind && w.currency === currency);
        const value = own.reduce((s, { w }) => s + w.balance, 0);
        return { key: kind, label: KIND_LABELS[kind], sub: `${own.length} ${own.length === 1 ? "wallet" : "wallets"}`, value, currency, counted: value > 0, color: KIND_COLORS[kind] };
      }).filter((i) => i.sub !== "0 wallets");
    }
    return active.map(({ w, color }) => {
      const sameCurrency = w.currency === currency;
      return {
        key: w.uuid,
        label: w.name,
        sub: [KIND_LABELS[w.kind], w.institution, sameCurrency ? null : `in ${w.currency}, not in the total`].filter(Boolean).join(" · "),
        value: w.balance,
        currency: w.currency,
        counted: sameCurrency && w.balance > 0,
        color,
        onOpen: () => onOpen(w.uuid),
      };
    });
  }, [breakdown, active, currency, onOpen]);
  const sorted = [...items].sort((a, b) => Number(b.counted) - Number(a.counted) || b.value - a.value);
  const slices = sorted.filter((i) => i.counted);
  const total = slices.reduce((s, i) => s + i.value, 0);
  const share = (i: Item) => (i.counted && total > 0 ? (i.value / total) * 100 : null);
  const focus = sorted.find((i) => i.key === hovered);

  return (
    <Module>
      <ModuleHead
        title="Composition"
        desc={breakdown === "wallet" ? "Open a slice or a row to go down to that wallet." : "Your wallets by kind, to read: open one from By wallet."}
        right={
          <div role="group" aria-label="Breakdown" className="flex flex-wrap gap-1.5">
            {(["wallet", "kind"] as const).map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={b === breakdown}
                onClick={() => { setBreakdown(b); setHovered(null); }}
                className={`px-2.5 py-1 rounded-full border text-[11.5px] font-semibold transition-colors ${
                  b === breakdown ? "bg-[#1c1917] border-[#1c1917] text-white" : "border-[#E0DACC] text-[#78716c] hover:text-[#1c1917]"
                }`}
              >
                {b === "wallet" ? "By wallet" : "By kind"}
              </button>
            ))}
          </div>
        }
      />
      <div className={MODULE_BODY}>
        <div className="grid grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)] gap-[26px] items-center">
          <div className="relative w-full max-w-[210px] aspect-square mx-auto">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 210, height: 210 }}>
              <PieChart>
                <Pie
                  data={slices.length ? slices : [{ key: "none", label: "", value: 1, color: "#EEE9DD" }]}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="67%"
                  outerRadius="98%"
                  paddingAngle={slices.length > 1 ? 1.4 : 0}
                  stroke="none"
                  isAnimationActive={false}
                  onMouseLeave={() => setHovered(null)}
                >
                  {(slices.length ? slices : [{ key: "none", color: "#EEE9DD" } as Item]).map((i) => (
                    <Cell
                      key={i.key}
                      fill={i.color}
                      opacity={hovered && hovered !== i.key ? 0.25 : 1}
                      cursor={i.onOpen ? "pointer" : "default"}
                      onMouseEnter={() => i.key !== "none" && setHovered(i.key)}
                      onClick={i.onOpen}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-[22%] text-center">
              <span className="text-xl font-bold text-[#1c1917] tabular-nums">
                {focus && share(focus) !== null ? `${share(focus)!.toFixed(1)}%` : formatCurrency(total, currency, 0)}
              </span>
              <span className="text-[10.5px] text-[#78716c] truncate max-w-full">{focus ? focus.label : "total"}</span>
            </div>
          </div>
          <ul className="min-w-0">
            {sorted.map((i, index) => {
              const pct = share(i);
              const content = (
                <>
                  <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: i.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#1c1917]">{i.label}</span>
                    {i.sub && <span className="block truncate text-[11.5px] font-medium text-[#78716c]">{i.sub}</span>}
                  </span>
                  <span className={`shrink-0 pl-4 text-right font-bold tabular-nums ${i.value < 0 ? "text-rose-600" : "text-[#1c1917]"}`}>
                    {formatCurrency(i.value, i.currency, 0)}
                  </span>
                  <span className="hidden sm:block shrink-0 min-w-[92px] text-right text-xs text-[#78716c] tabular-nums">
                    {pct === null ? "—" : `${pct.toFixed(1)}%`}
                  </span>
                  <span className="w-[18px] shrink-0">{i.onOpen && <ChevronRight className="h-4 w-4 text-[#a8a29e]" />}</span>
                </>
              );
              const row = `w-full flex items-center gap-3 px-2.5 py-[11px] rounded-[14px] text-left transition-colors ${index < sorted.length - 1 ? "border-b border-[#EEE9DD]" : ""} ${hovered === i.key ? "bg-[#F7F5EF]" : ""}`;
              return (
                <li key={i.key} onMouseEnter={() => setHovered(i.key)} onMouseLeave={() => setHovered(null)}>
                  {i.onOpen ? (
                    <button type="button" onClick={i.onOpen} className={`${row} hover:bg-[#F7F5EF] outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40`}>{content}</button>
                  ) : (
                    <div className={row}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Module>
  );
}
