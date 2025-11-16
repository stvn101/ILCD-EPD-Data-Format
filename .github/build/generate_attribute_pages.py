import pandas as pd
import re
import html
import os
from urllib.parse import quote

# --- Constants ---
# Define base directories - Updated for .github/build/ location
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOC_DIR = os.path.join(BASE_DIR, 'doc')

# Ensure output directory exists
os.makedirs(DOC_DIR, exist_ok=True)

ADOC_SOURCE_FILE = os.path.join(DOC_DIR, 'asciidoc', 'ilcd-epd-v1.3.adoc')
PAGES_OUTPUT_DIR = os.path.join(DOC_DIR, 'attribute_pages')

# --- Data Loading and Parsing ---
def parse_asciidoc_table(filename):
    """Parses the main data table from an AsciiDoc file."""
    print(f"Reading data from {filename}...")
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
    cells = [c.strip() for c in re.findall(r'##(.*?)##', body_str, re.DOTALL)]
    
    num_columns = len(headers)
    
    if len(cells) % num_columns != 0:
        padding = num_columns - (len(cells) % num_columns)
        cells.extend([''] * padding)
        
    rows = [cells[i:i + num_columns] for i in range(0, len(cells), num_columns)]
    
    df = pd.DataFrame(rows, columns=headers)
    df.replace('{nbsp}', '', regex=True, inplace=True)
    
    if 'Indent' in df.columns:
        df['Indent'] = pd.to_numeric(df['Indent'], errors='coerce').fillna(0).astype(int)
    else:
        df['Indent'] = 0
        
    return df

def sanitize_filename(path):
    """Convert a path to a safe filename."""
    return re.sub(r'[^a-zA-Z0-9._-]', '_', str(path))

def generate_attribute_page(row_data, index):
    """Generate a Wiktionary-style page for a single attribute."""
    
    element_name = str(row_data.get('Element/Attribute Name', '')).replace('|&nbsp;&nbsp;', '').strip()
    path = str(row_data.get('Path', f'row_{index}'))
    
    page_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{html.escape(element_name)} - ILCD+EPD Attribute</title>
    <link rel="stylesheet" href="../css/style.css">
</head>
<body class="attribute-page show-both">
    <a href="javascript:history.back()" class="back-link">← Back</a>
    
    <div class="controls">
        <div class="lang-buttons">
            <button id="show-en-btn">Show English</button>
            <button id="show-de-btn">Show German</button>
            <button id="show-both-btn" class="active">Show Both</button>
        </div>
        <div class="download-buttons">
            <button id="download-csv-btn">Download as CSV</button>
            <button id="download-adoc-btn">Download as AsciiDoc</button>
        </div>
    </div>
    
    <div class="header">
        <h1>{html.escape(element_name)}</h1>
        <div class="path">Path: {html.escape(path)}</div>
    </div>
    
    <div class="content">
"""

    # Dynamically iterate over all fields in the row data
    for field_name, field_value in row_data.items():
        # Skip only internal fields and the name itself; include even empty values for visibility
        if field_name in ['Path', 'Indent', 'Element/Attribute Name']:
            continue

        # Normalize value to string and allow empty display
        if pd.isna(field_value):
            field_value_str = ''
        else:
            field_value_str = str(field_value).strip()

        # Handle boolean-like fields for better display
        if field_name in ['Technically Required']:
            if field_value_str.lower() in ['true', 'yes', '1']:
                field_value_str = 'Yes'
            elif field_value_str.lower() in ['false', 'no', '0']:
                field_value_str = 'No'

        # Prepare the field label, cleaning it and adding language indicators
        clean_field_name = field_name
        lang_indicator = ''
        field_class = 'field'
        
        if '(en)' in field_name:
            lang_indicator = ' <span class="lang-indicator">(English)</span>'
            clean_field_name = field_name.replace(' (en)', '').strip()
            field_class += ' lang-en'
        elif '(de)' in field_name:
            lang_indicator = ' <span class="lang-indicator">(German)</span>'
            clean_field_name = field_name.replace(' (de)', '').strip()
            field_class += ' lang-de'

        # Build field value HTML (list for multiline, placeholder for empty)
        if field_value_str and '\n' in field_value_str:
            items = field_value_str.split('\n')
            items_html = "<ul>" + "".join(f"<li>{html.escape(item.strip())}</li>" for item in items if item.strip()) + "</ul>"
            field_html = f'<div class="field-value">{items_html}</div>'
        elif field_value_str:
            field_html = f'<div class="field-value">{html.escape(field_value_str)}</div>'
        else:
            field_class += ' empty'
            field_html = '<div class="field-value">&mdash;</div>'

        # Add the field to the page content
        page_content += f"""
        <div class="{field_class}">
            <div class="field-label">{html.escape(clean_field_name)}{lang_indicator}</div>
            {field_html}
        </div>
"""

    page_content += """
    </div>
    
    <script src="../js/attribute_script.js"></script>
</body>
</html>
"""
    
    return page_content

def generate_all_attribute_pages(df):
    """Generate individual attribute pages for all rows in the DataFrame."""
    
    if not os.path.exists(PAGES_OUTPUT_DIR):
        os.makedirs(PAGES_OUTPUT_DIR)
        print(f"Created directory: {PAGES_OUTPUT_DIR}")
    
    generated_pages = []
    
    for index, row in df.iterrows():
        path = str(row.get('Path', f'row_{index}'))
        sanitized_path = sanitize_filename(path)
        
        page_content = generate_attribute_page(row, index)
        
        filename = f"{sanitized_path}.html"
        filepath = os.path.join(PAGES_OUTPUT_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(page_content)
        
        generated_pages.append({
            'path': path,
            'filename': filename,
            'filepath': filepath
        })
    
    return generated_pages

def generate_index_page(pages_info):
    """Generate an index page listing all attribute pages."""
    
    index_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ILCD+EPD v1.3 Attribute Pages Index</title>
    <link rel="stylesheet" href="../css/style.css">
</head>
<body class="attribute-page">
    <h1>ILCD+EPD v1.3 Attribute Pages</h1>
    
    <div class="controls">
        <div class="download-buttons">
            <button id="download-csv-btn">Download as CSV</button>
            <button id="download-adoc-btn">Download as AsciiDoc</button>
        </div>
    </div>
    
    <div class="pages-list">
        <p>Click on any attribute below to view its detailed information:</p>
"""

    for page_info in pages_info:
        index_content += f"""
        <a href="{html.escape(page_info['filename'])}" class="page-link" target="_blank">
            <div class="path">{html.escape(page_info['path'])}</div>
        </a>
"""

    index_content += """    </div>
    <script src="../js/attribute_script.js"></script>
</body>
</html>
"""
    
    index_filepath = os.path.join(PAGES_OUTPUT_DIR, 'index.html')
    with open(index_filepath, 'w', encoding='utf-8') as f:
        f.write(index_content)
    
    return index_filepath

# --- Main Execution ---
if __name__ == "__main__":
    try:
        # Parse the AsciiDoc data
        df = parse_asciidoc_table(ADOC_SOURCE_FILE)
        
        # Generate all attribute pages
        print("Generating individual attribute pages...")
        pages_info = generate_all_attribute_pages(df)
        
        # Generate index page
        print("Generating index page...")
        index_path = generate_index_page(pages_info)
        
        print(f"Successfully generated {len(pages_info)} attribute pages in '{PAGES_OUTPUT_DIR}' directory")
        print(f"Index page created at: {index_path}")
        print(f"Open '{os.path.join(PAGES_OUTPUT_DIR, 'index.html')}' to browse all pages")
        
    except (FileNotFoundError, ValueError, KeyError) as e:
        print(f"An error occurred: {e}")
