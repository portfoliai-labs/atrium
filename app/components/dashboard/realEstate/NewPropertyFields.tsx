// components/dashboard/realEstate/NewPropertyFields.tsx
"use client";

import { useEffect, useState } from "react";
import { useRealEstate } from "../../../context/RealEstateContext";
import {
  ACQUISITION_KIND_LABELS, ENERGY_RATINGS, FREQUENCY_LABELS, HOLDER_KIND_LABELS, PROPERTY_KINDS, PROPERTY_KIND_LABELS, PROPERTY_USES, PROPERTY_USE_LABELS,
  RATE_INDEX_LABELS, sqftToSqm,
} from "../../../lib/realEstate";
import { COMMON_CURRENCIES, today } from "../../../lib/wallets";
import type {
  AcquisitionKind, CostKind, HolderKind, InstalmentFrequency, MarketZone, MortgageInput, Property, PropertyCreateRequest, PropertyInput, PropertyKind,
  PropertyUpdateRequest, PropertyUse, RateIndex,
} from "../../../models/RealEstate";
import { Field, INPUT, parseAmount } from "../wallets/WalletDialogs";
import { MunicipalityPicker } from "./MunicipalityPicker";

const HOLDER_NAME_MAX = 120;

const COSTS: { kind: CostKind; label: string; placeholder: string }[] = [
  { kind: "notary", label: "Notary", placeholder: "3500" },
  { kind: "agency", label: "Agency fee", placeholder: "9150" },
  { kind: "taxes", label: "Registration & taxes", placeholder: "11750" },
  { kind: "other", label: "Other costs", placeholder: "0" },
];

const RATE_INDEXES = Object.keys(RATE_INDEX_LABELS) as RateIndex[];
const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as InstalmentFrequency[];

/** The day a month after `day` (the 28th at most), for a mortgage's first instalment. */
export function monthAfter(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(Math.min(d, 28)).padStart(2, "0")}`;
}

/** A whole number from a field, null when empty, NaN when it isn't one. */
const parseWhole = (text: string) => (text.trim() === "" ? null : /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN);

const text = (v: string | number | null | undefined) => (v == null ? "" : String(v));

/**
 * A property's own fields — what it is, where, its size, the user's share, who holds it, the
 * property it belongs to (a garage to the house), Italy's land registry for one in Italy, the
 * municipality picked by name — new (`initial` left out) or as `initial` has them, to change.
 * Changing an existing property's use here corrects the use it has today; a use that changed on a
 * day is its page's "Use changed". Returns the fields, what's still missing, the property to
 * create, and the changes to send for `initial` (only what changed; "" clears the surface, the
 * energy rating, the note and the property it belongs to; the address, the details and the holder
 * are sent whole, if anything in them changed).
 */
export function usePropertyFields(initial?: Property, defaultCurrency = "EUR") {
  const italian = initial?.details.italy;
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<PropertyKind>(initial?.kind ?? "apartment");
  const [use, setUse] = useState<PropertyUse>(initial?.use ?? "long_term_rental");
  const [country, setCountry] = useState(initial?.address.country ?? "IT");
  const [street, setStreet] = useState(initial?.address.street ?? "");
  const [locality, setLocality] = useState(initial?.address.locality ?? "");
  const [postalCode, setPostalCode] = useState(text(initial?.address.postalCode));
  const [region, setRegion] = useState(text(initial?.address.region));
  const [neighbourhood, setNeighbourhood] = useState(text(initial?.address.neighbourhood));
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [surface, setSurface] = useState(text(initial?.surfaceSqm));
  const [unit, setUnit] = useState<"sqm" | "sqft">("sqm");
  const [rooms, setRooms] = useState(text(initial?.rooms));
  const [yearBuilt, setYearBuilt] = useState(text(initial?.yearBuilt));
  const [energy, setEnergy] = useState(text(initial?.energyRating));
  const [share, setShare] = useState(text(initial?.ownershipSharePct ?? 100));
  const [note, setNote] = useState(text(initial?.note));
  const [holderKind, setHolderKind] = useState<HolderKind>(initial?.holder.kind ?? "person");
  const [holderName, setHolderName] = useState(text(initial?.holder.name));
  const [appurtenantTo, setAppurtenantTo] = useState(initial?.appurtenantToUuid ?? "");
  const [historic, setHistoric] = useState(italian?.historic ?? false);
  // How it was acquired when not through a purchase tracked here (see acquisitionFields).
  const [acquisitionKind, setAcquisitionKind] = useState<AcquisitionKind>(initial?.acquisition.kind ?? "inheritance");
  const [acquiredOn, setAcquiredOn] = useState(initial?.acquisition.acquiredOn ?? "");
  const [donorPurchasedOn, setDonorPurchasedOn] = useState(initial?.acquisition.donorPurchasedOn ?? "");
  const [donorCost, setDonorCost] = useState(text(initial?.acquisition.donorCost));
  const [freeLoanToRelative, setFreeLoanToRelative] = useState(italian?.freeLoanToRelative ?? false);
  // What it can belong to: another property, not archived, not itself an appurtenance. One that
  // has appurtenances of its own can't belong to another.
  const { properties, source } = useRealEstate();
  const hasAppurtenances = !!initial && properties.some((p) => p.appurtenantToUuid === initial.uuid);
  const owners = properties.filter((p) => p.uuid !== initial?.uuid && !p.archived && !p.appurtenantToUuid);
  // Italy's land registry.
  const [cadastre, setCadastre] = useState({
    municipalityCode: text(italian?.municipalityCode), cadastralSheet: text(italian?.cadastralSheet), cadastralParcel: text(italian?.cadastralParcel),
    cadastralSubunit: text(italian?.cadastralSubunit), cadastralCategory: text(italian?.cadastralCategory), cadastralIncome: text(italian?.cadastralIncome),
  });
  // Its market zone (OMI), of the municipality's: "" finds it from the address's location.
  const [omiZone, setOmiZone] = useState(italian?.omiZone ?? "");
  const zoneMunicipality = cadastre.municipalityCode.trim().toUpperCase();
  const [zones, setZones] = useState<{ code: string; list: MarketZone[] | null } | null>(null);
  useEffect(() => {
    if (!zoneMunicipality) return;
    let cancelled = false;
    source.marketZones(zoneMunicipality)
      .then((list) => { if (!cancelled) setZones({ code: zoneMunicipality, list }); })
      .catch(() => { if (!cancelled) setZones({ code: zoneMunicipality, list: null }); });
    return () => { cancelled = true; };
  }, [source, zoneMunicipality]);
  const municipalityZones = zones?.code === zoneMunicipality ? zones.list : undefined;

  const countryCode = country.trim().toUpperCase();
  const currencyCode = currency.trim().toUpperCase();
  const italy = countryCode === "IT";
  const surfaceValue = parseAmount(surface);
  const surfaceSqm = surfaceValue === null ? null : unit === "sqm" ? Number(surfaceValue) : sqftToSqm(Number(surfaceValue));
  const roomsValue = parseWhole(rooms);
  const yearValue = parseWhole(yearBuilt);
  const shareValue = parseAmount(share);
  const cadastralIncome = parseAmount(cadastre.cadastralIncome);

  const problems = [
    !name.trim() && "a name",
    (!street.trim() || !locality.trim()) && "the street and the town",
    !/^[A-Z]{2}$/.test(countryCode) && "a two-letter country code",
    !/^[A-Z]{3}$/.test(currencyCode) && "a three-letter currency",
    surface.trim() !== "" && (surfaceSqm === null || surfaceSqm <= 0) && "a valid surface",
    Number.isNaN(roomsValue) && "a whole number of rooms",
    Number.isNaN(yearValue) && "a valid year built",
    (shareValue === null || Number(shareValue) <= 0 || Number(shareValue) > 100) && "a share between 0 and 100%",
    italy && cadastre.cadastralIncome.trim() !== "" && cadastralIncome === null && "a valid cadastral income",
    holderName.trim().length > HOLDER_NAME_MAX && `a holder's name of ${HOLDER_NAME_MAX} characters at most`,
  ].filter(Boolean) as string[];

  const address = () => ({
    country: countryCode,
    street: street.trim(),
    locality: locality.trim(),
    postalCode: postalCode.trim() || null,
    region: region.trim() || null,
    neighbourhood: neighbourhood.trim() || null,
    location: initial?.address.location ?? null,
  });
  const loanToRelative = use === "free_loan" && freeLoanToRelative;
  const zoneCode = zoneMunicipality ? omiZone : "";
  const details = () => (italy && (Object.values(cadastre).some((v) => v.trim()) || historic || loanToRelative || zoneCode)
    ? {
        italy: {
          municipalityCode: cadastre.municipalityCode.trim().toUpperCase() || null,
          cadastralSheet: cadastre.cadastralSheet.trim() || null,
          cadastralParcel: cadastre.cadastralParcel.trim() || null,
          cadastralSubunit: cadastre.cadastralSubunit.trim() || null,
          cadastralCategory: cadastre.cadastralCategory.trim().toUpperCase() || null,
          cadastralIncome,
          historic,
          freeLoanToRelative: loanToRelative,
          // Sent whole with the rest: left out, a PATCH would drop the zone picked.
          omiZone: zoneCode || null,
        },
      }
    : { italy: null });
  const holder = () => ({ kind: holderKind, name: holderName.trim() || null });
  const donorCostValue = parseAmount(donorCost);
  const acquisition = () => ({
    kind: acquisitionKind,
    acquiredOn: acquisitionKind === "purchase" ? null : acquiredOn || null,
    donorPurchasedOn: acquisitionKind === "donation" ? donorPurchasedOn || null : null,
    donorCost: acquisitionKind === "donation" && donorCost.trim() ? donorCostValue : null,
  });
  // What the acquisition's fields lack, when they're shown.
  const acquisitionProblems = [
    acquisitionKind !== "purchase" && acquiredOn > today() && "an acquisition day that isn't in the future",
    acquisitionKind === "donation" && donorCost.trim() !== "" && (donorCostValue === null || Number(donorCostValue) < 0) && "a valid donor's cost",
  ].filter(Boolean) as string[];
  const acquisitionChanges = (): PropertyUpdateRequest => {
    if (!initial) return {};
    const a = acquisition();
    const b = initial.acquisition;
    const changed = a.kind !== b.kind || a.acquiredOn !== b.acquiredOn || a.donorPurchasedOn !== b.donorPurchasedOn
      || (a.donorCost === null ? null : Number(a.donorCost)) !== b.donorCost;
    return changed ? { acquisition: a } : {};
  };
  const acquisitionFields = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="How you got it" hint="It decides whether a sale's gain is taxed: never an inheritance's.">
        <select value={acquisitionKind} onChange={(e) => setAcquisitionKind(e.target.value as AcquisitionKind)} className={INPUT}>
          {(Object.keys(ACQUISITION_KIND_LABELS) as AcquisitionKind[]).map((k) => <option key={k} value={k}>{ACQUISITION_KIND_LABELS[k]}</option>)}
        </select>
      </Field>
      {acquisitionKind !== "purchase" ? (
        <Field label={acquisitionKind === "inheritance" ? "Inherited on" : "Donated on"}>
          <input type="date" value={acquiredOn} max={today()} onChange={(e) => setAcquiredOn(e.target.value)} className={INPUT} />
        </Field>
      ) : (
        <p className="self-end text-[11px] text-slate-400 pb-2">A sale&apos;s tax needs its purchase: add it as a Purchase transaction when you can.</p>
      )}
      {acquisitionKind === "donation" && (
        <>
          <Field label="The donor bought it on" hint="A sale's tax counts from the donor's purchase.">
            <input type="date" value={donorPurchasedOn} max={today()} onChange={(e) => setDonorPurchasedOn(e.target.value)} className={INPUT} />
          </Field>
          <Field label="What it cost the donor" hint="With its costs: your part of it.">
            <input value={donorCost} onChange={(e) => setDonorCost(e.target.value)} inputMode="decimal" placeholder="Optional" className={INPUT} />
          </Field>
        </>
      )}
    </div>
  );
  const surfaceText = surfaceSqm === null ? null : String(Math.round(surfaceSqm * 100) / 100);

  const input = (): PropertyInput => ({
    name: name.trim(),
    kind,
    use,
    address: address(),
    currency: currencyCode,
    surfaceSqm: surfaceText,
    rooms: roomsValue,
    yearBuilt: yearValue,
    energyRating: energy.trim() || null,
    ownershipSharePct: shareValue,
    details: details().italy ? details() : null,
    note: note.trim() || null,
    holder: holder(),
    appurtenantToUuid: appurtenantTo || null,
  });

  const changes = (): PropertyUpdateRequest => {
    if (!initial) return {};
    const a = address();
    const before = initial.address;
    const addressChanged = (["country", "street", "locality", "postalCode", "region", "neighbourhood"] as const)
      .some((k) => (a[k] ?? null) !== (before[k] ?? null));
    const d = details();
    const now = d.italy;
    const detailsChanged = !now || !italian
      ? !!now !== !!italian
      : (["municipalityCode", "cadastralSheet", "cadastralParcel", "cadastralSubunit", "cadastralCategory", "historic", "freeLoanToRelative", "omiZone"] as const)
          .some((k) => (now[k] ?? null) !== (italian[k] ?? null))
        || (now.cadastralIncome === null ? null : Number(now.cadastralIncome)) !== italian.cadastralIncome;
    const h = holder();
    return {
      ...(name.trim() !== initial.name ? { name: name.trim() } : {}),
      ...(kind !== initial.kind ? { kind } : {}),
      ...(use !== initial.use ? { use } : {}),
      ...(addressChanged ? { address: a } : {}),
      ...(currencyCode !== initial.currency ? { currency: currencyCode } : {}),
      ...((surfaceSqm ?? null) !== initial.surfaceSqm ? { surfaceSqm: surfaceText ?? "" } : {}),
      ...(roomsValue !== initial.rooms && roomsValue !== null ? { rooms: roomsValue } : {}),
      ...(yearValue !== initial.yearBuilt && yearValue !== null ? { yearBuilt: yearValue } : {}),
      ...(energy.trim() !== (initial.energyRating ?? "") ? { energyRating: energy.trim() } : {}),
      ...(Number(shareValue) !== initial.ownershipSharePct ? { ownershipSharePct: shareValue } : {}),
      ...(detailsChanged ? { details: d } : {}),
      ...(note.trim() !== (initial.note ?? "") ? { note: note.trim() } : {}),
      ...(h.kind !== initial.holder.kind || h.name !== initial.holder.name ? { holder: h } : {}),
      ...(appurtenantTo !== (initial.appurtenantToUuid ?? "") ? { appurtenantToUuid: appurtenantTo } : {}),
    };
  };

  const fields = (
    <>
      <Section title="Property">
        <Field label="Name" className="sm:col-span-2">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Navigli loft" className={INPUT} />
        </Field>
        <Field label="Kind">
          <select value={kind} onChange={(e) => setKind(e.target.value as PropertyKind)} className={INPUT}>
            {PROPERTY_KINDS.map((k) => <option key={k} value={k}>{PROPERTY_KIND_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field label={initial ? "Use today" : "Use"} hint={initial ? "Corrects the use it has now. If it changed on a day, use \"Use changed\" on its page." : undefined}>
          <select value={use} onChange={(e) => setUse(e.target.value as PropertyUse)} className={INPUT}>
            {PROPERTY_USES.map((u) => <option key={u} value={u}>{PROPERTY_USE_LABELS[u]}</option>)}
          </select>
        </Field>
        <Field label="Street and number" className="sm:col-span-2">
          <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Via Vigevano 18" className={INPUT} />
        </Field>
        <Field label="Town or city">
          <input value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Milan" className={INPUT} />
        </Field>
        <Field label="Postal code">
          <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Optional" className={INPUT} />
        </Field>
        <Field label="Neighbourhood">
          <input value={neighbourhood} onChange={(e) => setNeighbourhood(e.target.value)} placeholder="Optional" className={INPUT} />
        </Field>
        <Field label="Region or province">
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Optional" className={INPUT} />
        </Field>
        <Field label="Country" hint="ISO code, e.g. IT, ES, GB.">
          <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} className={INPUT} />
        </Field>
        <Field label="Currency" hint={initial ? "Changes only while it has no transactions, mortgages or valuations." : "Every amount of this property's."}>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} list="property-currencies" className={INPUT} />
          <datalist id="property-currencies">{COMMON_CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Surface">
          <div className="flex gap-2">
            <input value={surface} onChange={(e) => setSurface(e.target.value)} inputMode="decimal" placeholder="68" className={`${INPUT} min-w-0 flex-1`} />
            <select value={unit} onChange={(e) => setUnit(e.target.value as "sqm" | "sqft")} aria-label="Unit" className={`${INPUT.replace("w-full", "")} w-24 shrink-0`}>
              <option value="sqm">m²</option>
              <option value="sqft">sq ft</option>
            </select>
          </div>
        </Field>
        <Field label="Rooms">
          <input value={rooms} onChange={(e) => setRooms(e.target.value)} inputMode="numeric" placeholder="3" className={INPUT} />
        </Field>
        <Field label="Year built">
          <input value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} inputMode="numeric" placeholder="1962" className={INPUT} />
        </Field>
        <Field label="Energy rating" hint="As the certificate writes it.">
          <input value={energy} onChange={(e) => setEnergy(e.target.value.toUpperCase())} list="energy-ratings" placeholder="D" className={INPUT} />
          <datalist id="energy-ratings">{ENERGY_RATINGS.map((r) => <option key={r} value={r} />)}</datalist>
        </Field>
        <Field label="Your share" hint="Transactions and mortgages are your part of them.">
          <div className="relative">
            <input value={share} onChange={(e) => setShare(e.target.value)} inputMode="decimal" className={`${INPUT} pr-9`} />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
          </div>
        </Field>
        <Field label="Held by" hint={holderKind === "company" ? "A company's property has no primary residence." : "You, unless you name someone."}>
          <div className="flex gap-2">
            <select value={holderKind} onChange={(e) => setHolderKind(e.target.value as HolderKind)} aria-label="Held by" className={`${INPUT.replace("w-full", "")} w-36 shrink-0`}>
              {(Object.keys(HOLDER_KIND_LABELS) as HolderKind[]).map((k) => <option key={k} value={k}>{HOLDER_KIND_LABELS[k]}</option>)}
            </select>
            <input value={holderName} onChange={(e) => setHolderName(e.target.value)} maxLength={HOLDER_NAME_MAX} placeholder={holderKind === "company" ? "Company name" : "Optional"} aria-label="Holder's name" className={`${INPUT} min-w-0 flex-1`} />
          </div>
        </Field>
        <Field label="Belongs to" hint={hasAppurtenances ? "Other properties belong to it, so it can't belong to one." : "A garage or a cellar that goes with a house (pertinenza)."}>
          <select value={appurtenantTo} onChange={(e) => setAppurtenantTo(e.target.value)} disabled={hasAppurtenances || owners.length === 0} className={INPUT}>
            <option value="">No other property</option>
            {owners.map((p) => <option key={p.uuid} value={p.uuid}>{p.name}</option>)}
          </select>
        </Field>
      </Section>

      {italy && (
        <details className="rounded-2xl border border-slate-200 px-4 py-3 group" open={!!italian}>
          <summary className="cursor-pointer text-[11px] font-black uppercase tracking-widest text-slate-500">Land registry (for IMU and the market)</summary>
          <p className="text-[11px] text-slate-400 mt-1">
            What IMU is computed from, as the visura catastale writes it: the municipality, the category and the cadastral income are needed.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            <Field label="Municipality" className="sm:col-span-3">
              <MunicipalityPicker
                code={cadastre.municipalityCode}
                onChange={(code) => { setCadastre({ ...cadastre, municipalityCode: code }); if (code !== cadastre.municipalityCode) setOmiZone(""); }}
              />
            </Field>
            {zoneMunicipality && municipalityZones !== null && (municipalityZones === undefined || municipalityZones.length > 0) && (
              <Field label="Market zone (OMI)" className="sm:col-span-3" hint="The zone its market range comes from. Automatic finds it from the address's location.">
                <select value={omiZone} onChange={(e) => setOmiZone(e.target.value)} disabled={municipalityZones === undefined} className={INPUT}>
                  <option value="">Automatic (from the address&apos;s location)</option>
                  {omiZone && !municipalityZones?.some((z) => z.code === omiZone) && <option value={omiZone}>{omiZone}</option>}
                  {municipalityZones?.map((z) => <option key={z.code} value={z.code}>{z.code} · {z.band} · {z.description}</option>)}
                </select>
              </Field>
            )}
            <Field label="Category"><input value={cadastre.cadastralCategory} onChange={(e) => setCadastre({ ...cadastre, cadastralCategory: e.target.value })} placeholder="A/2" className={INPUT} /></Field>
            <Field label="Cadastral income (€)"><input value={cadastre.cadastralIncome} onChange={(e) => setCadastre({ ...cadastre, cadastralIncome: e.target.value })} inputMode="decimal" placeholder="1032.91" className={INPUT} /></Field>
            <Field label="Sheet (foglio)"><input value={cadastre.cadastralSheet} onChange={(e) => setCadastre({ ...cadastre, cadastralSheet: e.target.value })} placeholder="12" className={INPUT} /></Field>
            <Field label="Parcel (particella)"><input value={cadastre.cadastralParcel} onChange={(e) => setCadastre({ ...cadastre, cadastralParcel: e.target.value })} placeholder="345" className={INPUT} /></Field>
            <Field label="Subunit (subalterno)"><input value={cadastre.cadastralSubunit} onChange={(e) => setCadastre({ ...cadastre, cadastralSubunit: e.target.value })} placeholder="6" className={INPUT} /></Field>
          </div>
          <div className="mt-3 space-y-2">
            <Check checked={historic} onChange={setHistoric} label="Listed as of historic or artistic interest" hint="IMU on half the base." />
            {use === "free_loan" && (
              <Check
                checked={freeLoanToRelative}
                onChange={setFreeLoanToRelative}
                label="Lent to a parent or a child, on IMU's conditions"
                hint="They live in it, the contract is registered, you own no other home in Italy but your own in the same municipality, and it isn't A/1, A/8 or A/9: IMU on half the base."
              />
            )}
          </div>
        </details>
      )}

      <Field label="Note">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything worth remembering about it" className={`${INPUT} h-auto py-2.5`} />
      </Field>
    </>
  );

  return {
    fields, problems, started: name.trim() !== "", input, changes, currencyCode, surfaceSqm,
    acquisitionFields, acquisitionProblems, acquisition, acquisitionChanges,
  };
}

/**
 * A mortgage's fields: the loan, its first instalment (`defaultFirstDue` until one is picked), the
 * term in years, the frequency and a fixed or variable rate. Returns the fields (a grid's cells),
 * what's still missing and the mortgage to send.
 */
export function useMortgageFields(currencyCode: string, defaultFirstDue: string) {
  const [principal, setPrincipal] = useState("");
  const [firstInstalmentOn, setFirstInstalmentOn] = useState("");
  const [termYears, setTermYears] = useState("25");
  const [frequency, setFrequency] = useState<InstalmentFrequency>("monthly");
  const [rateKind, setRateKind] = useState<"fixed" | "variable">("fixed");
  const [fixedPct, setFixedPct] = useState("");
  const [index, setIndex] = useState<RateIndex>("euribor_3m");
  const [spreadPct, setSpreadPct] = useState("");
  const [initialPct, setInitialPct] = useState("");
  const [lender, setLender] = useState("");

  const principalValue = parseAmount(principal);
  const termValue = parseWhole(termYears);
  const firstDue = firstInstalmentOn || defaultFirstDue;
  const rateValues = rateKind === "fixed" ? [parseAmount(fixedPct)] : [parseAmount(spreadPct), parseAmount(initialPct)];

  const problems = [
    (principalValue === null || Number(principalValue) <= 0) && "the loan amount",
    !firstDue && "the first instalment's day",
    (termValue === null || Number.isNaN(termValue) || termValue < 1 || termValue > 50) && "a term between 1 and 50 years",
    rateValues.some((r) => r === null) && "the rate",
  ].filter(Boolean) as string[];

  const input = (): MortgageInput => ({
    principal: principalValue!,
    firstInstalmentOn: firstDue,
    termMonths: termValue! * 12,
    frequency,
    rate: rateKind === "fixed"
      ? { fixedPct: rateValues[0]! }
      : { variable: { index, spreadPct: rateValues[0]!, initialPct: rateValues[1]! } },
    lender: lender.trim() || null,
  });

  const fields = (
    <>
      <Field label={`Loan amount (${currencyCode || "—"})`} hint="Your part of it.">
        <input value={principal} onChange={(e) => setPrincipal(e.target.value)} inputMode="decimal" placeholder="220000" className={INPUT} />
      </Field>
      <Field label="First instalment" hint={!firstInstalmentOn && firstDue ? "A month after the purchase, unless you pick a day." : undefined}>
        <input type="date" value={firstDue} onChange={(e) => setFirstInstalmentOn(e.target.value)} className={INPUT} />
      </Field>
      <Field label="Term">
        <div className="relative">
          <input value={termYears} onChange={(e) => setTermYears(e.target.value)} inputMode="numeric" className={`${INPUT} pr-16`} />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">years</span>
        </div>
      </Field>
      <Field label="Instalments">
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as InstalmentFrequency)} className={INPUT}>
          {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>)}
        </select>
      </Field>
      <Field label="Rate" className="sm:col-span-2">
        <div role="group" aria-label="Rate" className="flex gap-2">
          {(["fixed", "variable"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={rateKind === k}
              onClick={() => setRateKind(k)}
              className={`px-4 py-2 rounded-xl border text-xs font-bold transition-colors ${rateKind === k ? "bg-[#1c1917] border-[#1c1917] text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
            >
              {k === "fixed" ? "Fixed" : "Variable"}
            </button>
          ))}
        </div>
      </Field>
      {rateKind === "fixed" ? (
        <Field label="Interest rate">
          <Percent value={fixedPct} onChange={setFixedPct} placeholder="1.6" />
        </Field>
      ) : (
        <>
          <Field label="Index">
            <select value={index} onChange={(e) => setIndex(e.target.value as RateIndex)} className={INPUT}>
              {RATE_INDEXES.map((i) => <option key={i} value={i}>{RATE_INDEX_LABELS[i]}</option>)}
            </select>
          </Field>
          <Field label="Spread">
            <Percent value={spreadPct} onChange={setSpreadPct} placeholder="1.1" />
          </Field>
          <Field label="Rate today" hint="The index plus the spread, the first instalments are worked out at.">
            <Percent value={initialPct} onChange={setInitialPct} placeholder="3.4" />
          </Field>
        </>
      )}
      <Field label="Lender">
        <input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="Optional" className={INPUT} />
      </Field>
    </>
  );

  return { fields, problems, input, principalValue };
}

/**
 * NEW PROPERTY — the real estate form's Purchase (RealEstateTransactionForm): a property and, if
 * given, its purchase (the price and the costs on top, each booked as a transaction) and its
 * mortgage, saved all or none (POST /properties). Without the purchase (inherited, or bought long
 * before) the property is added on its own, its value the valuations added later. The amounts are
 * the user's part when they own a share. Returns the fields, what's still missing, and the request
 * to send.
 */
export function useNewProperty(defaultCurrency = "EUR") {
  const property = usePropertyFields(undefined, defaultCurrency);
  const [bought, setBought] = useState(true);
  const [purchasedOn, setPurchasedOn] = useState(today());
  const [price, setPrice] = useState("");
  const [costs, setCosts] = useState<Record<CostKind, string>>({ notary: "", agency: "", taxes: "", other: "" });
  const [mortgaged, setMortgaged] = useState(false);
  const mortgage = useMortgageFields(property.currencyCode, bought && purchasedOn ? monthAfter(purchasedOn) : "");

  const priceValue = parseAmount(price);
  // A cost left empty or at 0 is no cost: only those above 0 are sent.
  const costValues = COSTS.map((c) => {
    const amount = parseAmount(costs[c.kind]);
    return { kind: c.kind, text: costs[c.kind], amount: amount !== null && Number(amount) === 0 ? null : amount, invalid: costs[c.kind].trim() !== "" && (amount === null || Number(amount) < 0) };
  });

  const problems = [
    ...property.problems,
    ...(bought && (!purchasedOn || priceValue === null || Number(priceValue) <= 0) ? ["the purchase day and price"] : []),
    ...(bought && costValues.some((c) => c.invalid) ? ["valid purchase costs"] : []),
    ...(mortgaged ? mortgage.problems : []),
    ...(!bought ? property.acquisitionProblems : []),
  ];

  const request = (): PropertyCreateRequest => ({
    ...property.input(),
    acquisition: bought ? { kind: "purchase" } : property.acquisition(),
    purchase: bought ? {
      purchasedOn,
      price: priceValue!,
      costs: costValues.filter((c) => c.amount !== null).map((c) => ({ kind: c.kind, amount: c.amount! })),
    } : null,
    mortgage: mortgaged ? mortgage.input() : null,
  });

  // What the purchase comes to, as the preview's form showed it.
  const priceNumber = priceValue === null ? 0 : Number(priceValue);
  const costsTotal = costValues.reduce((s, c) => s + (c.amount === null ? 0 : Number(c.amount)), 0);
  const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const currencyCode = property.currencyCode;

  const fields = (
    <>
      {property.fields}

      <Toggleable title="Purchase" checked={bought} onChange={setBought} hint="Leave it off for a property you didn't buy (inherited) or bought long before you track it here: its value is then the valuations you add.">
        <Field label="Purchase day">
          <input type="date" value={purchasedOn} max={today()} onChange={(e) => setPurchasedOn(e.target.value)} className={INPUT} />
        </Field>
        <Field label={`Price (${currencyCode || "—"})`} hint="Your part of it.">
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="305000" className={INPUT} />
        </Field>
        {COSTS.map((c) => (
          <Field key={c.kind} label={c.label}>
            <input value={costs[c.kind]} onChange={(e) => setCosts({ ...costs, [c.kind]: e.target.value })} inputMode="decimal" placeholder={c.placeholder} className={INPUT} />
          </Field>
        ))}
      </Toggleable>

      {!bought && property.acquisitionFields}

      <Toggleable title="Mortgage" checked={mortgaged} onChange={setMortgaged} hint="Equal instalments (French amortisation); the schedule is worked out for you.">
        {mortgage.fields}
      </Toggleable>

      {bought && priceNumber > 0 && (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 flex flex-wrap gap-x-5 gap-y-1">
          <span>All-in cost <span className="font-black text-slate-900">{fmt(priceNumber + costsTotal)} {currencyCode}</span></span>
          <span>Costs on top <span className="font-black text-slate-900">{((costsTotal / priceNumber) * 100).toFixed(1)}%</span></span>
          {property.surfaceSqm !== null && property.surfaceSqm > 0 && <span>Per m² <span className="font-black text-slate-900">{fmt(priceNumber / property.surfaceSqm)} {currencyCode}</span></span>}
          {mortgaged && mortgage.principalValue !== null && <span>Loan-to-value <span className="font-black text-slate-900">{((Number(mortgage.principalValue) / priceNumber) * 100).toFixed(0)}%</span></span>}
        </div>
      )}
    </>
  );

  return { fields, problems, started: property.started, request };
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C49A3C]" />
      <span>
        <span className="block text-[13px] font-semibold text-slate-700">{label}</span>
        <span className="block text-[11px] text-slate-400">{hint}</span>
      </span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-[11px] font-black uppercase tracking-widest text-slate-700 mb-3">{title}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  );
}

/** A section switched on or off by its own checkbox. */
function Toggleable({ title, checked, onChange, hint, children }: {
  title: string; checked: boolean; onChange: (v: boolean) => void; hint: string; children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 space-y-3">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C49A3C]" />
        <span>
          <span className="block text-[11px] font-black uppercase tracking-widest text-slate-700">{title}</span>
          <span className="block text-[11px] text-slate-400">{hint}</span>
        </span>
      </label>
      {checked && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">{children}</div>}
    </fieldset>
  );
}

export function Percent({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder={placeholder} className={`${INPUT} pr-9`} />
      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
    </div>
  );
}
