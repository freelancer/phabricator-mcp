import { describe, it } from 'node:test';
import assert from 'node:assert';
import { decodeText, hasBinaryExtension, isTextMimeType, sliceLines } from './file-text.js';

describe('decodeText', () => {
  it('decodes UTF-8 text', () => {
    assert.deepStrictEqual(decodeText(Buffer.from('h\u00e9llo\n', 'utf8')), { text: 'h\u00e9llo\n', valid: true });
  });

  it('keeps a byte order mark', () => {
    assert.deepStrictEqual(decodeText(Buffer.from([0xef, 0xbb, 0xbf, 0x61])), { text: '\ufeffa', valid: true });
  });

  it('returns null for data with a NUL byte', () => {
    assert.strictEqual(decodeText(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01])), null);
  });

  it('replaces invalid UTF-8 and reports it', () => {
    assert.deepStrictEqual(decodeText(Buffer.from([0x63, 0x61, 0x66, 0xe9])), { text: 'caf\ufffd', valid: false });
  });
});

describe('sliceLines', () => {
  const file = 'one\ntwo\nthree\nfour\n';

  it('returns a whole small file unchanged with no note', () => {
    assert.deepStrictEqual(sliceLines(file), { text: file });
    assert.deepStrictEqual(sliceLines('a\nb'), { text: 'a\nb' });
  });

  it('keeps CRLF line endings', () => {
    assert.deepStrictEqual(sliceLines('a\r\nb\r\n', { startLine: 2 }), { text: 'b\r\n', note: '[Line 2 of 2.]' });
  });

  it('returns a range and says how to read on', () => {
    assert.deepStrictEqual(sliceLines(file, { startLine: 2, lineCount: 2 }), {
      text: 'two\nthree\n',
      note: '[Lines 2-3 of 4. Pass startLine: 4 to read on.]',
    });
  });

  it('notes a range that reaches the end without a continuation', () => {
    assert.deepStrictEqual(sliceLines(file, { startLine: 3 }), {
      text: 'three\nfour\n',
      note: '[Lines 3-4 of 4.]',
    });
  });

  it('stops at a line boundary at the character limit', () => {
    assert.deepStrictEqual(sliceLines(file, { maxChars: 9 }), {
      text: 'one\ntwo\n',
      note: '[Lines 1-2 of 4; line 3 would pass the 9-character limit. Pass startLine: 3 to read on.]',
    });
  });

  it('pages join back into the file exactly, including a line longer than a page', () => {
    const text = '\ufeffalpha\r\nbeta\n\ngamma delta epsilon zeta eta theta\nepsilon';
    const pages: string[] = [];
    let at: { startLine: number; startColumn?: number } | undefined = { startLine: 1 };
    while (at) {
      const page = sliceLines(text, { ...at, maxChars: 12 });
      pages.push(page.text);
      const next = page.note?.match(/startLine: (\d+)(?:, startColumn: (\d+))?/);
      at = next ? { startLine: Number(next[1]), startColumn: next[2] ? Number(next[2]) : undefined } : undefined;
    }
    assert.ok(pages.length > 3);
    assert.strictEqual(pages.join(''), text);
  });

  it('cuts a line longer than the limit and says where to read on within it', () => {
    assert.deepStrictEqual(sliceLines('abcdefghij\nk\n', { maxChars: 4 }), {
      text: 'abcd',
      note: '[Line 1 of 2, characters 1-4 of 11. Pass startLine: 1, startColumn: 5 to read on.]',
    });
    assert.deepStrictEqual(sliceLines('abcdefghij\nk\n', { startColumn: 5, maxChars: 4 }), {
      text: 'efgh',
      note: '[Line 1 of 2, characters 5-8 of 11. Pass startLine: 1, startColumn: 9 to read on.]',
    });
  });

  it('returns the end of a long line with the lines after it', () => {
    assert.deepStrictEqual(sliceLines('abcdefghij\nk\n', { startColumn: 9, maxChars: 5 }), {
      text: 'ij\nk\n',
      note: '[Lines 1-2 of 2, from character 9 of line 1.]',
    });
  });

  it('rejects a startColumn past the end of the line', () => {
    assert.throws(() => sliceLines('ab\ncd\n', { startColumn: 4 }), /startColumn 4 is past the end of line 1 \(3 characters\)/);
  });

  it('does not split a surrogate pair when cutting a line', () => {
    assert.strictEqual(sliceLines('ab\u{1F600}cd', { maxChars: 3 }).text, 'ab');
  });

  it('starts a column on the second half of a surrogate pair at its first half', () => {
    assert.strictEqual(sliceLines('ab\u{1F600}cd\n', { startColumn: 4 }).text, '\u{1F600}cd\n');
  });

  it('names the commit to read on at', () => {
    assert.strictEqual(
      sliceLines('a\nb\n', { lineCount: 1, readOnCommit: 'abc' }).note,
      '[Line 1 of 2. Pass startLine: 2, commit: abc to read on.]',
    );
    assert.match(sliceLines('abcdef', { maxChars: 3, readOnCommit: 'abc' }).note!, /startColumn: 4, commit: abc to read on/);
  });

  it('marks an empty file', () => {
    assert.deepStrictEqual(sliceLines(''), { text: '', note: '[Empty file.]' });
  });

  it('rejects a startLine past the end', () => {
    assert.throws(() => sliceLines(file, { startLine: 5 }), /startLine 5 is past the end of the file \(4 lines\)/);
    assert.throws(() => sliceLines('', { startLine: 2 }), /startLine 2 is past the end of the file \(0 lines\)/);
  });
});

describe('hasBinaryExtension', () => {
  it('matches binary extensions in any case, and only the last one', () => {
    assert.ok(hasBinaryExtension('img/Logo.PNG'));
    assert.ok(hasBinaryExtension('dist/app.tar.gz'));
    assert.ok(!hasBinaryExtension('src/png.ts'));
    assert.ok(!hasBinaryExtension('icons/logo.svg'));
  });

  it('ignores dot files and dots in directory names', () => {
    assert.ok(!hasBinaryExtension('.zip'));
    assert.ok(!hasBinaryExtension('build.zip/README'));
  });
});

describe('isTextMimeType', () => {
  it('tells text from binary MIME types', () => {
    for (const type of ['text/plain', 'text/x-php; charset=us-ascii', 'application/json', 'image/svg+xml', 'application/javascript', 'application/x-empty']) {
      assert.ok(isTextMimeType(type), type);
    }
    for (const type of ['image/png', 'application/octet-stream', 'application/zip', 'application/pdf', 'font/woff2']) {
      assert.ok(!isTextMimeType(type), type);
    }
  });
});
