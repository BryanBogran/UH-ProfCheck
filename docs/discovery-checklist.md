# Campus discovery checklist

Thanks for checking whether ProfCheck can work at your school. This takes about 20 minutes. Fill it out once for each school you can access, and send the answers to Bryan or post them on your campus request issue.

## Privacy first

- Use only your own student login, and only pages you're normally allowed to see.
- **Don't send screenshots** unless they're cropped to the course results table and every student name, ID, and schedule detail is blacked out. Written answers are better.
- Don't send full links copied from the address bar. They often contain session values. Send only the hostname (the part between `https://` and the next `/`).
- Don't register for, drop, or change any class while checking.

## 1. The portal

1. What's the hostname of the course-search page? Example: `saprd.my.uh.edu`.
2. When you go from the search form to the results, does the hostname change?
3. Does the part of the link after the hostname look different between search and results? Describe it in general terms, not by pasting the link.
4. Do you know what system it runs on? Look for a logo or name at the bottom of the page: PeopleSoft, Banner, Workday, Colleague, or something else. "Not sure" is fine.
5. Are the results inside a box that scrolls separately from the rest of the page? This might be an iframe. Right-click inside the results: if you see "View frame source" or "This frame", say yes.

## 2. Each section in the results

Search for a common course with several sections (for example English 1301), then answer:

6. Is the course code shown on every row, or only once above a group of sections?
7. Is the instructor's name shown? How is it written: "Jane Doe", "Doe, Jane", "J. Doe"?
8. When no instructor is assigned, what does the page say? Examples: "Staff", "TBA", blank.
9. Are seat counts shown? Copy the exact wording with made-up numbers. Example: "Open Seats 12 of 30".
10. Is a full section shown differently? How?
11. Is a waitlist shown? What does it say?
12. Do lecture and lab appear as separate rows for the same section?

## 3. How the page updates

13. When you search again, change the term, or go to the next page of results, does the whole page reload, or do only the results change?
14. If you click into a section's details and go back, are the results still there?

## 4. Testing

15. Can you keep testing ProfCheck after launch when the portal changes?
16. Is there a second student at your school who can test? (Two testers are needed before a campus ships.) What's their GitHub handle?

## What happens next

Bryan reviews the answers and picks the first campus. He needs reliable course codes and seat counts and two testers, and if both schools qualify he picks the simpler page. Then he approves the hostname and features on your campus request issue, and you can start building. See [CONTRIBUTING.md](../CONTRIBUTING.md).
