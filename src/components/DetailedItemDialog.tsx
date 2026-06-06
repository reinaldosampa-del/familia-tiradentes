import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useBrands } from "@/hooks/useBrands";
import { parseProduct, type SizeUnit } from "@/lib/product-parser";
import { formatMoneyInput, parseNumber, normalizeName } from "@/lib/format";

type Kind = "weight" | "volume" | "unit" | "paper";

const KIND_LABEL: Record<Kind, string> = {
  weight: "Peso (kg/g)",
  volume: "Volume (L/ml)",
  unit: "Unidades (ex: ovos)",
  paper: "Papel higiênico",
};

type Item = {
  id: string;
  name: string;
  quantity: number;
  price: number;
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

export function DetailedItemDialog({
  open,
  onOpenChange,
  item,
  purchaseId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: Item;
  purchaseId: string;
}) {
  const qc = useQueryClient();
  const { data: brands = [] } = useBrands();
  const brandNames = useMemo(() => brands.map((b) => b.name), [brands]);

  // Pré-parse: marca + tamanho detectados pelo nome.
  const initial = useMemo(() => parseProduct(item.name, brandNames), [item.name, brandNames]);

  const [kind, setKind] = useState<Kind>(
    (item.unit_kind as Kind) ||
      (initial.sizeUnit === "ml" || initial.sizeUnit === "L" ? "volume" : "weight"),
  );
  const [brand, setBrand] = useState(item.brand || initial.brand || "");
  const [packQty, setPackQty] = useState(
    item.pack_qty != null ? String(item.pack_qty) : String(item.quantity || 1),
  );
  const [packSize, setPackSize] = useState(
    item.pack_size != null
      ? String(item.pack_size)
      : initial.size != null
        ? String(initial.size)
        : "",
  );
  const [packSizeUnit, setPackSizeUnit] = useState<SizeUnit>(
    (item.pack_size_unit as SizeUnit) || initial.sizeUnit || "kg",
  );
  const [itemsPerPack, setItemsPerPack] = useState(
    item.items_per_pack != null ? String(item.items_per_pack) : "",
  );
  const [rolls, setRolls] = useState(item.rolls != null ? String(item.rolls) : "");
  const [width, setWidth] = useState(item.width_cm != null ? String(item.width_cm) : "");
  const [length, setLength] = useState(item.length_m != null ? String(item.length_m) : "");
  const [price, setPrice] = useState(
    item.price ? formatMoneyInput(String(Math.round(item.price * 100))) : "",
  );

  useEffect(() => {
    if (!open) return;
    setBrand(item.brand || initial.brand || "");
    setKind(
      (item.unit_kind as Kind) ||
        (initial.sizeUnit === "ml" || initial.sizeUnit === "L" ? "volume" : "weight"),
    );
    setPackSize(
      item.pack_size != null
        ? String(item.pack_size)
        : initial.size != null
          ? String(initial.size)
          : "",
    );
    setPackSizeUnit((item.pack_size_unit as SizeUnit) || initial.sizeUnit || "kg");
    setPackQty(item.pack_qty != null ? String(item.pack_qty) : String(item.quantity || 1));
    setItemsPerPack(item.items_per_pack != null ? String(item.items_per_pack) : "");
    setRolls(item.rolls != null ? String(item.rolls) : "");
    setWidth(item.width_cm != null ? String(item.width_cm) : "");
    setLength(item.length_m != null ? String(item.length_m) : "");
    setPrice(item.price ? formatMoneyInput(String(Math.round(item.price * 100))) : "");
  }, [open, item.id]);

  const [confirmBrandOpen, setConfirmBrandOpen] = useState(false);

  const save = useMutation({
    mutationFn: async (opts?: { registerBrand?: boolean }) => {
      // Cadastra a marca apenas quando o usuário confirmar.
      if (opts?.registerBrand && brand.trim()) {
        const nb = normalizeName(brand);
        const exists = brands.find((b) => b.normalized === nb);
        if (!exists) {
          await supabase.from("brands").insert({ name: brand.trim().slice(0, 60), normalized: nb });
        }
      }
      const update = {
        unit_kind: kind,
        brand: brand.trim() || null,
        pack_qty: parseNumber(packQty) || null,
        pack_size: kind === "weight" || kind === "volume" ? parseNumber(packSize) || null : null,
        pack_size_unit:
          kind === "weight" || kind === "volume" ? packSizeUnit : null,
        items_per_pack: kind === "unit" ? parseNumber(itemsPerPack) || null : null,
        rolls: kind === "paper" ? parseNumber(rolls) || null : null,
        width_cm: kind === "paper" ? parseNumber(width) || null : null,
        length_m: kind === "paper" ? parseNumber(length) || null : null,
        price: parseNumber(price) || 0,
        quantity: parseNumber(packQty) || 1,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("purchase_items")
        .update(update)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items", purchaseId] });
      setConfirmBrandOpen(false);
      onOpenChange(false);
    },
  });

  const handleSaveClick = () => {
    const trimmed = brand.trim();
    if (trimmed) {
      const nb = normalizeName(trimmed);
      const exists = brands.find((b) => b.normalized === nb);
      if (!exists) {
        setConfirmBrandOpen(true);
        return;
      }
    }
    save.mutate(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastro detalhado</DialogTitle>
          <DialogDescription>
            Informações usadas para comparação inteligente por kg/L/un.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="Marca">
            <Input
              list="brands-dl"
              value={brand}
              onChange={(e) => setBrand(e.target.value.slice(0, 60))}
              placeholder="Ex: Camil"
              className="h-10 rounded-xl"
            />
            <datalist id="brands-dl">
              {brands.map((b) => (
                <option key={b.id} value={b.name} />
              ))}
            </datalist>
          </Field>

          <Field label="Tipo">
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${
                    kind === k
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Qtd. embalagens">
              <Input
                inputMode="decimal"
                value={packQty}
                onChange={(e) => setPackQty(e.target.value)}
                className="h-10 rounded-xl tabular-nums"
              />
            </Field>
            <Field label="Preço por embalagem (R$)">
              <Input
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(formatMoneyInput(e.target.value))}
                placeholder="0,00"
                className="h-10 rounded-xl tabular-nums"
              />
            </Field>

            {(kind === "weight" || kind === "volume") && (
              <>
                <Field label={kind === "weight" ? "Peso" : "Volume"}>
                  <Input
                    inputMode="decimal"
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                    className="h-10 rounded-xl tabular-nums"
                  />
                </Field>
                <Field label="Unidade">
                  <div className="flex h-10 gap-1">
                    {(kind === "weight"
                      ? (["g", "kg"] as const)
                      : (["ml", "L"] as const)
                    ).map((u) => (
                      <button
                        key={u}
                        onClick={() => setPackSizeUnit(u)}
                        className={`flex-1 rounded-xl text-sm font-semibold transition-colors ${
                          packSizeUnit === u
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

            {kind === "unit" && (
              <Field label="Itens por embalagem" wide>
                <Input
                  inputMode="decimal"
                  value={itemsPerPack}
                  onChange={(e) => setItemsPerPack(e.target.value)}
                  placeholder="20"
                  className="h-10 rounded-xl tabular-nums"
                />
              </Field>
            )}

            {kind === "paper" && (
              <>
                <Field label="Rolos">
                  <Input
                    inputMode="decimal"
                    value={rolls}
                    onChange={(e) => setRolls(e.target.value)}
                    placeholder="16"
                    className="h-10 rounded-xl tabular-nums"
                  />
                </Field>
                <Field label="Largura (cm)">
                  <Input
                    inputMode="decimal"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="10"
                    className="h-10 rounded-xl tabular-nums"
                  />
                </Field>
                <Field label="Comprimento (m)" wide>
                  <Input
                    inputMode="decimal"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    placeholder="30"
                    className="h-10 rounded-xl tabular-nums"
                  />
                </Field>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-2xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSaveClick}
            disabled={save.isPending}
            className="flex-1 rounded-2xl"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={confirmBrandOpen} onOpenChange={setConfirmBrandOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cadastrar nova marca?</DialogTitle>
            <DialogDescription>
              A marca <strong>{brand.trim()}</strong> não está na sua lista. Deseja
              incluí-la no cadastro de marcas?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => save.mutate({ registerBrand: false })}
              disabled={save.isPending}
              className="flex-1 rounded-2xl"
            >
              Não, só salvar
            </Button>
            <Button
              onClick={() => save.mutate({ registerBrand: true })}
              disabled={save.isPending}
              className="flex-1 rounded-2xl"
            >
              Sim, cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
