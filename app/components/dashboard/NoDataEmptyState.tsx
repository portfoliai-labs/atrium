// components/dashboard/NoDataEmptyState.tsx
import { TrendingUp } from "lucide-react";

/**
 * NO DATA EMPTY STATE — the dashed "nothing here yet" window shown in place of a whole page
 * (Dashboard Overview, Insights) when the backend has no portfolio data for the user at all,
 * typically a brand new account with no transactions recorded. One unified message reads far
 * better than a page of individually hidden modules that would leave nothing on screen.
 */
export function NoDataEmptyState({
  title, message, onNavigate,
}: { title: string; message: string; onNavigate?: (section: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center bg-white border border-slate-200 border-dashed rounded-4xl">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
        <TrendingUp className="h-6 w-6 text-slate-300" />
      </div>
      <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {title}
      </h3>
      <p className="text-slate-500 text-sm mt-1.5 max-w-sm">{message}</p>
      {onNavigate && (
        <button
          onClick={() => onNavigate("upload")}
          className="mt-5 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md shadow-slate-200"
        >
          Add transactions
        </button>
      )}
    </div>
  );
}
