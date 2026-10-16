export type SponsorshipStatus = "offered" | "not-offered" | "unknown";

/** A mention of a visa, OPT or EEO status alone is not an offer to sponsor. */
export function sponsorshipStatus(text: string): SponsorshipStatus {
  const plain = text.replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|amp);/g, " ").replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  const negative = [
    /\b(?:no|without)\s+(?:work\s+|employment\s+|immigration\s+|visa\s+)?sponsorship\b/i,
    /\b(?:cannot|can't|unable to|will not|won't|do not|does not|not able to)\s+(?:currently\s+)?(?:provide\s+|offer\s+)?(?:visa\s+|immigration\s+|employment\s+)?sponsor(?:ship)?\b/i,
    /\bsponsorship\s+(?:is\s+|will be\s+)?not\s+(?:available|provided|offered|supported)\b/i,
    /\b(?:not eligible|ineligible)\s+for\s+(?:visa\s+)?sponsorship\b/i,
  ];
  if (negative.some(pattern => pattern.test(plain))) return "not-offered";
  const positive = [
    /\b(?:we|company|employer)\s+(?:(?:can|will|do|may)\s+)?(?:provide|offer|support)\s+(?:(?:work|employment|immigration|visa)\s+){0,2}sponsorship\b/i,
    /\b(?:visa|immigration|h-?1b)\s+sponsorship\s+(?:(?:is|may be|will be)\s+)?(?:available|offered|provided|supported)\b/i,
    /\b(?:eligible|qualifies)\s+for\s+(?:visa|immigration)\s+sponsorship\b/i,
    /\b(?:we|company|employer)\s+(?:can|will|may)\s+sponsor\s+(?:work\s+visas?|h-?1b|visas?|qualified\s+candidates|eligible\s+candidates)\b/i,
  ];
  return positive.some(pattern => pattern.test(plain)) ? "offered" : "unknown";
}
