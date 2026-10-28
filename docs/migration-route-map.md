# Clean URL route map

All original HTML addresses are retained. Root-relative resources assume the existing custom-domain root and an HTTP directory-index preview server. No DNS or Pages-source configuration changes are required by this filesystem layout.

| Original URL | Clean URL | Compatibility | Purpose | Risk |
| --- | --- | --- | --- | --- |
| `/index.html` | `/` | functional canonical alias | Personal developer homepage | low |
| `/projects/auto-clicker.html` | `/projects/auto-clicker/` | client-side replace with query/hash and visible fallback | Project showcase | low |
| `/projects/bootstrap-cover.html` | `/projects/bootstrap-cover/` | client-side replace with query/hash and visible fallback | Project showcase | low |
| `/projects/chriswellsdev.html` | `/projects/chriswellsdev/` | client-side replace with query/hash and visible fallback | Project showcase | low |
| `/projects/feedback-survey.html` | `/projects/feedback-survey/` | client-side replace with query/hash and visible fallback | Project showcase | low |
| `/projects/hex-math.html` | `/projects/hex-math/` | client-side replace with query/hash and visible fallback | Project showcase | low |
| `/projects/hotdog-counter.html` | `/projects/hotdog-counter/` | client-side replace with query/hash and visible fallback | Project showcase | low |
| `/projects/seating-chart.html` | `/projects/seating-chart/` | client-side replace with query/hash and visible fallback | Project showcase | low |
| `/projects/sort-the-numbers.html` | `/projects/sort-the-numbers/` | client-side replace with query/hash and visible fallback | Project showcase | low |
| `/projects/tennessee-guide.html` | `/projects/tennessee-guide/` | client-side replace with query/hash and visible fallback | Project showcase | low |
| `/projects/vacation-planner.html` | `/projects/vacation-planner/` | client-side replace with query/hash and visible fallback | Project showcase | low |
| `/templates/project.html` | `/projects/` | client-side replace with query/hash and visible fallback | Authoring source, moved to a non-HTML text file | low |
| `/tests/browser/homepage-harness.html` | `/test-lab/homepage-harness/` | functional canonical alias | Synthetic test utility | low |
| `/tests/browser/project-showcase-harness.html` | `/test-lab/project-showcase-harness/` | functional canonical alias | Synthetic test utility | low |
| `/tests/browser/seating-autofit-harness.html` | `/test-lab/seating-autofit-harness/` | functional canonical alias | Synthetic test utility | low |
| `/tests/browser/seating-backup-harness.html` | `/test-lab/seating-backup-harness/` | functional canonical alias | Synthetic test utility | low |
| `/tests/browser/seating-display-color-harness.html` | `/test-lab/seating-display-color-harness/` | functional canonical alias | Synthetic test utility | low |
| `/tests/browser/seating-reliability-harness.html` | `/test-lab/seating-reliability-harness/` | functional canonical alias | Synthetic test utility | low |
| `/tests/browser/seating-stability-harness.html` | `/test-lab/seating-stability-harness/` | functional canonical alias | Synthetic test utility | low |
| `/tests/browser/seating-workspace-harness.html` | `/test-lab/seating-workspace-harness/` | functional canonical alias | Synthetic test utility | low |
| `/tests/browser/website-usability-harness.html` | `/test-lab/website-usability-harness/` | functional canonical alias | Synthetic test utility | low |
| `/webpages/about.html` | `/about/` | client-side replace with query/hash and visible fallback | Personal biography | low |
| `/webpages/blog.html` | `/blog/` | client-side replace with query/hash and visible fallback | Project development notes and download/source links | low |
| `/webpages/HexMath.html` | `/hex-math/` | functional canonical alias | Two-player multiplication strategy game | medium |
| `/webpages/oldaboutpage.html` | `/archive/bootstrap-cover/` | client-side replace with query/hash and visible fallback | Historical Bootstrap coursework biography | low |
| `/webpages/PrivatePolicy.html` | `/privacy/hotdog-counter/` | functional canonical alias | Hotdog Counter privacy policy | low |
| `/webpages/projects.html` | `/projects/` | client-side replace with query/hash and visible fallback | Complete project catalog | low |
| `/webpages/resume.html` | `/resume/` | client-side replace with query/hash and visible fallback | Embedded resume PDF with direct fallback | low |
| `/webpages/SeatingChart.html` | `/seating-chart/` | functional canonical alias | Interactive classroom seating planner with browser-local records | high |
| `/webpages/sortTheNumber.html` | `/sort-the-numbers/` | functional canonical alias | Number-order browser game | medium |
| `/webpages/survey.html` | `/feedback/` | functional canonical alias | Client-side form validation demo; no message delivery | medium |
| `/webpages/tools-games.html` | `/tools-games/` | client-side replace with query/hash and visible fallback | Browser tool and game catalog | low |
| `/wgu-web-task/Task 2 pages/chattanooga.html` | `/coursework/tennessee/chattanooga/` | client-side replace with query/hash and visible fallback | Tennessee coursework state/city/contact page | medium |
| `/wgu-web-task/Task 2 pages/contact.html` | `/coursework/tennessee/contact/` | client-side replace with query/hash and visible fallback | Tennessee coursework state/city/contact page | medium |
| `/wgu-web-task/Task 2 pages/knoxville.html` | `/coursework/tennessee/knoxville/` | client-side replace with query/hash and visible fallback | Tennessee coursework state/city/contact page | medium |
| `/wgu-web-task/Task 2 pages/nashville.html` | `/coursework/tennessee/nashville/` | client-side replace with query/hash and visible fallback | Tennessee coursework state/city/contact page | medium |
| `/wgu-web-task/Task 2 pages/state.html` | `/coursework/tennessee/` | client-side replace with query/hash and visible fallback | Tennessee coursework state/city/contact page | medium |
| `(new utility)` | `/test-lab/migration/` | new clean route | New exhaustive route/resource and synthetic data verification utility | low |

## Collision decisions

- /projects/index.html is added alongside the existing project files; no directory replacement.
- Application routes and /projects/<id>/ showcases remain distinct.
- Coursework uses /coursework/tennessee/ and city children.
- Test harnesses receive noindex /test-lab/ routes and retain functional originals.
- The authoring template becomes docs/project-template.html.txt; its old browser URL redirects to Projects.
- Root and /index.html share a physical file; canonical is /.
- The original privacy-policy URL retains full policy content for non-JavaScript external consumers.

## Verification

`python scripts/audit_routes.py` discovers every HTML file and checks its route mapping and all extracted local references, including CSS, static script URLs, metadata, sitemap and robots references. `--external` makes one bounded availability check per external URL; ordinary runs retain the recorded classifications.

Run Node tests and the catalogs checker, then `python scripts/serve_seating_tests.py --request-log <local-output.jsonl>`. Visit `/test-lab/migration/` on `http://127.0.0.1:8873` for the complete route/resource, no-script fallback, and synthetic classroom checks. Test utilities are intentionally noindex and refuse data operations on other origins.

Never clear classroom storage to preview or deploy this migration. Paths share data only when protocol, host and port remain the same. `file://` and project-subpath hosting are not supported preview modes for root-relative URLs. Use the repository root as the HTTP server root.

The authoring template is now `docs/project-template.html.txt`. Its previous public HTML address redirects to Projects instead of exposing placeholders.
