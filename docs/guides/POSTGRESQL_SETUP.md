# PostgreSQL Setup Guide

Complete guide to set up and migrate to PostgreSQL.

## Quick Start

### 1. Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Docker (Recommended for Testing):**
```bash
docker run --name bundestag-postgres \
  -e POSTGRES_USER=bundestag_user \
  -e POSTGRES_PASSWORD=bundestag_password \
  -e POSTGRES_DB=bundestag \
  -p 5432:5432 \
  -d postgres:14
```

### 2. Create Database and User

```bash
# Connect to PostgreSQL
psql postgres

# Create user and database
CREATE USER bundestag_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE bundestag OWNER bundestag_user;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE bundestag TO bundestag_user;

# Exit
\q
```

### 3. Configure Environment

Create `.env` file or export variables:

```bash
# .env file
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=bundestag
POSTGRES_USER=bundestag_user
POSTGRES_PASSWORD=your_secure_password
```

Or export:
```bash
export POSTGRES_HOST=localhost
export POSTGRES_DB=bundestag
export POSTGRES_USER=bundestag_user
export POSTGRES_PASSWORD=your_secure_password
```

### 4. Install Python Dependencies

```bash
# Add to pyproject.toml
uv add psycopg2-binary  # or psycopg2

# Install
uv sync
```

### 5. Initialize Schema

```bash
# Create tables and indexes
uv run python -c "from backend.database_postgresql import init_database; init_database()"
```

### 6. Migrate Data

```bash
# Run migration from SQLite
uv run python backend/migrate_to_postgresql.py
```

## Detailed Setup

### Local Development

**1. Install PostgreSQL**
```bash
# macOS
brew install postgresql@14
brew services start postgresql@14

# Add to PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@14/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**2. Create Database**
```bash
# Create user
createuser -s bundestag_user

# Create database
createdb -O bundestag_user bundestag

# Set password
psql bundestag -c "ALTER USER bundestag_user WITH PASSWORD 'your_password';"
```

**3. Initialize Schema**
```bash
# From SQL file
psql bundestag < backend/schema_postgresql.sql

# Or from Python
uv run python -c "from backend.database_postgresql import init_database; init_database()"
```

**4. Test Connection**
```bash
# Test from command line
psql bundestag -U bundestag_user -c "SELECT version();"

# Test from Python
uv run python backend/database_postgresql.py
```

### Production Deployment

#### Option 1: Managed PostgreSQL (Recommended)

**DigitalOcean:**
```bash
# Create database cluster
doctl databases create bundestag-db \
  --engine postgres \
  --version 14 \
  --region fra1 \
  --size db-s-1vcpu-1gb

# Get connection details
doctl databases connection bundestag-db
```

**AWS RDS:**
```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier bundestag-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 14.7 \
  --master-username bundestag_user \
  --master-user-password your_password \
  --allocated-storage 20
```

**Configuration:**
```bash
# Update environment
export POSTGRES_HOST=your-db.postgres.database.azure.com
export POSTGRES_DB=bundestag
export POSTGRES_USER=bundestag_user@your-db
export POSTGRES_PASSWORD=your_password
export POSTGRES_PORT=5432

# Enable SSL
export POSTGRES_SSLMODE=require
```

#### Option 2: Self-Hosted

**Docker Compose:**
```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_USER: bundestag_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: bundestag
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/schema_postgresql.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  pgbouncer:
    image: pgbouncer/pgbouncer
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_USER: bundestag_user
      DATABASES_PASSWORD: ${POSTGRES_PASSWORD}
      DATABASES_DBNAME: bundestag
    ports:
      - "6432:6432"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

Start:
```bash
docker-compose up -d
```

### Migration Process

**Step 1: Backup SQLite Database**
```bash
# Create backup
cp backend/bundestag.db backend/bundestag_backup_$(date +%Y%m%d).db

# Verify backup
sqlite3 backend/bundestag_backup_*.db "SELECT COUNT(*) FROM protocols"
```

**Step 2: Run Migration**
```bash
# Dry run (check only)
uv run python backend/migrate_to_postgresql.py --dry-run

# Full migration
uv run python backend/migrate_to_postgresql.py
```

**Step 3: Verify Migration**
```bash
# Compare counts
uv run python -c "
from backend.database import get_protocol_count as sqlite_count
from backend.database_postgresql import get_protocol_count as pg_count
print(f'SQLite: {sqlite_count()}')
print(f'PostgreSQL: {pg_count()}')
"
```

**Step 4: Update Application**
```python
# In backend/api.py, change import
# From:
from database import search_words, get_word_timeline

# To:
from database_postgresql import search_words, get_word_timeline
```

**Step 5: Test Application**
```bash
# Start backend with PostgreSQL
uv run uvicorn backend.api:app --reload

# Test endpoints
curl http://localhost:8000/api/words/search?q=bundes
curl http://localhost:8000/api/words/deutschland/timeline
```

## Performance Tuning

### PostgreSQL Configuration

Edit `postgresql.conf`:

```bash
# Find config file
psql -c "SHOW config_file"

# Edit configuration
vim /path/to/postgresql.conf
```

**Recommended Settings:**
```conf
# Memory
shared_buffers = 256MB          # 25% of RAM
effective_cache_size = 1GB      # 50-75% of RAM
work_mem = 16MB                 # Per query operation
maintenance_work_mem = 128MB    # For VACUUM, CREATE INDEX

# Query Planning
random_page_cost = 1.1          # For SSD
effective_io_concurrency = 200  # For SSD

# WAL
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# Autovacuum
autovacuum = on
autovacuum_max_workers = 3
```

Restart PostgreSQL:
```bash
brew services restart postgresql@14  # macOS
sudo systemctl restart postgresql    # Linux
```

### Analyze and Vacuum

```bash
# After initial data load
psql bundestag -c "VACUUM ANALYZE"

# Schedule regular maintenance
psql bundestag -c "VACUUM ANALYZE words"
psql bundestag -c "VACUUM ANALYZE word_occurrences"
```

### Monitor Performance

```bash
# Check slow queries
psql bundestag -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
"

# Check table sizes
psql bundestag -c "
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Check index usage
psql bundestag -c "
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
"
```

## Backup and Restore

### Automated Backups

**Daily Backup Script:**
```bash
#!/bin/bash
# backup_postgres.sh

BACKUP_DIR="/backups/bundestag"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="bundestag_${DATE}.sql.gz"

# Create backup
pg_dump bundestag | gzip > "${BACKUP_DIR}/${FILENAME}"

# Keep only last 7 days
find "${BACKUP_DIR}" -name "bundestag_*.sql.gz" -mtime +7 -delete

echo "Backup created: ${FILENAME}"
```

**Cron Job:**
```bash
# Add to crontab
crontab -e

# Daily at 2 AM
0 2 * * * /path/to/backup_postgres.sh
```

### Restore from Backup

```bash
# Decompress and restore
gunzip -c bundestag_20240208.sql.gz | psql bundestag

# Or direct restore
pg_restore -d bundestag backup.dump
```

## Monitoring

### pgAdmin (GUI)

**Install:**
```bash
# macOS
brew install --cask pgadmin4

# Or via Docker
docker run -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL=admin@example.com \
  -e PGADMIN_DEFAULT_PASSWORD=admin \
  -d dpage/pgadmin4
```

**Connect:**
- URL: http://localhost:5050
- Add server: localhost:5432
- Database: bundestag

### Command-Line Monitoring

**Check Connections:**
```bash
psql bundestag -c "
SELECT count(*) as connections,
       usename,
       state
FROM pg_stat_activity
GROUP BY usename, state;
"
```

**Check Database Size:**
```bash
psql bundestag -c "
SELECT pg_size_pretty(pg_database_size('bundestag'));
"
```

**Check Cache Hit Ratio:**
```bash
psql bundestag -c "
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
"
```

## Troubleshooting

### Connection Issues

**Error: "could not connect to server"**
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start if not running
brew services start postgresql@14

# Check port
lsof -i :5432
```

**Error: "password authentication failed"**
```bash
# Reset password
psql postgres -c "ALTER USER bundestag_user WITH PASSWORD 'new_password';"

# Update .env file
```

**Error: "database does not exist"**
```bash
# Create database
createdb bundestag -O bundestag_user
```

### Performance Issues

**Slow Queries:**
```bash
# Enable query logging
psql bundestag -c "ALTER SYSTEM SET log_min_duration_statement = 1000;"  # Log queries > 1s
psql bundestag -c "SELECT pg_reload_conf();"

# Check slow query log
tail -f /path/to/postgresql.log
```

**Missing Indexes:**
```bash
# Find missing indexes
psql bundestag -c "
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
ORDER BY n_distinct DESC;
"
```

### Migration Issues

**Data Mismatch:**
```bash
# Re-run verification
uv run python backend/migrate_to_postgresql.py --verify-only

# Check specific tables
psql bundestag -c "SELECT COUNT(*) FROM words"
sqlite3 backend/bundestag.db "SELECT COUNT(*) FROM words"
```

**Out of Memory:**
```bash
# Increase work_mem temporarily
psql bundestag -c "SET work_mem = '256MB';"

# Or in postgresql.conf
```

## Cost Estimates

### Managed PostgreSQL

**DigitalOcean:**
- Basic (1 GB RAM): $15/month
- Standard (4 GB RAM): $60/month
- High-performance (8 GB RAM): $120/month

**AWS RDS:**
- db.t3.micro (1 GB RAM): $15-20/month
- db.t3.small (2 GB RAM): $30-35/month
- db.t3.medium (4 GB RAM): $60-70/month

**Azure Database:**
- Basic (1 vCore): $20-25/month
- General Purpose (2 vCore): $80-90/month

### Self-Hosted

**VPS:**
- Hetzner (2 GB RAM): €5/month
- DigitalOcean (2 GB RAM): $12/month
- AWS EC2 t3.small: $15-20/month

**Plus:**
- Backup storage: $5-10/month
- Maintenance time: 2-4 hours/month

## Next Steps

1. **Test locally** with Docker
2. **Run migration** on development copy
3. **Verify data** integrity
4. **Performance test** with real queries
5. **Deploy to staging**
6. **Monitor for 1 week**
7. **Deploy to production**

See `POSTGRESQL_MIGRATION.md` for decision guide.
