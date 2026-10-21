import type { ComponentChildren } from 'preact';

interface Props {
  title: string;
  /** One line on what belongs here. */
  hint: string;
  /** `yours`: the few figures only the visitor knows, set apart in a card. `check`: plain list. */
  tone: 'yours' | 'check';
  children: ComponentChildren;
}

/**
 * A tier of inputs. Tools put the visitor's own figures first ("Your numbers"), then rates worth
 * checking ("Check these"); everything already filled in sits in a closed Refine panel below.
 */
export default function Tier({ title, hint, tone, children }: Props) {
  return (
    <fieldset
      class={
        tone === 'yours'
          ? 'mt-4 rounded-xl border border-line-strong bg-raised px-4 pt-3 pb-1'
          : 'mt-5'
      }
    >
      <legend class={tone === 'yours' ? 'float-left w-full' : 'w-full'}>
        <span class="block font-display text-lg font-medium">{title}</span>
        <span class="mt-0.5 block text-sm text-ink-muted">{hint}</span>
      </legend>
      <div
        class={`clear-both divide-y divide-line ${tone === 'check' ? 'mt-1 border-t border-line-strong' : 'mt-1'}`}
      >
        {children}
      </div>
    </fieldset>
  );
}
