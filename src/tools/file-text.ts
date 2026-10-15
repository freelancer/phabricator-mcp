/**
 * Most characters of file text returned in one call: under 10k tokens of PHP,
 * while dense text such as minified JS or CJK stays near or under Claude Code's
 * default 25k-token limit on tool output.
 */
export const MAX_FILE_CHARS = 40_000;

/** byteLimit used when the caller gives none, so a huge file is refused rather than downloaded on every page. */
export const DEFAULT_BYTE_LIMIT = 2 * 1024 * 1024;

/**
 * Decode file bytes as UTF-8 text, or return null for binary data. A NUL byte
 * marks a file as binary; other invalid bytes become U+FFFD so text in a legacy
 * encoding is still readable, with `valid: false` so the caller can say so.
 * A byte order mark is kept, as git has it.
 */
export function decodeText(bytes: Uint8Array): { text: string; valid: boolean } | null {
  if (bytes.includes(0)) {
    return null;
  }
  try {
    return { text: new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }).decode(bytes), valid: true };
  } catch {
    return { text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes), valid: false };
  }
}

/** Added to a file's note when it is not valid UTF-8. */
export const INVALID_UTF8_NOTE = '[Not valid UTF-8: undecodable bytes are shown as U+FFFD, so writing this text back would change the file.]';

/**
 * Extensions of files that are almost always binary. A file named like this is
 * checked with file.info before its bytes are downloaded, since a 2 MB image
 * otherwise costs a 2.6 MB base64 download to find out it is not text.
 */
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'icns', 'tif', 'tiff', 'psd', 'heic', 'avif',
  'mp3', 'mp4', 'm4a', 'mov', 'avi', 'mkv', 'webm', 'wav', 'ogg', 'flac',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'zip', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar', 'tar', 'jar', 'war', 'apk', 'ipa',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
  'exe', 'dll', 'so', 'dylib', 'a', 'o', 'class', 'pyc', 'wasm', 'sqlite',
]);

export function hasBinaryExtension(path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 && BINARY_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

/**
 * Whether a MIME type from file.info is text. Phabricator detects it with
 * libmagic when it stores the blob, e.g. "text/plain" or "image/png".
 */
export function isTextMimeType(mimeType: string): boolean {
  return /^text\/|[/+](json|xml|javascript|ecmascript|x-empty|svg)\b/.test(mimeType);
}

export interface SliceOptions {
  /** First line, 1-based. */
  startLine?: number;
  /** First UTF-16 code unit of the first line, 1-based, to read on within a long line. */
  startColumn?: number;
  lineCount?: number;
  maxChars?: number;
  /** Commit hash the read-on instructions name, so later pages read the same version. */
  readOnCommit?: string;
}

/**
 * Select lines from a file's text, cut short at a line boundary once the
 * selection would pass `maxChars`. Lines keep their terminators, so the pages
 * of a file join back into it exactly. A line longer than `maxChars` is
 * returned in parts, read on with `startColumn`. `note` says which lines were
 * returned when it is not the whole file, and how to continue when text was
 * left out.
 */
export function sliceLines(
  text: string,
  { startLine = 1, startColumn: requestedColumn = 1, lineCount, maxChars = MAX_FILE_CHARS, readOnCommit }: SliceOptions = {},
): { text: string; note?: string } {
  const pinned = readOnCommit === undefined ? '' : `, commit: ${readOnCommit}`;
  const lines = text === '' ? [] : text.split(/(?<=\n)/);
  const total = lines.length;

  if (startLine > Math.max(total, 1)) {
    throw new Error(`startLine ${startLine} is past the end of the file (${total} lines)`);
  }
  if (total === 0) {
    return { text: '', note: '[Empty file.]' };
  }

  const first = lines[startLine - 1]!;
  // A column on the second half of a surrogate pair starts at its first half.
  const startColumn = requestedColumn > 1 && isLowSurrogate(first.charCodeAt(requestedColumn - 1))
    && isHighSurrogate(first.charCodeAt(requestedColumn - 2)) ? requestedColumn - 1 : requestedColumn;
  if (startColumn > first.length) {
    throw new Error(`startColumn ${startColumn} is past the end of line ${startLine} (${first.length} characters)`);
  }
  const head = first.slice(startColumn - 1);

  // The rest of the first line alone is over the limit, e.g. minified code:
  // return part of it, without splitting a surrogate pair.
  if (head.length > maxChars) {
    const cutAt = isHighSurrogate(head.charCodeAt(maxChars - 1)) ? maxChars - 1 : maxChars;
    const to = startColumn - 1 + cutAt;
    return {
      text: head.slice(0, cutAt),
      note: `[Line ${startLine} of ${total}, characters ${startColumn}-${to} of ${first.length}. Pass startLine: ${startLine}, startColumn: ${to + 1}${pinned} to read on.]`,
    };
  }

  const end = lineCount === undefined ? total : Math.min(total, startLine - 1 + lineCount);
  let selected = head;
  let last = startLine;
  while (last < end && selected.length + lines[last]!.length <= maxChars) {
    selected += lines[last];
    last++;
  }

  if (startLine === 1 && startColumn === 1 && last === total) {
    return { text: selected };
  }

  const range = last === startLine ? `Line ${last}` : `Lines ${startLine}-${last}`;
  let note = `[${range} of ${total}`;
  if (startColumn > 1) {
    note += `, from character ${startColumn} of line ${startLine}`;
  }
  if (last < end) {
    note += `; line ${last + 1} would pass the ${maxChars}-character limit`;
  }
  if (last < total) {
    note += `. Pass startLine: ${last + 1}${pinned} to read on`;
  }
  return { text: selected, note: `${note}.]` };
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
