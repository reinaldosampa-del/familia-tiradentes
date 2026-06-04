import { useMemo, useState } from "react";
import { Plus, Trash2, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatBRL, formatMoneyInput, parseNumber } from "@/lib/format";

type Mode = "weight" | "volume" | "unit" | "paper";

type Row = {
  id: string;
  label: string;
  price: string; // formatado "0,00"
  // weight
  qty: string; // quantidade de embalagens
  size: string; // peso/volume por embalagem
  sizeUnit: "g" | "kg" | "ml" | "L";
  // unit
  perPack: string; // qtde por pacote (ex 20 ovos)
  // paper
  rolls: string;
  width: string; // cm
  length: string; // m
};

const MODES: { id: Mode; label: string; unit: string; example: string }[] = [
  { id: "weight", label: "Peso", unit: "R$/kg", example: "Ex: 1 pacote de 620g por 19,98" },
  { id: "volume", label: "Volume", unit: "R$/L", example: "Ex: 900ml por 11,39" },
  { id: "unit", label: "Unidade", unit: "R$/un", example: "Ex: 20 ovos por 13,98" },
  { id: "paper", label: "Papel higiênico", unit: "R$/m²", example: "Ex: 16 rolos 30×10cm por 18,90" },
];

let counter = 0;
const newRow = (): Row => ({
  id: `r${++counter}-${Date.now()}`,
  label: "",
  price: "",
  qty: "1",
  size: "",
  sizeUnit: "g",
  perPack: "",
  rolls: "",
  width: "",
  length: "",
});

function totalContent(mode: Mode, r: Row): number {
  const qty = parseNumber(r.qty) || 0;
  switch (mode) {
    case "weight": {
      const s = parseNumber(r.size) || 0;
      const kg = r.sizeUnit === "kg" ? s : s / 1000;
      return qty * kg;
    }
    case "volume": {
      const s = parseNumber(r.size) || 0;
      const l = r.sizeUnit === "L" ? s : s / 1000;
      return qty * l;
    }
    case "unit": {
      const p = parseNumber(r.perPack) || 0;
      return qty * p;
    }
    case "paper": {
      const rolls = parseNumber(r.rolls) || 0;
      const w = (parseNumber(r.width) || 0) / 100; // cm → m
      const l = parseNumber(r.length) || 0; // m
      return qty * rolls * w * l; // m²
    }
  }
}

export function PriceCalculatorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("weight");
  const [rows, setRows] = useState<Row[]>([newRow(), newRow()]);

  const modeInfo = MODES.find((m) => m.id === mode)!;

  const ranked = useMemo(() => {
    return rows
      .map((r, idx) => {
        const price = parseNumber(r.price) || 0;
        const content = totalContent(mode, r);
        const unit = content > 0 && price > 0 ? price / content : 0;
        return { row: r, idx, price, content, unit };
      })
      .filter((x) => x.unit > 0)
      .sort((a, b) => a.unit - b.unit);
  }, [rows, mode]);

  const bestId = ranked[0]?.row.id;

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const resetMode = (m: Mode) => {
    setMode(m);
    setRows((rs) =>
      rs.map((r) => ({
        ...r,
        sizeUnit: m === "volume" ? "ml" : "g",
      })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Calculadora de melhor compra</DialogTitle>
          <DialogDescription>{modeInfo.example}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => resetMode(m.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === m.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <ul className="space-y-3">
          {rows.map((r, i) => {
            const rank = ranked.find((x) => x.row.id === r.id);
            const isBest = bestId === r.id;
            return (
              <li
                key={r.id}
                className={`rounded-2xl border bg-card p-3 transition-all ${
                  isBest
                    ? "border-success ring-2 ring-success/40"
                    : "border-border"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {i + 1}
                  </span>
                  <Input
                    value={r.label}
                    onChange={(e) => update(r.id, { label: e.target.value.slice(0, 40) })}
                    placeholder={`Opção ${i + 1}`}
                    className="h-9 flex-1 rounded-xl text-sm"
                  />
                  <button
                    onClick={() => remove(r.id)}
                    aria-label="Remover"
                    disabled={rows.length <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Preço (R$)">
                    <Input
                      inputMode="numeric"
                      value={r.price}
                      onChange={(e) =>
                        update(r.id, { price: formatMoneyInput(e.target.value) })
                      }
                      placeholder="0,00"
                      className="h-10 rounded-xl text-base tabular-nums"
                    />
                  </Field>
                  <Field label="Qtd. de embalagens">
                    <Input
                      inputMode="decimal"
                      value={r.qty}
                      onChange={(e) => update(r.id, { qty: e.target.value })}
                      placeholder="1"
                      className="h-10 rounded-xl text-base tabular-nums"
                    />
                  </Field>

                  {(mode === "weight" || mode === "volume") && (
                    <>
                      <Field label={mode === "weight" ? "Peso" : "Volume"}>
                        <Input
                          inputMode="decimal"
                          value={r.size}
                          onChange={(e) => update(r.id, { size: e.target.value })}
                          placeholder={mode === "weight" ? "620" : "900"}
                          className="h-10 rounded-xl text-base tabular-nums"
                        />
                      </Field>
                      <Field label="Unidade">
                        <div className="flex h-10 gap-1">
                          {(mode === "weight"
                            ? (["g", "kg"] as const)
                            : (["ml", "L"] as const)
                          ).map((u) => (
                            <button
                              key={u}
                              onClick={() => update(r.id, { sizeUnit: u })}
                              className={`flex-1 rounded-xl text-sm font-semibold transition-colors ${
                                r.sizeUnit === u
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </>
                  )}

                  {mode === "unit" && (
                    <Field label="Itens por embalagem" wide>
                      <Input
                        inputMode="decimal"
                        value={r.perPack}
                        onChange={(e) => update(r.id, { perPack: e.target.value })}
                        placeholder="20"
                        className="h-10 rounded-xl text-base tabular-nums"
                      />
                    </Field>
                  )}

                  {mode === "paper" && (
                    <>
                      <Field label="Rolos por pacote">
                        <Input
                          inputMode="decimal"
                          value={r.rolls}
                          onChange={(e) => update(r.id, { rolls: e.target.value })}
                          placeholder="16"
                          className="h-10 rounded-xl text-base tabular-nums"
                        />
                      </Field>
                      <Field label="Largura (cm)">
                        <Input
                          inputMode="decimal"
                          value={r.width}
                          onChange={(e) => update(r.id, { width: e.target.value })}
                          placeholder="10"
                          className="h-10 rounded-xl text-base tabular-nums"
                        />
                      </Field>
                      <Field label="Comprimento (m)" wide>
                        <Input
                          inputMode="decimal"
                          value={r.length}
                          onChange={(e) => update(r.id, { length: e.target.value })}
                          placeholder="30"
                          className="h-10 rounded-xl text-base tabular-nums"
                        />
                      </Field>
                    </>
                  )}
                </div>

                {rank && (
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground">
                      Preço unitário
                    </span>
                    <span
                      className={`font-bold tabular-nums ${
                        isBest ? "text-success" : "text-foreground"
                      }`}
                    >
                      {formatBRL(rank.unit)} {modeInfo.unit.replace("R$", "")}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <Button
          variant="outline"
          onClick={() => setRows((rs) => [...rs, newRow()])}
          className="w-full rounded-2xl border-dashed"
        >
          <Plus className="h-4 w-4" /> Adicionar opção
        </Button>

        {ranked.length >= 2 && (
          <div className="rounded-2xl border border-success/30 bg-success/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-success">
              <Trophy className="h-4 w-4" /> Ranking ({modeInfo.unit})
            </div>
            <ol className="space-y-1.5">
              {ranked.map((x, i) => (
                <li
                  key={x.row.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        i === 0
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate">
                      {x.row.label || `Opção ${x.idx + 1}`}
                    </span>
                  </span>
                  <span
                    className={`tabular-nums ${
                      i === 0 ? "font-bold text-success" : "text-muted-foreground"
                    }`}
                  >
                    {formatBRL(x.unit)}
                    {i > 0 &&
                      ranked[0].unit > 0 &&
                      ` (+${Math.round(((x.unit - ranked[0].unit) / ranked[0].unit) * 100)}%)`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
