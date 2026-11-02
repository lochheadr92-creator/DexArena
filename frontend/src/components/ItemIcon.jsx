import { Sun, Moon, Leaf, Snowflake, Footprints, Hand, RefreshCw, Shirt, Sparkles, Ghost, Package } from "lucide-react";
import { typeColors } from "@/game/config";
import { cn } from "@/lib/utils";

const ICONS = { sun: Sun, moon: Moon, leaf: Leaf, snowflake: Snowflake, footprints: Footprints, hand: Hand, "refresh-cw": RefreshCw, shirt: Shirt, sparkles: Sparkles, ghost: Ghost, spool: Package };

export const ItemIcon = ({ item, className }) => {
  if (item.sprite) return <img src={item.sprite} alt={item.name} className={cn("h-8 w-8 object-contain [image-rendering:pixelated]", className)} loading="lazy" data-testid={`item-icon-${item.id}`} />;
  const Icon = ICONS[item.icon] || Package;
  const color = typeColors[item.type]?.bg || "#94a3b8";
  return (
    <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", className)} style={{ backgroundColor: `${color}26`, color }} data-testid={`item-icon-${item.id}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
};
