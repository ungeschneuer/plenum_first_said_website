"""A fingerprint of the rules that decide what is counted and how.

A word form keeps its lemma and a lemma its first occurrence once written, so a change to these files only takes
effect for all protocols after a rebuild. The export writes the fingerprint to stand.json; the daily workflow
compares it with the fingerprint of the checked-out code and starts a rebuild when they differ.

Run as a script, it prints the fingerprint.
"""

import hashlib
from pathlib import Path

PIPELINE_DIRECTORY = Path(__file__).parent
RULE_FILES = (
    'export_static_data.py', 'first_occurrence.py', 'fragments.py', 'lemmatizer.py', 'ocr_repair.py',
    'protocol_sources.py', 'protocol_text.py', 'speaker_lines.py', 'speakers.py', 'text_speakers.py',
    'first_names.txt', 'member_surnames.txt', 'multiword_terms.txt', 'requirements.txt',
)
FINGERPRINT_LENGTH = 16


def rules_version() -> str:
    digest = hashlib.sha256()
    for name in RULE_FILES:
        digest.update(name.encode() + b'\0' + (PIPELINE_DIRECTORY / name).read_bytes() + b'\0')
    return digest.hexdigest()[:FINGERPRINT_LENGTH]


if __name__ == '__main__':
    print(rules_version())
