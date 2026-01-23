"""
Generate individual attribute pages for schemadoc documentation.

Each row in the schemadoc table gets its own detailed page.
"""

import pandas as pd
import re
import html
import os
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

# Columns to display on attribute pages
DISPLAY_COLUMNS = [
    'Field Name',
    'Element/Attribute Name',
    'Requ.',
    'Occ.',
    'Datatype',
    'Definition',
    'eDoc ID',
    'Path',
]


def parse_asciidoc_table(filename):
    """Parses the main data table from an AsciiDoc file."""
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

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


def sanitize_filename(path):
    """Create a safe filename from a path."""
    return re.sub(r'[^a-zA-Z0-9._-]', '_', path)


def generate_attribute_page(row, doc_title, all_rows_df, base_name=None):
    """Generate HTML for a single attribute page."""
    
    path = row.get('Path', '')
    field_name = row.get('Field Name', '')
    element_name = row.get('Element/Attribute Name', '').strip()
    
    # Use base_name for back link if provided, otherwise sanitize doc_title
    back_link_file = base_name if base_name else sanitize_filename(doc_title)
    
    # Build breadcrumb from path
    path_parts = path.split('/') if path else []
    breadcrumb_html = ""
    if path_parts:
        crumbs = []
        accumulated_path = ""
        for part in path_parts[:-1]:
            accumulated_path = f"{accumulated_path}/{part}" if accumulated_path else part
            safe_path = sanitize_filename(accumulated_path)
            crumbs.append(f'<a href="{safe_path}.html">{html.escape(part)}</a>')
        if crumbs:
            breadcrumb_html = " / ".join(crumbs) + f" / <strong>{html.escape(path_parts[-1])}</strong>"
        else:
            breadcrumb_html = f"<strong>{html.escape(path_parts[-1] if path_parts else element_name)}</strong>"
    
    # Build fields HTML
    fields_html = ""
    for col in DISPLAY_COLUMNS:
        value = row.get(col, '')
        if not value or value == '{nbsp}':
            value = '<span class="empty">-</span>'
        else:
            # Handle links in Datatype
            if col == 'Datatype' and 'link:' in str(value):
                link_match = re.match(r'link:([^\[]+)\[([^\]]+)\]', value)
                if link_match:
                    href, text = link_match.groups()
                    value = f'<a href="../{html.escape(href)}" target="_blank">{html.escape(text)}</a>'
                else:
                    value = html.escape(str(value))
            else:
                value = html.escape(str(value))
        
        fields_html += f"""
        <div class="field-row">
            <div class="field-label">{html.escape(col)}</div>
            <div class="field-value">{value}</div>
        </div>"""
    
    # Find child elements
    children_html = ""
    if path:
        children = all_rows_df[all_rows_df['Path'].str.startswith(path + '/') & 
                               (all_rows_df['Path'].str.count('/') == path.count('/') + 1)]
        if len(children) > 0:
            children_html = "<div class='children-section'><h2>Child Elements</h2><ul class='children-list'>"
            for _, child in children.iterrows():
                child_path = child.get('Path', '')
                child_name = child.get('Element/Attribute Name', '').strip()
                child_field = child.get('Field Name', '')
                safe_child_path = sanitize_filename(child_path)
                children_html += f'<li><a href="{safe_child_path}.html">{html.escape(child_name)}</a> - {html.escape(child_field)}</li>'
            children_html += "</ul></div>"
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{html.escape(element_name)} - {html.escape(doc_title)}</title>
    <link rel="stylesheet" href="../css/style.css">
    <style>
        body.attribute-page {{
            max-width: 900px;
            margin: 20px auto;
        }}
        .attribute-page-container {{
            background-color: #fff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }}
        .back-link {{ margin-bottom: 20px; }}
        .back-link a {{ color: #007bff; text-decoration: none; font-weight: 500; }}
        .back-link a:hover {{ text-decoration: underline; }}
        .breadcrumb {{ margin-bottom: 20px; color: #666; font-size: 0.95em; }}
        .breadcrumb a {{ color: #007bff; text-decoration: none; }}
        .breadcrumb a:hover {{ text-decoration: underline; }}
        .field-name-display {{ color: #666; font-size: 0.95em; margin-bottom: 20px; }}
        h1 {{ margin-top: 0; margin-bottom: 10px; color: #2c3e50; }}
        .attribute-details {{ margin-top: 30px; }}
        .field-row {{ display: flex; border-bottom: 1px solid #eee; padding: 15px 0; }}
        .field-row:last-child {{ border-bottom: none; }}
        .field-label {{ width: 200px; font-weight: bold; color: #333; flex-shrink: 0; }}
        .field-value {{ flex: 1; color: #555; word-break: break-word; }}
        .empty {{ color: #999; font-style: italic; }}
        .children-section {{ margin-top: 40px; padding-top: 30px; border-top: 2px solid #eee; }}
        .children-section h2 {{ margin-top: 0; color: #2c3e50; }}
        .children-list {{ list-style-type: none; padding-left: 0; }}
        .children-list li {{ padding: 8px 0; }}
        .children-list a {{ color: #007bff; text-decoration: none; }}
        .children-list a:hover {{ text-decoration: underline; }}
    </style>
</head>
<body class="attribute-page">
    <div class="attribute-page-container">
        <div class="back-link"><a href="../{back_link_file}.html">&larr; Back to {html.escape(doc_title)}</a></div>
        <div class="breadcrumb">Path: {breadcrumb_html}</div>
        <h1>{html.escape(element_name)}</h1>
        <p class="field-name-display"><em>{html.escape(field_name)}</em></p>
        
        <div class="attribute-details">
            {fields_html}
        </div>
        
        {children_html if children_html else ''}
    </div>
    
    <script src="../js/schemadoc_script.js"></script>
</body>
</html>
"""
    return html_content


def process_single_file(adoc_path, output_base_dir):
    """Process a single AsciiDoc file and generate attribute pages."""
    try:
        df = parse_asciidoc_table(adoc_path)
        doc_title = extract_title_from_adoc(adoc_path)
        
        # Create output directory for attribute pages
        base_name = os.path.splitext(os.path.basename(adoc_path))[0]
        output_dir = os.path.join(output_base_dir, 'attribute_pages')
        os.makedirs(output_dir, exist_ok=True)
        
        page_count = 0
        for idx, row in df.iterrows():
            path = row.get('Path', '')
            if not path:
                continue
            
            safe_filename = sanitize_filename(path) + '.html'
            output_path = os.path.join(output_dir, safe_filename)
            
            # Pass base_name for the back link
            html_content = generate_attribute_page(row, doc_title, df, base_name)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            page_count += 1
        
        print(f"  Generated {page_count} attribute pages")
        return True
    except Exception as e:
        print(f"  Error: {e}")
        return False


def main():
    """Main function to generate attribute pages for all schemadoc files."""
    try:
        # Check if source directory exists
        if not os.path.exists(DATA_DIR):
            logger.error(f"Source directory not found: {DATA_DIR}")
            return 1

        # Get list of AsciiDoc files
        adoc_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.adoc')]

        logger.info(f"Found {len(adoc_files)} AsciiDoc files")
        logger.info(f"Output directory: {OUTPUT_DIR}")

        # Process each file
        success_count = 0
        for adoc_file in sorted(adoc_files):
            adoc_path = os.path.join(DATA_DIR, adoc_file)
            logger.info(f"Processing: {adoc_file}")
            if process_single_file(adoc_path, OUTPUT_DIR):
                success_count += 1

        logger.info(f"Successfully processed {success_count}/{len(adoc_files)} files")
        return 0 if success_count == len(adoc_files) else 1

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
