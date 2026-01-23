"""
Generate interactive HTML documentation from schemadoc AsciiDoc files.

This script parses AsciiDoc files and generates interactive HTML pages
with search, column toggles, and attribute detail page links.
"""

import pandas as pd
import re
import html
import os
import shutil
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# --- Constants ---
# Define base directories - Updated for .github/build/ location
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOC_DIR = os.path.join(BASE_DIR, 'doc')
DATA_DIR = os.path.join(DOC_DIR, 'asciidoc', 'schemadoc_adoc')
OUTPUT_DIR = os.path.join(DOC_DIR, 'schemadoc')

# Columns to display in the HTML report
PRESENTATION_COLUMNS = [
    'Field Name',
    'Element/Attribute Name',
    'Requ.',
    'Occ.',
    'Datatype',
    'Definition',
    'eDoc ID',
]


def parse_asciidoc_table(filename):
    """Parses the main data table from an AsciiDoc file."""
    logger.info(f"  Reading data from {filename}...")
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the table - look for ".* Data Structure" pattern
    table_match = re.search(r'\.[^\n]+ Data Structure\n.*?\|===(.*?)(\|===)', content, re.DOTALL)
    if not table_match:
        raise ValueError(f"Could not find the Data Structure table in {filename}")

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


def extract_title_from_adoc(filename):
    """Extract the document title from the AsciiDoc file."""
    with open(filename, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('= '):
                return line[2:].strip().replace(' Documentation', '')
    return os.path.basename(filename).replace('.adoc', '')


def generate_html_report(df_source, presentation_columns, title):
    """Generates the final interactive HTML report from the DataFrame."""
    
    df_presentation = pd.DataFrame(index=df_source.index)

    for col_name in presentation_columns:
        if col_name == 'Element/Attribute Name':
            # Use a placeholder that won't be escaped
            indentation = df_source['Indent'].apply(lambda x: '[[INDENT]]' * x) if 'Indent' in df_source.columns else ''
            values = df_source.get(col_name, '').astype(str)
            df_presentation[col_name] = indentation + values
        else:
            df_presentation[col_name] = df_source.get(col_name, '')

    # --- Build HTML ---
    def get_col_class(col_name):
        return ''

    # Create Table Header HTML
    header_html = "<thead><tr>"
    header_html += '<th data-col="View Attribute">View Attribute</th>'
    for col in presentation_columns:
        col_class = get_col_class(col)
        header_html += f'<th class="{col_class}" data-col="{html.escape(col)}">{html.escape(col)}</th>'
    header_html += "</tr></thead>"

    # Create column toggle checkboxes
    checkboxes_html = ""
    for col in presentation_columns:
        col_id = f"toggle-{col.replace(' ', '-').replace('.', '').replace('(', '').replace(')', '')}"
        checkboxes_html += f'<label for="{col_id}"><input type="checkbox" id="{col_id}" data-col="{html.escape(col)}" checked>{html.escape(col)}</label>'

    # Create Table Body HTML
    body_html = "<tbody>"
    for idx, row in df_presentation.iterrows():
        path = df_source.at[idx, 'Path'] if 'Path' in df_source.columns else ''
        path_tooltip = html.escape(str(path))
        attribute_path = str(path).replace('/', '_')
        
        body_html += f'<tr data-tooltip="{path_tooltip}">'
        
        # Add "View Attribute" button
        body_html += f'<td data-col="View Attribute">'
        body_html += f'<button class="view-attr-btn" onclick="openAttributePage(\'{html.escape(attribute_path)}\')" title="View detailed information">View Attribute</button>'
        body_html += f'</td>'
        
        for col in presentation_columns:
            cell_value = str(row.get(col, ''))
            col_class = get_col_class(col)
            
            # Handle links in Datatype column
            if col == 'Datatype' and 'link:' in cell_value:
                # Convert AsciiDoc link to HTML link
                link_match = re.match(r'link:([^\[]+)\[([^\]]+)\]', cell_value)
                if link_match:
                    href, text = link_match.groups()
                    cell_value = f'<a href="{html.escape(href)}" target="_blank">{html.escape(text)}</a>'
                else:
                    cell_value = html.escape(cell_value)
            elif col == 'Element/Attribute Name':
                # Don't escape, but replace placeholder with actual nbsp
                cell_value = cell_value.replace('[[INDENT]]', '&nbsp;&nbsp;&nbsp;&nbsp;')
            else:
                cell_value = html.escape(cell_value)
            
            body_html += f'<td class="{col_class}" data-col="{html.escape(col)}">{cell_value}</td>'
        body_html += "</tr>"
    body_html += "</tbody>"

    html_table = f'<table id="report-table">{header_html}{body_html}</table>'

    # --- Final HTML Document ---
    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{html.escape(title)}</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <h1>{html.escape(title)}</h1>
    <div class="controls">
        <input type="text" id="search-bar" placeholder="Search by Name, Path, or Definition...">
        <div class="download-buttons">
            <button id="download-csv-btn">Download CSV</button>
            <button id="download-adoc-btn">Download AsciiDoc</button>
        </div>
        <div class="view-options">
            <button id="toggle-stripes-btn">Toggle Stripes</button>
        </div>
        <div class="col-toggles">{checkboxes_html}
    </div>
    </div>
    {html_table}
    <script src="js/schemadoc_script.js"></script>
</body>
</html>
"""
    return html_template


def process_single_file(adoc_path, output_dir):
    """Process a single AsciiDoc file and generate HTML."""
    try:
        df = parse_asciidoc_table(adoc_path)
        title = extract_title_from_adoc(adoc_path)
        
        html_content = generate_html_report(df, PRESENTATION_COLUMNS, title)
        
        # Generate output filename
        base_name = os.path.splitext(os.path.basename(adoc_path))[0]
        output_path = os.path.join(output_dir, f"{base_name}.html")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"  Generated: {output_path}")
        return True
    except Exception as e:
        print(f"  Error processing {adoc_path}: {e}")
        return False


def main():
    """Main function to process all schemadoc AsciiDoc files."""
    try:
        # Create output directories
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        os.makedirs(os.path.join(OUTPUT_DIR, 'css'), exist_ok=True)
        os.makedirs(os.path.join(OUTPUT_DIR, 'js'), exist_ok=True)
        os.makedirs(os.path.join(OUTPUT_DIR, 'attribute_pages'), exist_ok=True)
        os.makedirs(os.path.join(OUTPUT_DIR, 'data'), exist_ok=True)

        # Check if source directory exists
        if not os.path.exists(DATA_DIR):
            logger.error(f"Source directory not found: {DATA_DIR}")
            return 1

        # Get list of AsciiDoc files
        adoc_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.adoc')]

        logger.info(f"Found {len(adoc_files)} AsciiDoc files in {DATA_DIR}")
        logger.info(f"Output directory: {OUTPUT_DIR}")

        # Process each file
        success_count = 0
        for adoc_file in sorted(adoc_files):
            adoc_path = os.path.join(DATA_DIR, adoc_file)
            logger.info(f"Processing: {adoc_file}")
            if process_single_file(adoc_path, OUTPUT_DIR):
                success_count += 1

        logger.info(f"Successfully processed {success_count}/{len(adoc_files)} files")

        # Copy CSS from build folder
        logger.info("Copying CSS file...")
        build_dir = os.path.dirname(os.path.abspath(__file__))
        src_css = os.path.join(build_dir, 'css', 'style.css')
        if os.path.exists(src_css):
            shutil.copy(src_css, os.path.join(OUTPUT_DIR, 'css', 'style.css'))
            logger.info("  Copied: style.css")

        # Copy schemadoc JS from build folder
        logger.info("Copying JS file...")
        src_js = os.path.join(build_dir, 'js', 'schemadoc_script.js')
        if os.path.exists(src_js):
            shutil.copy(src_js, os.path.join(OUTPUT_DIR, 'js', 'schemadoc_script.js'))
            logger.info("  Copied: schemadoc_script.js")

        # Copy AsciiDoc source files to data folder for downloads
        logger.info("Copying AsciiDoc source files for download...")
        for adoc_file in adoc_files:
            src = os.path.join(DATA_DIR, adoc_file)
            dst = os.path.join(OUTPUT_DIR, 'data', adoc_file)
            shutil.copy(src, dst)
            logger.info(f"  Copied: {adoc_file}")

        logger.info("Done!")
        return 0

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
