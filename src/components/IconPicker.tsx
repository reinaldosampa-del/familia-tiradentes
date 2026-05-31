import { cn } from "@/lib/utils";

type IconOption = { name: string; Icon: React.ComponentType<{ className?: string }> };

interface Props {
  icons: IconOption[];
  value: string;
  onChange: (name: string) => void;
  size?: "sm" | "md";
}

export function IconPicker({ icons, value, onChange, size = "md" }: Props) {
  const btn = size === "sm" ? "h-12 w-12" : "h-14 w-14";
  const ic = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
      {icons.map(({ name, Icon }) => {
        const active = value === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={cn(
              btn,
              "flex items-center justify-center rounded-2xl border-2 transition-all active:scale-95",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "border-border bg-card text-foreground hover:border-primary/50",
            )}
            aria-label={name}
          >
            <Icon className={ic} />
          </button>
        );
      })}
    </div>
  );
}
