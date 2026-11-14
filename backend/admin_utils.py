"""
Utility functions for admin operations (system monitoring, database management, etc.)
PostgreSQL version.
"""

import os
import psutil
import subprocess
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from database_postgresql_impl import DatabaseConnection, DB_CONFIG
import time


def get_system_stats() -> Dict:
    """Get system statistics for monitoring."""
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)

        # Memory usage
        memory = psutil.virtual_memory()
        memory_used_mb = memory.used / (1024 * 1024)
        memory_total_mb = memory.total / (1024 * 1024)
        memory_percent = memory.percent

        # Disk usage
        disk = psutil.disk_usage(str(Path(__file__).parent))
        disk_used_gb = disk.used / (1024 * 1024 * 1024)
        disk_total_gb = disk.total / (1024 * 1024 * 1024)
        disk_percent = disk.percent

        # Database size from PostgreSQL
        db_size_mb = 0
        try:
            with DatabaseConnection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT pg_database_size(%s)", (DB_CONFIG['database'],))
                db_size_bytes = cursor.fetchone()[0]
                db_size_mb = db_size_bytes / (1024 * 1024)
        except Exception as e:
            logging.error(f"Error getting database size: {e}")

        # Process uptime
        process = psutil.Process(os.getpid())
        uptime_seconds = (datetime.now() - datetime.fromtimestamp(process.create_time())).total_seconds()

        return {
            "cpu_percent": round(cpu_percent, 1),
            "memory_used_mb": round(memory_used_mb, 1),
            "memory_total_mb": round(memory_total_mb, 1),
            "memory_percent": round(memory_percent, 1),
            "disk_used_gb": round(disk_used_gb, 2),
            "disk_total_gb": round(disk_total_gb, 2),
            "disk_percent": round(disk_percent, 1),
            "database_size_mb": round(db_size_mb, 2),
            "uptime_seconds": int(uptime_seconds)
        }
    except Exception as e:
        logging.error(f"Error getting system stats: {e}")
        return {}


def check_processing_active() -> Dict:
    """Check if protocol processing is currently active."""
    try:
        # Check for rebuild_database.py or process_protocols processes
        is_processing = False
        processing_info = None

        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time']):
            try:
                cmdline = proc.info.get('cmdline', [])
                if cmdline and any('rebuild_database.py' in str(arg) or 'process_protocols' in str(arg) for arg in cmdline):
                    is_processing = True
                    uptime = int(time.time() - proc.info['create_time'])
                    processing_info = {
                        "pid": proc.info['pid'],
                        "uptime_seconds": uptime,
                        "uptime_formatted": f"{uptime//3600}h {(uptime%3600)//60}m"
                    }
                    break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        # If processing is active, get the most recently modified protocol
        current_protocol = None
        if is_processing:
            with DatabaseConnection() as conn:
                cursor = conn.cursor()
                # Get protocol that was processed most recently (within last 5 minutes)
                cursor.execute("""
                    SELECT id, datum, titel, wahlperiode, protokollnummer
                    FROM protocols
                    WHERE processed = TRUE
                    ORDER BY CAST(id AS INTEGER) DESC
                    LIMIT 1
                """)
                recent = cursor.fetchone()
                if recent:
                    current_protocol = {
                        "id": recent[0],
                        "date": str(recent[1]) if recent[1] else None,
                        "title": recent[2],
                        "wahlperiode": recent[3],
                        "protokollnummer": recent[4]
                    }

        return {
            "is_processing": is_processing,
            "processing_info": processing_info,
            "current_protocol": current_protocol
        }
    except Exception as e:
        logging.error(f"Error checking processing status: {e}")
        return {
            "is_processing": False,
            "processing_info": None,
            "current_protocol": None
        }


def get_database_stats() -> Dict:
    """Get database statistics."""
    try:
        with DatabaseConnection() as conn:
            cursor = conn.cursor()

            # Count protocols
            cursor.execute("SELECT COUNT(*) FROM protocols")
            total_protocols = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM protocols WHERE processed = TRUE")
            processed_protocols = cursor.fetchone()[0]

            # Count words
            cursor.execute("SELECT COUNT(*) FROM words")
            total_words = cursor.fetchone()[0]

            # Count word occurrences
            cursor.execute("SELECT SUM(count) FROM word_occurrences")
            result = cursor.fetchone()[0]
            total_occurrences = result if result else 0

            # Count speakers
            cursor.execute("SELECT COUNT(*) FROM speakers")
            total_speakers = cursor.fetchone()[0]

            # Count parties
            cursor.execute("SELECT COUNT(*) FROM parties")
            total_parties = cursor.fetchone()[0]

            # Get most recently processed protocol (by ID, highest = most recent)
            cursor.execute("""
                SELECT id, datum, titel, wahlperiode, protokollnummer
                FROM protocols
                WHERE processed = TRUE
                ORDER BY CAST(id AS INTEGER) DESC
                LIMIT 1
            """)
            recent = cursor.fetchone()
            last_processed_protocol = {
                "id": recent[0],
                "date": str(recent[1]) if recent[1] else None,
                "title": recent[2],
                "wahlperiode": recent[3],
                "protokollnummer": recent[4]
            } if recent else None

            # Get next protocol to be processed (oldest unprocessed)
            cursor.execute("""
                SELECT id, datum, titel, wahlperiode, protokollnummer
                FROM protocols
                WHERE processed = FALSE
                ORDER BY wahlperiode, protokollnummer
                LIMIT 1
            """)
            next_protocol = cursor.fetchone()
            next_to_process = {
                "id": next_protocol[0],
                "date": str(next_protocol[1]) if next_protocol[1] else None,
                "title": next_protocol[2],
                "wahlperiode": next_protocol[3],
                "protokollnummer": next_protocol[4]
            } if next_protocol else None

            # Processing progress percentage
            processing_percentage = (processed_protocols / total_protocols * 100) if total_protocols > 0 else 0

            # Count words with enhanced NLP data
            cursor.execute("""
                SELECT COUNT(*) FROM words
                WHERE gender IS NOT NULL OR base_lemma IS NOT NULL
            """)
            words_with_nlp = cursor.fetchone()[0]

            # Count words by analysis source
            cursor.execute("""
                SELECT analysis_source, COUNT(*) as count
                FROM words
                WHERE analysis_source IS NOT NULL
                GROUP BY analysis_source
                ORDER BY count DESC
            """)
            nlp_breakdown = []
            for row in cursor.fetchall():
                nlp_breakdown.append({
                    "source": row[0],
                    "count": row[1]
                })

            # Count speakers with Bundestag MdB IDs (for MP ranking)
            cursor.execute("SELECT COUNT(*) FROM speakers WHERE bundestag_id IS NOT NULL")
            speakers_with_bundestag_id = cursor.fetchone()[0]

            # Check if processing is currently active
            processing_status = check_processing_active()

            return {
                "total_protocols": total_protocols,
                "processed_protocols": processed_protocols,
                "unprocessed_protocols": total_protocols - processed_protocols,
                "processing_percentage": round(processing_percentage, 2),
                "total_unique_words": total_words,
                "words_with_nlp_data": words_with_nlp,
                "nlp_analysis_breakdown": nlp_breakdown,
                "total_word_occurrences": total_occurrences,
                "total_speakers": total_speakers,
                "speakers_with_bundestag_id": speakers_with_bundestag_id,
                "total_parties": total_parties,
                "last_processed_protocol": last_processed_protocol,
                "next_to_process": next_to_process,
                "processing_active": processing_status["is_processing"],
                "processing_info": processing_status["processing_info"],
                "currently_processing": processing_status["current_protocol"]
            }
    except Exception as e:
        logging.error(f"Error getting database stats: {e}")
        return {}


def create_database_backup() -> Dict:
    """Create a backup of the PostgreSQL database using pg_dump."""
    try:
        # Create backups directory if it doesn't exist
        backup_dir = Path(__file__).parent / "backups"
        backup_dir.mkdir(exist_ok=True)

        # Create backup filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"bundestag_backup_{timestamp}.sql"

        # Run pg_dump
        env = os.environ.copy()
        env['PGPASSWORD'] = DB_CONFIG['password']

        result = subprocess.run([
            'pg_dump',
            '-h', DB_CONFIG['host'],
            '-p', str(DB_CONFIG['port']),
            '-U', DB_CONFIG['user'],
            '-d', DB_CONFIG['database'],
            '-f', str(backup_path),
            '--format=plain',
            '--no-owner',
            '--no-acl'
        ], env=env, capture_output=True, text=True)

        if result.returncode != 0:
            return {
                "success": False,
                "message": f"pg_dump failed: {result.stderr}"
            }

        backup_size_mb = backup_path.stat().st_size / (1024 * 1024)

        return {
            "success": True,
            "message": "Backup created successfully",
            "backup_file": str(backup_path.name),
            "backup_size_mb": round(backup_size_mb, 2),
            "timestamp": timestamp
        }
    except Exception as e:
        logging.error(f"Error creating backup: {e}")
        return {
            "success": False,
            "message": f"Backup failed: {str(e)}"
        }


def list_database_backups() -> List[Dict]:
    """List all database backups."""
    try:
        backup_dir = Path(__file__).parent / "backups"
        if not backup_dir.exists():
            return []

        backups = []
        for backup_file in sorted(backup_dir.glob("bundestag_backup_*.sql"), reverse=True):
            stat = backup_file.stat()
            backups.append({
                "filename": backup_file.name,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
            })

        return backups
    except Exception as e:
        logging.error(f"Error listing backups: {e}")
        return []


def get_processing_queue_info() -> Dict:
    """Get information about the processing queue."""
    try:
        with DatabaseConnection() as conn:
            cursor = conn.cursor()

            # Get total counts
            cursor.execute("SELECT COUNT(*) FROM protocols")
            total_protocols = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM protocols WHERE processed = TRUE")
            processed_protocols = cursor.fetchone()[0]

            # Get unprocessed protocols by Wahlperiode
            cursor.execute("""
                SELECT wahlperiode, COUNT(*) as count
                FROM protocols
                WHERE processed = FALSE
                GROUP BY wahlperiode
                ORDER BY wahlperiode
            """)

            queue_by_wp = []
            for row in cursor.fetchall():
                queue_by_wp.append({
                    "wahlperiode": row[0],
                    "unprocessed_count": row[1]
                })

            # Get oldest unprocessed protocol
            cursor.execute("""
                SELECT id, datum, titel, wahlperiode
                FROM protocols
                WHERE processed = FALSE
                ORDER BY wahlperiode, protokollnummer
                LIMIT 1
            """)

            oldest = cursor.fetchone()
            oldest_unprocessed = {
                "id": oldest[0],
                "date": str(oldest[1]) if oldest[1] else None,
                "title": oldest[2],
                "wahlperiode": oldest[3]
            } if oldest else None

            # Calculate processing rate (estimate based on average)
            # Assume ~1 protocol/min as baseline from recent measurements
            unprocessed_count = total_protocols - processed_protocols
            estimated_rate_per_min = 1.0  # protocols per minute
            estimated_hours_remaining = (unprocessed_count / estimated_rate_per_min) / 60 if unprocessed_count > 0 else 0

            # Get processing progress by Wahlperiode
            cursor.execute("""
                SELECT
                    wahlperiode,
                    COUNT(*) as total,
                    SUM(CASE WHEN processed = TRUE THEN 1 ELSE 0 END) as processed,
                    ROUND(SUM(CASE WHEN processed = TRUE THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as percentage
                FROM protocols
                GROUP BY wahlperiode
                ORDER BY wahlperiode
            """)

            progress_by_wp = []
            for row in cursor.fetchall():
                progress_by_wp.append({
                    "wahlperiode": row[0],
                    "total": row[1],
                    "processed": row[2],
                    "percentage": float(row[3]) if row[3] else 0.0
                })

            return {
                "total_unprocessed": unprocessed_count,
                "total_processed": processed_protocols,
                "total_protocols": total_protocols,
                "processing_percentage": round(processed_protocols / total_protocols * 100, 2) if total_protocols > 0 else 0,
                "estimated_hours_remaining": round(estimated_hours_remaining, 1),
                "estimated_rate_per_min": estimated_rate_per_min,
                "queue_by_wahlperiode": queue_by_wp,
                "progress_by_wahlperiode": progress_by_wp,
                "oldest_unprocessed": oldest_unprocessed
            }
    except Exception as e:
        logging.error(f"Error getting queue info: {e}")
        return {}


def vacuum_database() -> Dict:
    """Run VACUUM on PostgreSQL database to reclaim space."""
    try:
        with DatabaseConnection() as conn:
            # VACUUM cannot run inside a transaction block
            conn.set_isolation_level(0)  # AUTOCOMMIT mode
            cursor = conn.cursor()
            cursor.execute("VACUUM ANALYZE")

        return {
            "success": True,
            "message": "Database optimized successfully"
        }
    except Exception as e:
        logging.error(f"Error vacuuming database: {e}")
        return {
            "success": False,
            "message": f"Optimization failed: {str(e)}"
        }


def get_data_quality_stats(page: int = 1, per_page: int = 50,
                           min_occ: int = 1, caps_only: bool = False) -> Dict:
    """
    Return data quality statistics focused on PATTERN_FALLBACK words.

    Includes:
    - source_breakdown: word counts per analysis_source
    - pattern_fallback_total: total PATTERN_FALLBACK words
    - all_caps_unrecognized: PATTERN_FALLBACK words that are all-caps
    - words: paginated list of PATTERN_FALLBACK words sorted by total_occurrences DESC
    """
    try:
        with DatabaseConnection() as conn:
            cursor = conn.cursor()

            # Source breakdown with percentages
            cursor.execute("""
                SELECT analysis_source, COUNT(*) as count
                FROM words
                WHERE analysis_source IS NOT NULL
                GROUP BY analysis_source
                ORDER BY count DESC
            """)
            rows = cursor.fetchall()
            total_with_source = sum(r[1] for r in rows)
            source_breakdown = [
                {
                    'source': r[0],
                    'count': r[1],
                    'pct': round(r[1] * 100.0 / total_with_source, 1) if total_with_source else 0.0
                }
                for r in rows
            ]

            # PATTERN_FALLBACK total
            cursor.execute("""
                SELECT COUNT(*) FROM words WHERE analysis_source = 'PATTERN_FALLBACK'
            """)
            pattern_fallback_total = cursor.fetchone()[0]

            # All-caps unrecognized (PATTERN_FALLBACK AND all-caps)
            cursor.execute("""
                SELECT COUNT(*) FROM words
                WHERE analysis_source = 'PATTERN_FALLBACK'
                  AND word ~ '^[A-ZÄÖÜ]+$'
            """)
            all_caps_unrecognized = cursor.fetchone()[0]

            # Compound_split total (for stat card)
            cursor.execute("""
                SELECT COUNT(*) FROM words WHERE analysis_source = 'COMPOUND_SPLIT'
            """)
            compound_split_total = cursor.fetchone()[0]

            # Custom_dict total (for stat card)
            cursor.execute("""
                SELECT COUNT(*) FROM words WHERE analysis_source = 'CUSTOM_DICT'
            """)
            custom_dict_total = cursor.fetchone()[0]

            # Build paginated word query
            caps_filter = "AND word ~ '^[A-ZÄÖÜ]+$'" if caps_only else ""
            cursor.execute(f"""
                SELECT COUNT(*) FROM words
                WHERE analysis_source = 'PATTERN_FALLBACK'
                  AND COALESCE(total_occurrences, 0) >= %s
                  {caps_filter}
            """, (min_occ,))
            total = cursor.fetchone()[0]

            offset = (page - 1) * per_page
            cursor.execute(f"""
                SELECT word, COALESCE(total_occurrences, 0) as total_occurrences,
                       pos_tag, gender,
                       (SELECT datum::text FROM protocols WHERE id = first_protocol_id) as first_date,
                       (word ~ '^[A-ZÄÖÜ]+$') as is_all_caps
                FROM words
                WHERE analysis_source = 'PATTERN_FALLBACK'
                  AND COALESCE(total_occurrences, 0) >= %s
                  {caps_filter}
                ORDER BY total_occurrences DESC, word ASC
                LIMIT %s OFFSET %s
            """, (min_occ, per_page, offset))

            words = []
            for row in cursor.fetchall():
                words.append({
                    'word': row[0],
                    'total_occurrences': row[1],
                    'pos_tag': row[2],
                    'gender': row[3],
                    'first_date': row[4],
                    'is_all_caps': bool(row[5]),
                })

            pages = max(1, (total + per_page - 1) // per_page)

            return {
                'source_breakdown': source_breakdown,
                'pattern_fallback_total': pattern_fallback_total,
                'all_caps_unrecognized': all_caps_unrecognized,
                'compound_split_total': compound_split_total,
                'custom_dict_total': custom_dict_total,
                'words': words,
                'total': total,
                'page': page,
                'pages': pages,
            }
    except Exception as e:
        logging.error(f"Error getting data quality stats: {e}")
        return {
            'source_breakdown': [], 'pattern_fallback_total': 0,
            'all_caps_unrecognized': 0, 'compound_split_total': 0,
            'custom_dict_total': 0, 'words': [], 'total': 0,
            'page': page, 'pages': 1,
        }


def get_log_tail(lines: int = 100) -> List[str]:
    """Get the last N lines from the application log."""
    try:
        log_file = Path(__file__).parent / "app.log"
        if not log_file.exists():
            return ["Log file not found. Logs will appear here once the application starts logging."]

        with open(log_file, 'r') as f:
            all_lines = f.readlines()
            if not all_lines:
                return ["Log file is empty. New log entries will appear here."]
            return all_lines[-lines:]
    except Exception as e:
        logging.error(f"Error reading log file: {e}")
        return [f"Error reading log: {str(e)}"]
