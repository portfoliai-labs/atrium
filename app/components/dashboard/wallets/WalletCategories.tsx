// components/dashboard/wallets/WalletCategories.tsx
"use client";

import { useState } from "react";
import { Check, FolderTree, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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

type Dialog =
  | { kind: "new"; type: CategoryKind; parent: Category | null }
  | { kind: "edit"; category: Category }
  | { kind: "delete"; category: Category };

/**
 * CATEGORIES — the user's own, money out and money in each a tree up to three levels deep, across
 * every wallet as budgets are. Every user starts with the presets, which are theirs like any other:
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
