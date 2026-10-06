# UH ProfCheck V2 — Chrome Web Store images

Upload these four JPEG screenshots in this order:

1. `01-professor-insights-1280x800.jpg` — ratings, GPA, withdrawal history, CougarGrades course link, and Best Overall recommendation.
2. `02-dark-mode-1280x800.jpg` — dark enrollment pages and the saved on-page dark-mode toggle.
3. `03-ranking-modes-1280x800.jpg` — Best Overall, Easiest A, and Lowest Risk controls.
4. `04-seats-and-tba-1280x800.jpg` — low-seat notice and course-wide grade information when an instructor is unassigned.

Use `05-small-promo-440x280.jpg` in the **Small promotional tile** field. The overview is for reviewing the set, not uploading as a listing screenshot.

Screenshots are 1280 × 800; the small promo is 440 × 280. These match the dimensions in the Chrome Web Store image guide: https://developer.chrome.com/docs/webstore/images

The UI was rendered with the extension's current content, ranking, launcher, and dark-mode scripts on a local copy of native PeopleSoft course components. Names, ratings, grade data, and availability are illustrative. The images label that fact; they contain no student-account information. UI crops are enlarged for readability, with separate callouts and promotional headings.

The `source/` folder contains editable HTML/CSS layouts, original UI captures at double resolution, the existing extension logo, and `build-layouts.py`. It has no external dependencies. Run `python3 source/build-layouts.py` to regenerate layouts, then capture the individual HTML pages at 1280 × 800 (440 × 280 for the promo). The public preview page is `index.html`.
