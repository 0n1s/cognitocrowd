const ALLOWED_TAGS = new Set(['section', 'div', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br']);
const ALLOWED_CLASSES = new Set(['trust-section', 'trust-callout', 'trust-list', 'trust-muted', 'trust-grid', 'trust-card']);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeAttributes(tag: string, attrs: string) {
  const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i);
  const classes = (classMatch?.[1] || '')
    .split(/\s+/)
    .map((className) => className.trim())
    .filter((className) => ALLOWED_CLASSES.has(className));

  const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']*)["']/i);
  const href = hrefMatch?.[1]?.trim() || '';
  const safeHref = tag === 'a' && (href.startsWith('/') || href.startsWith('https://') || href.startsWith('mailto:')) ? href : '';

  const attrParts = [];
  if (classes.length > 0) attrParts.push(`class="${classes.join(' ')}"`);
  if (safeHref) attrParts.push(`href="${escapeHtml(safeHref)}" rel="nofollow noopener" target="${safeHref.startsWith('https://') ? '_blank' : '_self'}"`);

  return attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
}

export function sanitizeTrustPageHtml(html: string) {
  const withoutDangerousBlocks = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta)\b[^>]*\/?\s*>/gi, '');

  return withoutDangerousBlocks.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (fullTag, rawTagName, rawAttrs) => {
    const tagName = String(rawTagName || '').toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) return '';
    if (fullTag.startsWith('</')) return `</${tagName}>`;
    if (tagName === 'br') return '<br>';
    return `<${tagName}${sanitizeAttributes(tagName, String(rawAttrs || ''))}>`;
  });
}

export function plainTextToTrustPageHtml(value: string) {
  const paragraphs = String(value || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return '';

  return paragraphs
    .map((paragraph) => `<section class="trust-section"><p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p></section>`)
    .join('\n');
}
