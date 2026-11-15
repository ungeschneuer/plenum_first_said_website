"""Fetch over HTTP with retries: a rebuild sends thousands of requests, and some break off midway."""

import http.client
import json
import sys
import time
import urllib.error
import urllib.request

ATTEMPTS = 5
SECONDS_BEFORE_RETRY = 15
TIMEOUT_SECONDS = 120
TRANSIENT_ERRORS = (urllib.error.URLError, http.client.HTTPException, ConnectionError, TimeoutError,
                    json.JSONDecodeError)


def fetch_bytes(request: urllib.request.Request) -> bytes:
    for attempt in range(1, ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code < 500 and error.code != 429 or attempt == ATTEMPTS:
                raise
            print(f'  {request.full_url}: HTTP {error.code}, Versuch {attempt} von {ATTEMPTS}', file=sys.stderr)
        except TRANSIENT_ERRORS as error:
            if attempt == ATTEMPTS:
                raise
            print(f'  {request.full_url}: {error!r}, Versuch {attempt} von {ATTEMPTS}', file=sys.stderr)
        time.sleep(SECONDS_BEFORE_RETRY * attempt)
    raise AssertionError('unreachable')


def fetch_json(request: urllib.request.Request):
    for attempt in range(1, ATTEMPTS + 1):
        try:
            return json.loads(fetch_bytes(request))
        except json.JSONDecodeError:
            if attempt == ATTEMPTS:
                raise
            time.sleep(SECONDS_BEFORE_RETRY * attempt)
    raise AssertionError('unreachable')
