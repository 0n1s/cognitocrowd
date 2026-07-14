"use client";

import { useBrandAssets } from "@/components/brand-provider";
import { cn } from "@/lib/utils";

export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  const assets = useBrandAssets();
  const mark = assets.logoMarkUrl;

  if (compact && mark) {
    return <img src={mark} alt="TrainlyLabs" className={cn("h-7 w-7 object-contain", className)} />;
  }

  if (!compact && (assets.logoLightUrl || assets.logoDarkUrl)) {
    return (
      <span className={cn("inline-flex items-center", className)} aria-label="TrainlyLabs">
        <img src={assets.logoLightUrl || assets.logoDarkUrl} alt="TrainlyLabs" className="h-8 w-auto object-contain dark:hidden" />
        <img src={assets.logoDarkUrl || assets.logoLightUrl} alt="TrainlyLabs" className="hidden h-8 w-auto object-contain dark:block" />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      {!compact && <span className="font-headline text-lg font-bold">TrainlyLabs</span>}
    </span>
  );
}
