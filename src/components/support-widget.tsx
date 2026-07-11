"use client";

import Script from "next/script";
import type { AppSettings } from "@/lib/types";

type SupportWidgetProps = {
  settings: Pick<
    AppSettings,
    | "supportWidgetEnabled"
    | "supportWidgetProvider"
    | "supportWidgetTawkPropertyId"
    | "supportWidgetTawkWidgetId"
    | "supportWidgetCrispWebsiteId"
    | "supportWidgetScriptUrl"
    | "supportWidgetCustomScript"
  > | null;
};

function cleanPathSegment(value?: string) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function cleanCrispWebsiteId(value?: string) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9-]/g, "");
}

function cleanScriptUrl(value?: string) {
  const url = String(value || "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function parseCustomScriptSnippet(value?: string) {
  const snippet = String(value || "").trim();
  if (!snippet) {
    return { inlineScripts: [] as string[], externalUrls: [] as string[] };
  }

  const inlineScripts: string[] = [];
  const externalUrls: string[] = [];
  const scriptTagPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptTagPattern.exec(snippet)) !== null) {
    const attrs = match[1] || "";
    const content = (match[2] || "").trim();
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      const cleanUrl = cleanScriptUrl(srcMatch[1].startsWith("//") ? `https:${srcMatch[1]}` : srcMatch[1]);
      if (cleanUrl) externalUrls.push(cleanUrl);
    }
    if (content) inlineScripts.push(content);
  }

  if (inlineScripts.length === 0 && externalUrls.length === 0 && !snippet.includes("<")) {
    inlineScripts.push(snippet);
  }

  return {
    inlineScripts,
    externalUrls: Array.from(new Set(externalUrls)),
  };
}

export function SupportWidget({ settings }: SupportWidgetProps) {
  if (!settings?.supportWidgetEnabled) return null;

  const provider = settings.supportWidgetProvider || "none";

  if (provider === "tawk") {
    const propertyId = cleanPathSegment(settings.supportWidgetTawkPropertyId);
    const widgetId = cleanPathSegment(settings.supportWidgetTawkWidgetId);
    if (!propertyId || !widgetId) return null;

    return (
      <Script id="support-widget-tawk" strategy="afterInteractive">
        {`
          window.Tawk_API = window.Tawk_API || {};
          window.Tawk_LoadStart = new Date();
          (function(){
            var s1 = document.createElement("script");
            var s0 = document.getElementsByTagName("script")[0];
            s1.async = true;
            s1.src = "https://embed.tawk.to/${propertyId}/${widgetId}";
            s1.charset = "UTF-8";
            s1.setAttribute("crossorigin", "*");
            s0.parentNode.insertBefore(s1, s0);
          })();
        `}
      </Script>
    );
  }

  if (provider === "crisp") {
    const websiteId = cleanCrispWebsiteId(settings.supportWidgetCrispWebsiteId);
    if (!websiteId) return null;

    return (
      <>
        <Script id="support-widget-crisp-config" strategy="afterInteractive">
          {`window.$crisp = []; window.CRISP_WEBSITE_ID = "${websiteId}";`}
        </Script>
        <Script id="support-widget-crisp" src="https://client.crisp.chat/l.js" strategy="afterInteractive" />
      </>
    );
  }

  if (provider === "custom") {
    const scriptUrl = cleanScriptUrl(settings.supportWidgetScriptUrl);
    const { inlineScripts, externalUrls } = parseCustomScriptSnippet(settings.supportWidgetCustomScript);
    const scripts = [...(scriptUrl ? [scriptUrl] : []), ...externalUrls];
    if (scripts.length === 0 && inlineScripts.length === 0) return null;

    return (
      <>
        {scripts.map((url, index) => (
          <Script key={url} id={`support-widget-custom-src-${index}`} src={url} strategy="afterInteractive" />
        ))}
        {inlineScripts.map((script, index) => (
          <Script key={`${index}-${script.slice(0, 24)}`} id={`support-widget-custom-inline-${index}`} strategy="afterInteractive">
            {script}
          </Script>
        ))}
      </>
    );
  }

  return null;
}
