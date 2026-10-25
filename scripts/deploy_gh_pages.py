#!/usr/bin/env python3
"""Publish a static build to a GitHub Pages branch using the Git Data API.

This avoids depending on a working `git push` from the local machine. It never
prints or writes the token anywhere. Build the app with the correct VITE_BASE
before running this script.

Example:
  python3 scripts/deploy_gh_pages.py \
    --repo OWNER/REPO \
    --token-file secret/github_apikey.txt \
    --dist dist \
    --wait-for-pages
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API_ROOT = "https://api.github.com"


class GitHubError(RuntimeError):
    def __init__(self, status: int, method: str, path: str, body: str):
        super().__init__(
            f"GitHub API {method} {path} failed with {status}: {body[:500]}"
        )
        self.status = status


def api_request(
    method: str,
    path: str,
    token: str,
    payload: dict | None = None,
) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{API_ROOT}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "local-first-ai-pwa-deploy",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise GitHubError(error.code, method, path, body) from error


def split_csv(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def collect_files(dist: Path) -> list[Path]:
    if not dist.is_dir():
        raise SystemExit(f"Build directory does not exist: {dist}")
    if not (dist / "index.html").is_file():
        raise SystemExit(
            f"No index.html in {dist}. Build the app for the correct VITE_BASE first."
        )
    files = []
    for path in sorted(dist.rglob("*")):
        if not path.is_file():
            continue
        if path.name == ".DS_Store":
            continue
        files.append(path)
    if not files:
        raise SystemExit(f"Build directory is empty: {dist}")
    return files


def wait_for_pages_build(
    repo: str, token: str, commit_sha: str, timeout_seconds: int
) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_status = ""
    while time.monotonic() < deadline:
        try:
            build = api_request(
                "GET", f"/repos/{repo}/pages/builds/latest", token
            )
        except GitHubError as error:
            if error.status in (403, 404):
                print(
                    "Pages build status is unavailable (Pages may not be enabled "
                    "or the token lacks Pages read access)."
                )
                return
            raise

        status = str(build.get("status") or "unknown")
        commit = str(build.get("commit") or "")
        if status != last_status or (commit and commit != commit_sha):
            print(f"Pages build: {status} ({commit or 'no commit'})")
            last_status = status
        if status == "built" and commit == commit_sha:
            print("Pages build complete.")
            return
        if status == "errored":
            raise SystemExit("Pages build errored; inspect the repository Actions/settings.")
        time.sleep(10)
    raise SystemExit("Timed out waiting for the Pages build.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Publish a built static site to a GitHub Pages branch."
    )
    parser.add_argument("--repo", required=True, help="OWNER/REPO")
    parser.add_argument(
        "--token-file",
        default="secret/github_apikey.txt",
        help="Local file containing a fine-grained GitHub token (never printed).",
    )
    parser.add_argument("--dist", default="dist", help="Build output directory.")
    parser.add_argument("--branch", default="gh-pages", help="Target branch.")
    parser.add_argument(
        "--message",
        default="Deploy static build",
        help="Commit message.",
    )
    parser.add_argument(
        "--preserve",
        default=".nojekyll,CNAME",
        help="Comma-separated existing branch files to preserve.",
    )
    parser.add_argument(
        "--wait-for-pages",
        action="store_true",
        help="Poll the Pages build until this commit is built.",
    )
    parser.add_argument(
        "--pages-timeout",
        type=int,
        default=300,
        help="Seconds to wait for the Pages build.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be published without changing the branch.",
    )
    args = parser.parse_args()

    if args.repo.count("/") != 1:
        raise SystemExit("--repo must be OWNER/REPO")
    token_path = Path(args.token_file)
    if not token_path.is_file():
        raise SystemExit(f"Token file not found: {token_path}")
    token = token_path.read_text(encoding="utf-8").strip()
    if not token:
        raise SystemExit("Token file is empty.")
    if "\n" in token or "\r" in token:
        raise SystemExit("Token file should contain a single token.")

    dist = Path(args.dist)
    files = collect_files(dist)
    new_paths = {path.relative_to(dist).as_posix() for path in files}
    preserve = set(split_csv(args.preserve))
    encoded_branch = urllib.parse.quote(args.branch, safe="")
    ref_path = f"/repos/{args.repo}/git/ref/heads/{encoded_branch}"

    parent_sha: str | None = None
    base_tree_sha: str | None = None
    old_paths: set[str] = set()
    try:
        ref = api_request("GET", ref_path, token)
        parent_sha = ref["object"]["sha"]
        parent = api_request(
            "GET", f"/repos/{args.repo}/git/commits/{parent_sha}", token
        )
        base_tree_sha = parent["tree"]["sha"]
        old_tree = api_request(
            "GET",
            f"/repos/{args.repo}/git/trees/{base_tree_sha}?recursive=1",
            token,
        )
        if old_tree.get("truncated"):
            raise SystemExit(
                "The existing Git tree is truncated; refusing to guess which "
                "files to remove. Publish manually or use a smaller branch."
            )
        old_paths = {
            entry["path"]
            for entry in old_tree.get("tree", [])
            if entry.get("type") == "blob"
        }
    except GitHubError as error:
        if error.status != 404:
            raise
        print(f"Branch {args.branch!r} does not exist yet; it will be created.")

    deleted = sorted(old_paths - new_paths - preserve)
    print(f"Publishing {len(files)} files to {args.repo}:{args.branch}")
    print(f"Deleting {len(deleted)} stale file(s)")
    if args.dry_run:
        for path in sorted(new_paths):
            print(f"  add/update  {path}")
        for path in deleted:
            print(f"  delete      {path}")
        print("Dry run: no remote changes made.")
        return 0

    entries: list[dict] = []
    for path in files:
        rel = path.relative_to(dist).as_posix()
        content = base64.b64encode(path.read_bytes()).decode("ascii")
        blob = api_request(
            "POST",
            f"/repos/{args.repo}/git/blobs",
            token,
            {"content": content, "encoding": "base64"},
        )
        entries.append(
            {"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]}
        )

    if ".nojekyll" not in new_paths:
        empty = api_request(
            "POST",
            f"/repos/{args.repo}/git/blobs",
            token,
            {"content": "", "encoding": "base64"},
        )
        entries.append(
            {
                "path": ".nojekyll",
                "mode": "100644",
                "type": "blob",
                "sha": empty["sha"],
            }
        )

    for path in deleted:
        entries.append(
            {"path": path, "mode": "100644", "type": "blob", "sha": None}
        )

    tree_payload: dict = {"tree": entries}
    if base_tree_sha:
        tree_payload["base_tree"] = base_tree_sha
    tree = api_request(
        "POST", f"/repos/{args.repo}/git/trees", token, tree_payload
    )

    message = args.message.strip() or "Deploy static build"
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    commit_payload = {
        "message": f"{message}\n\nDeployed {stamp}",
        "tree": tree["sha"],
        "parents": [parent_sha] if parent_sha else [],
    }
    commit = api_request(
        "POST", f"/repos/{args.repo}/git/commits", token, commit_payload
    )

    if parent_sha:
        api_request(
            "PATCH",
            f"/repos/{args.repo}/git/refs/heads/{encoded_branch}",
            token,
            {"sha": commit["sha"], "force": False},
        )
    else:
        api_request(
            "POST",
            f"/repos/{args.repo}/git/refs",
            token,
            {"ref": f"refs/heads/{args.branch}", "sha": commit["sha"]},
        )

    print(f"Published commit {commit['sha']}")
    if deleted:
        print("Deleted stale files:")
        for path in deleted:
            print(f"  {path}")
    if args.wait_for_pages:
        wait_for_pages_build(
            args.repo, token, commit["sha"], max(10, args.pages_timeout)
        )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except GitHubError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
