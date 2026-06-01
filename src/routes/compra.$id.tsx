import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MoreVertical, Plus, Trash2, Pencil, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { PreListDialog } from "@/components/PreListDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPicker } from "@/components/IconPicker";
import { PURCHASE_ICONS } from "@/lib/icons";
import { getIcon } from "@/lib/icons";
import { formatBRL, formatShortDate, normalizeName, parseNumber } from "@/lib/format";

type HistoryHit = {
  price: number;
  name: string;
  purchaseName: string;
  date: string;
};

type Compare = "cheaper" | "same" | "more" | "none";

function compareTo(currentPrice: number, prev?: HistoryHit): Compare {
  if (!prev || !(prev.price > 0) || !(currentPrice > 0)) return "none";
  const a = Math.round(currentPrice * 100);
  const b = Math.round(prev.price * 100);
  if (a < b) return "cheaper";
  if (a > b) return "more";
  return "same";
}

export const Route = createFileRoute("/compra/$id")({
  head: () => ({
    meta: [
      { title: "Compra — Lista de Compras" },
      { name: "description", content: "Detalhes da compra com itens e total automático." },
    ],
  }),
  component: PurchaseDetailPage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div>
        <p className="text-sm text-destructive">Erro ao carregar: {error.message}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
          Voltar
        </Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted-foreground">Compra não encontrada.</p>
    </div>
  ),
});

type Purchase = {
  id: string;
  name: string;
  icon: string;
  budget: number;
  date: string;
};

type Item = {
  id: string;
  purchase_id: string;
  quantity: number;
  name: string;
  price: number;
  position: number;
};

function PurchaseDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  useRealtime(`purchase-${id}`, "purchases", [["purchase", id]], `id=eq.${id}`);
  useRealtime(`items-${id}`, "purchase_items", [["items", id]], `purchase_id=eq.${id}`);

  const { data: purchase, isLoading } = useQuery({
    queryKey: ["purchase", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, name, icon, budget, date")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Purchase | null;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_items")
        .select("id, purchase_id, quantity, name, price, position")
        .eq("purchase_id", id)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  // Realtime for the history too — other devices may edit older purchases.
  useRealtime("history-purchases", "purchases", [["price-history"]]);
  useRealtime("history-items", "purchase_items", [["price-history"]]);

  // Pull all priced items from OTHER purchases dated <= current date.
  const { data: history = [] } = useQuery({
    queryKey: ["price-history", id, purchase?.date ?? ""],
    enabled: !!purchase?.date,
    queryFn: async () => {
      const { data: ps, error: e1 } = await supabase
        .from("purchases")
        .select("id, name, date")
        .neq("id", id)
        .lte("date", purchase!.date);
      if (e1) throw e1;
      const ids = (ps ?? []).map((p) => p.id);
      if (ids.length === 0) return [] as HistoryHit[];
      const map = new Map(ps!.map((p) => [p.id, p]));
      const { data: its, error: e2 } = await supabase
        .from("purchase_items")
        .select("purchase_id, name, price")
        .in("purchase_id", ids)
        .gt("price", 0);
      if (e2) throw e2;
      return (its ?? [])
        .map((it) => {
          const p = map.get(it.purchase_id)!;
          return {
            price: Number(it.price) || 0,
            name: it.name as string,
            purchaseName: (p.name as string) || "Sem nome",
            date: p.date as string,
          };
        })
        .filter((h) => h.name && h.name.trim().length > 0) as HistoryHit[];
    },
  });

  // For a given item name, find the most recent prior occurrence (by date).
  const findPrev = useMemo(() => {
    return (rawName: string): HistoryHit | undefined => {
      const key = normalizeName(rawName);
      if (!key) return undefined;
      let best: HistoryHit | undefined;
      for (const h of history) {
        const n = normalizeName(h.name);
        if (!n) continue;
        if (n === key || n.includes(key) || key.includes(n)) {
          if (!best || h.date > best.date) best = h;
        }
      }
      return best;
    };
  }, [history]);

  const total = useMemo(
    () => items.reduce((acc, it) => acc + (it.quantity || 0) * (it.price || 0), 0),
    [items],
  );

  const addItem = useMutation({
    mutationFn: async () => {
      const position = items.length;
      const { error } = await supabase
        .from("purchase_items")
        .insert({ purchase_id: id, quantity: 1, name: "", price: 0, position });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items", id] }),
  });

  const deletePurchase = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => router.navigate({ to: "/" }),
  });

  const [preOpen, setPreOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const jumpToItem = (itemId: string) => {
    const el = itemRefs.current[itemId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightId(itemId);
    window.setTimeout(() => setHighlightId((cur) => (cur === itemId ? null : cur)), 2200);
  };

  if (isLoading || !purchase) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <PurchaseHeader
        purchase={purchase}
        total={total}
        onDelete={() => deletePurchase.mutate()}
        onOpenPreList={() => setPreOpen(true)}
      />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-3 py-3">
          <div className="sticky top-0 z-[1] mb-2 flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
            <div className="w-16 shrink-0">Qtd</div>
            <div className="min-w-[200px] flex-1">Produto</div>
            <div className="w-28 shrink-0 text-right">Valor</div>
            <div className="w-28 shrink-0 text-right">Subtotal</div>
            <div className="w-9 shrink-0" />
          </div>

          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum item ainda. Toque em + para adicionar.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  purchaseId={id}
                  highlighted={highlightId === item.id}
                  prev={findPrev(item.name)}
                  rowRef={(el) => {
                    itemRefs.current[item.id] = el;
                  }}
                />
              ))}
            </ul>
          )}

          <button
            onClick={() => addItem.mutate()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card/50 py-4 text-sm font-medium text-muted-foreground transition-all hover:border-primary hover:text-primary active:scale-[0.99]"
          >
            <Plus className="h-5 w-5" />
            Adicionar item
          </button>

          <div className="h-24" />
        </div>
      </main>

      <footer className="border-t border-border bg-card shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total da compra
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {formatBRL(total)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Restante
            </p>
            <p
              className={`text-lg font-semibold tabular-nums ${
                purchase.budget - total < 0 ? "text-destructive" : "text-success"
              }`}
            >
              {formatBRL(purchase.budget - total)}
            </p>
          </div>
        </div>
      </footer>

      <PreListDialog
        open={preOpen}
        onOpenChange={setPreOpen}
        purchaseId={id}
        items={items.map((it) => ({ id: it.id, name: it.name, quantity: it.quantity }))}
        onJumpToItem={jumpToItem}
      />
    </div>
  );
}

function PurchaseHeader({
  purchase,
  total,
  onDelete,
  onOpenPreList,
}: {
  purchase: Purchase;
  total: number;
  onDelete: () => void;
  onOpenPreList: () => void;
}) {
  const qc = useQueryClient();
  const Icon = getIcon(purchase.icon);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const [budgetText, setBudgetText] = useState(
    purchase.budget ? String(purchase.budget).replace(".", ",") : "",
  );
  const [dateText, setDateText] = useState(purchase.date);

  useEffect(() => {
    setBudgetText(purchase.budget ? String(purchase.budget).replace(".", ",") : "");
  }, [purchase.budget]);
  useEffect(() => {
    setDateText(purchase.date);
  }, [purchase.date]);

  const saveBudget = useDebouncedCallback(async (value: string) => {
    const num = parseNumber(value);
    const { error } = await supabase
      .from("purchases")
      .update({ budget: num, updated_at: new Date().toISOString() })
      .eq("id", purchase.id);
    if (!error) qc.invalidateQueries({ queryKey: ["purchase", purchase.id] });
  }, 350);

  const navigate = useNavigate();

  // Mudar a data NÃO altera a lista atual. Em vez disso, cada data é uma
  // "compra" independente (mesmo nome/ícone). Procuramos uma compra existente
  // com o mesmo nome nesta data; se não houver, criamos uma nova (copiando a
  // pré-lista) e navegamos para ela. A lista antiga permanece intacta.
  const saveDate = async (value: string) => {
    if (!value || value === purchase.date) return;
    const nameKey = normalizeName(purchase.name);

    // Buscar compras nessa data com nome similar (case/acento-insensível).
    const { data: candidates } = await supabase
      .from("purchases")
      .select("id, name, date")
      .eq("date", value);

    const match = (candidates ?? []).find(
      (c) => normalizeName(c.name as string) === nameKey,
    );

    if (match && match.id !== purchase.id) {
      navigate({ to: "/compra/$id", params: { id: match.id as string } });
      return;
    }

    // Criar nova compra para essa data, herdando nome/ícone/orçamento.
    const { data: created, error } = await supabase
      .from("purchases")
      .insert({
        name: purchase.name,
        icon: purchase.icon,
        budget: purchase.budget,
        date: value,
      })
      .select("id")
      .single();
    if (error || !created) return;

    // Copiar pré-lista (anotações) para a nova data.
    const { data: pre } = await supabase
      .from("pre_list_items")
      .select("quantity, name, position")
      .eq("purchase_id", purchase.id);
    if (pre && pre.length > 0) {
      await supabase.from("pre_list_items").insert(
        pre.map((p) => ({
          purchase_id: created.id as string,
          quantity: p.quantity,
          name: p.name,
          position: p.position,
        })),
      );
    }

    qc.invalidateQueries({ queryKey: ["purchases"] });
    navigate({ to: "/compra/$id", params: { id: created.id as string } });
  };

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto max-w-4xl px-3 py-3">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight text-foreground">
              {purchase.name || "Sem nome"}
            </h1>
            <p className="text-xs text-muted-foreground">
              Itens: {formatBRL(total)}
            </p>
          </div>

          <button
            onClick={onOpenPreList}
            className="flex h-10 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
            aria-label="Abrir pré-lista"
          >
            <ListChecks className="h-4 w-4" />
            Pré-lista
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted"
                aria-label="Opções"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onClick={() => setEditOpen(true)} className="gap-2">
                <Pencil className="h-4 w-4" /> Editar compra
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setConfirmDel(true)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Excluir compra
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Valor disponível
            </span>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                R$
              </span>
              <Input
                inputMode="decimal"
                value={budgetText}
                onChange={(e) => {
                  setBudgetText(e.target.value);
                  saveBudget(e.target.value);
                }}
                placeholder="0,00"
                className="h-11 rounded-xl pl-9 text-base font-semibold tabular-nums"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Data ({formatShortDate(dateText || purchase.date)})
            </span>
            <Input
              type="date"
              value={dateText}
              onChange={(e) => {
                setDateText(e.target.value);
                saveDate(e.target.value);
              }}
              className="h-11 rounded-xl text-base"
            />
          </label>
        </div>
      </div>

      <EditPurchaseDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        purchase={purchase}
      />

      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir esta compra?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Todos os itens serão apagados. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDel(false)}
              className="flex-1 rounded-2xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDel(false);
                onDelete();
              }}
              className="flex-1 rounded-2xl"
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function EditPurchaseDialog({
  open,
  onOpenChange,
  purchase,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  purchase: Purchase;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(purchase.name);
  const [icon, setIcon] = useState(purchase.icon);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(purchase.name);
      setIcon(purchase.icon);
    }
  }, [open, purchase.name, purchase.icon]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar compra</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            const { error } = await supabase
              .from("purchases")
              .update({
                name: name.trim().slice(0, 60),
                icon,
                updated_at: new Date().toISOString(),
              })
              .eq("id", purchase.id);
            setSaving(false);
            if (!error) {
              qc.invalidateQueries({ queryKey: ["purchase", purchase.id] });
              qc.invalidateQueries({ queryKey: ["purchases"] });
              onOpenChange(false);
            }
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="h-12 rounded-2xl text-base"
            />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium">Ícone</label>
            <IconPicker icons={PURCHASE_ICONS} value={icon} onChange={setIcon} />
          </div>
          <Button
            type="submit"
            disabled={saving || !name.trim()}
            className="h-12 w-full rounded-2xl text-base font-semibold"
          >
            Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItemRow({
  item,
  purchaseId,
  highlighted,
  prev,
  rowRef,
}: {
  item: Item;
  purchaseId: string;
  highlighted?: boolean;
  prev?: HistoryHit;
  rowRef?: (el: HTMLLIElement | null) => void;
}) {
  const qc = useQueryClient();

  const [qty, setQty] = useState(
    item.quantity ? String(item.quantity).replace(".", ",") : "",
  );
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(
    item.price ? String(item.price).replace(".", ",") : "",
  );
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (document.activeElement?.getAttribute("data-item-id") !== item.id + ":qty") {
      setQty(item.quantity ? String(item.quantity).replace(".", ",") : "");
    }
    if (document.activeElement?.getAttribute("data-item-id") !== item.id + ":name") {
      setName(item.name);
    }
    if (document.activeElement?.getAttribute("data-item-id") !== item.id + ":price") {
      setPrice(item.price ? String(item.price).replace(".", ",") : "");
    }
  }, [item.quantity, item.name, item.price, item.id]);

  const persist = useDebouncedCallback(
    async (patch: Partial<Pick<Item, "quantity" | "name" | "price">>) => {
      const { error } = await supabase
        .from("purchase_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (!error) qc.invalidateQueries({ queryKey: ["items", purchaseId] });
    },
    300,
  );

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("purchase_items")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items", purchaseId] }),
  });

  const subtotal =
    (parseNumber(qty) || 0) * (parseNumber(price) || 0);

  // Comparison uses persisted price (item.price) so the color settles after typing.
  const cmp = compareTo(item.price, prev);
  const cmpBorder =
    cmp === "cheaper"
      ? "border-success ring-2 ring-success/40"
      : cmp === "same"
        ? "border-warning ring-2 ring-warning/40"
        : cmp === "more"
          ? "border-destructive ring-2 ring-destructive/40"
          : "border-border";

  // Long-press (touch + mouse) opens the comparison modal.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPress = () => {
    if (!prev) return;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setCompareOpen(true), 500);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  useEffect(() => () => cancelPress(), []);

  return (
    <li
      ref={rowRef}
      onContextMenu={(e) => {
        if (prev) {
          e.preventDefault();
          setCompareOpen(true);
        }
      }}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onTouchMove={cancelPress}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") startPress();
      }}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      className={`flex items-center gap-2 rounded-2xl border bg-card px-2 py-2 shadow-sm transition-all ${
        highlighted
          ? "border-primary ring-2 ring-primary/40 scale-[1.01]"
          : cmpBorder
      }`}
    >
      <Input
        data-item-id={item.id + ":qty"}
        inputMode="decimal"
        value={qty}
        onChange={(e) => {
          setQty(e.target.value);
          persist({ quantity: parseNumber(e.target.value) });
        }}
        placeholder="1"
        className="h-10 w-16 shrink-0 rounded-xl px-2 text-center text-base tabular-nums"
      />
      <Input
        data-item-id={item.id + ":name"}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          persist({ name: e.target.value.slice(0, 200) });
        }}
        placeholder="Nome do produto"
        className="h-10 min-w-[200px] flex-1 rounded-xl text-base"
      />
      <Input
        data-item-id={item.id + ":price"}
        inputMode="decimal"
        value={price}
        onChange={(e) => {
          setPrice(e.target.value);
          persist({ price: parseNumber(e.target.value) });
        }}
        placeholder="0,00"
        className="h-10 w-28 shrink-0 rounded-xl text-right text-base tabular-nums"
      />
      <div className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
        {formatBRL(subtotal)}
      </div>
      <button
        onClick={() => remove.mutate()}
        aria-label="Remover item"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="truncate">{item.name || "Produto"}</DialogTitle>
            <DialogDescription>
              Comparação com a compra anterior mais próxima.
            </DialogDescription>
          </DialogHeader>
          {prev ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Anterior
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums">
                  {formatBRL(prev.price)}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {prev.purchaseName} · {formatShortDate(prev.date)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {prev.name}
                </p>
              </div>
              <div
                className={`rounded-2xl p-3 ${
                  cmp === "cheaper"
                    ? "bg-success/10"
                    : cmp === "more"
                      ? "bg-destructive/10"
                      : cmp === "same"
                        ? "bg-warning/10"
                        : "bg-muted/60"
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Atual
                </p>
                <p
                  className={`mt-1 text-xl font-bold tabular-nums ${
                    cmp === "cheaper"
                      ? "text-success"
                      : cmp === "more"
                        ? "text-destructive"
                        : "text-foreground"
                  }`}
                >
                  {formatBRL(item.price)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cmp === "cheaper"
                    ? "Mais barato 🎉"
                    : cmp === "more"
                      ? `+${formatBRL(item.price - prev.price)} mais caro`
                      : cmp === "same"
                        ? "Mesmo preço"
                        : "Sem preço informado"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum registro anterior encontrado para este produto.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </li>
  );
}
