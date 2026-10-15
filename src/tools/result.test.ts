import { describe, it } from 'node:test';
import assert from 'node:assert';
import { jsonResult, pruneEmpty } from './result.js';

describe('pruneEmpty', () => {
  it('drops null, empty array and empty object properties', () => {
    assert.deepStrictEqual(
      pruneEmpty({ a: null, b: [], c: {}, d: 1 }),
      { d: 1 },
    );
  });

  it('keeps falsy values that carry information', () => {
    assert.deepStrictEqual(
      pruneEmpty({ zero: 0, no: false, blank: '' }),
      { zero: 0, no: false, blank: '' },
    );
  });

  it('drops objects that become empty once pruned', () => {
    assert.deepStrictEqual(
      pruneEmpty({ fields: { 'maniphest:deadline': { epoch: null, triggerPHID: null }, name: 'x' } }),
      { fields: { name: 'x' } },
    );
  });

  it('keeps array elements, including nulls, so positions hold', () => {
    assert.deepStrictEqual(
      pruneEmpty({ list: [null, { a: null }, 2] }),
      { list: [null, {}, 2] },
    );
  });

  it('keeps an empty data list and leaves cursor untouched', () => {
    const cursor = { limit: 2, after: null, before: null, order: null };
    assert.deepStrictEqual(
      pruneEmpty({ data: [], maps: {}, cursor }),
      { data: [], cursor },
    );
  });

  it('keeps requested attachments whole and drops unrequested ones', () => {
    assert.deepStrictEqual(
      pruneEmpty({ data: [
        { id: 1, attachments: { reviewers: { reviewers: [] }, projects: { projectPHIDs: [] } } },
        { id: 2, attachments: {} },
      ] }),
      { data: [
        { id: 1, attachments: { reviewers: { reviewers: [] }, projects: { projectPHIDs: [] } } },
        { id: 2 },
      ] },
    );
  });

  it('prunes data, cursor and attachments like any other key below the top level', () => {
    assert.deepStrictEqual(
      pruneEmpty({ data: [{ fields: { data: [], cursor: { after: null }, attachments: { a: null } } }] }),
      { data: [{}] },
    );
  });

  it('keeps a top-level data that is not a list, pruned', () => {
    assert.deepStrictEqual(
      pruneEmpty({ data: { 'PHID-X': { a: null, b: 1 } } }),
      { data: { 'PHID-X': { b: 1 } } },
    );
  });

  it('keeps a "__proto__" key as data', () => {
    const pruned = pruneEmpty(JSON.parse('{"__proto__":{"phid":"PHID-X"},"ok":1}')) as Record<string, unknown>;
    assert.deepStrictEqual(Object.keys(pruned), ['__proto__', 'ok']);
  });

  it('keeps null custom fields in search results only when asked', () => {
    const result = {
      data: [{ fields: { name: 'x', 'custom.went.well': null, 'custom.deadline': { epoch: null }, ownerPHID: null } }],
    };
    assert.deepStrictEqual(pruneEmpty(result), { data: [{ fields: { name: 'x' } }] });
    assert.deepStrictEqual(
      pruneEmpty(result, { keepEmptyCustomFields: true }),
      { data: [{ fields: { name: 'x', 'custom.went.well': null, 'custom.deadline': {} } }] },
    );
  });

  it('passes scalars and top-level arrays through', () => {
    assert.strictEqual(pruneEmpty('x'), 'x');
    assert.strictEqual(pruneEmpty(null), null);
    assert.deepStrictEqual(pruneEmpty([]), []);
  });
});

describe('jsonResult', () => {
  it('returns compact JSON text content', () => {
    assert.deepStrictEqual(
      jsonResult({ a: 1, b: null, c: { d: [1, 2] } }),
      { content: [{ type: 'text', text: '{"a":1,"c":{"d":[1,2]}}' }] },
    );
  });
});
