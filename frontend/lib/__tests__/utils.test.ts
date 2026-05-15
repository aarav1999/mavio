import { cn, decodeHtml } from '../utils';

describe('cn (className merger)', () => {
  it('joins multiple class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('lets tailwind-merge resolve conflicting tailwind classes', () => {
    expect(cn('p-2 p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});

describe('decodeHtml', () => {
  it('decodes common HTML entities', () => {
    expect(decodeHtml('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(decodeHtml('&lt;b&gt;hi&lt;/b&gt;')).toBe('<b>hi</b>');
    expect(decodeHtml('&quot;quoted&quot;')).toBe('"quoted"');
    expect(decodeHtml('it&#39;s')).toBe("it's");
    expect(decodeHtml('a&nbsp;b')).toBe('a b');
  });

  it('decodes numeric character references', () => {
    expect(decodeHtml('&#8364;100')).toBe('€100');
  });

  it('leaves plain text untouched', () => {
    expect(decodeHtml('hello world')).toBe('hello world');
  });

  it('handles multiple entities in one string', () => {
    expect(decodeHtml('&lt;a href=&quot;x&quot;&gt;link&lt;/a&gt;')).toBe('<a href="x">link</a>');
  });
});
