/** Total characters of file text kept, about 16 files at the default byteLimit. */
const MAX_CACHED_CHARS = 32 * 1024 * 1024;

/** Most files kept. */
const MAX_CACHED_FILES = 1000;

/** A full Git commit hash (SHA-1 or SHA-256), at which a path cannot change. */
export function isCommitHash(commit: string): boolean {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(commit);
}

/**
 * Text of files read by phabricator_repository_file_content, keyed by commit
 * hash, so that reading a file page by page fetches it once. Otherwise each
 * page runs diffusion.filecontentquery and downloads the whole file again: for
 * a 1.9 MB file, about 1.5 s and 2.6 MB of base64 per page.
 *
 * Entries never go stale; the least recently used are dropped past
 * MAX_CACHED_CHARS or MAX_CACHED_FILES.
 */
export class FileContentCache<T> {
  private readonly entries = new Map<string, { value: T; size: number }>();
  private size = 0;

  constructor(
    private readonly maxSize = MAX_CACHED_CHARS,
    private readonly maxEntries = MAX_CACHED_FILES,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    // Map iterates in insertion order, so re-adding marks it most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, size: number): void {
    this.remove(key);
    if (size > this.maxSize) {
      return;
    }
    this.entries.set(key, { value, size });
    this.size += size;
    for (const oldest of this.entries.keys()) {
      if (this.size <= this.maxSize && this.entries.size <= this.maxEntries) {
        break;
      }
      this.remove(oldest);
    }
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (entry !== undefined) {
      this.entries.delete(key);
      this.size -= entry.size;
    }
  }
}
