"""Validate checked-in catalog pages; no dependencies or build step required.

Run from any directory: python scripts/check_catalog.py
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
import json
import re

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.refs = []
        self.ids = []
        self.records = []
        self.actions = []
        self.cards = {}
        self.metas = {}
        self.canonical = None
        self.images = []
        self.current_record = None
        self.text = []
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "base":
            return  # Resolution context, not a fetched resource or navigation link.
        if tag == 'meta':
            key = attrs.get('property', attrs.get('name'))
            if key:
                self.metas[key] = attrs.get('content', '')
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs.get('href')
        if tag == 'img':
            self.images.append(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if "data-project-id" in attrs:
            self.records.append(attrs["data-project-id"])
            self.current_record = {"text": [], "actions": []}
            self.cards[attrs["data-project-id"]] = self.current_record
        if "data-action" in attrs:
            self.actions.append((attrs["data-action"], attrs.get("href")))
            if self.current_record is not None:
                self.current_record["actions"].append((attrs["data-action"], attrs.get("href")))
        for key in ("href", "src"):
            if key in attrs:
                self.refs.append(attrs[key])

    def handle_data(self, data):
        self.text.append(data)
        if self.current_record is not None:
            self.current_record["text"].append(data)

    def handle_endtag(self, tag):
        if tag == "article":
            self.current_record = None


def local_target(page_path, ref):
    url = urlsplit(ref)
    if url.scheme or url.netloc:
        return None
    # Match browser URL resolution, including legacy ../../ URLs clamped at site root.
    resolved = urlsplit(urljoin("https://catalog.invalid/" + page_path.relative_to(ROOT).as_posix(), ref))
    target = ROOT / unquote(resolved.path.lstrip("/"))
    return (target / "index.html" if target.is_dir() else target).resolve(), unquote(resolved.fragment)


def check():
    manifest = json.loads((ROOT / "data/projects.json").read_text(encoding="utf-8"))
    projects = manifest["projects"]
    ids = [p["id"] for p in projects]
    assert len(ids) == len(set(ids)), "Duplicate project IDs"
    verified_external = {entry["url"] for entry in manifest["externalLinkChecks"]}
    allowed_actions = {"launch", "play", "source", "download", "notes", "policy", "demo"}
    pages = {path.resolve(): Page(path) for path in ROOT.rglob("*.html")
             if ".git" not in path.parts and "templates" not in path.parts}
    exact_paths = {path.relative_to(ROOT).as_posix() for path in ROOT.rglob("*")
                   if path.is_file() and ".git" not in path.parts}
    references = 0
    for path, page in pages.items():
        assert not any(urlsplit(ref).path.endswith('/resume.html') or ref == 'resume.html'
                       for ref in page.refs), f"Resume navigation link remains: {path}"
        for ref in page.refs:
            local = local_target(path, ref)
            if local:
                target, fragment = local
                assert target.is_relative_to(ROOT), f"Path escapes site: {path}: {ref}"
                assert target.exists(), f"Missing target: {path.relative_to(ROOT)}: {ref}"
                assert target.relative_to(ROOT).as_posix() in exact_paths, f"Incorrect URL case: {ref}"
                if fragment:
                    assert target in pages and fragment in pages[target].ids, f"Missing fragment: {ref}"
                references += 1
    catalog = pages[(ROOT / "projects/index.html").resolve()]
    tools = pages[(ROOT / "tools-games/index.html").resolve()]
    for relative in ['projects/index.html', 'tools-games/index.html']:
        directory = pages[(ROOT / relative).resolve()]
        assert directory.canonical == directory.metas['og:url'] == 'https://chriswellsdev.com/' + relative.removesuffix('index.html')
        assert directory.metas['description'] == directory.metas['og:description'] == directory.metas['twitter:description']
        assert directory.metas['description']
        assert directory.metas['og:title'] == directory.metas['twitter:title']
        assert directory.metas['og:image'] == directory.metas['twitter:image']
        image_path = urlsplit(directory.metas['og:image'])
        assert image_path.netloc == 'chriswellsdev.com' and (ROOT / image_path.path.lstrip('/')).is_file()
    assert sorted(catalog.records) == sorted(ids), "Catalog must contain every project exactly once"
    assert sorted(tools.records) == sorted(p["id"] for p in projects
                                         if p["category"] in ("Browser Tools", "Browser Games"))
    for project in projects:
        assert re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", project["id"])
        assert project["category"] in manifest["categories"]
        path = local_target(ROOT / "index.html", project["showcase"])[0]
        page = pages[path]
        assert page.records == [project["id"]], f"Showcase ID mismatch: {path}"
        assert len(page.ids) == len(set(page.ids)), f"Duplicate IDs: {path}"
        canonical = 'https://chriswellsdev.com' + project['showcase']
        assert page.canonical == canonical
        assert page.metas['og:url'] == canonical
        assert page.metas['description'] == page.metas['og:description'] == page.metas['twitter:description'] == project['summary']
        assert page.metas['og:title'] == page.metas['twitter:title'] == project['title'] + ' — ChrisWellsDev'
        preview = project['preview'] or next(p['preview'] for p in projects if p['id'] == 'chriswellsdev')
        assert page.metas['og:image'] == page.metas['twitter:image'] == 'https://chriswellsdev.com/' + preview['src']
        assert page.metas['og:image:alt'] == page.metas['twitter:image:alt'] == preview['alt']
        for dimension in ('width', 'height'):
            assert page.metas['og:image:' + dimension] == str(preview[dimension])
        text = " ".join(" ".join(page.text).split())
        catalog_text = " ".join(" ".join(catalog.text).split())
        for value in (project["title"], project["category"], project["summary"]):
            assert value in text and value in catalog_text, f"Metadata drift: {project['id']}: {value}"
        for directory_name in ("projects/index.html", "tools-games/index.html"):
            directory_path = ROOT / directory_name
            directory = pages[directory_path.resolve()]
            if project["id"] not in directory.cards:
                continue
            card = directory.cards[project["id"]]
            card_text = " ".join(" ".join(card["text"]).split())
            for value in (project["title"], project["summary"], project["category"], *project["technologies"]):
                assert value in card_text, f"Card metadata drift: {project['id']}: {value}"
            showcase_actions = [href for kind, href in card["actions"] if kind == "showcase"]
            assert len(showcase_actions) == 1
            assert local_target(directory_path, showcase_actions[0])[0] == path, f"Wrong showcase: {project['id']}"
            for kind, href in card["actions"]:
                if kind == "showcase":
                    continue
                assert any(kind == link["kind"] and
                           (local_target(directory_path, href) == local_target(ROOT / "index.html", link["url"])
                            if not urlsplit(link["url"]).scheme else href == link["url"])
                           for link in project["links"]), f"Unexpected quick action: {project['id']}"
        for value in project["features"] + project["usage"] + project["notes"] + project["technologies"] + [project['status'], project['approach']]:
            assert value in text, f"Showcase content drift: {project['id']}: {value}"
        assert len(page.actions) == len(project["links"]), f"Unexpected actions: {path}"
        for link in project["links"]:
            assert link["kind"] in allowed_actions
            assert link["label"] in text
            expected = local_target(ROOT / "index.html", link["url"])
            assert any(kind == link["kind"] and
                       (local_target(path, href) == expected if expected else href == link["url"])
                       for kind, href in page.actions), f"Action drift: {project['id']}: {link}"
            if urlsplit(link["url"]).scheme:
                assert link["url"] in verified_external, f"Unverified external action: {link['url']}"
        if project["preview"]:
            src = project["preview"]["src"]
            assert (ROOT / unquote(src)).exists(), f"Missing preview: {src}"
            for rendered_page in [page, catalog, tools] if project['category'] in ('Browser Tools', 'Browser Games') else [page, catalog]:
                matches = [img for img in rendered_page.images if unquote(urlsplit(img['src']).path).endswith(unquote(src))]
                assert matches, f"Preview missing from catalog/showcase: {project['id']}"
                for img in matches:
                    assert img.get('alt') == project['preview']['alt']
                    assert all(img.get(dimension) == str(project['preview'][dimension]) for dimension in ('width', 'height'))
                    assert img.get('loading') == 'lazy' and img.get('decoding') == 'async'
            assert any(local_target(path, ref) == local_target(ROOT / "index.html", src)
                       for ref in page.refs), f"Preview not rendered: {project['id']}"
    print(f"PASS: {len(projects)} projects, {len(tools.records)} browser tools/games, "
          f"{len(pages)} HTML pages, {references} local references.")
    print("PASS: IDs, categories, content, actions, previews, sharing metadata, and Resume removal.")
    print("External verification records are provenance, not a live availability check.")


if __name__ == "__main__":
    check()
