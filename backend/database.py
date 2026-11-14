"""
PostgreSQL database module for Bundestag Word Tracker.
This module uses PostgreSQL as the only database backend.
"""
import os
from pathlib import Path

# Load .env file if it exists
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

# Import all PostgreSQL functions
from database_postgresql_impl import *

# Log database type
import logging
logging.info("Using PostgreSQL database")
