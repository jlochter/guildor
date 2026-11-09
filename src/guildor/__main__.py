"""CLI entry point.

    python -m guildor verify RUN.json
    python -m guildor verify-link "https://…/#run=<code>"   (or just the code)
"""

import sys

from .ruleset import IllegalAction
from .share import record_from_share
from .verify import main as verify_main
from .verify import verify

USAGE = "usage: python -m guildor verify RUN.json | verify-link URL_OR_CODE"


def verify_link(arg: str) -> int:
    try:
        record, hash_ok = record_from_share(arg)
    except (ValueError, KeyError, TypeError, IllegalAction) as e:
        print(f"INVALID\n  - {e}")
        return 1
    res = verify(record)
    if res.ok and hash_ok:
        print(f"OK  score={res.score}  seed={record['seed']!r}  final_hash={record['final_hash']}")
        return 0
    print("INVALID")
    if not hash_ok:
        print("  - claimed final hash does not match the replayed game (link was altered)")
    for e in res.errors:
        print(f"  - {e}")
    return 1


def main() -> int:
    args = sys.argv[1:]
    if len(args) >= 1 and args[0] == "verify":
        return verify_main(args[1:])
    if len(args) == 2 and args[0] == "verify-link":
        return verify_link(args[1])
    print(USAGE, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
