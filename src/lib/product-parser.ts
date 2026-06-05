import { normalizeName } from "./format";

export type SizeUnit = "g" | "kg" | "ml" | "L" | "un";
export type UnitKind = "weight" | "volume" | "unit" | "paper";

export type ParsedProduct = {
  base: string;          // nome principal sem marca e sem tamanho
  brand?: string;        // nome de marca casada (mantém capitalização cadastrada)
  size?: number;         // valor numérico
  sizeUnit?: SizeUnit;   // unidade do tamanho
};

const UNIT_PATTERNS: { re: RegExp; unit: SizeUnit }[] = [
  // kg variants: "5kg", "5 kg", "5k" (k = kg para Samsung)
  { re: /(\d+(?:[.,]\d+)?)\s*kg\b/i, unit: "kg" },
  { re: /(\d+(?:[.,]\d+)?)\s*k\b/i, unit: "kg" },
  { re: /(\d+(?:[.,]\d+)?)\s*g\b/i, unit: "g" },
  { re: /(\d+(?:[.,]\d+)?)\s*ml\b/i, unit: "ml" },
  { re: /(\d+(?:[.,]\d+)?)\s*l\b/i, unit: "L" },
];

const STRIP_TOKENS = new Set([
  "de", "da", "do", "das", "dos", "com", "sem",
]);

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((t) => (t ? t[0].toUpperCase() + t.slice(1) : ""))
    .join(" ")
    .trim();
}

function formatSize(size: number, unit: SizeUnit): string {
  const n = Number.isInteger(size) ? String(size) : String(size).replace(".", ",");
  const u = unit === "kg" ? "Kg" : unit === "L" ? "L" : unit;
  return `${n}${u}`;
}

/**
 * Tenta extrair { base, brand, size, sizeUnit } de uma descrição livre.
 * Faz casamento de marca contra a lista fornecida (substring por token).
 */
export function parseProduct(raw: string, brandList: string[] = []): ParsedProduct {
  const original = (raw || "").trim();
  if (!original) return { base: "" };

  let working = " " + original + " ";
  let size: number | undefined;
  let sizeUnit: SizeUnit | undefined;

  for (const { re, unit } of UNIT_PATTERNS) {
    const m = working.match(re);
    if (m) {
      size = parseFloat(m[1].replace(",", "."));
      sizeUnit = unit;
      working = working.replace(m[0], " ");
      break;
    }
  }

  // Busca marca: cada marca cadastrada, normalizada, tenta substring no nome normalizado.
  let brand: string | undefined;
  const normWorking = " " + normalizeName(working) + " ";
  let bestLen = 0;
  for (const b of brandList) {
    const nb = normalizeName(b);
    if (!nb) continue;
    if (normWorking.includes(" " + nb + " ") && nb.length > bestLen) {
      brand = b;
      bestLen = nb.length;
    }
  }

  // Remove marca do working para isolar base.
  let baseText = working;
  if (brand) {
    const re = new RegExp(
      "\\b" + brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b",
      "i",
    );
    baseText = baseText.replace(re, " ");
  }

  // Limpa stopwords/duplicados de espaço.
  const tokens = baseText
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !STRIP_TOKENS.has(t.toLowerCase()));
  const base = titleCase(tokens.join(" "));

  return {
    base,
    brand: brand ? titleCase(brand) : undefined,
    size,
    sizeUnit,
  };
}

/** Recompõe um nome bonito: "Arroz Camil 5Kg" */
export function formatProductName(p: ParsedProduct): string {
  const parts: string[] = [];
  if (p.base) parts.push(p.base);
  if (p.brand) parts.push(p.brand);
  if (p.size && p.sizeUnit) parts.push(formatSize(p.size, p.sizeUnit));
  return parts.join(" ").trim();
}

/** Conveniência: parse + format. */
export function autoFormat(raw: string, brandList: string[]): string {
  const parsed = parseProduct(raw, brandList);
  const formatted = formatProductName(parsed);
  return formatted || raw.trim();
}

// ---------- Preço por unidade (comparação inteligente) ----------

export type NormalizedPrice = {
  kind: UnitKind;
  /** valor "padrão" de conteúdo total da compra (qty * tamanho), em kg, L ou un */
  baseQty: number;
  /** preço total efetivo da compra (qty * price) */
  totalPrice: number;
  /** preço por unidade base (R$/kg, R$/L, R$/un, R$/m²) */
  perUnit: number;
  unitLabel: string;
};

type ItemForNorm = {
  quantity: number;
  price: number;
  name: string;
  brand?: string | null;
  unit_kind?: string | null;
  pack_qty?: number | null;
  pack_size?: number | null;
  pack_size_unit?: string | null;
  items_per_pack?: number | null;
  rolls?: number | null;
  width_cm?: number | null;
  length_m?: number | null;
};

function toBase(value: number, unit: string): { kind: UnitKind; base: number; label: string } | null {
  switch (unit) {
    case "g":  return { kind: "weight", base: value / 1000, label: "R$/kg" };
    case "kg": return { kind: "weight", base: value,        label: "R$/kg" };
    case "ml": return { kind: "volume", base: value / 1000, label: "R$/L"  };
    case "L":
    case "l":  return { kind: "volume", base: value,        label: "R$/L"  };
    case "un": return { kind: "unit",   base: value,        label: "R$/un" };
    default:   return null;
  }
}

/**
 * Calcula preço normalizado. Usa cadastro detalhado se houver; caso contrário,
 * parseia o nome em busca de tamanho/peso para inferir kg/L automaticamente.
 */
export function normalizedPrice(it: ItemForNorm): NormalizedPrice | null {
  const qty = Number(it.quantity) || 0;
  const price = Number(it.price) || 0;
  if (qty <= 0 || price <= 0) return null;
  const totalPrice = qty * price;

  // Detalhado
  if (it.unit_kind) {
    if (it.unit_kind === "paper") {
      const rolls = Number(it.rolls) || 0;
      const w = (Number(it.width_cm) || 0) / 100;
      const l = Number(it.length_m) || 0;
      const packQty = Number(it.pack_qty) || 1;
      const area = packQty * rolls * w * l;
      if (area <= 0) return null;
      return {
        kind: "paper",
        baseQty: qty * area,
        totalPrice,
        perUnit: totalPrice / (qty * area),
        unitLabel: "R$/m²",
      };
    }
    if (it.unit_kind === "unit") {
      const items = Number(it.items_per_pack) || 0;
      const packQty = Number(it.pack_qty) || 1;
      const totalItems = qty * packQty * items;
      if (totalItems <= 0) return null;
      return {
        kind: "unit",
        baseQty: totalItems,
        totalPrice,
        perUnit: totalPrice / totalItems,
        unitLabel: "R$/un",
      };
    }
    // weight or volume
    const conv = toBase(Number(it.pack_size) || 0, String(it.pack_size_unit || ""));
    if (!conv) return null;
    const packQty = Number(it.pack_qty) || 1;
    const totalBase = qty * packQty * conv.base;
    if (totalBase <= 0) return null;
    return {
      kind: conv.kind,
      baseQty: totalBase,
      totalPrice,
      perUnit: totalPrice / totalBase,
      unitLabel: conv.label,
    };
  }

  // Simples — tenta extrair peso/volume do nome
  const parsed = parseProduct(it.name);
  if (parsed.size && parsed.sizeUnit) {
    const conv = toBase(parsed.size, parsed.sizeUnit);
    if (conv) {
      const totalBase = qty * conv.base;
      return {
        kind: conv.kind,
        baseQty: totalBase,
        totalPrice,
        perUnit: totalPrice / totalBase,
        unitLabel: conv.label,
      };
    }
  }

  return null;
}
