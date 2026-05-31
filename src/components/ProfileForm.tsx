import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPicker } from "./IconPicker";
import { PROFILE_ICONS } from "@/lib/icons";
import { ShoppingBasket } from "lucide-react";

interface Props {
  initialName?: string;
  initialIcon?: string;
  submitLabel?: string;
  onSubmit: (data: { name: string; icon: string }) => void;
  isSubmitting?: boolean;
}

export function ProfileForm({
  initialName = "",
  initialIcon = "Smile",
  submitLabel = "Entrar",
  onSubmit,
  isSubmitting,
}: Props) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        onSubmit({ name: trimmed.slice(0, 40), icon });
      }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="name">
          Seu nome
        </label>
        <Input
          id="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Maria"
          maxLength={40}
          className="h-12 rounded-2xl text-base"
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Escolha um ícone</label>
        <IconPicker icons={PROFILE_ICONS} value={icon} onChange={setIcon} />
      </div>

      <Button
        type="submit"
        disabled={!name.trim() || isSubmitting}
        className="h-12 w-full rounded-2xl text-base font-semibold"
      >
        <ShoppingBasket className="mr-2 h-5 w-5" />
        {submitLabel}
      </Button>
    </form>
  );
}
