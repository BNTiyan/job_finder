import { Job } from "@/types";
import { getAnswerForQuestion } from "@/data/applicationAnswers";
import * as cheerio from "cheerio";

export interface UserProfile {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    portfolio: string;
    location: string;
    resumeUrl: string; // URL to the uploaded resume in cloud or base64
}

export async function applyToGreenhouse(job: Job, profile: UserProfile) {
    console.log(`[Auto-Apply] Submitting REAL application to Greenhouse: ${job.company} - ${job.title}...`);
    try {
        let fetchUrl = job.applyUrl;

        // If it's a scraped greenhouse job, bypass the iframe and fetch the direct form!
        if (job.id.startsWith('gh-')) {
            const [, companyId, ...jobIdParts] = job.id.split("-");
            const jobId = jobIdParts.join("-");
            fetchUrl = `https://boards.greenhouse.io/embed/job_app?for=${companyId}&token=${jobId}`;
            console.log(`[Auto-Apply] Bypassing wrapper. Fetching raw form: ${fetchUrl}`);
        }

        // 1. Fetch the actual application board page
        const response = await fetch(fetchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            }
        });

        if (!response.ok) {
            return { success: false, message: "Failed to access company application page. They may be blocking automated requests." };
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // 2. Find the form
        const form = $("form#application_form");
        if (!form.length) {
            return { success: false, message: "Could not find the application form on the page." };
        }

        const submitUrl = form.attr("action");
        if (!submitUrl) {
            return { success: false, message: "Could not find the form submission URL." };
        }

        // 3. Extract hidden required tokens
        const formData = new FormData();
        $("input[type='hidden']").each((_, el) => {
            const name = $(el).attr("name");
            const val = $(el).val();
            if (name && val) {
                formData.append(name, val.toString());
            }
        });

        // 4. Build the multipart form payload
        formData.append("job_application[first_name]", profile.firstName);
        formData.append("job_application[last_name]", profile.lastName);
        formData.append("job_application[email]", profile.email);
        formData.append("job_application[phone]", profile.phone);
        if (profile.location) formData.append("job_application[location]", profile.location);

        // Standard URL fields
        if (profile.linkedin) formData.append("job_application[answers][LinkedIn]", profile.linkedin);
        if (profile.github) formData.append("job_application[answers][GitHub]", profile.github);
        if (profile.portfolio) formData.append("job_application[answers][Portfolio]", profile.portfolio);

        // 5. Parse custom questions and answer them!
        $(".custom_question").each((_, el) => {
            const labelText = $(el).find("label").text().trim();
            const input = $(el).find("input[type='text'], select, textarea").first();
            const nameAttr = input.attr("name");

            if (nameAttr && labelText) {
                const answerOrAnswers = getAnswerForQuestion(labelText, profile);

                if (input[0].tagName === 'select') {
                    let selectedValue = "";
                    const options = $(el).find("option");
                    const targetAnswers = Array.isArray(answerOrAnswers) ? answerOrAnswers : [answerOrAnswers];

                    // Try to find an option matching any of our preferred answers
                    for (const target of targetAnswers) {
                        options.each((_, opt) => {
                            const optText = $(opt).text().trim();
                            if (!selectedValue && optText.toLowerCase().includes(target.toLowerCase())) {
                                selectedValue = $(opt).attr("value") || optText;
                            }
                        });
                        if (selectedValue) break; // Found a match!
                    }

                    // If no match found, pick the first valid option (skipping "Please select")
                    if (!selectedValue && options.length > 1) {
                        const fallbackOpt = $(options[1]);
                        selectedValue = fallbackOpt.attr("value") || fallbackOpt.text();
                    }

                    formData.append(nameAttr, selectedValue);
                    console.log(`[Auto-Apply] Answering dropdown: "${labelText}" -> "${selectedValue}"`);
                } else {
                    const answerStr = Array.isArray(answerOrAnswers) ? answerOrAnswers[0] : answerOrAnswers;
                    formData.append(nameAttr, answerStr);
                    console.log(`[Auto-Apply] Answering text: "${labelText}" -> "${answerStr}"`);
                }
            }
        });

        // 6. Attempt the POST request
        const submitResponse = await fetch(submitUrl.startsWith('http') ? submitUrl : `https://boards.greenhouse.io${submitUrl}`, {
            method: 'POST',
            body: formData,
            headers: {
                // Do not explicitly set Content-Type so fetch can auto-generate the multipart boundary
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            }
        });

        if (submitResponse.ok) {
            console.log(`[Auto-Apply] Success! Submitted to Greenhouse.`);
            return { success: true, message: "Successfully submitted application payload!" };
        } else {
            console.error(`[Auto-Apply] Failed with status: ${submitResponse.status}`);
            return { success: false, message: `Submission rejected by server (Status ${submitResponse.status}). Bot protections may be active.` };
        }

    } catch (err) {
        console.error(err);
        return { success: false, message: "An error occurred while building the submission payload." };
    }
}

export async function applyToLever(job: Job, profile: UserProfile) {
    console.log(`[Auto-Apply] Submitting to Lever: ${job.company} - ${job.title}...`);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { success: true, message: "Successfully applied via simulated submission." };
}
