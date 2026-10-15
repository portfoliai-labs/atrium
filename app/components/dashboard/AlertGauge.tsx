// components/dashboard/AlertGauge.tsx
import type { AlertRuleResponse } from "../../models/Alert";
import { alertState, alertFigures, describeAlert, APPROACHING_FROM_PCT, type AlertTone } from "../../lib/alerts";

// Dial geometry: a half circle from the left end (progress 0) over the top to the right end
// (progress 100), in a 200 x 112 box with the centre at (100, 100).
const CX = 100;
const CY = 100;
const R = 78;
const STROKE = 16;

const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const TRACK = "#e2e8f0";

/** The point on the dial's arc at `pct` (0–100) of the way round. */
function pointAt(pct: number): [number, number] {
  const angle = Math.PI - (pct / 100) * Math.PI;
  return [CX + R * Math.cos(angle), CY - R * Math.sin(angle)];
}

function arcPath(from: number, to: number): string {
  const [x1, y1] = pointAt(from);
  const [x2, y2] = pointAt(to);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
}

export const TONE_STYLES: Record<AlertTone, { card: string; chip: string }> = {
  ok: { card: "border-slate-200 bg-white", chip: "bg-emerald-50 text-emerald-700" },
  warn: { card: "border-amber-200 bg-white", chip: "bg-amber-50 text-amber-700" },
  danger: { card: "border-red-200 bg-red-50/40", chip: "bg-red-100 text-red-700" },
  muted: { card: "border-slate-200 bg-white", chip: "bg-slate-100 text-slate-600" },
};

const NO_FIGURES_HINT: Record<string, string> = {
  off: "This alert is turned off.",
  pending: "The first check runs within about 5 minutes.",
  unavailable: "Your history doesn't cover this window yet.",
};

/**
 * ALERT DIAL — a fuel-gauge style half dial. The needle sits at how far the current value has
 * got towards the threshold (the backend's progressPct: 0 = at or moving away from it, 100 =
 * reached): the lower part of the arc is green and the upper part, from APPROACHING_FROM_PCT,
 * amber — red once the condition holds. With no reading to show, the arc is grey and there is
 * no needle.
 */
function AlertDial({ progressPct, breached, label }: { progressPct: number | null; breached: boolean; label: string }) {
  const active = progressPct !== null;
  const needleDeg = active ? (Math.min(Math.max(progressPct, 0), 100) / 100) * 180 : 0;

  return (
    <svg viewBox="0 0 200 112" className="w-full max-w-56 mx-auto" role="img" aria-label={label}>
      {active ? (
        <>
          <path d={arcPath(0, APPROACHING_FROM_PCT)} fill="none" stroke={EMERALD} strokeWidth={STROKE} />
          <path d={arcPath(APPROACHING_FROM_PCT, 100)} fill="none" stroke={breached ? RED : AMBER} strokeWidth={STROKE} />
        </>
      ) : (
        <path d={arcPath(0, 100)} fill="none" stroke={TRACK} strokeWidth={STROKE} />
      )}
      {active && (
        <g style={{ transform: `rotate(${needleDeg}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: "transform 700ms ease-out" }}>
          <line x1={CX} y1={CY} x2={CX - 66} y2={CY} stroke="#1c1917" strokeWidth={3} strokeLinecap="round" />
        </g>
      )}
      <circle cx={CX} cy={CY} r={6} fill={active ? "#1c1917" : "#cbd5e1"} />
    </svg>
  );
}

/** One alert as a card: what it watches, the dial, now vs. limit, and its state. */
export function AlertGaugeCard({ rule }: { rule: AlertRuleResponse }) {
  const state = alertState(rule);
  const { title, subtitle } = describeAlert(rule);
  const figures = alertFigures(rule);
  const styles = TONE_STYLES[state.tone];

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-3 ${styles.card}`}>
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-900 truncate">{title}</p>
        <p className="text-xs text-slate-500 truncate">{subtitle}</p>
      </div>

      <AlertDial
        progressPct={state.progressPct}
        breached={state.breached}
        label={state.progressPct === null ? state.label : `${Math.round(state.progressPct)}% of the way to the threshold. ${state.label}`}
      />

      {figures ? (
        <div className="flex items-baseline justify-between gap-3 text-xs text-slate-500">
          <span>Now <b className="text-sm font-black text-slate-900 tabular-nums">{figures.current}</b></span>
          <span>Limit <b className="text-sm font-black text-slate-900 tabular-nums">{figures.limit}</b></span>
        </div>
      ) : (
        <p className="text-xs text-slate-500 text-center">{NO_FIGURES_HINT[state.kind] ?? ""}</p>
      )}

      <span className={`self-start text-[10px] font-bold px-2.5 py-1 rounded-full ${styles.chip}`}>{state.label}</span>
    </div>
  );
}
