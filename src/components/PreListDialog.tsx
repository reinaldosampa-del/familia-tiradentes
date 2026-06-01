import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Circle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { normalizeName, parseNumber } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type PreItem = {
  id: string;
  purchase_id: string;
  quantity: number;
  name: string;
  position: number;
};

export type ListItem = {
  id: string;
  quantity: number;
  name: string;
};

type Status = "missing" | "qty" | "ok" | "empty";

function findMatch(pre: PreItem, items: ListItem[]) {
  const key = normalizeName(pre.name);
  if (!key) return undefined;
  return items.find((it) => {
    const n = normalizeName(it.name);
    return n && (n.includes(key) || key.includes(n));
  });
}

function statusFor(pre: PreItem, items: ListItem[]): { status: Status; matchId?: string } {
  if (!pre.name.trim()) return { status: "empty" };
  const match = findMatch(pre, items);
  if (!match) return { status: "missing" };
  const need = Number(pre.quantity) || 0;
  const have = Number(match.quantity) || 0;
  if (need > 0 && have !== need) return { status: "qty", matchId: match.id };
  return { status: "ok", matchId: match.id };
}

export function PreListDialog({
  open,
  onOpenChange,
  purchaseId,
  items,
  onJumpToItem,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  purchaseId: string;
  items: ListItem[];
  onJumpToItem: (itemId: string) => void;
}) {
  const qc = useQueryClient();

  useRealtime(
    `pre-${purchaseId}`,
    "pre_list_items",
    [["pre_items", purchaseId]],
    `purchase_id=eq.${purchaseId}`,
  );

  const { data: preItems = [] } = useQuery({
    queryKey: ["pre_items", purchaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pre_list_items")
        .select("id, purchase_id, quantity, name, position")
        .eq("purchase_id", purchaseId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PreItem[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pre_list_items")
        .insert({ purchase_id: purchaseId, quantity: 1, name: "", position: preItems.length });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre_items", purchaseId] }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pré-lista</DialogTitle>
          <DialogDescription>
            Compare o que você precisa com o que já está no carrinho. Toque no nome para
            ver o item.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2 text-[11px] font-medium text-muted-foreground">
          <LegendDot className="bg-destructive" /> Falta
          <LegendDot className="bg-warning" /> Qtde
          <LegendDot className="bg-success" /> OK
        </div>

        <ul className="space-y-2">
          {preItems.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">
              Nenhum item na pré-lista.
            </li>
          ) : (
            preItems.map((pre) => (
              <PreItemRow
                key={pre.id}
                pre={pre}
                items={items}
                onJump={(id) => {
                  onJumpToItem(id);
                  onOpenChange(false);
                }}
              />
            ))
          )}
        </ul>

        <button
          onClick={() => add.mutate()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card/50 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-primary hover:text-primary active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" /> Adicionar à pré-lista
        </button>
      </DialogContent>
    </Dialog>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />;
}

function PreItemRow({
  pre,
  items,
  onJump,
}: {
  pre: PreItem;
  items: ListItem[];
  onJump: (itemId: string) => void;
}) {
  const qc = useQueryClient();
  const [qty, setQty] = useState(
    pre.quantity ? String(pre.quantity).replace(".", ",") : "",
  );
  const [name, setName] = useState(pre.name);

  useEffect(() => {
    setQty(pre.quantity ? String(pre.quantity).replace(".", ",") : "");
  }, [pre.quantity]);
  useEffect(() => {
    setName(pre.name);
  }, [pre.name]);

  const persist = useDebouncedCallback(
    async (patch: Partial<Pick<PreItem, "quantity" | "name">>) => {
      const { error } = await supabase
        .from("pre_list_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", pre.id);
      if (!error) qc.invalidateQueries({ queryKey: ["pre_items", pre.purchase_id] });
    },
    300,
  );

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pre_list_items").delete().eq("id", pre.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pre_items", pre.purchase_id] }),
  });

  // Use the persisted values (pre.name / pre.quantity) so the status only
  // updates after the debounced save completes — doesn't flicker while typing.
  const { status, matchId } = useMemo(
    () => statusFor(pre, items),
    [pre, items],
  );

  const ring =
    status === "missing"
      ? "ring-2 ring-destructive/50 bg-destructive/5"
      : status === "qty"
        ? "ring-2 ring-warning/60 bg-warning/5"
        : status === "ok"
          ? "ring-2 ring-success/60 bg-success/5"
          : "ring-1 ring-border bg-card";

  const dot =
    status === "missing"
      ? "text-destructive fill-destructive"
      : status === "qty"
        ? "text-warning fill-warning"
        : status === "ok"
          ? "text-success fill-success"
          : "text-muted-foreground";

  return (
    <li className={`flex items-center gap-2 rounded-2xl px-2 py-2 ${ring}`}>
      <button
        type="button"
        onClick={() => matchId && onJump(matchId)}
        disabled={!matchId}
        aria-label={matchId ? "Mostrar item na lista" : "Sem correspondência"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-background/60 disabled:cursor-default"
      >
        <Circle className={`h-3.5 w-3.5 ${dot}`} />
      </button>
      <Input
        inputMode="decimal"
        value={qty}
        onChange={(e) => {
          setQty(e.target.value);
          persist({ quantity: parseNumber(e.target.value) });
        }}
        placeholder="1"
        className="h-10 w-14 shrink-0 rounded-xl px-2 text-center text-base tabular-nums"
      />
      <Input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          persist({ name: e.target.value.slice(0, 120) });
        }}
        placeholder="produto"
        className="h-10 min-w-0 flex-1 rounded-xl text-base"
      />
      <button
        onClick={() => remove.mutate()}
        aria-label="Remover"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
