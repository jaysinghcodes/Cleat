#!/usr/bin/env python3
"""Independent ICS check for Cleat exports and feeds.

Uses Python icalendar, not ical.js.

  python3 packages/domain/scripts/verify-ics.py FILE [FILE ...]
  python3 packages/domain/scripts/verify-ics.py --feed URL [--export FILE]

Each calendar must use VERSION 2.0, include PRODID, use CRLF line endings,
and keep every physical line to 75 octets or fewer. Every VEVENT needs a UID
and a DTSTAMP. Two files passed together must list the same UIDs. --feed
fetches the URL twice, checks text/calendar and max-age=60, and checks that
those UIDs match. --export UIDs must also appear in that feed.
"""

from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request
from pathlib import Path

from icalendar import Calendar


def fail(message: str) -> None:
    print(f"FAIL {message}", file=sys.stderr)
    raise SystemExit(1)


def physical_lines(raw: bytes) -> list[str]:
    if not raw.endswith(b"\r\n"):
        fail("calendar does not end with CRLF")
    stripped = raw.replace(b"\r\n", b"")
    if b"\n" in stripped or b"\r" in stripped:
        fail("calendar has a line ending other than CRLF")
    lines = raw.split(b"\r\n")
    if lines[-1] != b"":
        fail("calendar does not end with CRLF")
    return [line.decode("utf-8") for line in lines[:-1]]


def check_bytes(label: str, raw: bytes) -> Calendar:
    lines = physical_lines(raw)
    longest = 0
    for line in lines:
        size = len(line.encode("utf-8"))
        longest = max(longest, size)
        if size > 75:
            fail(f"{label} line is {size} octets: {line[:80]!r}")
    text = raw.decode("utf-8")
    calendar = Calendar.from_ical(text)
    version = str(calendar.get("version") or "")
    prodid = str(calendar.get("prodid") or "")
    if version != "2.0":
        fail(f"{label} VERSION is {version or 'missing'}")
    if not prodid.strip():
        fail(f"{label} PRODID is missing")
    events = []
    for component in calendar.walk("VEVENT"):
        uid = str(component.get("uid") or "")
        stamp = component.get("dtstamp")
        status = str(component.get("status") or "")
        if not uid:
            fail(f"{label} VEVENT has no UID")
        if stamp is None:
            fail(f"{label} VEVENT {uid} has no DTSTAMP")
        stamp_text = component["DTSTAMP"].to_ical().decode("utf-8")
        if status not in {"CONFIRMED", "CANCELLED"}:
            fail(f"{label} VEVENT {uid} STATUS is {status or 'missing'}")
        summary = str(component.get("summary") or "")
        unfolded = raw.replace(b"\r\n ", b"").replace(b"\r\n\t", b"")
        if not summary or summary.encode("utf-8") not in unfolded:
            fail(f"{label} VEVENT {uid} SUMMARY did not unfold")
        events.append((uid, stamp_text, status, summary))
    if not events:
        fail(f"{label} has no VEVENT")
    print(f"{label}")
    print(f"  bytes {len(raw)}")
    print(f"  line endings CRLF")
    print(f"  longest line {longest} octets")
    print(f"  VERSION {version}")
    print(f"  PRODID {prodid}")
    print(f"  events {len(events)}")
    for uid, stamp, status, summary in events:
        print(f"  UID {uid} DTSTAMP {stamp} STATUS {status}")
        print(f"  SUMMARY {summary}")
    return calendar


def uids(calendar: Calendar) -> list[str]:
    return [str(component.get("uid")) for component in calendar.walk("VEVENT")]


def load_path(path: str) -> tuple[str, bytes]:
    file = Path(path)
    if not file.is_file():
        fail(f"missing file {path}")
    return file.name, file.read_bytes()


def fetch(url: str) -> tuple[bytes, str, str]:
    request = urllib.request.Request(url)
    try:
        response_cm = urllib.request.urlopen(request, timeout=20)
    except urllib.error.HTTPError as error:
        fail(f"{url} returned HTTP {error.code}")
    with response_cm as response:
        body = response.read()
        status = str(response.status)
        headers = {key.lower(): value for key, value in response.headers.items()}
    content_type = headers.get("content-type", "")
    cache_control = headers.get("cache-control", "")
    if status != "200":
        fail(f"{url} returned HTTP {status}")
    if not content_type.lower().startswith("text/calendar"):
        fail(f"{url} Content-Type is {content_type or 'missing'}")
    if "max-age=60" not in cache_control.replace(" ", ""):
        fail(f"{url} Cache-Control is {cache_control or 'missing'}")
    print(f"  HTTP {status}")
    print(f"  Content-Type {content_type}")
    print(f"  Cache-Control {cache_control}")
    return body, content_type, cache_control


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify Cleat ICS calendars.")
    parser.add_argument("files", nargs="*", help="ICS files. Two files must have the same UIDs.")
    parser.add_argument("--feed", help="Subscribe URL. Fetched twice.")
    parser.add_argument("--export", help="Export file. Its UIDs must appear in --feed.")
    args = parser.parse_args()
    if not args.files and not args.feed:
        fail("pass an ICS file or --feed")

    calendars: list[tuple[str, Calendar]] = []
    for path in args.files:
        label, raw = load_path(path)
        calendars.append((label, check_bytes(label, raw)))

    if len(calendars) >= 2:
        first = uids(calendars[0][1])
        for label, calendar in calendars[1:]:
            current = uids(calendar)
            if current != first:
                fail(f"UIDs differ between {calendars[0][0]} and {label}")
        print(f"UID stable across {len(calendars)} files: {', '.join(first)}")

    if args.feed:
        print(f"feed {args.feed}")
        print("fetch 1")
        first_body, _, _ = fetch(args.feed)
        first_calendar = check_bytes("feed fetch 1", first_body)
        print("fetch 2")
        second_body, _, _ = fetch(args.feed)
        second_calendar = check_bytes("feed fetch 2", second_body)
        first_uids = uids(first_calendar)
        second_uids = uids(second_calendar)
        if first_uids != second_uids:
            fail("feed UIDs changed between fetches")
        print(f"UID stable across feed fetches: {', '.join(first_uids)}")
        if args.export:
            export_label, export_raw = load_path(args.export)
            export_calendar = check_bytes(export_label, export_raw)
            export_uids = uids(export_calendar)
            missing = [uid for uid in export_uids if uid not in first_uids]
            if missing:
                fail(f"export UID missing from feed: {', '.join(missing)}")
            print(f"UID shared by export and feed: {', '.join(export_uids)}")
    elif args.export:
        fail("--export requires --feed")

    print("OK")


if __name__ == "__main__":
    main()
