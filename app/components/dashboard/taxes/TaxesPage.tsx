// components/dashboard/taxes/TaxesPage.tsx
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Hourglass, Info, Loader2, Landmark } from "lucide-react";
import { usePortfolio } from "../../../context/PortfolioContext";
import { taxService } from "../../../services/taxService";
import { ApiError } from "../../../services/apiClient";
import { formatCurrency, formatQuantity } from "../../../lib/format";
import {
  COST_METHOD_LABELS, INCOME_KIND_LABELS, TAX_DISCLAIMER, TAXATION_MODE_LABELS, categoryDetail, categoryLabel, ratePct, taxYears,
} from "../../../lib/taxes";
import {
  TAX_REGIME_UNAVAILABLE,
  type CarriedLoss, type CostMethod, type IncomeCategory, type IncomePayment, type InvestmentIncome, type RealizedGain,
  type RealizedGains, type TaxedIncome, type TaxYear, type UnrealizedGain,
} from "../../../models/Tax";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { Fig, Figs, Module, ModuleHead, MODULE_BODY } from "../PerformanceSection";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;

// What a request came back with: the answer, or why there's none.
type Loaded<T> = { key: string; data: T | null; error: string | null; noRegime?: boolean };

const errorText = (err: unknown, what: string) => {
  if (err instanceof ApiError && err.status === 503) return `A currency's exchange rate is missing, so ${what} can't be computed yet. Try again later.`;
  if (err instanceof ApiError && err.status === 403) return `You can't read ${what} for this account.`;
  return err instanceof Error ? err.message : `Unable to load ${what}.`;
};

const assetName = (a: { ticker: string | null; isin: string | null; assetId: string }) => a.ticker ?? a.isin ?? a.assetId;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const toneOf = (v: number): "gain" | "loss" | undefined => (v > 0 ? "gain" : v < 0 ? "loss" : undefined);
const toneClass = (v: number) => (v > 0 ? "text-[#047857]" : v < 0 ? "text-[#e11d48]" : "text-[#1c1917]");

/**
 * TAXES — the taxes on the user's investments for a calendar year (an advisor's client's, on the
 * client's Wealth), across every real portfolio (not the backtests): All portfolios' Taxes page,
 * or the only portfolio's. By the regime of their tax residence (Italy only, for now):
 * - what goes in the tax return (the declared portfolios'), by kind of income, with the earlier
 *   losses each one took; and what each withheld portfolio's broker takes;
 * - the losses carried to the years after (the zainetto fiscale), each the tax return's or one
 *   broker's, and those whose last year it is: in the year in course, the positions in gain that
 *   would take them before they're lost, and those that wouldn't (an ETF's gain);
 * - the year's sales, each against what its units cost (the regime's method, or FIFO / average
 *   cost on request);
 * - the year's investment income (dividends, coupons, interest): a declared portfolio's taxed in
 *   the tax return by its own categories, never offset with the gains' losses; a withheld one's
 *   taxed at source by its broker.
 * Without a residence (or with one that has no regime) only the sales and the income are there,
 * with the way to set it (`onOpenSettings`). Every figure is an estimate on the recorded transactions: the page says
 * so, the backend doesn't. Who pays a portfolio's taxes is set in Manage portfolios (`onOpenPortfolios`).
 */
export function TaxesPage({ trail, onOpenSettings, onOpenPortfolios }: {
  trail: Crumb[];
  // Where the tax residence is set: the user's Settings, a client's settings.
  onOpenSettings?: () => void;
  // Where each portfolio's taxation mode is set.
  onOpenPortfolios: () => void;
}) {
  const { portfolios, client } = usePortfolio();
  const clientUuid = client?.uuid ?? null;
  const years = useMemo(() => taxYears(), []);
  const [year, setYear] = useState(years[0]);
  // null: the regime's own.
  const [method, setMethod] = useState<CostMethod | null>(null);
  const [taxYear, setTaxYear] = useState<Loaded<TaxYear> | null>(null);
  const [gains, setGains] = useState<Loaded<RealizedGains> | null>(null);
  const [income, setIncome] = useState<Loaded<InvestmentIncome> | null>(null);

  const yearKey = `${clientUuid}:${year}`;
  const gainsKey = `${yearKey}:${method}`;
  // A residence set elsewhere (another tab, the client's settings) is read on the next visit.
  useEffect(() => {
    let cancelled = false;
    taxService.year(year, clientUuid)
      .then((data) => { if (!cancelled) setTaxYear({ key: yearKey, data, error: null }); })
      .catch((err) => {
        if (cancelled) return;
        const noRegime = err instanceof ApiError && err.status === 409 && err.errorType === TAX_REGIME_UNAVAILABLE;
        setTaxYear({ key: yearKey, data: null, error: noRegime ? null : errorText(err, "this year's taxes"), noRegime });
      });
    return () => { cancelled = true; };
  }, [year, clientUuid, yearKey]);
  useEffect(() => {
    let cancelled = false;
    taxService.income(year, clientUuid)
      .then((data) => { if (!cancelled) setIncome({ key: yearKey, data, error: null }); })
      .catch((err) => { if (!cancelled) setIncome({ key: yearKey, data: null, error: errorText(err, "this year's income") }); });
    return () => { cancelled = true; };
  }, [year, clientUuid, yearKey]);
  useEffect(() => {
    let cancelled = false;
    taxService.realizedGains(year, method, clientUuid)
      .then((data) => { if (!cancelled) setGains({ key: gainsKey, data, error: null }); })
      .catch((err) => { if (!cancelled) setGains({ key: gainsKey, data: null, error: errorText(err, "this year's sales") }); });
    return () => { cancelled = true; };
  }, [year, method, clientUuid, gainsKey]);

  const tax = taxYear?.key === yearKey ? taxYear : null;
  const sales = gains?.key === gainsKey ? gains : null;
  const payments = income?.key === yearKey ? income : null;
  // The gains of the year asked before, kept on screen while another method's load.
  const shownSales = sales ?? (gains?.key.startsWith(`${yearKey}:`) ? gains : null);

  const nameOf = useMemo(() => {
    const names = new Map(portfolios.map((p) => [p.uuid, p.name]));
    return (uuid: string | null) => (uuid ? names.get(uuid) ?? "A portfolio" : "Your tax return");
  }, [portfolios]);
  const withheldPortfolios = portfolios.filter((p) => !p.isVirtual && p.taxationMode === "withheld");
  const isCurrent = year === years[0];
  const whose = client ? `${client.name}'s` : "your";

  const right = (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Tax year</span>
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="appearance-none h-10 pl-4 pr-9 rounded-xl bg-white border border-[#E0DACC] text-[13px] font-bold text-[#1c1917] outline-none hover:border-[#C49A3C] focus:ring-2 focus:ring-[#C49A3C]/30"
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[#857e78]" />
    </label>
  );

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Taxes" right={right} />

      <div className="flex flex-col gap-2">
        {/* The page's name, as the other pages have it; the year is the picker's, beside the trail. */}
        <h1 className="text-[30px] md:text-[40px] font-bold text-[#1c1917] leading-[1.05]" style={serif}>
          {client ? `${client.name}'s taxes on investments` : "Taxes on investments"}
        </h1>
        <p className="flex items-start gap-2 text-[12.5px] text-[#78716c] max-w-3xl">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {TAX_DISCLAIMER}
        </p>
      </div>

      {tax === null ? (
        <Loading />
      ) : tax.noRegime ? (
        <NoRegime client={client?.name} onOpenSettings={onOpenSettings} />
      ) : tax.error ? (
        <ErrorNote text={tax.error} />
      ) : tax.data && (
        <TaxYearModules
          data={tax.data}
          net={shownSales?.data?.net ?? null}
          incomeGross={payments?.data?.totalGross ?? null}
          isCurrent={isCurrent}
          nameOf={nameOf}
          whose={whose}
          withheldCount={withheldPortfolios.length}
          onOpenPortfolios={onOpenPortfolios}
        />
      )}

      <RealizedGainsModule
        loaded={shownSales}
        loading={sales === null}
        method={method}
        onMethod={setMethod}
        nameOf={nameOf}
        whose={whose}
      />

      <IncomeModule loaded={payments} nameOf={nameOf} whose={whose} />
    </div>
  );
}

function Loading() {
  return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></div>;
}

function ErrorNote({ text }: { text: string }) {
  return <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">{text}</p>;
}

/** No tax residence, or one without a regime: the taxes can't be computed, the sales still read. */
function NoRegime({ client, onOpenSettings }: { client?: string; onOpenSettings?: () => void }) {
  return (
    <Module>
      <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-xl bg-[#C49A3C]/10 text-[#C49A3C] shrink-0"><Landmark className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-bold text-[#1c1917]">
              {client ? `Set ${client}'s tax residence to estimate their taxes` : "Set your tax residence to estimate your taxes"}
            </p>
            <p className="text-[12.5px] text-[#78716c] mt-0.5 max-w-xl">
              The taxes due, the losses carried forward and those about to expire follow the rules of the country
              {client ? " they pay" : " you pay"} taxes in. Only Italy&apos;s are computed for now. The year&apos;s sales and income are below either way.
            </p>
          </div>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-[12.5px] font-bold hover:bg-[#131210] transition-colors"
          >
            {client ? "Client settings" : "Set tax residence"}
          </button>
        )}
      </div>
    </Module>
  );
}

// ── The year by the regime ────────────────────────────────────────────────────────────────

function TaxYearModules({ data, net, incomeGross, isCurrent, nameOf, whose, withheldCount, onOpenPortfolios }: {
  data: TaxYear;
  // The year's realized net, from the sales (null while they load).
  net: number | null;
  // The year's investment income before taxes, from the payments (null while they load).
  incomeGross: number | null;
  isCurrent: boolean;
  nameOf: (uuid: string | null) => string;
  whose: string;
  withheldCount: number;
  onOpenPortfolios: () => void;
}) {
  const money = (v: number) => formatCurrency(v, data.currency);
  const carried = data.carriedLosses.reduce((s, l) => s + l.amount, 0);
  const expiring = data.expiringLosses.reduce((s, l) => s + l.amount, 0);
  // Each withheld portfolio's gains and income, as its broker taxed them.
  const withheldUuids = [...new Set([...data.withheld.map((w) => w.portfolioUuid), ...data.withheldIncome.map((w) => w.portfolioUuid)])];

  return (
    <>
      <Module>
        <ModuleHead title="The year at a glance" />
        <div className={MODULE_BODY}>
          <Figs>
            <Fig
              label="Tax to declare"
              value={money(data.tax + data.incomeTax)}
              sub={`${money(data.tax)} on gains · ${money(data.incomeTax)} on income`}
              strong
              info="What the declared portfolios' gains and income owe, to put in the tax return."
            />
            <Fig label="Withheld by brokers" value={money(data.withheldTax)} info="What the brokers of the portfolios under the regime amministrato withhold on their gains. Their income was taxed at source." />
            <Fig label="Net realized" value={net === null ? "—" : money(net)} tone={net === null ? undefined : toneOf(net)} info="The year's gains less its losses, on every portfolio." />
            <Fig label="Investment income" value={incomeGross === null ? "—" : money(incomeGross)} info="The year's dividends, coupons and interest before taxes, on every portfolio." />
            <Fig label="Losses carried forward" value={money(carried)} sub={expiring > 0 ? `${money(expiring)} expire this year` : undefined} />
          </Figs>
          <p className="mt-4 text-xs text-[#78716c]">
            {withheldCount === 0
              ? `Every portfolio is declared in ${whose} tax return. `
              : `${withheldCount} ${withheldCount === 1 ? "portfolio is" : "portfolios are"} taxed by the broker: their gains and losses are their own. `}
            <button type="button" onClick={onOpenPortfolios} className="font-bold text-[#C49A3C] hover:text-[#a87f2f] underline underline-offset-2">
              Who pays each portfolio&apos;s taxes
            </button>
          </p>
        </div>
      </Module>

      {data.expiringLosses.length > 0 && (
        <ExpiringLosses losses={data.expiringLosses} harvestable={data.harvestable} year={data.year} isCurrent={isCurrent} money={money} nameOf={nameOf} />
      )}

      <Module>
        <ModuleHead title="Tax return" desc="The declared portfolios' gains and income, by kind" />
        <div className={`${MODULE_BODY} space-y-6`}>
          {data.incomes.length === 0 && data.investmentIncome.length === 0 && (
            <Empty text={`Nothing to declare from ${whose} investments in ${data.year}.`} />
          )}
          {data.incomes.length > 0 && (
            <div className="space-y-2">
              <SubHead title="Capital gains" note="Offset by the losses" />
              <IncomesTable incomes={data.incomes} money={money} total={data.tax} />
            </div>
          )}
          {data.investmentIncome.length > 0 && (
            <div className="space-y-2">
              <SubHead title="Dividends, coupons and interest" note="Quadro RM · never offset by the losses" />
              <IncomeCategoriesTable categories={data.investmentIncome} money={money} total={data.incomeTax} />
            </div>
          )}
        </div>
      </Module>

      {withheldUuids.length > 0 && (
        <Module>
          <ModuleHead title="Withheld by the broker" desc="What each portfolio under the regime amministrato has taken from it" />
          <div className={`${MODULE_BODY} space-y-6`}>
            {withheldUuids.map((uuid) => {
              const gains = data.withheld.find((w) => w.portfolioUuid === uuid);
              const income = data.withheldIncome.find((w) => w.portfolioUuid === uuid);
              return (
                <div key={uuid} className="space-y-2">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-bold text-[#1c1917]">{nameOf(uuid)}</span>
                    {gains && <span className="text-sm font-bold tabular-nums text-[#1c1917]">{money(gains.tax)} on gains</span>}
                  </p>
                  {gains && gains.incomes.length > 0 ? <IncomesTable incomes={gains.incomes} money={money} total={gains.tax} /> : <Empty text="No gains or losses this year." />}
                  {income && (
                    <p className="text-xs text-[#78716c]">
                      Income <b className="text-[#1c1917] tabular-nums">{money(income.gross)}</b> gross
                      {income.withheldAtSource > 0 && <>, <b className="text-[#1c1917] tabular-nums">{money(income.withheldAtSource)}</b> withheld abroad</>}
                      : taxed at source by the broker.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Module>
      )}

      <Module>
        <ModuleHead title="Losses carried forward" desc="Losses left to offset later gains (the zainetto fiscale)" />
        <div className={MODULE_BODY}>
          {data.carriedLosses.length === 0
            ? <Empty text={`No losses left for the years after ${data.year}.`} />
            : <LossesTable losses={data.carriedLosses} money={money} nameOf={nameOf} />}
        </div>
      </Module>

      {data.unclassifiedAssetIds.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-[#78716c]">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {data.unclassifiedAssetIds.length === 1 ? "One security" : `${data.unclassifiedAssetIds.length} securities`} couldn&apos;t be classified from the market data, so
          {data.unclassifiedAssetIds.length === 1 ? " it is" : " they are"} taxed as {categoryLabel("redditi_diversi").toLowerCase()}: check {data.unclassifiedAssetIds.length === 1 ? "it" : "them"} with your advisor.
        </p>
      )}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[13px] text-[#78716c]">{text}</p>;
}

function SubHead({ title, note }: { title: string; note?: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-[13px] font-bold text-[#1c1917]">{title}</span>
      {note && <span className="text-[11px] text-[#857e78]">{note}</span>}
    </p>
  );
}

const TH = "py-2 pr-4 text-left text-[10px] font-black uppercase tracking-[0.12em] text-[#857e78] whitespace-nowrap";
const THR = `${TH} text-right pr-0 pl-4`;
const TD = "py-2.5 pr-4 align-top";
const TDR = "py-2.5 pl-4 text-right tabular-nums align-top whitespace-nowrap";

function IncomesTable({ incomes, money, total }: { incomes: TaxedIncome[]; money: (v: number) => string; total: number }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[620px] text-[13px]">
        <thead className="border-b border-[#EEE9DD]">
          <tr>
            <th className={TH}>Income</th>
            <th className={THR}>Gains</th>
            <th className={THR}>Losses</th>
            <th className={THR}>Past losses used</th>
            <th className={THR}>Taxable</th>
            <th className={THR}>Rate</th>
            <th className={THR}>Tax</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EEE9DD]">
          {incomes.map((i) => {
            const offset = i.offsetLosses.reduce((s, o) => s + o.amount, 0);
            return (
              <tr key={i.category}>
                <td className={TD}>
                  <span className="block font-semibold text-[#1c1917]">{categoryLabel(i.category)}</span>
                  {categoryDetail(i.category) && <span className="block text-[11px] text-[#857e78]">{categoryDetail(i.category)}</span>}
                </td>
                <td className={`${TDR} text-[#047857]`}>{money(i.gains)}</td>
                <td className={`${TDR} ${i.losses < 0 ? "text-[#e11d48]" : ""}`}>{money(i.losses)}</td>
                <td className={TDR} title={i.offsetLosses.map((o) => `${o.originYear}: ${money(o.amount)}`).join("\n") || undefined}>
                  {offset === 0 ? "—" : money(offset)}
                  {i.offsetLosses.length > 0 && (
                    <span className="block text-[11px] text-[#857e78]">from {i.offsetLosses.map((o) => o.originYear).join(", ")}</span>
                  )}
                </td>
                <td className={TDR}>{money(i.taxable)}</td>
                <td className={TDR}>{ratePct(i.rate)}</td>
                <td className={`${TDR} font-bold text-[#1c1917]`}>{money(i.tax)}</td>
              </tr>
            );
          })}
        </tbody>
        {incomes.length > 1 && (
          <tfoot className="border-t border-[#E0DACC]">
            <tr>
              <td className={`${TD} font-bold`} colSpan={6}>Total</td>
              <td className={`${TDR} font-bold`}>{money(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function IncomeCategoriesTable({ categories, money, total }: { categories: IncomeCategory[]; money: (v: number) => string; total: number }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[620px] text-[13px]">
        <thead className="border-b border-[#EEE9DD]">
          <tr>
            <th className={TH}>Income</th>
            <th className={THR}>Gross</th>
            <th className={THR}>Withheld abroad</th>
            <th className={THR}>Accrued paid</th>
            <th className={THR}>Taxable</th>
            <th className={THR}>Rate</th>
            <th className={THR}>Tax</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EEE9DD]">
          {categories.map((c) => (
            <tr key={c.category}>
              <td className={TD}>
                <span className="block font-semibold text-[#1c1917]">{categoryLabel(c.category)}</span>
                {categoryDetail(c.category) && <span className="block text-[11px] text-[#857e78]">{categoryDetail(c.category)}</span>}
              </td>
              <td className={TDR}>{money(c.gross)}</td>
              <td className={TDR}>{c.withheldAtSource === 0 ? "—" : money(c.withheldAtSource)}</td>
              <td className={TDR} title="The accrued interest paid with a bond's purchase, which its coupon gives back">
                {c.accruedOffset === 0 ? "—" : money(c.accruedOffset)}
              </td>
              <td className={TDR}>{money(c.taxable)}</td>
              <td className={TDR}>{ratePct(c.rate)}</td>
              <td className={`${TDR} font-bold text-[#1c1917]`}>{money(c.tax)}</td>
            </tr>
          ))}
        </tbody>
        {categories.length > 1 && (
          <tfoot className="border-t border-[#E0DACC]">
            <tr>
              <td className={`${TD} font-bold`} colSpan={6}>Total</td>
              <td className={`${TDR} font-bold`}>{money(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function LossesTable({ losses, money, nameOf }: { losses: CarriedLoss[]; money: (v: number) => string; nameOf: (uuid: string | null) => string }) {
  const sorted = [...losses].sort((a, b) => a.usableUntil - b.usableUntil || a.originYear - b.originYear);
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead className="border-b border-[#EEE9DD]">
          <tr>
            <th className={TH}>Offsets</th>
            <th className={TH}>Where</th>
            <th className={THR}>From</th>
            <th className={THR}>Usable until</th>
            <th className={THR}>Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EEE9DD]">
          {sorted.map((l) => (
            <tr key={`${l.category}:${l.originYear}:${l.portfolioUuid}`}>
              <td className={`${TD} font-semibold text-[#1c1917]`}>{categoryLabel(l.category)}</td>
              <td className={`${TD} text-[#78716c]`}>{l.portfolioUuid ? `${nameOf(l.portfolioUuid)} (broker)` : "Tax return"}</td>
              <td className={TDR}>{l.originYear}</td>
              <td className={TDR}>31 Dec {l.usableUntil}</td>
              <td className={`${TDR} font-bold text-[#e11d48]`}>{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The losses whose last year it is: lost on 31 December. In the year in course, the positions in
 * gain that would take them if sold (each where the loss is: the tax return's take the declared
 * portfolios' gains, a broker's its own portfolio's), and those whose gain wouldn't.
 */
function ExpiringLosses({ losses, harvestable, year, isCurrent, money, nameOf }: {
  losses: CarriedLoss[];
  harvestable: UnrealizedGain[];
  year: number;
  isCurrent: boolean;
  money: (v: number) => string;
  nameOf: (uuid: string | null) => string;
}) {
  const total = losses.reduce((s, l) => s + l.amount, 0);
  const absorbing = harvestable.filter((h) => h.offsets !== null);
  const notAbsorbing = harvestable.filter((h) => h.offsets === null);

  return (
    <section className="rounded-[1.75rem] border border-amber-300 bg-amber-50/70 overflow-hidden">
      <div className="px-6 pt-[22px] pb-4 flex items-start gap-3">
        <Hourglass className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-bold text-[#1c1917]">
            {money(total)} of losses {isCurrent ? "expire" : "expired"} on 31 December {year}
          </h2>
          <p className="text-[12.5px] text-[#78716c] mt-0.5">
            {isCurrent
              ? "Gains realized before then can use them; after, they're lost."
              : "Whatever this year's gains didn't use was lost."}
          </p>
        </div>
      </div>
      <div className="px-6 pb-[22px] space-y-5">
        <ul className="flex flex-wrap gap-2">
          {losses.map((l) => (
            <li key={`${l.category}:${l.originYear}:${l.portfolioUuid}`} className="px-3 py-1.5 rounded-full bg-white border border-amber-200 text-xs text-[#78716c]">
              <b className="text-[#1c1917] tabular-nums">{money(l.amount)}</b> · {categoryLabel(l.category).toLowerCase()} from {l.originYear} · {l.portfolioUuid ? `${nameOf(l.portfolioUuid)} (broker)` : "tax return"}
            </li>
          ))}
        </ul>

        {isCurrent && absorbing.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#78716c]">Positions in gain that would use them</p>
            <HarvestTable rows={absorbing} money={money} nameOf={nameOf} />
          </div>
        )}
        {isCurrent && harvestable.length === 0 && (
          <p className="text-[12.5px] text-[#78716c]">No position held is in a gain that could use them.</p>
        )}
        {isCurrent && notAbsorbing.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> In gain, but selling them doesn&apos;t use the losses
            </p>
            <p className="text-[12px] text-[#78716c]">
              An ETF&apos;s or a fund&apos;s gain is income from capital (redditi di capitale): it&apos;s taxed in full and offsets no loss.
            </p>
            <HarvestTable rows={notAbsorbing} money={money} nameOf={nameOf} />
          </div>
        )}
        {isCurrent && harvestable.length > 0 && (
          <p className="text-[11px] text-[#857e78]">Valued at the last prices available. Selling to realize a gain is a decision to weigh with your advisor.</p>
        )}
      </div>
    </section>
  );
}

function HarvestTable({ rows, money, nameOf }: { rows: UnrealizedGain[]; money: (v: number) => string; nameOf: (uuid: string | null) => string }) {
  const sorted = [...rows].sort((a, b) => b.gain - a.gain);
  return (
    <div className="overflow-x-auto -mx-1 px-1 rounded-2xl bg-white border border-amber-200">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead className="border-b border-[#EEE9DD]">
          <tr>
            <th className={`${TH} pl-4`}>Security</th>
            <th className={TH}>Where</th>
            <th className={THR}>Quantity</th>
            <th className={THR}>Value</th>
            <th className={`${THR} pr-4`}>Gain</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EEE9DD]">
          {sorted.map((h) => (
            <tr key={`${h.portfolioUuid}:${h.assetId}`}>
              <td className={`${TD} pl-4`}>
                <span className="block font-semibold text-[#1c1917]">{assetName(h)}</span>
                <span className="block text-[11px] text-[#857e78]">
                  {categoryLabel(h.taxCategory)}{h.taxableShare < 1 ? ` · ${ratePct(h.taxableShare)} taxable` : ""}
                </span>
              </td>
              <td className={`${TD} text-[#78716c]`}>{h.portfolioUuid ? nameOf(h.portfolioUuid) : "Declared portfolios"}</td>
              <td className={TDR}>{formatQuantity(h.quantity)}</td>
              <td className={TDR}>{money(h.value)}</td>
              <td className={`${TDR} pr-4 font-bold text-[#047857]`}>{money(h.gain)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── The year's sales ──────────────────────────────────────────────────────────────────────

function RealizedGainsModule({ loaded, loading, method, onMethod, nameOf, whose }: {
  loaded: Loaded<RealizedGains> | null;
  loading: boolean;
  method: CostMethod | null;
  onMethod: (method: CostMethod | null) => void;
  nameOf: (uuid: string | null) => string;
  whose: string;
}) {
  const data = loaded?.data ?? null;
  const shownMethod = method ?? data?.method ?? null;
  const [open, setOpen] = useState<string | null>(null);

  const methodToggle = (
    <div className="flex items-center gap-2">
      {loading && loaded && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C49A3C]" />}
      <div role="radiogroup" aria-label="Cost method" className="inline-flex p-0.5 rounded-xl bg-[#F7F5EF] border border-[#EEE9DD]">
        {(Object.keys(COST_METHOD_LABELS) as CostMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={shownMethod === m}
            onClick={() => onMethod(m)}
            className={`px-3 py-1.5 rounded-[10px] text-[11.5px] font-bold transition-colors ${shownMethod === m ? "bg-white text-[#1c1917] shadow-sm" : "text-[#78716c] hover:text-[#1c1917]"}`}
          >
            {COST_METHOD_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  );

  const money = (v: number) => formatCurrency(v, data?.currency ?? "EUR");
  const sorted = data ? [...data.gains].sort((a, b) => b.executedAt.localeCompare(a.executedAt)) : [];
  const uncovered = sorted.filter((g) => g.uncoveredQuantity > 0).length;

  return (
    <Module>
      <ModuleHead title="Realized gains and losses" desc="The year's sales, each against what its units cost" right={methodToggle} />
      <div className={`${MODULE_BODY} space-y-5`}>
        {!loaded ? <Loading /> : loaded.error ? <ErrorNote text={loaded.error} /> : data && (
          <>
            <Figs>
              <Fig label="Gains" value={money(data.totalGains)} tone={data.totalGains > 0 ? "gain" : undefined} />
              <Fig label="Losses" value={money(data.totalLosses)} tone={data.totalLosses < 0 ? "loss" : undefined} />
              <Fig label="Net" value={money(data.net)} tone={toneOf(data.net)} strong />
            </Figs>
            {method === null && data.taxResidence && (
              <p className="text-xs text-[#78716c]">
                {COST_METHOD_LABELS[data.method]}, as {whose} tax residence&apos;s rules take it. FIFO is shown for comparison only.
              </p>
            )}

            {data.byPortfolio.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {data.byPortfolio.map((b) => (
                  <span key={b.key} className="px-3 py-1.5 rounded-full border border-[#E0DACC] text-xs text-[#78716c]">
                    {nameOf(b.key)} · <b className={`tabular-nums ${toneClass(b.net)}`}>{money(b.net)}</b>
                  </span>
                ))}
              </div>
            )}

            {sorted.length === 0 ? (
              <Empty text="No sales this year." />
            ) : (
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead className="border-b border-[#EEE9DD]">
                    <tr>
                      <th className={TH}>Date</th>
                      <th className={TH}>Security</th>
                      <th className={TH}>Portfolio</th>
                      <th className={THR}>Quantity</th>
                      <th className={THR}>Proceeds</th>
                      <th className={THR}>Cost</th>
                      <th className={THR}>Gain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEE9DD]">
                    {sorted.map((g) => (
                      <SaleRow
                        key={g.transactionUuid}
                        gain={g}
                        money={money}
                        portfolio={nameOf(g.portfolioUuid)}
                        open={open === g.transactionUuid}
                        onToggle={() => setOpen((o) => (o === g.transactionUuid ? null : g.transactionUuid))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {uncovered > 0 && (
              <p className="flex items-start gap-2 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {uncovered === 1 ? "One sale sells" : `${uncovered} sales sell`} more units than were held then: the units over aren&apos;t in the gain. A purchase is probably missing from the transactions.
              </p>
            )}
          </>
        )}
      </div>
    </Module>
  );
}

function SaleRow({ gain: g, money, portfolio, open, onToggle }: {
  gain: RealizedGain;
  money: (v: number) => string;
  portfolio: string;
  open: boolean;
  onToggle: () => void;
}) {
  const hasLots = g.lots.length > 0;
  return (
    <Fragment>
      <tr className={hasLots ? "cursor-pointer hover:bg-[#FBFAF6]" : undefined} onClick={hasLots ? onToggle : undefined}>
        <td className={`${TD} whitespace-nowrap text-[#78716c]`}>{dateLabel(g.executedAt)}</td>
        <td className={TD}>
          <span className="flex items-center gap-1.5 font-semibold text-[#1c1917]">
            {assetName(g)}
            {hasLots && <ChevronDown className={`h-3.5 w-3.5 text-[#857e78] transition-transform ${open ? "rotate-180" : ""}`} />}
          </span>
          {g.taxCategory && (
            <span className="block text-[11px] text-[#857e78]">
              {categoryLabel(g.taxCategory)}{g.taxableShare !== null && g.taxableShare < 1 ? ` · ${ratePct(g.taxableShare)} taxable` : ""}
            </span>
          )}
        </td>
        <td className={`${TD} text-[#78716c]`}>
          {portfolio}
          {g.taxationMode === "withheld" && (
            <span className="block text-[11px] text-[#857e78]">
              {TAXATION_MODE_LABELS.withheld.label}{g.withheldTax !== null ? ` · ${money(g.withheldTax)}` : ""}
            </span>
          )}
        </td>
        <td className={TDR}>
          {formatQuantity(g.quantity)}
          {g.uncoveredQuantity > 0 && <span className="block text-[11px] text-amber-700">{formatQuantity(g.uncoveredQuantity)} not held</span>}
        </td>
        <td className={TDR}>{money(g.proceeds)}</td>
        <td className={TDR}>{money(g.cost)}</td>
        <td className={`${TDR} font-bold ${toneClass(g.gain)}`}>{money(g.gain)}</td>
      </tr>
      {open && hasLots && (
        <tr className="bg-[#FBFAF6]">
          <td />
          <td colSpan={6} className="pb-3 pr-0">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#857e78] mb-1.5">Lots sold, oldest first</p>
            <ul className="space-y-1">
              {g.lots.map((l, i) => (
                <li key={i} className="flex justify-between gap-4 text-xs text-[#78716c] tabular-nums max-w-md">
                  <span>Bought {dateLabel(l.acquiredOn)}</span>
                  <span>{formatQuantity(l.quantity)} units · {money(l.cost)}</span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

// ── The year's income ─────────────────────────────────────────────────────────────────────

/**
 * The year's dividends, coupons and interest, each payment with what was withheld abroad and, on a
 * declared portfolio with a regime, its taxable base and tax; a withheld portfolio's broker taxed it
 * at source, so only its gross and what was withheld are there.
 */
function IncomeModule({ loaded, nameOf, whose }: {
  loaded: Loaded<InvestmentIncome> | null;
  nameOf: (uuid: string | null) => string;
  whose: string;
}) {
  const data = loaded?.data ?? null;
  const money = (v: number) => formatCurrency(v, data?.currency ?? "EUR");
  const sorted = data ? [...data.payments].sort((a, b) => b.executedAt.localeCompare(a.executedAt)) : [];

  return (
    <Module>
      <ModuleHead title="Dividends, coupons and interest" desc="The year's investment income, payment by payment" />
      <div className={`${MODULE_BODY} space-y-5`}>
        {!loaded ? <Loading /> : loaded.error ? <ErrorNote text={loaded.error} /> : data && (
          <>
            <Figs>
              <Fig label="Gross" value={money(data.totalGross)} />
              <Fig label="Withheld abroad" value={money(data.totalWithheldAtSource)} info="The taxes withheld at source, as recorded. Their credit isn't estimated." />
              <Fig label="Tax to declare" value={data.totalTax === null ? "—" : money(data.totalTax)} strong info="The declared portfolios' income's estimated tax. A withheld portfolio's broker has already taxed its own." />
            </Figs>
            {sorted.length === 0 ? (
              <Empty text={`No dividends, coupons or interest in ${whose} portfolios this year.`} />
            ) : (
              <div className="overflow-x-auto -mx-1 px-1">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead className="border-b border-[#EEE9DD]">
                    <tr>
                      <th className={TH}>Date</th>
                      <th className={TH}>Income</th>
                      <th className={TH}>Portfolio</th>
                      <th className={THR}>Gross</th>
                      <th className={THR}>Withheld abroad</th>
                      <th className={THR}>Taxable</th>
                      <th className={THR}>Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEE9DD]">
                    {sorted.map((p) => <PaymentRow key={p.transactionUuid} payment={p} money={money} portfolio={nameOf(p.portfolioUuid)} />)}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Module>
  );
}

function PaymentRow({ payment: p, money, portfolio }: { payment: IncomePayment; money: (v: number) => string; portfolio: string }) {
  const withheld = p.taxationMode === "withheld";
  return (
    <tr>
      <td className={`${TD} whitespace-nowrap text-[#78716c]`}>{dateLabel(p.executedAt)}</td>
      <td className={TD}>
        <span className="block font-semibold text-[#1c1917]">{p.assetId ? assetName({ ...p, assetId: p.assetId }) : "Cash"}</span>
        <span className="block text-[11px] text-[#857e78]">
          {INCOME_KIND_LABELS[p.kind] ?? p.kind}
          {p.taxCategory ? ` · ${categoryLabel(p.taxCategory)}` : ""}
          {p.rate !== null ? ` · ${ratePct(p.rate)}` : ""}
        </span>
      </td>
      <td className={`${TD} text-[#78716c]`}>
        {portfolio}
        {withheld && <span className="block text-[11px] text-[#857e78]">Taxed at source by the broker</span>}
      </td>
      <td className={TDR}>{money(p.gross)}</td>
      <td className={TDR}>{p.withheldAtSource === 0 ? "—" : money(p.withheldAtSource)}</td>
      <td className={TDR}>
        {p.taxable === null ? "—" : money(p.taxable)}
        {p.accruedOffset > 0 && <span className="block text-[11px] text-[#857e78]">less {money(p.accruedOffset)} accrued paid</span>}
      </td>
      <td className={`${TDR} font-bold text-[#1c1917]`}>{p.tax === null ? "—" : money(p.tax)}</td>
    </tr>
  );
}
