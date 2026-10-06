# UH ProfCheck Privacy Policy

Effective date: October 6, 2026

## What the extension accesses

UH ProfCheck reads professor names, course codes, and displayed seat availability on University of Houston enrollment pages at `https://saprd.my.uh.edu/*`. It does not read unrelated tabs or websites.

## What is sent off-device

The extension sends public professor names to the CougarGrades API at `https://api.cougargrades.io/api/instructor/{name}` and its RateMyProfessors bridge at `/api/external/rmp/search`. When an instructor is unassigned, it sends the course code to `/api/course/{courseCode}` for course-wide GPA and withdrawal information. CougarGrades is the recipient of these requests. The extension also builds links to CougarGrades and RateMyProfessors; those sites receive normal browser requests when a user opens a link.

The extension does not send student IDs, authentication cookies, personal schedules, enrollment actions, or form submissions to these data services.

## What is stored

- Preferences, including display toggles, ranking mode, dark mode, and selectors, use browser sync storage.
- The floating button position uses local storage.
- Professor and course API responses are cached in browser session storage. Clear API Cache in settings removes these responses.
- The extension does not intentionally store browsing history, authentication cookies, student IDs, personal schedules, or form submissions.

## Sharing and security

The extension does not sell user data or send analytics, ads, or developer telemetry. It does not execute remote code. External insight links open using `noopener noreferrer`. Network lookups are limited to the CougarGrades API needed for professor and course information.

## Contact

Questions: flamezbb1@gmail.com

The public privacy policy linked from the store listing should contain this current disclosure when publishing V2.
