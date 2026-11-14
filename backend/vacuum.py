"""Optimize database with VACUUM and ANALYZE."""
import sqlite3
import logging
from database import DB_PATH
import os

logging.basicConfig(level=logging.INFO)

def optimize():
    # Get database size before
    size_before = os.path.getsize(DB_PATH) / (1024 * 1024)  # MB

    print("=" * 80)
    print("Database Optimization")
    print("=" * 80)
    print(f"\nDatabase: {DB_PATH}")
    print(f"Size before: {size_before:.2f} MB")

    conn = sqlite3.connect(DB_PATH)

    print("\n1. Running VACUUM (may take a few minutes)...")
    print("   This reclaims unused space and defragments the database...")
    conn.execute("VACUUM")

    print("\n2. Running ANALYZE...")
    print("   This updates query planner statistics...")
    conn.execute("ANALYZE")

    conn.close()

    # Get database size after
    size_after = os.path.getsize(DB_PATH) / (1024 * 1024)  # MB
    saved = size_before - size_after

    print("\n" + "=" * 80)
    print("Database Optimization Complete!")
    print("=" * 80)
    print(f"Size after: {size_after:.2f} MB")
    if saved > 0:
        print(f"Space saved: {saved:.2f} MB ({(saved/size_before)*100:.1f}%)")
    else:
        print("No space to reclaim (database was already optimized)")
    print("\nQuery performance should now be improved!")

if __name__ == "__main__":
    optimize()
