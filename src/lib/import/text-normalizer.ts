/**
 * Text normalization for descriptor content extracted from Excel files.
 * Ensures consistent storage and searchability.
 */

/**
 * Normalizes text extracted from Excel files.
 * Handles: smart quotes, Unicode bullets, normalization form, whitespace.
 */
export function normalizeDescriptorText(text: string | null | undefined): string {
  if (!text) return '';

  // Step 1: Normalize to Unicode NFC (composed form)
  // Ensures "é" is stored as single character, not "e" + combining accent
  let normalized = String(text).normalize('NFC');

  // Step 2: Convert smart quotes to straight quotes
  normalized = normalized
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // ' ' ‚ ‛ → '
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // " " „ ‟ → "
    .replace(/[\u2032\u2035]/g, "'")               // ′ ‵ → '
    .replace(/[\u2033\u2036]/g, '"');              // ″ ‶ → "

  // Step 3: Convert Unicode bullets and list markers to hyphens
  normalized = normalized
    .replace(/[\u2022\u2023\u2043\u204C\u204D]/g, '-')  // • ‣ ⁃ ⁌ ⁍ → -
    .replace(/[\u25E6\u25AA\u25AB\u25CF\u25CB]/g, '-')  // ◦ ▪ ▫ ● ○ → -
    .replace(/[\u2219\u00B7]/g, '-');                    // ∙ · → -

  // Step 4: Convert non-breaking spaces to regular spaces
  normalized = normalized
    .replace(/[\u00A0\u202F\u2007\u200A]/g, ' ')  // NBSP, NNBSP, figure space, hair space
    .replace(/[\u2000-\u200B]/g, ' ');            // Various Unicode spaces

  // Step 5: Convert dashes/hyphens to standard hyphen
  normalized = normalized
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-'); // ‐ ‑ ‒ – — ― → -

  // Step 6: Remove control characters (except newlines and tabs)
  normalized = normalized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Step 7: Normalize whitespace
  normalized = normalized
    .replace(/\r\n/g, '\n')           // Windows line endings
    .replace(/\r/g, '\n')             // Old Mac line endings
    .replace(/[ \t]+/g, ' ')          // Collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
    .trim();

  return normalized;
}

/**
 * Detects potential encoding issues in text.
 * Returns warnings if suspicious patterns found.
 */
export function detectEncodingIssues(text: string): string[] {
  if (!text) return [];

  const warnings: string[] = [];

  // Check for mojibake patterns (common UTF-8 misinterpretation)
  if (/Ã©|Ã¨|Ã |Ã¢|Ã®|Ã´|Ã¹|Ã»|Ã§/i.test(text)) {
    warnings.push('Possible UTF-8 mojibake detected (French accents)');
  }
  if (/â€™|â€œ|â€|â€¢|â€"|â€"/i.test(text)) {
    warnings.push('Possible UTF-8 mojibake detected (smart quotes/dashes)');
  }

  // Check for replacement characters (encoding failure)
  if (/\uFFFD/.test(text)) {
    warnings.push('Unicode replacement character found (encoding failure)');
  }

  // Check for unusual control characters
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
    warnings.push('Control characters detected (may indicate encoding issues)');
  }

  // Check for private use area characters
  if (/[\uE000-\uF8FF]/.test(text)) {
    warnings.push('Private use area characters found (font-specific symbols)');
  }

  // Check for very long strings without spaces (possible encoding issue)
  if (text.length > 500 && !/\s/.test(text)) {
    warnings.push('Very long string without whitespace (possible encoding issue)');
  }

  return warnings;
}

/**
 * Extracts skill name from filename.
 * "01_Industrial_Mechanics_marking_scheme (f).xlsx" → "Industrial Mechanics"
 */
export function extractSkillNameFromFilename(filename: string): string {
  return filename
    .replace(/\.xlsx$/i, '')                    // Remove extension
    .replace(/^\d+[_\-\s]*/g, '')               // Remove leading number
    .replace(/_marking_scheme.*$/i, '')         // Remove "marking_scheme" suffix
    .replace(/_/g, ' ')                         // Underscores to spaces
    .replace(/\s+/g, ' ')                       // Collapse whitespace
    .trim();
}
