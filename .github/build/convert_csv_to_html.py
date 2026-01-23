#!/usr/bin/env python3
"""
Convert CSV files to HTML with Bootstrap styling.

Auto-discovers all CSV files in doc/identifiers/ and converts them to HTML pages.
Display names are generated from filenames by replacing underscores with spaces
and removing the .csv extension.

Usage:
    python convert_csv_to_html.py <output_directory>

Example:
    python convert_csv_to_html.py gitBranches/main/identifiers
"""

import pandas as pd
import os
import sys
import glob
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


def generate_display_name(filename):
    """
    Generate a display name from a CSV filename.

    Args:
        filename: CSV filename (e.g., "BackgroundDB_SourceDatasets_ecoinvent.csv")

    Returns:
        Display name (e.g., "BackgroundDB SourceDatasets ecoinvent")
    """
    # Remove .csv extension
    name = filename.replace('.csv', '')
    # Replace underscores with spaces
    name = name.replace('_', ' ')
    return name


def convert_csv_to_html(csv_path, output_dir):
    """
    Convert a single CSV file to an HTML page with Bootstrap styling.

    Args:
        csv_path: Path to the CSV file
        output_dir: Directory to write the HTML file
    """
    try:
        # Generate display name from filename
        filename = os.path.basename(csv_path)
        display_name = generate_display_name(filename)

        # Read CSV and convert to HTML table
        df = pd.read_csv(csv_path)
        html_table = df.to_html(
            index=False,
            classes='table table-striped',
            border=0,
            table_id=display_name
        )

        # Generate HTML filename
        html_filename = os.path.join(output_dir, filename.replace('.csv', '.html'))

        # Write HTML file with Bootstrap styling
        with open(html_filename, 'w') as f:
            f.write(f"""<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <title>{display_name}</title>
</head>
<body>
    <div class="container">
        <h1>{display_name}</h1>
        {html_table}
    </div>
</body>
</html>
""")

        logger.info(f"Converted {filename} -> {os.path.basename(html_filename)}")
    except FileNotFoundError as e:
        logger.error(f"File not found: {csv_path}")
        raise
    except pd.errors.EmptyDataError:
        logger.error(f"CSV file is empty: {csv_path}")
        raise
    except Exception as e:
        logger.error(f"Error converting {csv_path}: {e}")
        raise


def main():
    """Main entry point."""
    try:
        if len(sys.argv) != 2:
            logger.error("Usage: python convert_csv_to_html.py <output_directory>")
            return 1

        output_dir = sys.argv[1]

        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)

        # Auto-discover all CSV files in doc/identifiers/ (relative to repo root)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        repo_root = os.path.dirname(os.path.dirname(script_dir))
        csv_pattern = os.path.join(repo_root, "doc/identifiers/*.csv")
        csv_files = glob.glob(csv_pattern)

        if not csv_files:
            logger.warning(f"No CSV files found matching pattern: {csv_pattern}")
            return 0

        logger.info(f"Found {len(csv_files)} CSV file(s) to convert:")

        # Convert each CSV file to HTML
        for csv_path in sorted(csv_files):
            convert_csv_to_html(csv_path, output_dir)

        logger.info(f"All files converted successfully to: {output_dir}")
        return 0
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
