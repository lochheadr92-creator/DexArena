import { TYPE_COLORS } from "@/lib/types";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

export const TypeBadge = ({ type, size = "sm", className }) => {
  const c = TYPE_COLORS[type] || { bg: "#64748B", text: "#fff" };
  return (
    <span
      data-testid={`type-badge-${type}`}
      style={{ backgroundColor: c.bg, color: c.text }}
      className={cn(
        "inline-flex items-center rounded-full font-semibold uppercase tracking-wider leading-none",
        size === "sm" ? "px-1.5 py-[3px] text-[9px]" : "px-2.5 py-1 text-[11px]",
        className,
      )}
    >
      {titleCase(type)}
    </span>
  );
};
