/**
 * Shareable results: a tool's inputs live in the URL query, so a link restores the scenario.
 * No server involved. Only numbers, enums and booleans are allowed, never free text, so a crafted
 * link cannot inject content into the page.
 */

export type ParamSpec =
  | { param: string; type: 'number'; min?: number; max?: number; integer?: boolean }
  | { param: string; type: 'enum'; values: readonly string[] }
  | { param: string; type: 'boolean' };

export type ShareSchema<T> = { [K in keyof T]?: ParamSpec };

function assertUniqueParams(schema: Record<string, ParamSpec | undefined>): void {
  const seen = new Set<string>();
  for (const spec of Object.values(schema)) {
    if (!spec) continue;
    if (seen.has(spec.param)) throw new Error(`duplicate share param "${spec.param}"`);
    seen.add(spec.param);
  }
}

function encodeValue(spec: ParamSpec, value: unknown): string | null {
  switch (spec.type) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      return String(Number(value.toPrecision(12)));
    case 'enum':
      return typeof value === 'string' && spec.values.includes(value) ? value : null;
    case 'boolean':
      return typeof value === 'boolean' ? (value ? '1' : '0') : null;
  }
}

function decodeValue(spec: ParamSpec, raw: string): unknown {
  switch (spec.type) {
    case 'number': {
      if (!/^-?(\d+\.?\d*|\.\d+)$/.test(raw)) return undefined;
      const n = Number(raw);
      if (!Number.isFinite(n)) return undefined;
      if (spec.integer && !Number.isInteger(n)) return undefined;
      if (spec.min !== undefined && n < spec.min) return undefined;
      if (spec.max !== undefined && n > spec.max) return undefined;
      return n;
    }
    case 'enum':
      return spec.values.includes(raw) ? raw : undefined;
    case 'boolean':
      return raw === '1' ? true : raw === '0' ? false : undefined;
  }
}

/** Values → query string (without "?"), in schema order. Invalid or missing values are left out. */
export function encodeShare<T extends object>(values: Partial<T>, schema: ShareSchema<T>): string {
  assertUniqueParams(schema as Record<string, ParamSpec | undefined>);
  const params = new URLSearchParams();
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const spec = schema[key];
    if (!spec) continue;
    const encoded = encodeValue(spec, values[key]);
    if (encoded !== null) params.set(spec.param, encoded);
  }
  return params.toString();
}

/** Query string → the values it validly carries. Unknown, malformed or out-of-range params are ignored. */
export function decodeShare<T extends object>(
  search: string | URLSearchParams,
  schema: ShareSchema<T>,
): Partial<T> {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const out: Partial<T> = {};
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const spec = schema[key];
    const raw = spec && params.get(spec.param);
    if (!spec || raw === null || raw === undefined) continue;
    const value = decodeValue(spec, raw);
    if (value !== undefined) out[key] = value as T[keyof T];
  }
  return out;
}

/** `href` with its query replaced by the encoded values; the hash is dropped. */
export function shareUrl<T extends object>(
  href: string,
  values: Partial<T>,
  schema: ShareSchema<T>,
): string {
  const url = new URL(href);
  url.search = encodeShare(values, schema);
  url.hash = '';
  return url.href;
}
