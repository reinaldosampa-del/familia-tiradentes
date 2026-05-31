import {
  User, Smile, Heart, Star, Sun, Moon, Cat, Dog, Bird, Fish, Rabbit, Squirrel,
  Apple, Cherry, Grape, Carrot, IceCream, Cookie, Coffee, Pizza, Sandwich,
  ShoppingCart, ShoppingBag, Store, Package, Beef, Milk, Egg, Croissant,
  Wheat, Salad, Banana, type LucideIcon,
} from "lucide-react";

export const PROFILE_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "Smile", Icon: Smile },
  { name: "Heart", Icon: Heart },
  { name: "Star", Icon: Star },
  { name: "Sun", Icon: Sun },
  { name: "Moon", Icon: Moon },
  { name: "Cat", Icon: Cat },
  { name: "Dog", Icon: Dog },
  { name: "Bird", Icon: Bird },
  { name: "Fish", Icon: Fish },
  { name: "Rabbit", Icon: Rabbit },
  { name: "Squirrel", Icon: Squirrel },
  { name: "User", Icon: User },
];

export const PURCHASE_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: "ShoppingCart", Icon: ShoppingCart },
  { name: "ShoppingBag", Icon: ShoppingBag },
  { name: "Store", Icon: Store },
  { name: "Package", Icon: Package },
  { name: "Apple", Icon: Apple },
  { name: "Cherry", Icon: Cherry },
  { name: "Grape", Icon: Grape },
  { name: "Banana", Icon: Banana },
  { name: "Carrot", Icon: Carrot },
  { name: "Salad", Icon: Salad },
  { name: "Beef", Icon: Beef },
  { name: "Milk", Icon: Milk },
  { name: "Egg", Icon: Egg },
  { name: "Wheat", Icon: Wheat },
  { name: "Croissant", Icon: Croissant },
  { name: "Sandwich", Icon: Sandwich },
  { name: "Pizza", Icon: Pizza },
  { name: "Cookie", Icon: Cookie },
  { name: "IceCream", Icon: IceCream },
  { name: "Coffee", Icon: Coffee },
];

const ALL: Record<string, LucideIcon> = Object.fromEntries(
  [...PROFILE_ICONS, ...PURCHASE_ICONS].map((i) => [i.name, i.Icon]),
);

export function getIcon(name: string | null | undefined, fallback: LucideIcon = ShoppingCart): LucideIcon {
  if (!name) return fallback;
  return ALL[name] ?? fallback;
}
