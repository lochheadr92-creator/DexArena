import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const SpriteImg = ({ src, alt, className, locked = false, pixelated }) => {
  const [failed, setFailed] = useState(false);
  const smooth = src && src.includes("/original/");
  const px = pixelated ?? !smooth;
  if (failed || !src) {
    return (
      <div className={cn("flex items-center justify-center text-slate-600", className)}>
        <HelpCircle className="h-1/2 w-1/2" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn("select-none object-contain", px && "pixelated", locked && "silhouette", className)}
    />
  );
};
