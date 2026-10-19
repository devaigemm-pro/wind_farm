/**
 * Parse the "Coating Method" value out of OCR text read from the inspection
 * label on the first repair photo. The label carries a line like:
 *   "Coating Method: RAL 7035-2009"
 * and we want the text AFTER the first colon ("RAL 7035-2009").
 *
 * Tolerant to case ("COATING METHOD:", "Coating method:"), variable spaces and
 * common OCR noise. Returns null when no coating-method line can be found or the
 * value after the colon is empty.
 */
export function parseCoatingMethod(ocrText: string | null | undefined): string | null {
  if (!ocrText) return null;
  const lines = ocrText.split(/\r?\n/);
  for (const line of lines) {
    // Match a "coating method" label (case-insensitive, flexible spacing),
    // followed by a colon and the value.
    const match = line.match(/coating\s*method\s*[:：]\s*(.+)$/i);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value) return value;
    }
  }
  return null;
}
