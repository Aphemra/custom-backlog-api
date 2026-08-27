export function normalizeIgdbSearchTerm(value: string): string {
  return value
    .replace(/[©®™℠]/gu, "")
    .normalize("NFKC")
    .replace(/\s*(?:[-–—:|]\s*)?(?:trophy\s+list|trophies)\s*$/iu, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
