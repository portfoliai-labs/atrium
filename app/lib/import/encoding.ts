// Decodes a CSV/TSV file's raw bytes, auto-detecting UTF-8 vs. the single-byte encodings
// Italian broker exports commonly fall back to (Windows-1252, ISO-8859-1).
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // Explicit UTF-8 BOM — unambiguous, strip it before decoding.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }

  try {
    // `fatal: true` makes TextDecoder throw on invalid UTF-8 byte sequences (e.g. a lone
    // 0xE9 for "é" written in Windows-1252) instead of silently replacing them with U+FFFD.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("windows-1252").decode(bytes);
    } catch {
      return new TextDecoder("iso-8859-1").decode(bytes);
    }
  }
}
