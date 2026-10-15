/**
 * Drop object properties that carry no information (null, [] and {}), at any
 * depth. Conduit returns every custom field on every object, mostly null, which
 * dominates search results without telling the caller anything.
 *
 * Kept even when empty, because the empty value is the answer:
 * - array elements, so positions stay meaningful;
 * - a result's `data`, so a search with no matches still returns `data: []`;
 * - a result's `cursor`, whole, so `after: null` still marks the last page;
 * - each requested attachment of a `data` item, whole, so no reviewers reads
 *   as `reviewers: []` rather than as an attachment that was never fetched.
 *
 * These exceptions apply only where *.search methods put those keys; anywhere
 * else a property named `data`, `cursor` or `attachments` is pruned like any
 * other.
 */
export function pruneEmpty(value: unknown, options: PruneOptions = {}): unknown {
  if (!isObject(value)) {
    return prune(value);
  }
  return pruneProperties(value, (key, child) => {
    if (key === 'cursor') {
      return { keep: true, value: child };
    }
    if (key === 'data') {
      return { keep: true, value: Array.isArray(child) ? child.map((item) => pruneSearchItem(item, options)) : prune(child) };
    }
    return undefined;
  });
}

export interface PruneOptions {
  /** Keep null `custom.*` keys in each item's `fields`, so every custom field shows. */
  keepEmptyCustomFields?: boolean;
}

function pruneSearchItem(item: unknown, options: PruneOptions): unknown {
  if (!isObject(item)) {
    return prune(item);
  }
  return pruneProperties(item, (key, child) => {
    if (key === 'attachments') {
      return { keep: !isEmpty(child), value: child };
    }
    if (key === 'fields' && options.keepEmptyCustomFields && isObject(child)) {
      return {
        keep: true,
        value: pruneProperties(child, (field, value) =>
          field.startsWith('custom.') ? { keep: true, value: prune(value) } : undefined),
      };
    }
    return undefined;
  });
}

function prune(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(prune);
  }
  return isObject(value) ? pruneProperties(value) : value;
}

/**
 * Prune each property of `object`, dropping those left empty. `special` can
 * decide a property itself by returning whether to keep it and its value.
 */
function pruneProperties(
  object: object,
  special?: (key: string, child: unknown) => { keep: boolean; value: unknown } | undefined,
): Record<string, unknown> {
  const entries: Array<[string, unknown]> = [];
  for (const [key, child] of Object.entries(object)) {
    const decided = special?.(key, child);
    if (decided) {
      if (decided.keep) {
        entries.push([key, decided.value]);
      }
      continue;
    }
    const next = prune(child);
    if (!isEmpty(next)) {
      entries.push([key, next]);
    }
  }
  // fromEntries defines keys as own properties, so "__proto__" survives.
  return Object.fromEntries(entries);
}

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEmpty(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return typeof value === 'object' && Object.keys(value).length === 0;
}

/**
 * Format a Conduit result as a tool response: compact JSON with empty
 * properties removed. Indentation alone made up about a tenth of each response.
 */
export function jsonResult(value: unknown, options?: PruneOptions) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(pruneEmpty(value, options)) }] };
}
