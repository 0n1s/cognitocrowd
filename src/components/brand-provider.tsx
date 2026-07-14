"use client";

import { createContext, useContext } from "react";
import type { BrandAssets } from "@/lib/types";

const BrandContext = createContext<BrandAssets>({});

export function BrandProvider({ assets, children }: { assets: BrandAssets; children: React.ReactNode }) {
  return <BrandContext.Provider value={assets}>{children}</BrandContext.Provider>;
}

export function useBrandAssets() {
  return useContext(BrandContext);
}
