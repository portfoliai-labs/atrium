// components/dashboard/wallets/WalletCategories.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, FolderTree, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useWallets } from "../../../context/WalletsContext";
import { walletService } from "../../../services/walletService";
import { CATEGORY_COLORS, CATEGORY_MAX_DEPTH, CATEGORY_PALETTE, CUSTOM_CATEGORY_COLOR, categoryOptionLabel, errorText, type CategoryTree } from "../../../lib/wallets";
import type { Category, CategoryKind, CategoryUpdateRequest } from "../../../models/Wallet";
import { ConfirmDialog } from "../ConfirmDialog";
import { DialogShell, Field, INPUT } from "./WalletDialogs";
import { DEMO_DISABLED_TITLE } from "../../preview/DemoBanner";

const KIND_TITLES: Record<CategoryKind, { title: string; desc: string }> = {
  spending: { title: "Money out", desc: "What spending is sorted into, and what budgets are set on." },
  income: { title: "Money in", desc: "Where money comes from, and what a money-in alert watches." },
};

/** A kind's categories as a <select>'s options, in tree order and indented by depth. */
export function CategoryOptions({ kind, disabled }: { kind: CategoryKind; disabled?: (c: Category) => boolean }) {
  const { categories } = useWallets();
  return (
    <>
      {categories.active(kind).map((c) => (
        <option key={c.uuid} value={c.uuid} disabled={disabled?.(c)}>{categoryOptionLabel(categories, c)}</option>
      ))}
    </>
  );
}

/**
 * CATEGORY PICKER — a movement's category, as a list of its own (a <select> can't hold a field):
 * the button shows the one picked, with its colour; open, its kind's tree (`value`: a uuid, "" for
 * none), indented, and last "Add new category", which turns into a field in place, the list kept
 * open, with ✓ beside it: the category is added at the top level of `kind` and picked at once.
 * Enter adds it; Esc leaves the field, then the list, never the dialog. The list is drawn over the
 * dialog (a portal, fixed under the button or above it with no room below), so its scrolling
 * box doesn't clip it.
 */
export function CategoryPicker({ kind, value, onChange, disabled }: {
  kind: CategoryKind;
  value: string;
  onChange: (uuid: string) => void;
  disabled?: boolean;
}) {
  const { categories, categoryAdded, sample } = useWallets();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const trimmed = name.trim();
  const taken = categories.children(null, kind).some((c) => categories.label({ categoryUuid: c.uuid }).toLowerCase() === trimmed.toLowerCase());
  const close = () => { setOpen(false); setAdding(false); setName(""); setError(null); };

  // Kept under the button (above it, without room below) as the dialog scrolls or the window resizes.
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom > 300 || r.top < 300;
      setPlace(below ? { left: r.left, width: r.width, top: r.bottom + 6 } : { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 6 });
    };
    measure();
    const outside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !list.current?.contains(t)) close();
    };
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    document.addEventListener("mousedown", outside);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      document.removeEventListener("mousedown", outside);
    };
  }, [open]);

  const pick = (uuid: string) => { onChange(uuid); close(); };
  const add = async () => {
    if (!trimmed || taken || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await walletService.createCategory({ kind, name: trimmed });
      categoryAdded(created);
      pick(created.uuid);
    } catch (err) {
      setError(errorText(err, "Unable to add this category."));
    } finally {
      setBusy(false);
    }
  };

  const row = "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[13px] transition-colors";
  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${INPUT} flex items-center gap-2 text-left`}
      >
        {value ? <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: categories.color({ categoryUuid: value }) }} /> : null}
        <span className={`flex-1 min-w-0 truncate ${value ? "" : "text-slate-400 font-normal"}`}>
          {value ? categories.label({ categoryUuid: value }) : "Uncategorised"}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && place && createPortal(
        <div
          ref={list}
          role="listbox"
          onKeyDown={(e) => {
            // The dialog's own Esc closes it: here it closes the field, then the list.
            if (e.key !== "Escape") return;
            e.stopPropagation();
            if (adding) { setAdding(false); setError(null); } else close();
          }}
          style={{ position: "fixed", left: place.left, width: place.width, top: place.top, bottom: place.bottom }}
          className="z-110 max-h-72 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200 shadow-[0_18px_40px_-16px_rgba(28,25,23,0.3)]"
        >
          <button type="button" role="option" aria-selected={!value} onClick={() => pick("")} className={`${row} ${!value ? "bg-[#C49A3C]/10" : "hover:bg-slate-50"}`}>
            <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-slate-300" />
            <span className="flex-1 text-slate-500">Uncategorised</span>
            {!value && <Check className="h-3.5 w-3.5 text-[#C49A3C]" />}
          </button>
          {categories.active(kind).map((c) => {
            const depth = categories.depth(c.uuid);
            const on = value === c.uuid;
            return (
              <button
                key={c.uuid}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => pick(c.uuid)}
                style={{ paddingLeft: `${12 + depth * 18}px` }}
                className={`${row} ${on ? "bg-[#C49A3C]/10" : "hover:bg-slate-50"}`}
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: categories.color({ categoryUuid: c.uuid }) }} />
                <span className={`flex-1 min-w-0 truncate ${depth === 0 ? "font-semibold text-slate-800" : "text-slate-600"}`}>{categories.label({ categoryUuid: c.uuid })}</span>
                {on && <Check className="h-3.5 w-3.5 text-[#C49A3C]" />}
              </button>
            );
          })}
          {!sample && (
            <div className="mt-1 pt-1 border-t border-slate-100">
              {adding ? (
                <div className="px-1 py-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
                      maxLength={40}
                      placeholder={kind === "spending" ? "New spending category" : "New income category"}
                      aria-label="New category's name"
                      className="min-w-0 flex-1 h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 placeholder:font-normal focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
                    />
                    <button
                      type="button"
                      onClick={() => void add()}
                      disabled={!trimmed || taken || busy}
                      aria-label="Add the category"
                      title="Add the category"
                      className="h-9 w-9 shrink-0 rounded-lg bg-[#1c1917] text-white hover:bg-[#C49A3C] flex items-center justify-center transition-colors disabled:opacity-40"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
                    </button>
                  </div>
                  {(taken || error) && <p className="px-1 text-[11px] font-semibold text-rose-600">{taken ? "There's a category with this name already." : error}</p>}
                </div>
              ) : (
                <button type="button" onClick={() => setAdding(true)} className={`${row} font-bold text-[#8A6A28] hover:bg-[#C49A3C]/10`}>
                  <Plus className="h-3.5 w-3.5" /> Add new category
                </button>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

type Dialog =
  | { kind: "new"; type: CategoryKind; parent: Category | null }
  | { kind: "edit"; category: Category }
  | { kind: "delete"; category: Category };

/**
 * CATEGORIES — Settings' Categories tab: the user's own, money out and money in each a tree up to
 * three levels deep, across every wallet as budgets are (one is also added from a movement's
 * dialog, see CategoryPicker). Every user starts with the presets, which are theirs like any other:
 * a category is added (at the top or under another), renamed, recoloured, moved (its subcategories
 * with it) and deleted, what it had going to its parent. A demo account's are its sample's, read
 * only: the buttons show, disabled, so it's clear where categories are changed.
 */
export function WalletCategories() {
  const { categories, categoriesError, sample, changed } = useWallets();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  if (categoriesError === undefined) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 text-[#C49A3C] animate-spin" /></div>;
  if (categories.active().length === 0) {
    return <p className="text-sm font-semibold text-rose-600">{categoriesError ?? "Your categories can't be read right now. Try again later."}</p>;
  }

  const close = () => { setDialog(null); setDialogError(null); };
  const remove = async (category: Category) => {
    setBusy(true);
    setDialogError(null);
    try {
      await walletService.deleteCategories([category.uuid]);
      close();
      changed();
    } catch (err) {
      setDialogError(errorText(err, "Unable to delete this category."));
    } finally {
      setBusy(false);
    }
  };
  const lock = sample ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {(["spending", "income"] as const).map((kind) => (
          <section key={kind} className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  {KIND_TITLES[kind].title} <span className="text-slate-400 font-semibold">({categories.active(kind).length})</span>
                </h4>
                <p className="text-[12px] text-slate-500 mt-0.5">{KIND_TITLES[kind].desc}</p>
              </div>
              <button
                type="button"
                onClick={() => setDialog({ kind: "new", type: kind, parent: null })}
                {...lock}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 bg-[#1c1917] text-white hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1c1917]"
              >
                <Plus className="h-3.5 w-3.5" /> New category
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {categories.active(kind).map((c) => {
                const depth = categories.depth(c.uuid);
                return (
                  <li key={c.uuid} className="flex items-center gap-2 pr-4 py-2.5" style={{ paddingLeft: `${24 + depth * 22}px` }}>
                    {depth > 0 && <span className="h-3 w-2.5 -mt-2 border-l-2 border-b-2 border-slate-200 rounded-bl shrink-0" />}
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: categories.color({ categoryUuid: c.uuid }) }} />
                    <span className={`flex-1 min-w-0 truncate text-[13px] ${depth === 0 ? "font-bold text-slate-800" : "font-semibold text-slate-600"}`}>
                      {categories.label({ categoryUuid: c.uuid })}
                    </span>
                    {depth < CATEGORY_MAX_DEPTH - 1 && (
                      <IconButton label="Add a subcategory" onClick={() => setDialog({ kind: "new", type: kind, parent: c })} {...lock}>
                        <Plus className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                    <IconButton label="Edit the category" onClick={() => setDialog({ kind: "edit", category: c })} {...lock}>
                      <Pencil className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label="Delete the category" danger onClick={() => { setDialogError(null); setDialog({ kind: "delete", category: c }); }} {...lock}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {dialog?.kind === "new" && (
        <CategoryDialog type={dialog.type} parent={dialog.parent} onClose={close} onSaved={() => { close(); changed(); }} />
      )}
      {dialog?.kind === "edit" && (
        <CategoryDialog type={dialog.category.kind} category={dialog.category} onClose={close} onSaved={() => { close(); changed(); }} />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title={`Delete "${categories.label({ categoryUuid: dialog.category.uuid })}"?`}
          description={deleteText(categories, dialog.category)}
          confirming={busy}
          error={dialogError}
          onConfirm={() => remove(dialog.category)}
          onClose={close}
        />
      )}
    </>
  );
}

/** Where a deleted category's contents go: its parent's, or (a top-level one) out of any category. */
function deleteText(tree: CategoryTree, c: Category) {
  const parent = tree.get(c.parentUuid);
  const hasChildren = tree.children(c.uuid).length > 0;
  const alerts = c.kind === "income" ? " and money-in alerts" : "";
  const budget = c.kind === "spending" ? " A budget on it ends this month; the months before keep it." : "";
  if (parent) {
    const parentName = tree.label({ categoryUuid: parent.uuid });
    return `${hasChildren ? "Its subcategories, movements" : "Its movements"}, payee rules${alerts} move to ${parentName}.${budget}`;
  }
  return `${hasChildren ? "Its subcategories become top-level categories, and its movements" : "Its movements become"} uncategorised; its payee rules${alerts} are deleted.${budget}`;
}

function IconButton({ label, onClick, danger, disabled, title, children }: {
  label: string; onClick: () => void; danger?: boolean; disabled?: boolean; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-lg text-slate-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400 ${
        danger ? "hover:text-rose-600 hover:bg-rose-50" : "hover:text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

// The "Under" field's value for the top level.
const TOP = "";

/**
 * A new category (of `type`, under `parent` or at the top) or one to change: its name (unique
 * among its siblings), where it sits (its subcategories move with it, no deeper than the tree
 * goes) and its colour (none: its preset's, or its parent's).
 */
function CategoryDialog({ type, parent, category, onClose, onSaved }: {
  type: CategoryKind;
  parent?: Category | null;
  category?: Category;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { categories } = useWallets();
  const [name, setName] = useState(category ? categories.label({ categoryUuid: category.uuid }) : "");
  const [under, setUnder] = useState(category ? category.parentUuid ?? TOP : parent?.uuid ?? TOP);
  const [color, setColor] = useState<string | null>(category?.color ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Levels the category takes up: itself, and its subcategories under it.
  const levels = category ? 1 + categories.height(category.uuid) : 1;
  const moved = category ? new Set([category.uuid, ...categories.descendants(category.uuid).map((c) => c.uuid)]) : new Set<string>();
  const canHold = (p: Category) => !moved.has(p.uuid) && categories.depth(p.uuid) + 1 + levels <= CATEGORY_MAX_DEPTH;
  const siblings = categories.children(under || null, type).filter((c) => c.uuid !== category?.uuid);
  const trimmed = name.trim();
  const taken = siblings.some((c) => categories.label({ categoryUuid: c.uuid }).toLowerCase() === trimmed.toLowerCase());
  const valid = trimmed.length > 0 && trimmed.length <= 40 && !taken;
  // The colour it shows with none of its own: its preset's, or the parent it would have.
  const inherited = category?.preset ? CATEGORY_COLORS[category.preset] : under ? categories.color({ categoryUuid: under }) : CUSTOM_CATEGORY_COLOR;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!category) {
        await walletService.createCategory({ kind: type, parentUuid: under || null, name: trimmed, ...(color ? { color } : {}) });
      } else {
        // Only what changed: a preset never renamed keeps its name unless it's changed here.
        const changes: CategoryUpdateRequest = {};
        if (trimmed !== categories.label({ categoryUuid: category.uuid })) changes.name = trimmed;
        if (color !== category.color) changes.color = color ?? "";
        if (under !== (category.parentUuid ?? TOP)) {
          if (under) changes.parentUuid = under;
          else changes.moveToTop = true;
        }
        if (Object.keys(changes).length > 0) await walletService.updateCategory(category.uuid, changes);
      }
      onSaved();
    } catch (err) {
      setError(errorText(err, "Unable to save this category."));
      setBusy(false);
    }
  };

  return (
    <DialogShell
      icon={category ? <Pencil className="h-5 w-5" /> : <FolderTree className="h-5 w-5" />}
      title={category ? "Edit category" : parent ? `New category in ${categories.label({ categoryUuid: parent.uuid })}` : "New category"}
      subtitle={`${KIND_TITLES[type].title}, across all your wallets`}
      busy={busy}
      error={error}
      submitLabel={category ? "Save" : "Add category"}
      canSubmit={valid}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field label="Name" hint={taken ? "Another category there has this name." : undefined}>
        <input className={INPUT} autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={type === "spending" ? "Gym" : "Bonus"} />
      </Field>
      <Field label="Under" hint={category && levels > 1 ? "Its subcategories move with it." : undefined}>
        <select className={INPUT} value={under} onChange={(e) => setUnder(e.target.value)}>
          <option value={TOP}>Top level</option>
          <CategoryOptions kind={type} disabled={(p) => !canHold(p)} />
        </select>
      </Field>
      <div className="space-y-1.5">
        <span className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Colour</span>
        <div className="flex flex-wrap items-center gap-2">
          <Swatch color={inherited} label="Default" on={color === null} onClick={() => setColor(null)} dashed />
          {CATEGORY_PALETTE.map((c) => <Swatch key={c} color={c} label={c} on={color === c} onClick={() => setColor(c)} />)}
        </div>
        <span className="block text-[11px] text-slate-400">
          {color === null ? (category?.preset ? "The preset's own colour." : under ? "The colour of the category it's in." : "A neutral grey.") : "Its own colour."}
        </span>
      </div>
    </DialogShell>
  );
}

function Swatch({ color, label, on, onClick, dashed }: { color: string; label: string; on: boolean; onClick: () => void; dashed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={`h-8 w-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${on ? "ring-2 ring-offset-2 ring-slate-900" : ""} ${dashed ? "border-2 border-dashed border-white outline outline-slate-300" : ""}`}
      style={{ background: color }}
    >
      {on && <Check className="h-4 w-4 text-white" />}
    </button>
  );
}
