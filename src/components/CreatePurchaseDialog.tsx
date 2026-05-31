import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPicker } from "./IconPicker";
import { PURCHASE_ICONS } from "@/lib/icons";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { name: string; icon: string }) => Promise<void> | void;
}

export function CreatePurchaseDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("ShoppingCart");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setName("");
          setIcon("ShoppingCart");
        }
      }}
    >
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova compra</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            setSaving(true);
            try {
              await onCreate({ name: trimmed.slice(0, 60), icon });
              onOpenChange(false);
              setName("");
              setIcon("ShoppingCart");
            } finally {
              setSaving(false);
            }
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome do mercado</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Assaí"
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
            disabled={!name.trim() || saving}
            className="h-12 w-full rounded-2xl text-base font-semibold"
          >
            Criar compra
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
