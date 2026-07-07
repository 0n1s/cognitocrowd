export function extractTextFromGenerateResult(result: unknown): string {
  if (!result || typeof result !== 'object') return '';

  const value = result as {
    text?: unknown;
    output?: { text?: unknown; content?: unknown };
    message?: { content?: unknown };
    content?: unknown;
  };

  if (typeof value.text === 'string' && value.text.trim()) return value.text.trim();
  if (typeof value.output?.text === 'string' && value.output.text.trim()) return value.output.text.trim();

  for (const content of [value.output?.content, value.message?.content, value.content]) {
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (!Array.isArray(content)) continue;

    const text = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();

    if (text) return text;
  }

  return '';
}
