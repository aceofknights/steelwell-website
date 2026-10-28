# Static project showcases

The site is checked-in HTML/CSS/JavaScript, served at the custom-domain root without a runtime framework or build dependency.

- `/projects/` (`projects/index.html`) is the full catalog. Existing `/projects/*.html` files are compatibility redirects, not catalog sources.
- `/tools-games/` (`tools-games/index.html`) lists the four browser entries.
- `/projects/<stable-id>/` (`projects/<stable-id>/index.html`) is each showcase.
- `data/projects.json` contains verified content, availability, original previews, and clean action destinations.
- `data/routes.json` records canonical destinations, original compatibility URLs, risks, source references, and collision decisions.
- `css/dashboard.css` supplies the shared design; core navigation and actions remain ordinary HTML links.
- `docs/project-template.html.txt` is the authoring skeleton. Its former public HTML URL now redirects to Projects so visitors never see unresolved placeholders.

## Editing or adding a project

1. Verify descriptions, technologies, availability, and destinations against project material. Do not invent releases, downloads, or screenshots.
2. Copy `docs/project-template.html.txt` to `projects/<stable-id>/index.html`. Replace every placeholder; remove unused optional sections. Canonical and sharing URLs must identify the new trailing-slash route.
3. Use root-relative resources and internal actions. Keep project details separate from launching tools. No Resume navigation entry.
4. Match the manifest's content, preview alt text/intrinsic dimensions, and verified links in both catalogs. Use the existing showcase/card classes.
5. Add the route to `data/routes.json`. Preserve existing public addresses with a safe compatibility document if a URL changes. Do not redirect classroom tools before their opening data capture.
6. Run `python scripts/check_catalog.py`, `python scripts/audit_routes.py`, Node tests, and relevant browser checks with `python scripts/serve_seating_tests.py`.

## Compatibility and data

Functional old and new tool pages load identical markup and shared scripts. Both paths stay on the same origin, so browser-local classroom records remain available without a schema change. The Node parity test prevents functional aliases from drifting. Directory depth keeps Seating Chart's dynamic script resolution unchanged.

The existing privacy-policy URL also retains full text for consumers without JavaScript. Other old content addresses use a small same-origin client redirect that preserves query/fragment state and offers a visible fallback. These are HTTP-200 static files, not server-side 301/308 redirects. See the migration report for full verification and rollback instructions.
