// ─── Non-USA location patterns (exclude these) ───────────────────────────────

const NON_USA_PATTERNS: RegExp[] = [
  // Countries
  /\b(uk|united kingdom|england|scotland|wales|northern ireland)\b/i,
  /\b(canada|toronto|vancouver|montreal|calgary|ottawa)\b/i,
  /\b(india|bangalore|bengaluru|mumbai|hyderabad|pune|chennai|new delhi|gurgaon|noida)\b/i,
  /\b(germany|berlin|munich|frankfurt|hamburg|cologne)\b/i,
  /\b(france|paris|lyon|marseille)\b/i,
  /\b(australia|sydney|melbourne|brisbane|perth)\b/i,
  /\b(brazil|são paulo|sao paulo|rio de janeiro|brasília)\b/i,
  /\b(singapore)\b/i,
  /\b(japan|tokyo|osaka)\b/i,
  /\b(china|beijing|shanghai|shenzhen)\b/i,
  /\b(mexico|ciudad de méxico|monterrey|guadalajara)\b/i,
  /\b(netherlands|amsterdam|rotterdam)\b/i,
  /\b(ireland|dublin)\b/i,
  /\b(israel|tel aviv)\b/i,
  /\b(sweden|stockholm|gothenburg)\b/i,
  /\b(spain|madrid|barcelona)\b/i,
  /\b(poland|warsaw|krakow)\b/i,
  /\b(czech republic|prague)\b/i,
  /\b(switzerland|zurich|geneva)\b/i,
  /\b(austria|vienna)\b/i,
  /\b(denmark|copenhagen)\b/i,
  /\b(norway|oslo)\b/i,
  /\b(finland|helsinki)\b/i,
  /\b(portugal|lisbon)\b/i,
  /\b(italy|rome|milan)\b/i,
  /\b(colombia|bogotá|medellin)\b/i,
  /\b(argentina|buenos aires)\b/i,
  /\b(chile|santiago)\b/i,
  /\b(south korea|seoul)\b/i,
  /\b(taiwan|taipei)\b/i,
  /\b(hong kong)\b/i,
  /\b(new zealand|auckland)\b/i,
  /\b(south africa|johannesburg|cape town)\b/i,
  /\b(nigeria|lagos)\b/i,
  /\b(kenya|nairobi)\b/i,
  /\b(egypt|cairo)\b/i,
  /\b(turkey|istanbul|ankara)\b/i,
  /\b(russia|moscow)\b/i,
  /\b(ukraine|kyiv)\b/i,
  /\b(romania|bucharest)\b/i,
  /\b(hungary|budapest)\b/i,
  /\b(belgium|brussels)\b/i,
];

// ─── USA location patterns (include these) ───────────────────────────────────

const USA_PATTERNS: RegExp[] = [
  /\busa?\b/i,
  /\bunited states\b/i,
  /\bu\.s\.a?\.?\b/i,
  /\bamerica\b/i,
  // US-remote variants
  /\bus[- ]remote\b/i,
  /\bremote[- ]us\b/i,
  /\bremote.*united states\b/i,
  /\bunited states.*remote\b/i,
  // State abbreviations (word-boundary anchored)
  /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/,
  // Major US cities
  /\b(new york|san francisco|los angeles|chicago|seattle|boston|austin|denver|miami|atlanta|dallas|houston|portland|phoenix|san jose|san diego|nashville|minneapolis|detroit|philadelphia|washington|baltimore|pittsburgh|cleveland|columbus|indianapolis|charlotte|raleigh|salt lake city|las vegas|st\.? louis|kansas city|tampa|orlando|san antonio|memphis|louisville|richmond|sacramento)\b/i,
];

/**
 * Returns true if the given location string represents a US-based job.
 * Logic:
 *  1. Empty / bare "Remote" → include (US companies default to US)
 *  2. Matches a non-USA pattern → exclude
 *  3. Matches a USA pattern → include
 *  4. Ambiguous → include (show more, not less)
 */
export function isUSALocation(location: string): boolean {
  if (!location) return true;

  const loc = location.trim();

  // Bare "Remote" or "Worldwide" without country qualifier → US companies → include
  if (/^(remote|worldwide|anywhere)$/i.test(loc)) return true;

  // Explicitly non-USA → exclude
  if (NON_USA_PATTERNS.some((p) => p.test(loc))) return false;

  // Explicitly USA → include
  if (USA_PATTERNS.some((p) => p.test(loc))) return true;

  // Ambiguous (e.g. "Multiple Locations", "Hybrid") → include
  return true;
}

/**
 * Returns true if the job was posted within the last `hoursBack` hours.
 * Jobs with no posted date are included (can't determine recency).
 */
export function isRecentJob(postedAt: string, hoursBack = 24): boolean {
  if (!postedAt) return true;
  try {
    const posted = new Date(postedAt).getTime();
    if (isNaN(posted)) return true;
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    return posted >= cutoff;
  } catch {
    return true;
  }
}
