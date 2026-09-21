"""Example: run a query against the YesMadam ClickHouse database.

Usage:
    python fetch_data.py "SELECT 1"
"""

import sys

from client import get_client


def main():
    query = sys.argv[1] if len(sys.argv) > 1 else "SELECT 1"

    client = get_client()
    result = client.query(query)

    print(result.column_names)
    for row in result.result_rows:
        print(row)


if __name__ == "__main__":
    main()
