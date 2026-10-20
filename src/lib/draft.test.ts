import { describe, expect, it } from 'vitest';
import { published, sourceNote } from './draft';

describe('draft markers', () => {
  it('drops placeholders and trailing markers', () => {
    expect(published('TODO_COPY')).toBe('');
    expect(published('These terms are governed by the laws of India. TODO_COPY')).toBe(
      'These terms are governed by the laws of India.',
    );
    expect(published('Plain text.')).toBe('Plain text.');
  });

  it('strips the TODO_VERIFY prefix from source notes', () => {
    expect(sourceNote('TODO_VERIFY: UPERC tariff order')).toBe('UPERC tariff order');
    expect(sourceNote('Green Gas Limited price page')).toBe('Green Gas Limited price page');
  });
});
