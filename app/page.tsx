"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Birth = {
  id: string;
  owner: string;
  kittyId: string;
  matronId: string;
  sireId: string;
  genes: string;
};

type BirthQuery = {
  KittyCore_Birth: Array<Birth>;
};

const GQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GQL_ENDPOINT || "http://localhost:8080/v1/graphql";

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(GQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GraphQL error ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data as T;
}

function splitGenesToQuads(genesBigIntString: string): string[] {
  // CryptoKitties genes are 256-bit big integer encoded as decimal here.
  // We convert to base-32-like chunks using hex representation then map to nibbles.
  try {
    const big = BigInt(genesBigIntString);
    const hex = big.toString(16).padStart(64, "0");
    // 32 bytes -> 48 traits nibble pairs in CK; we will present as 12 traits x 4 nibbles
    // To keep minimal and visual, take the last 48 nibbles and group by 4 from right to left
    const nibbles = hex.split("");
    const last48 = nibbles.slice(-48);
    const groups: string[] = [];
    for (let i = 0; i < 12; i++) {
      const start = last48.length - (i + 1) * 4;
      groups.unshift(last48.slice(start, start + 4).join(""));
    }
    return groups;
  } catch {
    return [];
  }
}

function kittyImageUrl(id?: string) {
  if (!id) return undefined;
  return `https://img.cryptokitties.co/0x06012c8cf97bead5deae237070f9587f8e7a266d/${id}.svg`;
}

function TraitRow({
  label,
  matron,
  sire,
  kitten,
}: {
  label: string;
  matron?: string;
  sire?: string;
  kitten?: string;
}) {
  const cells = [matron, sire, kitten];
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {cells.map((g, i) => (
          <div key={i} className="grid grid-cols-4 text-center text-[10px]">
            {g?.split("").map((c, idx) => (
              <div
                key={idx}
                className={
                  idx === 3
                    ? "bg-foreground text-background rounded px-1 py-0.5"
                    : "bg-muted text-foreground/80 rounded px-1 py-0.5"
                }
              >
                {c}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type TraitRelation =
  | "allShare"
  | "parentsOnlyShare"
  | "matronKittenShare"
  | "sireKittenShare"
  | "mutation";

function deriveTraitRelation(
  matronQuad?: string,
  sireQuad?: string,
  kittenQuad?: string
): TraitRelation {
  const m = matronQuad?.at(-1);
  const s = sireQuad?.at(-1);
  const k = kittenQuad?.at(-1);
  if (m && s && k) {
    if (m === s && s === k) return "allShare";
    if (m === s && k !== m) return "parentsOnlyShare";
    if (m === k && s !== k) return "matronKittenShare";
    if (s === k && m !== k) return "sireKittenShare";
  }
  return "mutation";
}

function relationBgClass(relation: TraitRelation): string {
  switch (relation) {
    case "allShare":
      return "bg-emerald-100/60 dark:bg-emerald-900/30";
    case "parentsOnlyShare":
      return "bg-rose-100/60 dark:bg-rose-900/30";
    case "matronKittenShare":
      return "bg-amber-100/60 dark:bg-amber-900/30";
    case "sireKittenShare":
      return "bg-sky-100/60 dark:bg-sky-900/30";
    case "mutation":
    default:
      return "bg-fuchsia-100/50 dark:bg-fuchsia-900/20";
  }
}

function Quad({ quad }: { quad?: string }) {
  const chars = quad ? quad.split("") : [];
  return (
    <div className="flex gap-0.5 justify-center">
      {Array.from({ length: 4 }).map((_, idx) => {
        const c = chars[idx] ?? "";
        const isDominant = idx === 3;
        return (
          <div
            key={idx}
            className={
              isDominant
                ? "w-6 h-6 flex items-center justify-center rounded bg-foreground text-background text-xs font-bold"
                : "w-6 h-6 flex items-center justify-center rounded bg-muted text-foreground/70 text-xs"
            }
          >
            {c}
          </div>
        );
      })}
    </div>
  );
}

function GenomeStrip({
  groups,
  labels,
  matronGroups,
  sireGroups,
  kittenGroups,
}: {
  groups: string[];
  labels: string[];
  matronGroups: string[];
  sireGroups: string[];
  kittenGroups: string[];
}) {
  return (
    <div className="space-y-1">
      {/* Trait labels */}
      <div className="grid grid-cols-12 gap-1 text-center">
        {labels.map((label, idx) => (
          <div
            key={idx}
            className="text-[8px] text-muted-foreground font-medium px-1"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Gene strip */}
      <div className="grid grid-cols-12 gap-1">
        {groups.map((quad, idx) => {
          const relation = deriveTraitRelation(
            matronGroups[idx],
            sireGroups[idx],
            kittenGroups[idx]
          );
          const bg = relationBgClass(relation);
          return (
            <div key={idx} className={`rounded-sm p-1 relative ${bg}`}>
              <Quad quad={quad} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CatWithGenome({
  title,
  birth,
  groups,
  labels,
  matronGroups,
  sireGroups,
  kittenGroups,
  showMutation = false,
}: {
  title: string;
  birth?: Birth | null;
  groups: string[];
  labels: string[];
  matronGroups: string[];
  sireGroups: string[];
  kittenGroups: string[];
  showMutation?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Cat image */}
      <div className="bg-muted/20 rounded-lg p-4 aspect-square flex flex-col items-center justify-center">
        <div className="text-sm font-medium mb-2">{title}</div>
        <div className="flex-1 flex items-center justify-center">
          {birth?.kittyId ? (
            <Image
              src={kittyImageUrl(birth.kittyId)!}
              alt={`${title} #${birth.kittyId}`}
              width={180}
              height={180}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-xs text-muted-foreground">Loading...</div>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          ID: {birth?.kittyId || "-"}
        </div>
      </div>

      {/* Genome strip */}
      <div className="bg-background/50 rounded-lg p-3 relative">
        <GenomeStrip
          groups={groups}
          labels={labels}
          matronGroups={matronGroups}
          sireGroups={sireGroups}
          kittenGroups={kittenGroups}
        />
        {showMutation && (
          <div className="absolute top-1 right-1">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
          </div>
        )}
      </div>
    </div>
  );
}

function Legend() {
  const items: Array<{ label: string; className: string }> = [
    {
      label: "Matron, Sire & Kitten share",
      className: "bg-emerald-100/60 dark:bg-emerald-900/30",
    },
    {
      label: "Parents share, Kitten different",
      className: "bg-rose-100/60 dark:bg-rose-900/30",
    },
    {
      label: "Matron & Kitten share",
      className: "bg-amber-100/60 dark:bg-amber-900/30",
    },
    {
      label: "Sire & Kitten share",
      className: "bg-sky-100/60 dark:bg-sky-900/30",
    },
    {
      label: "Mutation (dot on kitten)",
      className: "bg-fuchsia-100/50 dark:bg-fuchsia-900/20",
    },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-xs">
          <span className={`inline-block h-3 w-4 rounded ${it.className}`} />
          <span className="text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

type TourStepId = "kittenMouthDominance";

function useElementRect(target: HTMLElement | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    const update = () => setRect(target.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(target);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [target]);
  return rect;
}

function SpotlightOverlay({
  targetRect,
  title,
  description,
  onNext,
  onClose,
  isLast = true,
}: {
  targetRect: DOMRect | null;
  title: string;
  description: string;
  onNext: () => void;
  onClose: () => void;
  isLast?: boolean;
}) {
  if (!targetRect) return null;
  const padding = 8;
  const top = Math.max(0, targetRect.top - padding);
  const left = Math.max(0, targetRect.left - padding);
  const width = targetRect.width + padding * 2;
  const height = targetRect.height + padding * 2;

  const tooltipWidth = 320;
  const placeRight = left + width + 16 + tooltipWidth < window.innerWidth;
  const tooltipLeft = placeRight ? left + width + 16 : Math.max(16, left);
  const tooltipTop = placeRight
    ? Math.max(16, top)
    : Math.min(window.innerHeight - 16, top + height + 12);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="absolute rounded-md ring-2 ring-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
        style={{ top, left, width, height, pointerEvents: "none" }}
      />
      <div
        className="absolute bg-background text-foreground shadow-lg rounded-md p-4 w-[320px] border"
        style={{ left: tooltipLeft, top: tooltipTop }}
      >
        <div className="text-sm font-semibold mb-1">{title}</div>
        <div className="text-xs text-muted-foreground mb-3">{description}</div>
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground underline decoration-dotted"
          >
            Skip
          </button>
          <button
            onClick={onNext}
            className="text-xs px-3 py-1 rounded bg-foreground text-background"
          >
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [kitten, setKitten] = useState<Birth | null>(null);
  const [matron, setMatron] = useState<Birth | null>(null);
  const [sire, setSire] = useState<Birth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState<TourStepId | null>(null);
  const [kittyIdInput, setKittyIdInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // latest birth
        const q1 = `
          query LatestBirth {  
            KittyCore_Birth(limit: 1, order_by: {timestamp: desc}) {
              id
              owner
              kittyId
              matronId
              sireId
              genes
            }
          }
        `;
        const data1 = await gql<BirthQuery>(q1);
        const latest = data1.KittyCore_Birth[0];
        if (!latest) return;
        if (cancelled) return;
        setKitten(latest);

        const parentIds = [latest.matronId, latest.sireId];
        const q2 = `
          query Parents($ids: [numeric!]) {
            KittyCore_Birth(where: {kittyId: {_in: $ids}}) {
              id
              kittyId
              genes
            }
          }
        `;
        const data2 = await gql<BirthQuery>(q2, { ids: parentIds });
        const byId = Object.fromEntries(
          data2.KittyCore_Birth.map((b) => [b.kittyId, b])
        ) as Record<string, Birth>;
        setMatron(byId[latest.matronId]);
        setSire(byId[latest.sireId]);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const traits = useMemo(() => {
    const m = splitGenesToQuads(matron?.genes || "");
    const s = splitGenesToQuads(sire?.genes || "");
    const k = splitGenesToQuads(kitten?.genes || "");
    const labels = [
      "Unknown",
      "Unknown",
      "Unknown",
      "Mouth",
      "Wild",
      "Tummy Colour",
      "Pattern Colour",
      "Body Colour",
      "Eye Type",
      "Eye Colour",
      "Pattern",
      "Body (Tail)",
    ];
    return labels.map((label, idx) => ({
      label,
      matron: m[idx],
      sire: s[idx],
      kitten: k[idx],
    }));
  }, [matron?.genes, sire?.genes, kitten?.genes]);

  const hasAnyMutation = traits.some((_, idx) => {
    const relation = deriveTraitRelation(
      traits[idx].matron,
      traits[idx].sire,
      traits[idx].kitten
    );
    return relation === "mutation";
  });

  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!isTourOpen) {
      setTargetEl(null);
      return;
    }
    let active = true;
    const find = () => {
      let el: HTMLElement | null = null;
      if (tourStep === "kittenMouthDominance") {
        el = document.querySelector(
          '[data-genome="kitten"][data-trait="Mouth"]'
        ) as HTMLElement | null;
      }
      if (active) setTargetEl(el);
      if (!el) requestAnimationFrame(find);
    };
    find();
    return () => {
      active = false;
    };
  }, [isTourOpen, tourStep]);

  const targetRect = useElementRect(targetEl);

  // Helpers to load a specific kitten and its parents
  async function loadParentsFor(kittenBirth: Birth) {
    const parentIds = [kittenBirth.matronId, kittenBirth.sireId];
    const q2 = `
      query Parents($ids: [numeric!]) {
        KittyCore_Birth(where: {kittyId: {_in: $ids}}) {
          id
          kittyId
          genes
        }
      }
    `;
    const data2 = await gql<BirthQuery>(q2, { ids: parentIds });
    const byId = Object.fromEntries(
      data2.KittyCore_Birth.map((b) => [b.kittyId, b])
    ) as Record<string, Birth>;
    setMatron(byId[kittenBirth.matronId] ?? null);
    setSire(byId[kittenBirth.sireId] ?? null);
  }

  async function loadKittenById(id: string) {
    try {
      setError(null);
      const q = `
        query ByKitty($id: numeric!) {
          KittyCore_Birth(where: {kittyId: {_eq: $id}}, limit: 1) {
            id
            owner
            kittyId
            matronId
            sireId
            genes
          }
        }
      `;
      const data = await gql<BirthQuery>(q, { id });
      const item = data.KittyCore_Birth[0];
      if (!item) throw new Error("Kitty not found");
      setKitten(item);
      await loadParentsFor(item);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    }
  }

  async function loadRandomRecent() {
    try {
      setError(null);
      const q = `
        query Recent {
          KittyCore_Birth(limit: 50, order_by: {timestamp: desc}) {
            id
            owner
            kittyId
            matronId
            sireId
            genes
          }
        }
      `;
      const data = await gql<BirthQuery>(q);
      const arr = data.KittyCore_Birth;
      if (!arr.length) throw new Error("No kitties available");
      const pick = arr[Math.floor(Math.random() * arr.length)];
      setKitten(pick);
      await loadParentsFor(pick);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">
            CryptoKitties Genome Mapping
          </h1>
          <div className="flex items-center gap-2">
            <input
              value={kittyIdInput}
              onChange={(e) => setKittyIdInput(e.target.value)}
              placeholder="Kitty ID"
              inputMode="numeric"
              className="text-xs px-2 py-1 rounded border bg-background w-28"
            />
            <button
              onClick={() => kittyIdInput && loadKittenById(kittyIdInput)}
              className="text-xs px-3 py-1 rounded bg-foreground text-background"
            >
              Load
            </button>
            <button
              onClick={loadRandomRecent}
              className="text-xs px-3 py-1 rounded border"
            >
              Random recent
            </button>
          </div>
        </header>

        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

        {/* Main breeding visualization */}
        <section className="bg-gradient-to-b from-muted/20 to-muted/5 rounded-xl p-8">
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] gap-8 items-center">
            {/* Matron */}
            <div className="bg-muted/20 rounded-lg p-6 w-80 h-80 flex flex-col items-center justify-center">
              <div className="text-lg font-medium mb-3">Matron</div>
              <div className="flex-1 flex items-center justify-center">
                {matron?.kittyId ? (
                  <Image
                    src={kittyImageUrl(matron.kittyId)!}
                    alt={`Matron #${matron.kittyId}`}
                    width={260}
                    height={260}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Loading...
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                ID: {matron?.kittyId || "-"}
              </div>
            </div>

            {/* Plus sign */}
            <div className="flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                <span className="text-2xl font-light text-primary">+</span>
              </div>
            </div>

            {/* Sire */}
            <div className="bg-muted/20 rounded-lg p-6 w-80 h-80 flex flex-col items-center justify-center">
              <div className="text-lg font-medium mb-3">Sire</div>
              <div className="flex-1 flex items-center justify-center">
                {sire?.kittyId ? (
                  <Image
                    src={kittyImageUrl(sire.kittyId)!}
                    alt={`Sire #${sire.kittyId}`}
                    width={260}
                    height={260}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Loading...
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                ID: {sire?.kittyId || "-"}
              </div>
            </div>

            {/* Equals sign */}
            <div className="flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                <span className="text-2xl font-light text-primary">=</span>
              </div>
            </div>

            {/* Kitten */}
            <div className="bg-muted/20 rounded-lg p-6 w-80 h-80 flex flex-col items-center justify-center relative">
              <div className="text-lg font-medium mb-3">Kitten</div>
              <div className="flex-1 flex items-center justify-center">
                {kitten?.kittyId ? (
                  <Image
                    src={kittyImageUrl(kitten.kittyId)!}
                    alt={`Kitten #${kitten.kittyId}`}
                    width={260}
                    height={260}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Loading...
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                ID: {kitten?.kittyId || "-"}
              </div>
              {hasAnyMutation && (
                <div className="absolute top-4 right-4">
                  <span className="inline-block h-4 w-4 rounded-full bg-rose-500" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Expanded genome mapping section */}
        <section className="bg-gradient-to-b from-muted/10 to-muted/5 rounded-xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">Genome Mapping</h2>
            <p className="text-sm text-muted-foreground">
              Trace how genetic traits are inherited from parents to offspring
            </p>
          </div>

          {/* Trait labels */}
          <div className="grid grid-cols-12 gap-3 text-center mb-6">
            {traits.map((trait, idx) => (
              <div
                key={idx}
                className="text-xs text-muted-foreground font-medium px-2 py-1 bg-muted/30 rounded"
              >
                {trait.label}
              </div>
            ))}
          </div>

          {/* Expanded genome strips */}
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-6 space-y-4">
            {/* Matron genome */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Matron
              </div>
              <div className="grid grid-cols-12 gap-3">
                {traits.map((trait, idx) => {
                  const relation = deriveTraitRelation(
                    trait.matron,
                    trait.sire,
                    trait.kitten
                  );
                  const bg = relationBgClass(relation);
                  return (
                    <div
                      key={idx}
                      className={`rounded-md p-2 ${bg}`}
                      data-genome="matron"
                      data-trait={trait.label}
                    >
                      <Quad quad={trait.matron} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sire genome */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Sire
              </div>
              <div className="grid grid-cols-12 gap-3">
                {traits.map((trait, idx) => {
                  const relation = deriveTraitRelation(
                    trait.matron,
                    trait.sire,
                    trait.kitten
                  );
                  const bg = relationBgClass(relation);
                  return (
                    <div
                      key={idx}
                      className={`rounded-md p-2 ${bg}`}
                      data-genome="sire"
                      data-trait={trait.label}
                    >
                      <Quad quad={trait.sire} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Kitten genome */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Kitten
              </div>
              <div className="grid grid-cols-12 gap-3">
                {traits.map((trait, idx) => {
                  const relation = deriveTraitRelation(
                    trait.matron,
                    trait.sire,
                    trait.kitten
                  );
                  const bg = relationBgClass(relation);
                  return (
                    <div
                      key={idx}
                      className={`rounded-md p-2 relative ${bg}`}
                      data-genome="kitten"
                      data-trait={trait.label}
                    >
                      <Quad quad={trait.kitten} />
                      {relation === "mutation" && (
                        <span className="absolute -top-1 -right-1 inline-block h-3 w-3 rounded-full bg-rose-500" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 text-center">
            <div className="text-sm text-muted-foreground mb-3">
              Dominant trait visible in appearance • Recessive traits inherited
              but hidden
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                {
                  label: "All share",
                  className: "bg-emerald-100/60 dark:bg-emerald-900/30",
                },
                {
                  label: "Parents share",
                  className: "bg-rose-100/60 dark:bg-rose-900/30",
                },
                {
                  label: "Matron + Kitten",
                  className: "bg-amber-100/60 dark:bg-amber-900/30",
                },
                {
                  label: "Sire + Kitten",
                  className: "bg-sky-100/60 dark:bg-sky-900/30",
                },
                {
                  label: "Mutation",
                  className: "bg-fuchsia-100/50 dark:bg-fuchsia-900/20",
                },
              ].map((it) => (
                <div key={it.label} className="flex items-center gap-2 text-sm">
                  <span
                    className={`inline-block h-3 w-4 rounded ${it.className}`}
                  />
                  <span className="text-muted-foreground">{it.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Explain button anchored at bottom-right of mapping section */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => {
                setIsTourOpen(true);
                setTourStep("kittenMouthDominance");
                setTimeout(() => {
                  const el = document.querySelector(
                    '[data-genome="kitten"][data-trait="Mouth"]'
                  ) as HTMLElement | null;
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 0);
              }}
              className="text-xs px-3 py-1 rounded bg-foreground text-background"
            >
              Explain Genome to me
            </button>
          </div>
        </section>
      </div>

      {isTourOpen && (
        <SpotlightOverlay
          targetRect={targetRect}
          title="Dominant trait (rightmost)"
          description="Each trait is a group of four characters. The rightmost one is dominant, and it’s what you see on the kitten’s appearance. Here we highlight the Mouth trait on the kitten."
          onNext={() => {
            setIsTourOpen(false);
            setTourStep(null);
          }}
          onClose={() => {
            setIsTourOpen(false);
            setTourStep(null);
          }}
          isLast
        />
      )}
    </div>
  );
}
