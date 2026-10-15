import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FileContentCache, isCommitHash } from './file-cache.js';

describe('isCommitHash', () => {
  it('accepts only full SHA-1 and SHA-256 hashes', () => {
    assert.ok(isCommitHash('4b82e5e164416300588bf0294802a94de32b7ae5'));
    assert.ok(isCommitHash('A'.repeat(64)));
    assert.ok(!isCommitHash('4b82e5e'));
    assert.ok(!isCommitHash('master'));
  });
});

describe('FileContentCache', () => {
  it('evicts the least recently used entries past its size or entry count', () => {
    const cache = new FileContentCache<string>(10);
    cache.set('a', 'a', 4);
    cache.set('b', 'b', 4);
    cache.get('a');
    cache.set('c', 'c', 4);
    assert.strictEqual(cache.get('b'), undefined);
    assert.strictEqual(cache.get('a'), 'a');
    assert.strictEqual(cache.get('c'), 'c');

    const few = new FileContentCache<string>(10, 2);
    few.set('x', 'x', 0);
    few.set('y', 'y', 0);
    few.set('z', 'z', 0);
    assert.strictEqual(few.get('x'), undefined);
    assert.strictEqual(few.get('y'), 'y');
    assert.strictEqual(few.get('z'), 'z');
  });

  it('does not keep an entry larger than its size, or the one it replaces', () => {
    const cache = new FileContentCache<string>(10);
    cache.set('a', 'small', 4);
    cache.set('a', 'big', 11);
    assert.strictEqual(cache.get('a'), undefined);
    cache.set('b', 'b', 10);
    assert.strictEqual(cache.get('b'), 'b');
  });
});
