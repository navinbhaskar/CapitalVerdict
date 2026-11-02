/**
 * Formulas written in the site's plain notation, turned into MathML so they read like maths:
 * powers as superscripts and divisions as stacked fractions.
 *
 *   (1 + r)^n           → (1 + r) with n raised
 *   a ÷ b, 1/12, r/12   → a over b, with a rule between ("/" divides only before a digit, so
 *                          units like km/L and ₹/L stay as written)
 *   Σ term              → Σ applied to the whole term that follows it
 *   name(args)          → a function, e.g. bill(other + km), balance(m − 1)
 * Words become upright text, single letters italic variables, numbers numbers. Only "−" is a
 * minus; a hyphen stays part of a word (e-scooter, long-term). Everything else is text, so a
 * formula never fails to show: at worst it shows as written.
 *
 * The strings are the site's own copy, with numbers filled in; text is escaped all the same.
 */

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'row'; items: Node[] }
  | { kind: 'group'; inner: Node }
  | { kind: 'frac'; num: Node; den: Node }
  | { kind: 'sup'; base: Node; exp: Node }
  | { kind: 'call'; name: string; args: Node };

type Token =
  | { t: 'text'; v: string; spaceBefore: boolean }
  | { t: 'op'; v: string; spaceBefore: boolean }
  | { t: '('; spaceBefore: boolean }
  | { t: ')'; spaceBefore: boolean };

const ADD = new Set(['+', '−']);
const MUL = new Set(['×', '÷', '/']);
const REL = new Set(['=', '≥', '≤', ':']);

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let text = '';
  const flush = () => {
    const v = text.trim();
    if (v) out.push({ t: 'text', v, spaceBefore: false });
    text = '';
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    const next = src[i + 1] ?? '';
    const spaceBefore = i === 0 || /\s/.test(src[i - 1]!);
    const isOp =
      ADD.has(c) ||
      c === '×' ||
      c === '÷' ||
      c === '^' ||
      c === 'Σ' ||
      REL.has(c) ||
      (c === ',' && next === ' ') ||
      (c === '/' && /\d/.test(next));
    if (c === '(' || c === ')') {
      flush();
      out.push({ t: c, spaceBefore });
    } else if (isOp) {
      flush();
      out.push({ t: 'op', v: c, spaceBefore });
    } else {
      text += c;
    }
  }
  flush();
  return out;
}

class Parser {
  private i = 0;
  constructor(private readonly toks: Token[]) {}

  private peek() {
    return this.toks[this.i];
  }
  private isOp(set: Set<string>) {
    const p = this.peek();
    return p?.t === 'op' && set.has(p.v);
  }

  parse(): Node {
    const items = [this.relation()];
    // Anything left over (an unmatched ")") is kept as text rather than dropped.
    while (this.i < this.toks.length) {
      const tok = this.toks[this.i++]!;
      items.push({ kind: 'text', value: tok.t === 'text' || tok.t === 'op' ? tok.v : tok.t });
    }
    return items.length === 1 ? items[0]! : { kind: 'row', items };
  }

  private relation(): Node {
    const items: Node[] = [this.list()];
    while (this.isOp(REL)) {
      items.push({ kind: 'op', value: (this.toks[this.i++] as { v: string }).v });
      items.push(this.list());
    }
    return items.length === 1 ? items[0]! : { kind: 'row', items };
  }

  private list(): Node {
    const items: Node[] = [this.expr()];
    while (this.isOp(new Set([',']))) {
      this.i++;
      items.push({ kind: 'op', value: ',' });
      items.push(this.expr());
    }
    return items.length === 1 ? items[0]! : { kind: 'row', items };
  }

  private expr(): Node {
    const items: Node[] = [this.term()];
    while (this.isOp(ADD)) {
      items.push({ kind: 'op', value: (this.toks[this.i++] as { v: string }).v });
      items.push(this.term());
    }
    return items.length === 1 ? items[0]! : { kind: 'row', items };
  }

  private term(): Node {
    if (this.isOp(new Set(['Σ']))) {
      this.i++;
      return { kind: 'row', items: [{ kind: 'op', value: 'Σ' }, this.term()] };
    }
    let items: Node[] = [this.power()];
    for (;;) {
      if (this.isOp(MUL)) {
        const op = (this.toks[this.i++] as { v: string }).v;
        if (op === '×') {
          items.push({ kind: 'op', value: '×' }, this.power());
        } else {
          // ÷ or /: everything multiplied so far over the next factor (Σ included).
          const num: Node = items.length === 1 ? items[0]! : { kind: 'row', items };
          const den = this.isOp(new Set(['Σ'])) ? this.term() : this.power();
          items = [{ kind: 'frac', num, den }];
        }
      } else if (this.startsAtom()) {
        items.push(this.power());
      } else break;
    }
    return items.length === 1 ? items[0]! : { kind: 'row', items };
  }

  private startsAtom() {
    const p = this.peek();
    return p !== undefined && (p.t === 'text' || p.t === '(');
  }

  private power(): Node {
    const base = this.atom();
    if (this.isOp(new Set(['^']))) {
      this.i++;
      const exp = this.atom();
      return { kind: 'sup', base, exp: exp.kind === 'group' ? exp.inner : exp };
    }
    return base;
  }

  private atom(): Node {
    const p = this.peek();
    if (!p) return { kind: 'text', value: '' };
    if (p.t === '(') {
      this.i++;
      const inner = this.relation();
      if (this.peek()?.t === ')') this.i++;
      return { kind: 'group', inner };
    }
    if (p.t === 'text') {
      this.i++;
      const next = this.peek();
      if (next?.t === '(' && !next.spaceBefore) {
        this.i++;
        const args = this.relation();
        if (this.peek()?.t === ')') this.i++;
        return { kind: 'call', name: p.v, args };
      }
      return { kind: 'text', value: p.v };
    }
    this.i++;
    return { kind: 'text', value: p.t === 'op' ? p.v : p.t };
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function leaf(value: string): string {
  if (/^[0-9][0-9.,]*$/.test(value)) return `<mn>${esc(value)}</mn>`;
  if (/^[A-Za-z]$/.test(value)) return `<mi>${esc(value)}</mi>`;
  return `<mtext>${esc(value)}</mtext>`;
}

/**
 * Space around each operator, drawn with <mspace> rather than lspace/rspace: browsers drop
 * operator spacing between two words (e.g. "bill without solar − bill with solar").
 */
const gap = (em: number) => (em > 0 ? `<mspace width="${em}em"></mspace>` : '');
const OP_SPACE: Record<string, [number, number]> = {
  '+': [0.22, 0.22],
  '−': [0.22, 0.22],
  '×': [0.22, 0.22],
  '÷': [0.22, 0.22],
  '=': [0.28, 0.28],
  '≥': [0.28, 0.28],
  '≤': [0.28, 0.28],
  ':': [0, 0.28],
  ',': [0, 0.3],
  Σ: [0, 0.15],
};

/** A fraction's parts lose their outer brackets: the rule already groups them. */
const unwrap = (n: Node): Node => (n.kind === 'group' ? n.inner : n);

function ml(n: Node): string {
  switch (n.kind) {
    case 'text':
      return leaf(n.value);
    case 'op': {
      const [l, r] = OP_SPACE[n.value] ?? [0, 0];
      return `${gap(l)}<mo lspace="0" rspace="0">${esc(n.value)}</mo>${gap(r)}`;
    }
    case 'row':
      return `<mrow>${n.items.map(ml).join('')}</mrow>`;
    case 'group':
      return `<mrow><mo>(</mo>${ml(n.inner)}<mo>)</mo></mrow>`;
    case 'frac':
      return `<mfrac><mrow>${ml(unwrap(n.num))}</mrow><mrow>${ml(unwrap(n.den))}</mrow></mfrac>`;
    case 'sup':
      return `<msup><mrow>${ml(n.base)}</mrow><mrow>${ml(n.exp)}</mrow></msup>`;
    case 'call':
      return `<mrow>${leaf(n.name)}<mo>(</mo>${ml(n.args)}<mo>)</mo></mrow>`;
  }
}

/** One formula as a MathML element, which screen readers read as maths. */
export function formulaMathML(src: string, display: 'inline' | 'block' = 'inline'): string {
  const tree = new Parser(tokenize(src.trim())).parse();
  return `<math display="${display}">${ml(tree)}</math>`;
}

/** True when a formula has a power or a division worth drawing as maths. */
export const hasMaths = (src: string) => /\^|÷|\/\d/.test(src);

/**
 * A block of formula lines ("lhs = rhs"), split at each line's first "=" so the sides can line
 * up. Lines without one come back with an empty left side.
 */
export function formulaLines(block: string): { lhs: string; rhs: string }[] {
  return block
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((line) => {
      const at = line.indexOf('=');
      return at < 0
        ? { lhs: '', rhs: formulaMathML(line) }
        : { lhs: formulaMathML(line.slice(0, at)), rhs: formulaMathML(line.slice(at + 1)) };
    });
}
