'use server';

import { ai, getAiClient } from '@/ai/genkit';
import { z } from 'genkit';
import { getAppSettings } from '@/lib/database';
import { resolveConfiguredModel, validateModelAvailability } from '@/ai/model-resolver';
import { extractTextFromGenerateResult } from '@/ai/extract-text';
import { sanitizeTrustPageHtml } from '@/lib/trust-page-html';

const PublicTrustPageKeySchema = z.enum(['about', 'contact', 'privacy', 'terms', 'refund', 'guidelines', 'faq']);

const GeneratePublicTrustPageInputSchema = z.object({
  pageKey: PublicTrustPageKeySchema,
  companyContext: z.string().optional(),
  currentTitle: z.string().optional(),
  currentSubtitle: z.string().optional(),
  currentContent: z.string().optional(),
  model: z.string().optional(),
});
export type GeneratePublicTrustPageInput = z.infer<typeof GeneratePublicTrustPageInputSchema>;

const GeneratePublicTrustPageOutputSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  content: z.string(),
  contentHtml: z.string(),
});
export type GeneratePublicTrustPageOutput = z.infer<typeof GeneratePublicTrustPageOutputSchema>;

const pageLabels: Record<z.infer<typeof PublicTrustPageKeySchema>, string> = {
  about: 'About',
  contact: 'Contact',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  refund: 'Refund and Deposit Policy',
  faq: 'FAQ',
  guidelines: 'Contributor Guidelines',
};

function extractJsonObject(rawText: string) {
  const trimmed = rawText.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] || trimmed;
}

function fallbackDraft(input: GeneratePublicTrustPageInput): GeneratePublicTrustPageOutput {
  const label = pageLabels[input.pageKey];
  const context = input.companyContext || 'TrainlyLabs is an AI training and creative tools platform.';
  const title = input.currentTitle || label;
  const subtitle = input.currentSubtitle || `Information about ${label.toLowerCase()} at TrainlyLabs.`;
  const content = input.currentContent || `${context}\n\nThis draft page is being prepared. Please use the AI generator to create content.`;
  return {
    title,
    subtitle,
    content,
    contentHtml: sanitizeTrustPageHtml(`<section class="trust-section"><p>${content.replace(/\n+/g, '</p><p>')}</p></section>`),
  };
}

const promptTemplate = `You draft public trust page content for TrainlyLabs.
Generate only the selected page, not all pages.

Selected page: {{pageLabel}} (key: {{pageKey}})

Company context:
{{companyContext}}

Current page title:
{{currentTitle}}

Current page subtitle:
{{currentSubtitle}}

Current page content:
{{currentContent}}

Return JSON only:
{
  "title": "",
  "subtitle": "",
  "content": "",
  "contentHtml": ""
}

Rules:
- content is a plain text fallback.
- contentHtml is a polished HTML fragment only for the content area.
- Do not include page header, footer, navigation, body, html, CSS, JavaScript, forms, iframe, style tags, script tags, images, or inline styles.
- Only use these tags: section, div, h2, h3, p, ul, ol, li, strong, em, a, br.
- Only use these classes: trust-section, trust-callout, trust-list, trust-muted, trust-grid, trust-card.
- Use trust-section for major sections, trust-callout for important notices, trust-list on ul/ol, trust-grid with trust-card only when a compact two-column summary helps.
- For privacy, terms, and refund pages only: you MAY use standard legal section headings and general language that is typical for these types of pages. Do not include specific company names, addresses, or dates.
- For other pages: Do not invent legal entity names, jurisdictions, addresses, support emails, payment processors, refund guarantees, employment promises, or compliance claims.
- If details are missing, use bracketed placeholders such as [support email], [company legal name], [jurisdiction], or [refund review period].
- Keep the tone trustworthy, clear, modern, concise, and human.
- This is a draft for admin review, not legal advice.`;

const generatePublicTrustPageFlow = ai.defineFlow(
  {
    name: 'generatePublicTrustPageFlow',
    inputSchema: GeneratePublicTrustPageInputSchema,
    outputSchema: GeneratePublicTrustPageOutputSchema,
  },
  async (input) => {
    const settings = await getAppSettings();
    const runtimeAi = getAiClient({ providers: settings.aiProviders });
    const configuredModel = resolveConfiguredModel(input.model || settings.publicTrustPageAiModel || settings.defaultTextGenAiModel || settings.defaultGenAiModel, 'text');
    const model = validateModelAvailability(configuredModel, 'text', settings.aiProviders, false);

    if (!model) {
      return fallbackDraft(input);
    }

    try {
      const generated = await runtimeAi.generate({
        model,
        prompt: promptTemplate
          .replace('{{pageLabel}}', pageLabels[input.pageKey])
          .replace('{{pageKey}}', input.pageKey)
          .replace('{{companyContext}}', input.companyContext || settings.publicTrustCompanyContext || '')
          .replace('{{currentTitle}}', input.currentTitle || '')
          .replace('{{currentSubtitle}}', input.currentSubtitle || '')
          .replace('{{currentContent}}', input.currentContent || ''),
      });

      const parsed = JSON.parse(extractJsonObject(extractTextFromGenerateResult(generated))) as Partial<GeneratePublicTrustPageOutput>;
      const fallback = fallbackDraft(input);
      return {
        title: String(parsed.title || fallback.title).trim(),
        subtitle: String(parsed.subtitle || fallback.subtitle).trim(),
        content: String(parsed.content || fallback.content).trim(),
        contentHtml: sanitizeTrustPageHtml(String(parsed.contentHtml || fallback.contentHtml)),
      };
    } catch {
      return fallbackDraft(input);
    }
  }
);

export async function generatePublicTrustPage(input: GeneratePublicTrustPageInput): Promise<GeneratePublicTrustPageOutput> {
  return generatePublicTrustPageFlow(input);
}
