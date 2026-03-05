"use client";

import { UserProfile } from "./ProfileContext";

export function generateBookmarklet(profile: UserProfile): string {
    const code = `
    (function() {
      const p = ${JSON.stringify(profile)};
      
      // Greenhouse Selectors
      const fillGreenhouse = () => {
        const fields = {
          'first_name': p.firstName,
          'last_name': p.lastName,
          'email': p.email,
          'phone': p.phone,
          'job_application[location]': p.location,
          'urls[LinkedIn]': p.linkedin,
          'urls[GitHub]': p.github,
          'urls[Portfolio]': p.portfolio
        };
        
        for (const [id, val] of Object.entries(fields)) {
          const el = document.getElementById(id) || document.querySelector(\`[name="\${id}"]\`) || document.querySelector(\`[aria-label*="\${id.replace(/_/g, ' ')}"]\`);
          if (el && val) {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      };

      // Lever Selectors
      const fillLever = () => {
        const fields = {
          'name': \`\${p.firstName} \${p.lastName}\`,
          'email': p.email,
          'phone': p.phone,
          'org': '', // Company name if needed
          'urls[LinkedIn]': p.linkedin,
          'urls[GitHub]': p.github,
          'urls[Portfolio]': p.portfolio,
          'urls[Twitter]': '',
          'location': p.location
        };

        for (const [name, val] of Object.entries(fields)) {
          const el = document.querySelector(\`input[name="\${name}"]\`) || document.querySelector(\`input[aria-label*="\${name}"]\`);
          if (el && val) {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      };

      if (window.location.host.includes('greenhouse.io')) fillGreenhouse();
      if (window.location.host.includes('lever.co')) fillLever();
      
      console.log('Magic Fill Complete!');
      alert('Magic Fill Complete! Just upload your resume and hit Submit.');
    })();
  `.replace(/\s+/g, ' ').trim();

    return `javascript:${encodeURIComponent(code)}`;
}
