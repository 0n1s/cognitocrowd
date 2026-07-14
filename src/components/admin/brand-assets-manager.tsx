"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import type { BrandAssets } from "@/lib/types";

const assetOptions: Array<{ key: string; field: keyof BrandAssets; label: string; help: string; accept: string }> = [
  { key: "logoLight", field: "logoLightUrl", label: "Full logo · light backgrounds", help: "Recommended: 600 × 160 px or SVG · transparent background", accept: ".svg,.png,.webp,.jpg,.jpeg" },
  { key: "logoDark", field: "logoDarkUrl", label: "Full logo · dark backgrounds", help: "Recommended: 600 × 160 px or SVG · transparent background", accept: ".svg,.png,.webp,.jpg,.jpeg" },
  { key: "logoMark", field: "logoMarkUrl", label: "Compact logo mark", help: "Recommended: 512 × 512 px or square SVG", accept: ".svg,.png,.webp,.jpg,.jpeg" },
  { key: "favicon", field: "faviconUrl", label: "Favicon", help: "Recommended: 32 × 32 px SVG, PNG, or ICO", accept: ".svg,.png,.ico" },
  { key: "appleTouchIcon", field: "appleTouchIconUrl", label: "Apple touch icon", help: "Recommended: 180 × 180 px PNG", accept: ".png,.webp,.jpg,.jpeg" },
  { key: "socialImage", field: "socialImageUrl", label: "Social sharing image", help: "Recommended: 1200 × 630 px", accept: ".png,.webp,.jpg,.jpeg" },
  { key: "emailLogo", field: "emailLogoUrl", label: "Email logo", help: "Recommended: 600 × 160 px PNG", accept: ".png,.jpg,.jpeg" },
];

export function BrandAssetsManager({ value, onChange }: { value: BrandAssets; onChange: (value: BrandAssets) => void }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();

  const upload = async (asset: (typeof assetOptions)[number], file?: File) => {
    if (!file || !auth?.currentUser) return;
    setUploading(asset.key);
    try {
      const data = new FormData();
      data.append("asset", asset.key);
      data.append("file", file);
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/admin/brand-assets", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.message || "Upload failed.");
      onChange({ ...value, [asset.field]: result.url });
      toast({ title: "Brand asset updated", description: `${asset.label} is now live.` });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Could not upload the asset.", variant: "destructive" });
    } finally {
      setUploading(null);
      if (inputs.current[asset.key]) inputs.current[asset.key]!.value = "";
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {assetOptions.map((asset) => {
        const url = value?.[asset.field];
        return (
          <div key={asset.key} className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3 flex h-28 items-center justify-center rounded-md border bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(-45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(45deg,transparent_75%,hsl(var(--muted))_75%),linear-gradient(-45deg,transparent_75%,hsl(var(--muted))_75%)] bg-[length:16px_16px]">
              {url ? <img src={url} alt={`${asset.label} preview`} className="max-h-24 max-w-[90%] object-contain" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
            </div>
            <Label>{asset.label}</Label>
            <p className="mb-3 text-xs text-muted-foreground">{asset.help} · maximum 5 MB</p>
            <input ref={(node) => { inputs.current[asset.key] = node; }} type="file" accept={asset.accept} className="hidden" onChange={(event) => upload(asset, event.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" disabled={uploading !== null} onClick={() => inputs.current[asset.key]?.click()}>
              {uploading === asset.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {url ? "Replace" : "Upload"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
