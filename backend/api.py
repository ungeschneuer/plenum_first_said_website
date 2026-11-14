"""
FastAPI backend server for the Bundestag Word Intensity Tracker.
Provides REST API endpoints for word search, timelines, and details.
"""

import asyncio
import logging
import os
from typing import List, Optional, Dict
from fastapi import FastAPI, HTTPException, Query, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
import hashlib
import json

from database import (
    init_database, search_words, get_word_timeline,
    get_word_details, get_protocol_count, get_processed_protocol_count,
    get_speaker_details, get_party_details,
    get_words_by_speaker, get_words_by_party,
    get_all_speakers, get_all_parties,
    get_protocol_details, get_protocol_words, get_protocol_new_words,
    get_all_wahlperioden, get_wahlperiode_protocols, get_wahlperiode_stats,
    get_or_update_wahlperiode_metadata,
    get_words_comparison_timeline,
    get_word_of_the_day
)
from auth import verify_admin_token, verify_admin_password, create_access_token
from admin_utils import (
    get_system_stats, get_database_stats, create_database_backup,
    list_database_backups, get_processing_queue_info, vacuum_database,
    get_log_tail, get_data_quality_stats
)
from cache import get_cache_stats, clear_all_cache, invalidate_cache
from german_inflections import generate_word_forms

# Initialize logging
# Configure logging to write to both console and file
# This needs to be done AFTER uvicorn configures its logging
log_file_handler = logging.FileHandler('app.log', mode='a')
log_file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logging.getLogger().addHandler(log_file_handler)
logging.getLogger().setLevel(logging.INFO)

# Initialize FastAPI app
app = FastAPI(
    title="Bundestag Wort-Häufigkeits-Tracker API",
    description="API zur Verfolgung von Worthäufigkeiten in Bundestagsdebatten im Zeitverlauf",
    version="0.1.0"
)

# Configure CORS — set ALLOWED_ORIGINS in production (comma-separated list of origins)
_default_origins = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:3000"
_allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add GZip compression for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Pydantic models for API responses

# Pagination models
class PaginationInfo(BaseModel):
    next_cursor: Optional[str] = None
    has_more: bool = False
    total: Optional[int] = None
    limit: int

class PaginatedResponse(BaseModel):
    items: List[Dict]
    pagination: PaginationInfo

class WordSearchResult(BaseModel):
    word: str
    word_id: int
    occurrence_count: int


class TimelinePoint(BaseModel):
    date: str
    count: int
    total_words: int
    percentage: float
    protocol_id: str
    wahlperiode: int
    protokollnummer: int
    titel: str
    pdf_url: str


class WordDetails(BaseModel):
    word: str
    word_id: int
    first_protocol_id: str
    first_date: str
    wahlperiode: int
    protokollnummer: int
    titel: str
    pdf_url: str
    total_count: int
    first_speaker_id: Optional[int] = None
    party_at_time_id: Optional[int] = None
    optv_link: Optional[str] = None
    speaker_name: Optional[str] = None
    party_name: Optional[str] = None
    party_at_time_name: Optional[str] = None
    inflected_forms: List[str] = []
    first_spoken_form: Optional[str] = None
    is_abbreviation: bool = False
    full_form: Optional[str] = None


class WordOfTheDayResponse(BaseModel):
    word: str
    word_id: int
    first_protocol_id: str
    first_date: str
    wahlperiode: int
    protokollnummer: int
    titel: str
    pdf_url: str
    total_count: int
    first_speaker_id: Optional[int] = None
    optv_link: Optional[str] = None
    speaker_name: Optional[str] = None
    party_name: Optional[str] = None
    party_at_time_name: Optional[str] = None
    is_random: bool


class WordComparisonResponse(BaseModel):
    """Response model for word comparison endpoint."""
    words: Dict[str, List[TimelinePoint]]


class StatusResponse(BaseModel):
    total_protocols: int
    processed_protocols: int
    unprocessed_protocols: int


class SpeakerDetails(BaseModel):
    speaker_id: int
    name: str
    party_name: Optional[str] = None
    optv_link: Optional[str] = None
    party_id: Optional[int] = None


class PartyDetails(BaseModel):
    party_id: int
    name: str
    short_name: Optional[str] = None


class SpeakerListItem(BaseModel):
    speaker_id: int
    name: str
    party_name: Optional[str] = None
    word_count: int


class PartyListItem(BaseModel):
    party_id: int
    name: str
    speaker_count: int
    word_count: int


class WordBySpeaker(BaseModel):
    word: str
    first_protocol_id: str
    datum: str
    wahlperiode: int
    protokollnummer: int
    total_count: int


class WordByParty(BaseModel):
    word: str
    first_protocol_id: str
    datum: str
    wahlperiode: int
    protokollnummer: int
    speaker_id: Optional[int] = None
    speaker_name: str
    total_count: int


class ProtocolDetails(BaseModel):
    id: str
    wahlperiode: int
    protokollnummer: int
    datum: str
    titel: str
    pdf_url: str
    total_words: Optional[int] = None
    processed: bool
    unique_words: Optional[int] = None
    total_word_count: Optional[int] = None
    new_words_count: Optional[int] = None


class ProtocolWord(BaseModel):
    word: str
    count: int
    total_count: int
    first_speaker_id: Optional[int] = None
    speaker_name: Optional[str] = None
    party_name: Optional[str] = None


class ProtocolNewWord(BaseModel):
    word: str
    count: int
    total_count: int
    first_speaker_id: Optional[int] = None
    speaker_name: Optional[str] = None
    party_name: Optional[str] = None
    party_at_time_name: Optional[str] = None


class WahlperiodeListItem(BaseModel):
    wahlperiode: int
    start_date: str
    end_date: str
    protocol_count: int
    processed_count: int


class WahlperiodeProtocol(BaseModel):
    id: str
    protokollnummer: int
    datum: str
    titel: str
    pdf_url: str
    total_words: Optional[int] = None
    processed: bool


class WahlperiodeStats(BaseModel):
    wahlperiode: int
    total_protocols: int
    processed_protocols: int
    total_words: Optional[int] = None
    unique_words: int
    total_word_occurrences: int
    new_words: int
    speakers_count: int


class WahlperiodeMetadata(BaseModel):
    wahlperiode: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    election_date: Optional[str] = None
    chancellor: Optional[str] = None
    bundestag_president: Optional[str] = None
    coalition: Optional[str] = None
    total_seats: Optional[int] = None
    parliament_composition: Optional[List[Dict]] = None
    cabinet_members: Optional[List[Dict]] = None


# Ranking API Models
class SampleWord(BaseModel):
    word: str
    date: str
    protocol_id: str
    wahlperiode: Optional[int] = None


class NewWordsRankingItem(BaseModel):
    rank: int
    canonical_id: str
    primary_speaker_id: Optional[int] = None
    mp_name: str
    current_party: Optional[str]
    party_abbrev: Optional[str] = None
    wahlperiode: Optional[int] = None
    new_words_count: Optional[int] = None
    total_new_words: Optional[int] = None
    first_word_date: str
    last_word_date: str
    sample_words: List[SampleWord]
    wahlperioden: Optional[List[int]] = None


class NewWordsRankingResponse(BaseModel):
    wahlperiode: Optional[int]
    party: Optional[str]
    rankings: List[NewWordsRankingItem]
    total_mps: int
    total_new_words: int


class RankingStatistics(BaseModel):
    total_mps: int
    total_new_words: int
    avg_words_per_mp: int
    earliest_word_date: Optional[str]
    latest_word_date: Optional[str]


# Admin API Models
class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SystemStatsResponse(BaseModel):
    cpu_percent: float
    memory_used_mb: float
    memory_total_mb: float
    memory_percent: float
    disk_used_gb: float
    disk_total_gb: float
    disk_percent: float
    database_size_mb: float
    uptime_seconds: int


class DatabaseStatsResponse(BaseModel):
    total_protocols: int
    processed_protocols: int
    unprocessed_protocols: int
    processing_percentage: float
    total_unique_words: int
    words_with_nlp_data: int
    nlp_analysis_breakdown: List[Dict]
    total_word_occurrences: int
    total_speakers: int
    speakers_with_bundestag_id: int
    total_parties: int
    last_processed_protocol: Optional[Dict] = None
    next_to_process: Optional[Dict] = None
    processing_active: bool
    processing_info: Optional[Dict] = None
    currently_processing: Optional[Dict] = None


class BackupResponse(BaseModel):
    success: bool
    message: str
    backup_file: Optional[str] = None
    backup_size_mb: Optional[float] = None
    timestamp: Optional[str] = None


class BackupListItem(BaseModel):
    filename: str
    size_mb: float
    created_at: str


_BACKFILL_INTERVAL_DAYS = 7


def _run_backfill() -> None:
    """Synchronous wrapper — called from a thread pool."""
    try:
        from speaker_check_module import backfill_bundestag_ids
        backfill_bundestag_ids()
    except Exception as e:
        logging.error(f"Bundestag ID backfill failed: {e}")


async def _periodic_backfill() -> None:
    """
    Background task: backfill missing Bundestag IDs every _BACKFILL_INTERVAL_DAYS days.

    Starts with a 60-second delay so the server is fully up before the first
    (potentially slow) Stammdaten download.  Runs in a thread pool so the
    event loop is never blocked.
    """
    await asyncio.sleep(60)
    while True:
        logging.info("Periodic backfill: starting Bundestag ID backfill task")
        await asyncio.to_thread(_run_backfill)
        logging.info(f"Periodic backfill: next run in {_BACKFILL_INTERVAL_DAYS} days")
        await asyncio.sleep(_BACKFILL_INTERVAL_DAYS * 24 * 3600)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_database()
    logging.info("Database initialized")
    asyncio.create_task(_periodic_backfill())
    logging.info("Scheduled periodic Bundestag ID backfill (every 7 days)")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Bundestag Wort-Häufigkeits-Tracker API",
        "version": "0.1.0",
        "endpoints": {
            "search": "/api/words/search?q=<term>",
            "timeline": "/api/words/<word>/timeline",
            "details": "/api/words/<word>/details",
            "status": "/api/status"
        }
    }


@app.get("/api/status", response_model=StatusResponse)
async def get_status():
    """Get database status."""
    total = get_protocol_count()
    processed = get_processed_protocol_count()

    return StatusResponse(
        total_protocols=total,
        processed_protocols=processed,
        unprocessed_protocols=total - processed
    )


@app.get("/api/words/search")
async def search_words_endpoint(
    q: str = Query(..., min_length=1, description="Suchanfrage"),
    limit: int = Query(20, ge=1, le=100, description="Maximale Anzahl der Ergebnisse"),
    cursor: Optional[str] = Query(None, description="Pagination cursor")
):
    """
    Suche nach Wörtern, die der Anfrage entsprechen (mit Pagination).

    - **q**: Suchanfrage (Teilübereinstimmung)
    - **limit**: Maximale Anzahl der Ergebnisse (1-100)
    - **cursor**: Pagination cursor für nächste Seite (optional)

    Returns paginated results with pagination metadata.
    """
    try:
        result = search_words(q, limit=limit, cursor=cursor)
        return {
            'items': [WordSearchResult(**item) for item in result['items']],
            'pagination': result['pagination']
        }
    except ValueError as e:
        # Invalid cursor - return first page
        logging.warning(f"Invalid cursor in search: {e}, returning first page")
        result = search_words(q, limit=limit, cursor=None)
        return {
            'items': [WordSearchResult(**item) for item in result['items']],
            'pagination': result['pagination']
        }
    except Exception as e:
        logging.error(f"Error in search endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.api_route("/api/words/{word}/timeline", methods=["GET", "HEAD"], response_model=List[TimelinePoint])
async def get_word_timeline_endpoint(word: str, response: Response):
    """
    Zeitachsendaten für ein bestimmtes Wort abrufen.

    - **word**: Das nachzuschlagende Wort (Groß-/Kleinschreibung wird ignoriert)

    Gibt eine Liste von Datenpunkten zurück, die die Worthäufigkeit im Zeitverlauf zeigen.
    """
    try:
        timeline_data = get_word_timeline(word)

        if not timeline_data:
            raise HTTPException(status_code=404, detail=f"Wort '{word}' nicht gefunden")

        # Calculate percentage for each data point
        timeline_points = []
        for point in timeline_data:
            percentage = (point['count'] / point['total_words'] * 100) if point['total_words'] > 0 else 0

            timeline_points.append(TimelinePoint(
                date=point['date'],
                count=point['count'],
                total_words=point['total_words'],
                percentage=round(percentage, 4),
                protocol_id=point['protocol_id'],
                wahlperiode=point['wahlperiode'],
                protokollnummer=point['protokollnummer'],
                titel=point['titel'],
                pdf_url=point['pdf_url']
            ))

        # Add cache headers - timeline data is stable
        response.headers["Cache-Control"] = "public, max-age=3600"  # 1 hour
        etag = hashlib.md5(json.dumps([p.dict() for p in timeline_points]).encode()).hexdigest()
        response.headers["ETag"] = etag

        return timeline_points
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in timeline endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.api_route("/api/words/{word}/details", methods=["GET", "HEAD"], response_model=WordDetails)
async def get_word_details_endpoint(word: str, response: Response):
    """
    Detaillierte Informationen über ein Wort abrufen.

    - **word**: Das nachzuschlagende Wort (Groß-/Kleinschreibung wird ignoriert)

    Gibt Informationen über das erste Vorkommen und die Gesamtnutzung zurück.
    """
    try:
        details = get_word_details(word)

        if not details:
            raise HTTPException(status_code=404, detail=f"Wort '{word}' nicht gefunden")

        # Add cache headers - word details are stable
        response.headers["Cache-Control"] = "public, max-age=3600"  # 1 hour
        etag = hashlib.md5(json.dumps(details, default=str).encode()).hexdigest()
        response.headers["ETag"] = etag

        inflected_forms = generate_word_forms(
            word=details.get('word', ''),
            pos_tag=details.get('pos_tag') or '',
            gender=details.get('gender') or '',
        )

        from custom_dictionary import lookup_custom_word as _lookup
        custom_info = _lookup(details.get('word', ''))
        full_form = custom_info.get('full_form') if custom_info else None
        # For mixed-case abbreviations (GroKo, GmbH) the DB may not have is_abbreviation=True,
        # so also check the custom dict.
        is_abbreviation = details.get('is_abbreviation', False) or bool(
            custom_info and custom_info.get('is_abbreviation')
        )
        # Remove is_abbreviation from details to avoid duplicate keyword argument when spreading
        details_without_abbr = {k: v for k, v in details.items() if k != 'is_abbreviation'}

        return WordDetails(**details_without_abbr, inflected_forms=inflected_forms,
                           full_form=full_form, is_abbreviation=is_abbreviation)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in details endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.api_route("/api/word-of-the-day", methods=["GET", "HEAD"], response_model=WordOfTheDayResponse)
async def get_word_of_the_day_endpoint(response: Response):
    """
    Wort des Tages - täglich wechselnd.

    Gibt ein Wort zurück, das an diesem Tag (Monat+Tag) in einem Jahr
    erstmals verwendet wurde. Die Auswahl wechselt jährlich, sodass
    am gleichen Tag über Jahre unterschiedliche Wörter angezeigt werden.
    """
    try:
        from datetime import datetime

        now = datetime.now()
        word_data = get_word_of_the_day(now.month, now.day, now.year)

        if not word_data:
            raise HTTPException(
                status_code=503,
                detail="Keine Wörter in der Datenbank verfügbar"
            )

        # 24h Cache
        response.headers["Cache-Control"] = "public, max-age=86400"
        etag = hashlib.md5(f"{now.year}-{now.month}-{now.day}-{word_data['word']}".encode()).hexdigest()
        response.headers["ETag"] = etag

        return WordOfTheDayResponse(**word_data)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in word-of-the-day: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.api_route("/api/words/compare", methods=["GET", "HEAD"], response_model=WordComparisonResponse)
async def get_words_comparison_endpoint(
    words: str = Query(..., description="Comma-separated list of words to compare"),
    response: Response = None
):
    """
    Vergleichsdaten für mehrere Wörter in einer optimierten Abfrage abrufen.

    - **words**: Komma-getrennte Liste von Wörtern zum Vergleichen (z.B. "Klimawandel,Klimakrise,Erderwärmung")

    Gibt ein Dictionary zurück, das jedes Wort auf seine Zeitachsendaten abbildet.
    Optimiert für Vergleiche mit 2-5 Wörtern.
    """
    try:
        # Parse comma-separated words
        word_list = [w.strip() for w in words.split(',') if w.strip()]

        if not word_list:
            raise HTTPException(status_code=400, detail="Keine Wörter angegeben")

        if len(word_list) > 10:
            raise HTTPException(status_code=400, detail="Maximal 10 Wörter können verglichen werden")

        # Get comparison data
        comparison_data = get_words_comparison_timeline(word_list)

        # Convert to response format
        result = {}
        for word, timeline_data in comparison_data.items():
            timeline_points = []
            for point in timeline_data:
                percentage = (point['count'] / point['total_words'] * 100) if point['total_words'] > 0 else 0

                timeline_points.append(TimelinePoint(
                    date=point['date'],
                    count=point['count'],
                    total_words=point['total_words'],
                    percentage=round(percentage, 4),
                    protocol_id=point['protocol_id'],
                    wahlperiode=point['wahlperiode'],
                    protokollnummer=point['protokollnummer'],
                    titel=point['titel'],
                    pdf_url=point['pdf_url']
                ))
            result[word] = timeline_points

        # Add cache headers
        response.headers["Cache-Control"] = "public, max-age=3600"  # 1 hour
        etag = hashlib.md5(json.dumps(words).encode()).hexdigest()
        response.headers["ETag"] = etag

        return WordComparisonResponse(words=result)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in comparison endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/redner", response_model=List[SpeakerListItem])
async def get_speakers_list():
    """
    Liste aller Redner mit Anzahl eingeführter Wörter.

    Gibt eine Liste aller Redner zurück, die neue Wörter eingeführt haben (ab WP 19).
    """
    try:
        speakers = get_all_speakers()
        return [SpeakerListItem(**speaker) for speaker in speakers]
    except Exception as e:
        logging.error(f"Error in speakers list endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/redner/{speaker_id}", response_model=SpeakerDetails)
async def get_speaker_endpoint(speaker_id: int):
    """
    Detaillierte Informationen über einen Redner abrufen.

    - **speaker_id**: ID des Redners

    Gibt Informationen über den Redner und seine Partei zurück.
    """
    try:
        speaker = get_speaker_details(speaker_id)

        if not speaker:
            raise HTTPException(status_code=404, detail=f"Redner mit ID {speaker_id} nicht gefunden")

        return SpeakerDetails(**speaker)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in speaker details endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/redner/{speaker_id}/woerter")
async def get_speaker_words_endpoint(
    speaker_id: int,
    limit: int = Query(100, ge=1, le=1000, description="Maximale Anzahl der Wörter"),
    cursor: Optional[str] = Query(None, description="Pagination cursor")
):
    """
    Alle Wörter die ein Redner zuerst gesagt hat (mit Pagination).

    - **speaker_id**: ID des Redners
    - **limit**: Maximale Anzahl der Ergebnisse (1-1000)
    - **cursor**: Pagination cursor für nächste Seite (optional)

    Gibt eine Liste aller Wörter zurück, die dieser Redner als Erster im Bundestag verwendet hat.
    """
    try:
        result = get_words_by_speaker(speaker_id, limit=limit, page_cursor=cursor)
        return {
            'items': [WordBySpeaker(**item) for item in result['items']],
            'pagination': result['pagination']
        }
    except Exception as e:
        logging.error(f"Error in speaker words endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/parteien", response_model=List[PartyListItem])
async def get_parties_list():
    """
    Liste aller Parteien mit Statistiken.

    Gibt eine Liste aller Parteien mit Anzahl der Redner und eingeführten Wörter zurück.
    """
    try:
        parties = get_all_parties()
        return [PartyListItem(**party) for party in parties]
    except Exception as e:
        logging.error(f"Error in parties list endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/parteien/{party_id}", response_model=PartyDetails)
async def get_party_endpoint(party_id: int):
    """
    Detaillierte Informationen über eine Partei abrufen.

    - **party_id**: ID der Partei

    Gibt Informationen über die Partei zurück.
    """
    try:
        party = get_party_details(party_id)

        if not party:
            raise HTTPException(status_code=404, detail=f"Partei mit ID {party_id} nicht gefunden")

        return PartyDetails(**party)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in party details endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/parteien/{party_id}/woerter")
async def get_party_words_endpoint(
    party_id: int,
    limit: int = Query(100, ge=1, le=1000, description="Maximale Anzahl der Wörter"),
    cursor: Optional[str] = Query(None, description="Pagination cursor")
):
    """
    Alle Wörter die von Mitgliedern einer Partei zuerst gesagt wurden (mit Pagination).

    - **party_id**: ID der Partei
    - **limit**: Maximale Anzahl der Ergebnisse (1-1000)
    - **cursor**: Pagination cursor für nächste Seite (optional)

    Gibt eine Liste aller Wörter zurück, die von Mitgliedern dieser Partei als Erste verwendet wurden.
    """
    try:
        result = get_words_by_party(party_id, limit=limit, page_cursor=cursor)
        return {
            'items': [WordByParty(**item) for item in result['items']],
            'pagination': result['pagination']
        }
    except Exception as e:
        logging.error(f"Error in party words endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/protokoll/{protocol_id}", response_model=ProtocolDetails)
async def get_protocol_endpoint(protocol_id: str):
    """
    Detaillierte Informationen über ein Protokoll abrufen.

    - **protocol_id**: Protokoll-ID (z.B., "16001")

    Gibt Metadaten, Statistiken und Links zum Protokoll zurück.
    """
    try:
        details = get_protocol_details(protocol_id)

        if not details:
            raise HTTPException(status_code=404, detail=f"Protokoll '{protocol_id}' nicht gefunden")

        return ProtocolDetails(**details)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in protocol details endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/protokoll/{protocol_id}/woerter")
async def get_protocol_words_endpoint(
    protocol_id: str,
    limit: int = Query(100, ge=1, le=1000, description="Maximale Anzahl der Wörter"),
    cursor: Optional[str] = Query(None, description="Pagination cursor")
):
    """
    Alle Wörter aus einem Protokoll abrufen (mit Pagination).

    - **protocol_id**: Protokoll-ID
    - **limit**: Maximale Anzahl der Ergebnisse (1-1000)
    - **cursor**: Pagination cursor für nächste Seite (optional)

    Gibt die häufigsten Wörter aus dem Protokoll zurück mit Pagination.
    """
    try:
        result = get_protocol_words(protocol_id, limit=limit, page_cursor=cursor)
        return {
            'items': [ProtocolWord(**item) for item in result['items']],
            'pagination': result['pagination']
        }
    except Exception as e:
        logging.error(f"Error in protocol words endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/protokoll/{protocol_id}/neue-woerter", response_model=List[ProtocolNewWord])
async def get_protocol_new_words_endpoint(protocol_id: str):
    """
    Neue Wörter die in diesem Protokoll zum ersten Mal auftraten.

    - **protocol_id**: Protokoll-ID

    Gibt alle Wörter zurück, die in diesem Protokoll erstmals verwendet wurden.
    """
    try:
        words = get_protocol_new_words(protocol_id)
        return [ProtocolNewWord(**word) for word in words]
    except Exception as e:
        logging.error(f"Error in protocol new words endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.api_route("/api/wahlperioden", methods=["GET", "HEAD"], response_model=List[WahlperiodeListItem])
async def get_wahlperioden_list(response: Response):
    """
    Liste aller Wahlperioden in der Datenbank.

    Gibt eine Liste aller Wahlperioden mit grundlegenden Statistiken zurück.
    """
    try:
        wahlperioden = get_all_wahlperioden()

        # Add cache headers - wahlperiode list changes rarely
        response.headers["Cache-Control"] = "public, max-age=1800"  # 30 minutes

        return [WahlperiodeListItem(**wp) for wp in wahlperioden]
    except Exception as e:
        logging.error(f"Error in wahlperioden list endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/wahlperiode/{wp_number}", response_model=WahlperiodeMetadata)
async def get_wahlperiode_endpoint(wp_number: int):
    """
    Detaillierte Informationen über eine Wahlperiode abrufen.

    - **wp_number**: Wahlperioden-Nummer (z.B., 19)

    Gibt Metadaten aus Wikidata zurück (Regierung, Parlament, etc.).
    """
    try:
        metadata = get_or_update_wahlperiode_metadata(wp_number)

        if not metadata:
            # Return basic structure even if no Wikidata
            metadata = {
                'wahlperiode': wp_number,
                'start_date': None,
                'end_date': None,
                'chancellor': None,
            }
        else:
            # Rename wp_number to wahlperiode for Pydantic model compatibility
            if 'wp_number' in metadata:
                metadata['wahlperiode'] = metadata.pop('wp_number')

        return WahlperiodeMetadata(**metadata)
    except Exception as e:
        logging.error(f"Error in wahlperiode endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/wahlperiode/{wp_number}/protokolle", response_model=List[WahlperiodeProtocol])
async def get_wahlperiode_protocols_endpoint(wp_number: int):
    """
    Alle Protokolle einer Wahlperiode abrufen.

    - **wp_number**: Wahlperioden-Nummer

    Gibt eine Liste aller Protokolle aus dieser Wahlperiode zurück.
    """
    try:
        protocols = get_wahlperiode_protocols(wp_number)
        return [WahlperiodeProtocol(**p) for p in protocols]
    except Exception as e:
        logging.error(f"Error in wahlperiode protocols endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/wahlperiode/{wp_number}/statistik", response_model=WahlperiodeStats)
async def get_wahlperiode_stats_endpoint(wp_number: int):
    """
    Statistiken für eine Wahlperiode abrufen.

    - **wp_number**: Wahlperioden-Nummer

    Gibt detaillierte Statistiken über Protokolle, Wörter und Redner zurück.
    """
    try:
        stats = get_wahlperiode_stats(wp_number)
        return WahlperiodeStats(**stats)
    except Exception as e:
        logging.error(f"Error in wahlperiode stats endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


# Ranking API Endpoints
@app.get("/api/rankings/neue-woerter", response_model=NewWordsRankingResponse)
async def get_new_words_ranking_endpoint(
    wahlperiode: Optional[int] = Query(None, description="Filter nach Wahlperiode"),
    party: Optional[str] = Query(None, description="Filter nach Partei"),
    limit: int = Query(100, le=500, description="Maximale Anzahl Ergebnisse")
):
    """
    Ranking der Abgeordneten nach Anzahl neuer Wörter (seit 2015).

    Zeigt welche Abgeordnete die meisten neuen Wörter in den Bundestag eingebracht haben.
    Verwendet Wikidata-IDs für konsistente MP-Identifikation über Wahlperioden hinweg.

    - **wahlperiode**: Optional - Filter nach spezifischer Wahlperiode
    - **party**: Optional - Filter nach Partei (Name oder Abkürzung)
    - **limit**: Maximale Anzahl Ergebnisse (Standard: 100, Maximum: 500)

    Gibt Liste der Abgeordneten sortiert nach Anzahl neuer Wörter zurück.
    Jeder Eintrag enthält Beispielwörter und Zeitraum der Aktivität.
    """
    try:
        from database_rankings import get_new_words_ranking

        rankings = get_new_words_ranking(wahlperiode, party, limit)

        total_mps = len(rankings)
        total_new_words = sum(r.get('new_words_count', 0) for r in rankings)

        return NewWordsRankingResponse(
            wahlperiode=wahlperiode,
            party=party,
            rankings=rankings,
            total_mps=total_mps,
            total_new_words=total_new_words
        )
    except Exception as e:
        logging.error(f"Error in ranking endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/rankings/neue-woerter/gesamt", response_model=NewWordsRankingResponse)
async def get_overall_new_words_ranking_endpoint(
    party: Optional[str] = Query(None, description="Filter nach Partei"),
    limit: int = Query(100, le=500, description="Maximale Anzahl Ergebnisse")
):
    """
    Gesamtranking über alle Wahlperioden hinweg (seit 2015).

    Aggregiert neue Wörter pro Abgeordneter über alle Wahlperioden.
    Gleiche Person wird nur einmal gezählt, auch wenn in mehreren Perioden aktiv.

    - **party**: Optional - Filter nach Partei (Name oder Abkürzung)
    - **limit**: Maximale Anzahl Ergebnisse (Standard: 100, Maximum: 500)

    Gibt aggregierte Statistik pro Abgeordneter zurück mit Liste aller
    Wahlperioden in denen sie/er aktiv war.
    """
    try:
        from database_rankings import get_overall_new_words_ranking

        rankings = get_overall_new_words_ranking(party, limit)

        total_mps = len(rankings)
        total_new_words = sum(r.get('total_new_words', 0) for r in rankings)

        return NewWordsRankingResponse(
            wahlperiode=None,
            party=party,
            rankings=rankings,
            total_mps=total_mps,
            total_new_words=total_new_words
        )
    except Exception as e:
        logging.error(f"Error in overall ranking endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/rankings/statistik", response_model=RankingStatistics)
async def get_ranking_statistics_endpoint(
    wahlperiode: Optional[int] = Query(None, description="Filter nach Wahlperiode")
):
    """
    Statistiken über neue Wörter und Abgeordnete.

    - **wahlperiode**: Optional - Filter nach spezifischer Wahlperiode

    Gibt Gesamtstatistiken zurück:
    - Anzahl Abgeordnete mit neuen Wörtern
    - Gesamtzahl neuer Wörter
    - Durchschnitt pro Abgeordneter
    - Zeitraum (erstes und letztes Wort)
    """
    try:
        from database_rankings import get_ranking_statistics

        stats = get_ranking_statistics(wahlperiode)
        return RankingStatistics(**stats)
    except Exception as e:
        logging.error(f"Error in ranking statistics endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


# Admin API Endpoints
@app.post("/api/admin/login", response_model=LoginResponse)
async def admin_login(request: LoginRequest):
    """
    Admin login endpoint.

    Verifies password and returns JWT access token.
    """
    if not verify_admin_password(request.password):
        raise HTTPException(
            status_code=401,
            detail="Falsches Passwort"
        )

    token = create_access_token()
    return LoginResponse(access_token=token)


@app.get("/api/admin/stats/system", response_model=SystemStatsResponse)
async def get_admin_system_stats(username: str = Depends(verify_admin_token)):
    """
    Get system statistics (CPU, memory, disk usage).

    Requires admin authentication.
    """
    try:
        stats = get_system_stats()
        return SystemStatsResponse(**stats)
    except Exception as e:
        logging.error(f"Error in admin system stats: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/admin/stats/database", response_model=DatabaseStatsResponse)
async def get_admin_database_stats(username: str = Depends(verify_admin_token)):
    """
    Get database statistics (protocols, words, speakers).

    Requires admin authentication.
    """
    try:
        stats = get_database_stats()
        return DatabaseStatsResponse(**stats)
    except Exception as e:
        logging.error(f"Error in admin database stats: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/admin/stats/queue")
async def get_admin_queue_stats(username: str = Depends(verify_admin_token)):
    """
    Get processing queue information.

    Requires admin authentication.
    """
    try:
        queue_info = get_processing_queue_info()
        return queue_info
    except Exception as e:
        logging.error(f"Error in admin queue stats: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.post("/api/admin/database/backup", response_model=BackupResponse)
async def create_admin_backup(username: str = Depends(verify_admin_token)):
    """
    Create a database backup.

    Requires admin authentication.
    """
    try:
        result = create_database_backup()
        return BackupResponse(**result)
    except Exception as e:
        logging.error(f"Error creating backup: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/admin/database/backups", response_model=List[BackupListItem])
async def list_admin_backups(username: str = Depends(verify_admin_token)):
    """
    List all database backups.

    Requires admin authentication.
    """
    try:
        backups = list_database_backups()
        return [BackupListItem(**backup) for backup in backups]
    except Exception as e:
        logging.error(f"Error listing backups: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.post("/api/admin/database/vacuum")
async def vacuum_admin_database(username: str = Depends(verify_admin_token)):
    """
    Optimize database (VACUUM).

    Requires admin authentication.
    """
    try:
        result = vacuum_database()
        return result
    except Exception as e:
        logging.error(f"Error vacuuming database: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/admin/logs")
async def get_admin_logs(
    lines: int = Query(100, ge=1, le=1000),
    username: str = Depends(verify_admin_token)
):
    """
    Get application log tail.

    Requires admin authentication.
    """
    try:
        log_lines = get_log_tail(lines)
        return {"logs": log_lines}
    except Exception as e:
        logging.error(f"Error getting logs: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/admin/logs/processing")
async def get_admin_processing_logs(
    lines: int = Query(50, ge=1, le=200),
    username: str = Depends(verify_admin_token)
):
    """
    Get protocol processing activity log.

    Shows recently processed protocols from database activity.
    Requires admin authentication.
    """
    try:
        from database import get_connection
        from admin_utils import check_processing_active

        # Check if processing is active
        status = check_processing_active()

        # Get recently processed protocols
        conn = get_connection()
        cursor = conn.cursor()

        # Get last N processed protocols with timestamps
        cursor.execute("""
            SELECT p.id, p.wahlperiode, p.protokollnummer, p.datum, p.titel,
                   (SELECT COUNT(*) FROM words WHERE first_protocol_id = p.id) as new_words
            FROM protocols p
            WHERE p.processed = TRUE
            ORDER BY CAST(p.id AS INTEGER) DESC
            LIMIT %s
        """, (lines,))

        recent_protocols = cursor.fetchall()
        cursor.close()
        conn.close()

        # Format as log entries
        log_lines = []

        if status['is_processing']:
            log_lines.append(f"[ACTIVE] Processing running for {status['processing_info']['uptime_formatted']}")
            if status['current_protocol']:
                cp = status['current_protocol']
                log_lines.append(f"[CURRENT] Protocol {cp['id']} - WP {cp['wahlperiode']} #{cp['protokollnummer']}")
            log_lines.append("")
        else:
            log_lines.append("[IDLE] No processing activity detected")
            log_lines.append("")

        log_lines.append("[RECENTLY PROCESSED]")
        for p in recent_protocols[:20]:  # Show last 20
            wp_num = f"WP {p[1]:2} #{p[2]:3}" if p[1] and p[2] else "Unknown"
            date = p[3] if p[3] else "No date"
            words = p[5] if p[5] else 0
            log_lines.append(f"✓ {p[0]:6} | {wp_num} | {date} | {words:5} words | {p[4][:50] if p[4] else 'No title'}")

        return {"logs": log_lines}
    except Exception as e:
        logging.error(f"Error getting processing activity: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/admin/cache/stats")
async def get_admin_cache_stats(username: str = Depends(verify_admin_token)):
    """
    Get Redis cache statistics.

    Requires admin authentication.
    """
    try:
        stats = get_cache_stats()
        return stats
    except Exception as e:
        logging.error(f"Error getting cache stats: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.post("/api/admin/cache/clear")
async def clear_admin_cache(
    pattern: Optional[str] = None,
    username: str = Depends(verify_admin_token)
):
    """
    Clear cache entries.

    - **pattern**: Optional pattern to match (e.g., "search*"). If not provided, clears all cache.

    Requires admin authentication.
    """
    try:
        if pattern:
            deleted = invalidate_cache(pattern)
            return {"success": True, "message": f"Cleared {deleted} cache entries matching '{pattern}'"}
        else:
            success = clear_all_cache()
            return {"success": success, "message": "All cache cleared" if success else "Failed to clear cache"}
    except Exception as e:
        logging.error(f"Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/admin/data-quality")
async def get_admin_data_quality(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    min_occ: int = Query(1, ge=1),
    caps_only: bool = False,
    username: str = Depends(verify_admin_token)
):
    """
    Get data quality statistics for PATTERN_FALLBACK words.

    Returns source breakdown and paginated list of words that could not be
    analysed by spaCy or compound splitting (analysis_source = 'PATTERN_FALLBACK').

    Requires admin authentication.
    """
    try:
        return get_data_quality_stats(page, per_page, min_occ, caps_only)
    except Exception as e:
        logging.error(f"Error in data quality endpoint: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
