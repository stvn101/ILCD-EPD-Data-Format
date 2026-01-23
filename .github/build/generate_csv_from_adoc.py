import pandas as pd
import re
import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# --- Constants ---
# Define base directories - Updated for .github/build/ location
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOC_DIR = os.path.join(BASE_DIR, 'doc')

# Ensure output directory exists
os.makedirs(DOC_DIR, exist_ok=True)

ADOC_SOURCE_FILE = os.path.join(DOC_DIR, 'asciidoc', 'ilcd-epd-v1.3.adoc')
CSV_OUTPUT_FILE = os.path.join(DOC_DIR, 'ilcd-epd-v1.3.csv')

# --- Data Loading and Parsing ---
def parse_asciidoc_table(filename):
    """Parses the main data table from an AsciiDoc file."""
    logger.info(f"Reading data from {filename}...")
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    table_match = re.search(r'\.EPD Data Structure\n.*?\|===(.*?)(\|===)', content, re.DOTALL)
    if not table_match:
        raise ValueError("Could not find the '.EPD Data Structure' table in the AsciiDoc file.")

    table_content = table_match.group(1).strip()
    
    header_match = re.search(r'(\| \[role="title"\]##.*?##\n)+', table_content)
    if not header_match:
        raise ValueError("Could not parse the table header.")
        
    header_str = header_match.group(0)
    headers = [h.strip() for h in re.findall(r'##(.*?)##', header_str)]
    
    body_str = table_content[len(header_str):].strip()
    # Use re.DOTALL to handle multiline content within cells
    cells = [c.strip() for c in re.findall(r'##(.*?)##', body_str, re.DOTALL)]
    
    num_columns = len(headers)
    
    # Pad rows that are incomplete to avoid shape errors
    if len(cells) % num_columns != 0:
        padding = num_columns - (len(cells) % num_columns)
        cells.extend([''] * padding)
        
    rows = [cells[i:i + num_columns] for i in range(0, len(cells), num_columns)]
    
    df = pd.DataFrame(rows, columns=headers)
    
    # Clean up artifacts from AsciiDoc
    df.replace('{nbsp}', '', regex=True, inplace=True)
    
    return df

# --- Main Execution ---
def main():
    """Main entry point."""
    try:
        # 1. Parse the source AsciiDoc file
        df = parse_asciidoc_table(ADOC_SOURCE_FILE)

        # 2. Save the DataFrame to a CSV file
        df.to_csv(CSV_OUTPUT_FILE, index=False, encoding='utf-8-sig')

        logger.info(f"Successfully generated CSV file: {CSV_OUTPUT_FILE}")
        return 0

    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        return 1
    except ValueError as e:
        logger.error(f"Value error: {e}")
        return 1
    except KeyError as e:
        logger.error(f"Key error: {e}")
        return 1
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
