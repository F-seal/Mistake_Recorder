#!/usr/bin/env python3
"""Fail if local secret values appear anywhere in a build directory.

Never prints the secrets themselves. Example:
  python3 scripts/scan_build_secrets.py \
    --secret secret/deepseek_apikey.txt secret/github_apikey.txt
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scan build output for the contents of local secret files."
    )
    parser.add_argument("--dist", default="dist", help="Build output directory.")
    parser.add_argument(
        "--secret",
        nargs="+",
        required=True,
        help="One or more local files whose exact contents must not appear in the build.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Only print matched file paths, not success lines.",
    )
    args = parser.parse_args()

    dist = Path(args.dist)
    if not dist.is_dir():
        raise SystemExit(f"Build directory does not exist: {dist}")

    files = [path for path in dist.rglob("*") if path.is_file()]
    if not files:
        raise SystemExit(f"No files found in {dist}")

    failed = False
    for secret_path in args.secret:
        path = Path(secret_path)
        if not path.is_file():
            raise SystemExit(f"Secret file not found: {path}")
        value = path.read_text(encoding="utf-8", errors="ignore").strip()
        if not value:
            raise SystemExit(f"Secret file is empty: {path}")
        needle = value.encode("utf-8")
        matches = []
        for candidate in files:
            if needle in candidate.read_bytes():
                matches.append(str(candidate))
        if matches:
            failed = True
            print(f"FAIL: content from {path} appears in {len(matches)} build file(s)")
            for match in matches:
                print(f"  {match}")
        elif not args.quiet:
            print(f"OK: content from {path} is not in the build")

    print(f"Scanned {len(files)} build file(s).")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
