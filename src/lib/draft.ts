/** Copy still awaiting the owner's words carries this marker (see CLAUDE.md). */
const MARKER = /\s*TODO_COPY(?:_HI)?\b/g;

/** Text with draft markers removed; empty when the whole string is a placeholder. */
export function published(text: string): string {
  return text.replace(MARKER, '').trim();
}

/** A data source note without its internal TODO_VERIFY prefix (the page shows "Not verified"). */
export function sourceNote(source: string): string {
  return source.replace(/^TODO_VERIFY:\s*/, '');
}
