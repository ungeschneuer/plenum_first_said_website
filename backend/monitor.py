"""
System monitoring and analytics tools.
Provides insights into database health, performance, and usage patterns.
"""

import sqlite3
import time
import os
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json

from database import DB_PATH, get_connection


class SystemMonitor:
    """Monitor system health and performance."""

    @staticmethod
    def get_database_stats() -> Dict:
        """Get comprehensive database statistics."""
        conn = get_connection()
        cursor = conn.cursor()

        stats = {}

        # Basic counts
        cursor.execute("SELECT COUNT(*) FROM protocols")
        stats['total_protocols'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM protocols WHERE processed = 1")
        stats['processed_protocols'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM words")
        stats['total_unique_words'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM word_occurrences")
        stats['total_word_occurrences'] = cursor.fetchone()[0]

        # Database size
        stats['database_size_mb'] = os.path.getsize(DB_PATH) / (1024 * 1024)

        # Processing progress
        if stats['total_protocols'] > 0:
            stats['processing_progress'] = (stats['processed_protocols'] / stats['total_protocols']) * 100
        else:
            stats['processing_progress'] = 0

        # Date range
        cursor.execute("SELECT MIN(datum), MAX(datum) FROM protocols WHERE processed = 1")
        date_range = cursor.fetchone()
        stats['date_range_start'] = date_range[0]
        stats['date_range_end'] = date_range[1]

        # Wahlperioden
        cursor.execute("SELECT COUNT(DISTINCT wahlperiode) FROM protocols WHERE processed = 1")
        stats['wahlperioden_count'] = cursor.fetchone()[0]

        cursor.execute("""
            SELECT wahlperiode, COUNT(*) as count
            FROM protocols
            WHERE processed = 1
            GROUP BY wahlperiode
            ORDER BY wahlperiode DESC
        """)
        stats['protocols_by_wahlperiode'] = {
            row[0]: row[1] for row in cursor.fetchall()
        }

        conn.close()

        return stats

    @staticmethod
    def get_top_words(limit: int = 20) -> List[Dict]:
        """Get most frequently occurring words."""
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                w.word,
                SUM(wo.count) as total_count,
                COUNT(DISTINCT wo.protocol_id) as protocol_count,
                w.gender,
                w.pos_tag
            FROM words w
            JOIN word_occurrences wo ON w.word_id = wo.word_id
            GROUP BY w.word_id
            ORDER BY total_count DESC
            LIMIT ?
        """, (limit,))

        results = []
        for row in cursor.fetchall():
            results.append({
                'word': row[0],
                'total_count': row[1],
                'protocol_count': row[2],
                'gender': row[3],
                'pos_tag': row[4]
            })

        conn.close()
        return results

    @staticmethod
    def get_growth_statistics() -> Dict:
        """Get database growth statistics."""
        conn = get_connection()
        cursor = conn.cursor()

        stats = {}

        # New words per wahlperiode
        cursor.execute("""
            SELECT
                p.wahlperiode,
                COUNT(DISTINCT w.word_id) as new_words
            FROM words w
            JOIN protocols p ON w.first_protocol_id = p.id
            GROUP BY p.wahlperiode
            ORDER BY p.wahlperiode
        """)
        stats['new_words_by_wp'] = {
            row[0]: row[1] for row in cursor.fetchall()
        }

        # Cumulative growth
        cursor.execute("""
            SELECT
                p.datum as date,
                COUNT(DISTINCT w.word_id) as cumulative_words
            FROM words w
            JOIN protocols p ON w.first_protocol_id = p.id
            WHERE p.processed = 1
            GROUP BY p.datum
            ORDER BY p.datum
        """)

        cumulative = 0
        growth_data = []
        for row in cursor.fetchall():
            cumulative += row[1]
            growth_data.append({
                'date': row[0],
                'new_words': row[1],
                'cumulative_words': cumulative
            })

        stats['growth_timeline'] = growth_data

        conn.close()
        return stats

    @staticmethod
    def get_nlp_statistics() -> Dict:
        """Get NLP analysis statistics."""
        conn = get_connection()
        cursor = conn.cursor()

        stats = {}

        # Analysis sources
        cursor.execute("""
            SELECT analysis_source, COUNT(*) as count
            FROM words
            WHERE analysis_source IS NOT NULL
            GROUP BY analysis_source
            ORDER BY count DESC
        """)
        stats['analysis_sources'] = {
            row[0]: row[1] for row in cursor.fetchall()
        }

        # Confidence levels
        cursor.execute("""
            SELECT confidence, COUNT(*) as count
            FROM words
            WHERE confidence IS NOT NULL
            GROUP BY confidence
        """)
        stats['confidence_levels'] = {
            row[0]: row[1] for row in cursor.fetchall()
        }

        # Gender distribution
        cursor.execute("""
            SELECT gender, COUNT(*) as count
            FROM words
            WHERE gender IS NOT NULL
            GROUP BY gender
            ORDER BY count DESC
        """)
        stats['gender_distribution'] = {
            row[0]: row[1] for row in cursor.fetchall()
        }

        # POS tag distribution
        cursor.execute("""
            SELECT pos_tag, COUNT(*) as count
            FROM words
            WHERE pos_tag IS NOT NULL
            GROUP BY pos_tag
            ORDER BY count DESC
            LIMIT 10
        """)
        stats['pos_distribution'] = {
            row[0]: row[1] for row in cursor.fetchall()
        }

        # Compound words
        cursor.execute("SELECT COUNT(*) FROM words WHERE is_compound = 1")
        stats['compound_words_count'] = cursor.fetchone()[0]

        conn.close()
        return stats

    @staticmethod
    def get_cache_statistics() -> Dict:
        """Get cache usage statistics."""
        try:
            from cache import get_cache_info, get_cache_stats

            general_info = get_cache_info()
            detailed_stats = get_cache_stats()

            return {
                'total_entries': general_info['entries'],
                'total_size_bytes': general_info['size_bytes'],
                'functions_cached': general_info['functions'],
                'by_function': detailed_stats
            }
        except ImportError:
            return {'error': 'Cache module not available'}

    @staticmethod
    def get_index_statistics() -> Dict:
        """Get database index usage statistics."""
        conn = get_connection()
        cursor = conn.cursor()

        # Get list of indexes
        cursor.execute("""
            SELECT name, tbl_name, sql
            FROM sqlite_master
            WHERE type = 'index'
            AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        """)

        indexes = []
        for row in cursor.fetchall():
            indexes.append({
                'name': row[0],
                'table': row[1],
                'definition': row[2]
            })

        conn.close()

        return {
            'total_indexes': len(indexes),
            'indexes': indexes
        }

    @staticmethod
    def generate_report(output_file: Optional[str] = None) -> str:
        """Generate comprehensive system report."""
        report = []

        report.append("=" * 80)
        report.append("BUNDESTAG WORD TRACKER - SYSTEM REPORT")
        report.append("=" * 80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")

        # Database statistics
        report.append("DATABASE STATISTICS")
        report.append("-" * 80)
        db_stats = SystemMonitor.get_database_stats()
        report.append(f"Total protocols: {db_stats['total_protocols']:,}")
        report.append(f"Processed protocols: {db_stats['processed_protocols']:,}")
        report.append(f"Processing progress: {db_stats['processing_progress']:.1f}%")
        report.append(f"Total unique words: {db_stats['total_unique_words']:,}")
        report.append(f"Total word occurrences: {db_stats['total_word_occurrences']:,}")
        report.append(f"Database size: {db_stats['database_size_mb']:.2f} MB")
        report.append(f"Date range: {db_stats['date_range_start']} to {db_stats['date_range_end']}")
        report.append(f"Wahlperioden: {db_stats['wahlperioden_count']}")
        report.append("")

        # Top words
        report.append("TOP 10 MOST FREQUENT WORDS")
        report.append("-" * 80)
        top_words = SystemMonitor.get_top_words(limit=10)
        for i, word_data in enumerate(top_words, 1):
            report.append(f"{i:2d}. {word_data['word']:<20} {word_data['total_count']:>10,} occurrences")
        report.append("")

        # NLP statistics
        report.append("NLP ANALYSIS STATISTICS")
        report.append("-" * 80)
        nlp_stats = SystemMonitor.get_nlp_statistics()

        report.append("Analysis Sources:")
        for source, count in nlp_stats['analysis_sources'].items():
            percentage = (count / db_stats['total_unique_words']) * 100
            report.append(f"  {source:<20} {count:>10,} ({percentage:>5.1f}%)")

        report.append("\nGender Distribution:")
        for gender, count in nlp_stats['gender_distribution'].items():
            report.append(f"  {gender:<20} {count:>10,}")

        report.append(f"\nCompound words: {nlp_stats['compound_words_count']:,}")
        report.append("")

        # Cache statistics
        report.append("CACHE STATISTICS")
        report.append("-" * 80)
        cache_stats = SystemMonitor.get_cache_statistics()
        if 'error' not in cache_stats:
            report.append(f"Total entries: {cache_stats['total_entries']}")
            report.append(f"Total size: {cache_stats['total_size_bytes']:,} bytes")
            report.append(f"Functions cached: {cache_stats['functions_cached']}")
        else:
            report.append("Cache not available")
        report.append("")

        # Index statistics
        report.append("INDEX STATISTICS")
        report.append("-" * 80)
        index_stats = SystemMonitor.get_index_statistics()
        report.append(f"Total indexes: {index_stats['total_indexes']}")
        report.append("")

        report.append("=" * 80)

        # Save to file if requested
        report_text = "\n".join(report)

        if output_file:
            with open(output_file, 'w') as f:
                f.write(report_text)
            print(f"Report saved to: {output_file}")

        return report_text


def clear_screen():
    """Clear terminal screen safely."""
    # Use ANSI escape codes instead of os.system
    print('\033[2J\033[H', end='')


def print_dashboard():
    """Print real-time dashboard."""
    monitor = SystemMonitor()

    while True:
        clear_screen()

        print("=" * 80)
        print("BUNDESTAG WORD TRACKER - LIVE DASHBOARD")
        print("=" * 80)
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        # Get stats
        db_stats = monitor.get_database_stats()

        # Display key metrics
        print("KEY METRICS")
        print("-" * 80)
        print(f"Protocols:    {db_stats['processed_protocols']:>6,} / {db_stats['total_protocols']:<6,} ({db_stats['processing_progress']:>5.1f}%)")
        print(f"Unique Words: {db_stats['total_unique_words']:>10,}")
        print(f"Occurrences:  {db_stats['total_word_occurrences']:>10,}")
        print(f"Database:     {db_stats['database_size_mb']:>10.2f} MB")
        print()

        # Processing progress bar
        progress = int(db_stats['processing_progress'])
        bar_length = 50
        filled = int(bar_length * progress / 100)
        bar = '█' * filled + '░' * (bar_length - filled)
        print(f"Progress: [{bar}] {progress}%")
        print()

        # Top words
        print("TOP 5 WORDS")
        print("-" * 80)
        top_words = monitor.get_top_words(limit=5)
        for i, word_data in enumerate(top_words, 1):
            print(f"{i}. {word_data['word']:<20} {word_data['total_count']:>10,}")
        print()

        print("Press Ctrl+C to exit")
        print("=" * 80)

        try:
            time.sleep(5)
        except KeyboardInterrupt:
            print("\nExiting...")
            break


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "report":
            # Generate report
            output_file = sys.argv[2] if len(sys.argv) > 2 else None
            report = SystemMonitor.generate_report(output_file)
            print(report)

        elif command == "dashboard":
            # Show live dashboard
            print_dashboard()

        elif command == "stats":
            # Show quick stats
            stats = SystemMonitor.get_database_stats()
            print(json.dumps(stats, indent=2))

        elif command == "top":
            # Show top words
            limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20
            words = SystemMonitor.get_top_words(limit)
            for i, word in enumerate(words, 1):
                print(f"{i:3d}. {word['word']:<25} {word['total_count']:>10,} occurrences")

        else:
            print(f"Unknown command: {command}")
            print("\nUsage:")
            print("  python monitor.py report [output_file]")
            print("  python monitor.py dashboard")
            print("  python monitor.py stats")
            print("  python monitor.py top [limit]")
    else:
        print("System Monitor")
        print("=" * 80)
        print("\nUsage:")
        print("  python monitor.py report [output_file]  - Generate comprehensive report")
        print("  python monitor.py dashboard             - Show live dashboard")
        print("  python monitor.py stats                 - Show quick statistics")
        print("  python monitor.py top [limit]           - Show top words")
