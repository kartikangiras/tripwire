"""Download the AI Village dataset from Hugging Face, in tiers.

Tier "small"  (~95 MB): the social layer -- start here, enough to build the claim extractor.
Tier "docs"   (<1 MB) : SCHEMA.md / CHANGELOG.md / example.py / manifest.json.
Tier "mid"    (~690 MB): events + human-readable transcript.
Tier "big"    (~4.9 GB): agent_memories + computer_use_turns (the two that matter most, last).
Screenshots are per-day tars, pulled individually by date.
"""

import sys

from huggingface_hub import hf_hub_download

REPO = "aidigestorg/ai-village"
LOCAL = "data/raw"

TIERS = {
    "docs": ["SCHEMA.md", "CHANGELOG.md", "example.py", "manifest.json", "README.md"],
    "small": [
        "summaries.jsonl.gz",
        "agents.jsonl.gz",
        "chat_rooms.jsonl.gz",
        "village_goals.jsonl.gz",
        "agent_goals.jsonl.gz",
        "villages.jsonl.gz",
        "claude_code_sessions.jsonl.gz",
        "chat_messages.jsonl.gz",
        "computer_use_sessions.jsonl.gz",
    ],
    "mid": ["events.jsonl.gz", "village-transcript.json"],
    "big": ["agent_memories.jsonl.gz", "computer_use_turns.jsonl.gz", "claude_code_messages.jsonl.gz"],
}


def get(path: str) -> str:
    return hf_hub_download(REPO, path, repo_type="dataset", local_dir=LOCAL)


def main(argv: list[str]) -> int:
    """`tripwire fetch [tier|day:YYYY-MM-DD ...]`; default: docs small."""
    args = argv or ["docs", "small"]
    for name in args:
        if name.startswith("day:"):  # e.g. day:2026-06-18 -> one screenshot tar
            day = name.split(":", 1)[1]
            print(f"[{day}] screenshots ...", flush=True)
            print("  ->", get(f"images/computer-use-turns/{day}.tar"))
            continue
        if name not in TIERS:
            print(f"unknown tier {name!r}; choose from {list(TIERS)} or day:YYYY-MM-DD")
            return 2
        for f in TIERS[name]:
            print(f"[{name}] {f} ...", flush=True)
            print("  ->", get(f))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
