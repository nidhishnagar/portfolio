# YesMadam ClickHouse Connector

A small script for pulling data from the YesMadam ClickHouse database.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
# fill in .env with real ClickHouse host/port/user/password/database
```

## Usage

```bash
python fetch_data.py "SELECT * FROM your_table LIMIT 10"
```

Connection details are read from environment variables (`.env`, not committed).
See `.env.example` for the required variables.
