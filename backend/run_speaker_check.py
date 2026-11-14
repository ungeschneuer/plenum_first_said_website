import logging
import sys
from speaker_check_module import check_speakers_for_batch

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    stream=sys.stdout,
    force=True,
)

check_speakers_for_batch(delay=1.0)
