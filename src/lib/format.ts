export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(isFinite(value) ? value : 0);
}

export function formatShortDate(iso: string): string {
  // iso = "YYYY-MM-DD"
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Converte string para número.
 * Em celulares Samsung a vírgula às vezes falha, então tratamos o ponto
 * como vírgula. A ÚLTIMA ocorrência de vírgula/ponto é o separador decimal;
 * tudo antes é considerado parte inteira (sem milhares).
 */
export function parseNumber(input: string): number {
  if (!input) return 0;
  const unified = input.replace(/\./g, ",").replace(/[^\d,-]/g, "");
  const idx = unified.lastIndexOf(",");
  const cleaned =
    idx < 0
      ? unified
      : unified.slice(0, idx).replace(/,/g, "") + "." + unified.slice(idx + 1);
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Formata entrada de dinheiro em estilo "cents-fill":
 * - "1"     → "0,01"
 * - "12"    → "0,12"
 * - "199"   → "1,99"
 * - "1.99"  → "1,99" (ponto é tratado como dígito ignorado)
 * Mantém os 2 últimos dígitos como centavos.
 */
export function formatMoneyInput(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const trimmed = digits.replace(/^0+(?=\d)/, "") || "0";
  const padded = trimmed.padStart(3, "0");
  const reais = padded.slice(0, -2);
  const cents = padded.slice(-2);
  return `${parseInt(reais, 10)},${cents}`;
}

/**
 * Formata entrada de quantidade — aceita inteiro ou decimal com vírgula/ponto.
 * Apenas substitui ponto por vírgula visualmente e limita caracteres.
 */
export function formatQtyInput(raw: string): string {
  if (!raw) return "";
  // permite dígitos, vírgula e ponto; ponto vira vírgula
  let s = raw.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  // mantém só a primeira vírgula
  const i = s.indexOf(",");
  if (i >= 0) {
    s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, "");
  }
  return s;
}

export function normalizeName(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "de","da","do","das","dos","com","sem","para","pra","por","em","no","na",
  "caixa","pacote","pct","pacotinho","saco","lata","garrafa","embalagem",
  "kg","kgs","g","gr","grs","mg","ml","l","lt","lts","un","und","unid","unidade",
  "tipo","sabor","marca","ref","cx",
]);

/** Quebra um nome em tokens significativos (sem stopwords, ≥3 chars). */
export function tokens(s: string): string[] {
  return normalizeName(s)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

/**
 * Verifica se dois nomes provavelmente representam o mesmo produto.
 * - Compartilha pelo menos um token significativo (ou substring entre tokens)
 * - Fallback: substring direta quando não há tokens significativos
 */
export function similar(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const A = tokens(a);
  const B = tokens(b);
  if (A.length && B.length) {
    return A.some((t) => B.some((u) => u === t || u.includes(t) || t.includes(u)));
  }
  return na.includes(nb) || nb.includes(na);
}
