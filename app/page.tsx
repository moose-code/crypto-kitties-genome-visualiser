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

export default function Home() {
  const [kitten, setKitten] = useState<Birth | null>(null);
  const [matron, setMatron] = useState<Birth | null>(null);
  const [sire, setSire] = useState<Birth | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
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
      "Unknown A",
      "Mouth",
      "Wild",
      "Tummy Colour",
      "Pattern Colour",
      "Body Colour",
      "Eye Type",
      "Eye Colour",
      "Pattern",
      "Body (Tail)",
      "Unknown B",
      "Unknown C",
    ];
    return labels.map((label, idx) => ({
      label,
      matron: m[idx],
      sire: s[idx],
      kitten: k[idx],
    }));
  }, [matron?.genes, sire?.genes, kitten?.genes]);

  return (
    <div className="min-h-screen p-6 sm:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            Crypto City Genome Visualizer
          </h1>
          <a
            className="text-xs underline decoration-dotted text-muted-foreground"
            href="https://img.cryptokitties.co/0x06012c8cf97bead5deae237070f9587f8e7a266d/881847.svg"
            target="_blank"
            rel="noreferrer"
          >
            Sample kitty asset
          </a>
        </header>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { t: "Matron", b: matron },
            { t: "Sire", b: sire },
            { t: "Kitten", b: kitten },
          ].map(({ t, b }) => (
            <div key={t} className="rounded-lg border p-4 space-y-3">
              <div className="text-sm font-medium">{t}</div>
              <div className="aspect-square bg-muted/30 grid place-items-center rounded">
                {b?.kittyId ? (
                  <Image
                    src={kittyImageUrl(b.kittyId)!}
                    alt={`${t} #${b.kittyId}`}
                    width={240}
                    height={240}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">No image</div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                ID: {b?.kittyId || "-"}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-lg border p-4 space-y-3">
          <div className="text-sm font-medium">Genome (dominant on right)</div>
          <div className="space-y-2">
            {traits.map((t) => (
              <TraitRow
                key={t.label}
                label={t.label}
                matron={t.matron}
                sire={t.sire}
                kitten={t.kitten}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
