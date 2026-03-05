/**
 * A dictionary of common keywords found in job application custom questions,
 * and the static answers you want to provide for them.
 * 
 * The matcher will lowercase the job question label and look for these keywords.
 */
export const STATIC_ANSWERS: Record<string, string | string[]> = {
    // Sponsorship & Visa
    "sponsorship": "Yes",
    "require sponsorship": "Yes",
    "visa": "Yes",
    "authorized to work": "Yes",
    "legally authorized": "Yes",

    // Demographics / EEO (Voluntary)
    "gender": "Decline to answer",
    "sex": "Decline to answer",
    "race": ["Asian", "South Asian", "Asian (Not Hispanic or Latino)"],
    "ethnicity": ["Asian", "South Asian", "Asian (Not Hispanic or Latino)"],
    "hispanic or latino": "No",
    "hispanic latino": "No",
    "ehnicity": ["Asian", "South Asian", "Asian (Not Hispanic or Latino)", "South Asian"],
    "veteran": "No",
    "disability": "No",

    // Generic Yes/No's that might be required
    "relocate": "Yes",
    "background check": "Yes",

    // Catch-all
    "default_fallback": "N/A"
};

/**
 * Helper to find the best matching answer for a given question label
 */
export function getAnswerForQuestion(questionLabel: string, profile?: any): string | string[] {
    const normalized = questionLabel.toLowerCase();

    // Prioritize user profile inputs for Demographics if provided
    if (profile) {
        if (profile.gender && (normalized.includes("gender") || normalized.includes("sex"))) {
            return profile.gender;
        }
        if (profile.race && (normalized.includes("race") || normalized.includes("ethnicity") || normalized.includes("ehnicity"))) {
            return profile.race;
        }
        if (profile.location && (normalized.includes("location") || normalized.includes("city") || normalized.includes("address"))) {
            return profile.location;
        }
    }

    for (const [modifier, answer] of Object.entries(STATIC_ANSWERS)) {
        if (modifier !== "default_fallback" && normalized.includes(modifier)) {
            return answer;
        }
    }

    // If it's a dropdown, usually we'd need a valid option, 
    // but as a fallback, we supply the default generic answer.
    return STATIC_ANSWERS.default_fallback;
}
