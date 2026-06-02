import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPicker } from "./IconPicker";
import { PROFILE_ICONS } from "@/lib/icons";
import { ShoppingBasket, Check } from "lucide-react";

interface Props {
  initialName?: string;
  initialIcon?: string;
  initialColor?: string;
  submitLabel?: string;
  onSubmit: (data: { name: string; icon: string; color: string }) => void;
  isSubmitting?: boolean;
}

const PRESET_COLORS = [
  "#3b82f6", // azul
  "#ef4444", // vermelho
  "#10b981", // verde
  "#f59e0b", // amarelo
  "#8b5cf6", // roxo
  "#ec4899", // rosa
  "#14b8a6", // teal
  "#f97316", // laranja
  "#0ea5e9", // ciano
  "#84cc16", // lima
];

export function ProfileForm({
  initialName = "",
  initialIcon = "Smile",
  initialColor = PRESET_COLORS[0],
  submitLabel = "Entrar",
  onSubmit,
  isSubmitting,
}: Props) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        onSubmit({ name: trimmed.slice(0, 40), icon, color });
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

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Cor preferida</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Cor ${c}`}
              className="flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-all active:scale-90"
              style={{
                backgroundColor: c,
                boxShadow: color === c ? `0 0 0 3px ${c}` : "inset 0 0 0 1px rgba(0,0,0,0.1)",
                outline: color === c ? "2px solid white" : "none",
                outlineOffset: color === c ? "-5px" : "0",
              }}
            >
              {color === c && <Check className="h-4 w-4 text-white drop-shadow" />}
            </button>
          ))}
          <label className="flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border text-[10px] font-semibold text-muted-foreground">
            +
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute h-0 w-0 opacity-0"
            />
          </label>
        </div>
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
