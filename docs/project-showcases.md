# Project catalog and showcase authoring

The site serves ordinary checked-in HTML directly through GitHub Pages. There is
no backend, framework, runtime metadata fetch, or required generation/build step.
Navigation, category links, project details, and application links work without
JavaScript. Only the existing responsive-navigation enhancement loads on these pages.

## Files and responsibilities

- `data/projects.json`: canonical project IDs, categories, descriptions, technologies,
  overview/features, optional usage/notes/media, action URLs, and link-check provenance.
- `webpages/projects.html`: complete catalog, grouped by the manifest's categories.
- `webpages/tools-games.html`: Browser Tools and Browser Games only.
- `projects/<stable-id>.html`: a static showcase for each project.
- `templates/project.html`: copyable HTML showcase skeleton, including shared navigation.
- `css/dashboard.css`: existing design tokens/components plus shared catalog/showcase rules.
- `scripts/check_catalog.py`: standard-library-only metadata and internal-link validation.

## Current catalog

| Category | Stable project IDs |
| --- | --- |
| Browser Tools | `seating-chart`, `feedback-survey` |
| Browser Games | `hex-math`, `sort-the-numbers` |
| Desktop/Mobile Applications | `auto-clicker`, `vacation-planner`, `hotdog-counter` |
| Coursework | `tennessee-guide`, `bootstrap-cover` |
| Other Projects | `chriswellsdev` |

Every ID maps to `projects/<id>.html`. Other existing portfolio pages (About,
Resume, and Blog) remain supporting content rather than invented extra projects.
Media is optional: existing Auto Clicker/Tennessee assets and locally captured
Hex Math/Sort the Numbers screenshots are used where available. Missing media
does not generate a fake preview or an empty gallery.

## Adding or editing a project

1. Add/update its record in `data/projects.json`. Keep IDs and public showcase URLs
   stable. Leave unknown technologies empty; omit unavailable actions and preview assets.
2. Copy `templates/project.html` to `projects/<stable-id>.html`, or edit the existing
   showcase. Populate title, description, category, overview, features, details,
   technologies, and actions from the metadata. Add optional media, instructions,
   and notes only when supported by project material.
3. Add/update its catalog card. Use `data-project-id`, `.cw-project-summary`, and
   `data-action="showcase"`. Add browser tools/games to both directory pages.
4. Keep the shared static header consistent when changing navigation. Showcase
   pages live one directory below the root, as do the directory pages.
5. Run `python scripts/check_catalog.py`, check the resulting layout and keyboard
   operation in a browser, and commit the HTML with the metadata. Validation is
   optional for hosting but should be run before reviewing catalog changes.

Static HTML is intentionally explicit. The validator catches drift between the
metadata and published pages rather than requiring visitors or GitHub Pages to
run a renderer. The template and CSS define one design for all projects.

## Action semantics

- **View Project**: showcase HTML, never the application itself.
- **Launch Tool / Play Game**: original interactive page URL.
- **View Source**: verified existing repository; shared website-source links lead
  to the website repository, not a separately invented tool repository.
- **Download APK (Google Drive)**: the existing Google Drive file viewer, checked
  to show `Capstone.apk` and Download controls; the binary has not been tested.
- **Open Coursework / Explore Website**: existing static project entry point.
- **Privacy Policy / Development Notes**: supporting material, not an app demo.

Do not add downloads or app features inferred only from a project name. Hotdog
Counter currently has policy material only. The survey and coursework contact
form do not deliver messages. Legacy content and URLs remain available.

## Preservation boundary

The catalogs/showcases do not load tool scripts, embed live applications, access
browser storage, or migrate saved data. Launch links use the original tool paths
on the same production origin. Tool HTML/scripts/styles, coursework, policy text,
and CNAME are not changed by this milestone. The Blog retains its existing content
and gains only showcase links and stable anchors for the referenced entries.
