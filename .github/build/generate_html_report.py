import pandas as pd
import re
import html
import os

# --- Constants ---
# Define base directories - Updated for .github/build/ location
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOC_DIR = os.path.join(BASE_DIR, 'doc')

# Ensure output directory exists
os.makedirs(DOC_DIR, exist_ok=True)
os.makedirs(os.path.join(DOC_DIR, 'css'), exist_ok=True)
os.makedirs(os.path.join(DOC_DIR, 'js'), exist_ok=True)

ADOC_SOURCE_FILE = os.path.join(DOC_DIR, 'asciidoc', 'ilcd-epd-v1.3.adoc')
HTML_OUTPUT_FILE = os.path.join(DOC_DIR, 'index.html')

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

# --- HTML Generation ---


def generate_html_report(df_source, presentation_columns, column_map):
    """Generates the final interactive HTML report from the DataFrame."""
    # Create a new DataFrame for presentation, ensuring it's a copy.
    # It will be built column-by-column in the correct, final order.
    df_presentation = pd.DataFrame(index=df_source.index)

    # Build the presentation dataframe column-by-column, strictly following the presentation_columns list.
    for col_name in presentation_columns:
        source_col_name = column_map.get(col_name, col_name)

        # For the special 'Element/Attribute Name' column, add the indentation.
        if col_name == 'Element/Attribute Name':
            # Use better characters for the tree structure
            indentation = df_source['Indent'].apply(lambda x: '&nbsp;&nbsp;&nbsp;&nbsp;' * x) if 'Indent' in df_source.columns else ''
            values = df_source.get(source_col_name, '').astype(str)
            df_presentation[col_name] = indentation + values

        # For all other columns, just copy the data.
        else:
            df_presentation[col_name] = df_source.get(source_col_name, '')

    # --- Build HTML Manually for Interactivity ---
    def get_col_class(col_name):
        if col_name == 'Original ILCD Format Definition (en)':
            return ''  # Always visible
        if '(de)' in col_name: return 'lang-de'
        if '(en)' in col_name: return 'lang-en'
        return ''

    def detect_enum_groups(df):
        """Detect groups of rows that represent enum values for the same field.
        Returns a list of (start_idx, end_idx, enum_header) tuples.
        """
        enum_groups = []
        i = 0
        while i < len(df):
            # Look ahead for enum value rows (start with single letters like "A - ", "B - ")
            if i + 1 < len(df):
                next_datatype = str(df.iloc[i + 1].get('Datatype', '')).strip()
                if re.match(r'^[A-Z] - ', next_datatype):
                    # Found start of an enum group, this row is the header
                    start_idx = i
                    enum_header_element = str(df.iloc[i].get('Element/Attribute Name', '')).strip()
                    enum_header_datatype = str(df.iloc[i].get('Datatype', '')).strip()
                    
                    # Use element name as header if available, otherwise use datatype
                    enum_header = enum_header_element if enum_header_element else enum_header_datatype
                    
                    # Look ahead for all enum value rows
                    j = i + 1
                    while j < len(df):
                        curr_datatype = str(df.iloc[j].get('Datatype', '')).strip()
                        # Check if this looks like an enum value (single letter followed by " - ")
                        if re.match(r'^[A-Z] - ', curr_datatype):
                            j += 1
                        else:
                            break
                    
                    if j > i + 1:  # Found at least one enum value
                        enum_groups.append((start_idx, j - 1, enum_header))
                        i = j
                    else:
                        i += 1
                else:
                    i += 1
            else:
                i += 1
        return enum_groups

    def format_cell_html(col_name, value_str, is_definitions_identical=False):
        """Format cell content for regular (non-enum) cells."""
        if value_str is None:
            return ''
        
        # Escape HTML special characters
        escaped_value = html.escape(str(value_str))
        
        # Apply gray styling to Original ILCD Format Definition when identical to Definition
        if col_name == 'Original ILCD Format Definition (en)' and is_definitions_identical:
            return f'<span class="gray-definition">{escaped_value}</span>'
        
        return escaped_value

    # Create Checkboxes HTML with improved logic
    def should_be_togglable(col_name):
        # Essential columns that should never be hidden
        essential_cols = ['Element/Attribute Name']
        if col_name in essential_cols:
            return False
        # Always visible columns (like the English definition) should not be togglable
        if col_name == 'Original ILCD Format Definition (en)':
            return False
        return True
    
    checkboxes_html = ""
    for col in presentation_columns:
        if should_be_togglable(col):
            col_id = f"toggle-{col.replace(' ', '-').replace('(', '').replace(')', '')}"
            col_class = get_col_class(col)  # Reuse the language class logic
            checked_attr = "checked"  # Default to checked
            checkboxes_html += f'<label for="{col_id}" class="{col_class}"><input type="checkbox" id="{col_id}" data-col="{html.escape(col)}" {checked_attr}>{html.escape(col)}</label>'

    # Create Table Header HTML - Add "View Attribute" column first, then presentation_columns
    header_html = "<thead><tr>"
    header_html += '<th data-col="View Attribute">View Attribute</th>'  # New column
    for col in presentation_columns:
        col_class = get_col_class(col)
        header_html += f'<th class="{col_class}" data-col="{html.escape(col)}">{html.escape(col)}</th>'
    header_html += "</tr></thead>"

    # Detect enum groups in the source data
    enum_groups = detect_enum_groups(df_source)
    
    # Create Table Body HTML with enum grouping
    body_html = "<tbody>"
    skip_until = -1  # Track rows to skip because they're part of an enum group
    
    for index, row in df_presentation.iterrows():
        if index <= skip_until:
            continue  # Skip this row as it's part of an enum group
            
        path_tooltip = html.escape(str(df_source.loc[index, 'Path'])) if 'Path' in df_source.columns else ''
        attribute_path = str(df_source.loc[index, 'Path']) if 'Path' in df_source.columns else f'row_{index}'
        
        # Check if definitions are identical for this row (for gray styling)
        # The flag must be read from the original df_source using the current row's index.
        is_definitions_identical = str(df_source.loc[index].get('_definitions_identical', 'False')) == 'True'
        
        # Check if this row starts an enum group
        enum_group = next((g for g in enum_groups if g[0] == index), None)
        
        body_html += f'<tr data-tooltip="{path_tooltip}">'
        
        # Add "View Attribute" button column first
        body_html += f'<td data-col="View Attribute">'
        body_html += f'<button class="view-attr-btn" onclick="openAttributePage(\'{html.escape(attribute_path)}\')" title="View detailed information for this attribute">View Attribute</button>'
        body_html += f'</td>'
        
        # Then add all the regular columns
        for col in presentation_columns:
            col_class = get_col_class(col)
            cell_value = str(row[col]) if pd.notna(row[col]) else ''
            
            # Special handling for enum groups in Datatype column
            if col == 'Datatype' and enum_group:
                start_idx, end_idx, enum_header = enum_group
                # Combine the enum header with all enum values as a list
                enum_values = []
                for enum_idx in range(start_idx + 1, end_idx + 1):
                    enum_val = str(df_source.iloc[enum_idx].get('Datatype', '')).strip()
                    if enum_val:
                        enum_values.append(enum_val)
                
                if enum_values:
                    list_html = ''.join(f'<li>{html.escape(val)}</li>' for val in enum_values)
                    # Show the original datatype value as header, then the enum list
                    header_text = html.escape(cell_value) if cell_value.strip() else "Enumeration:"
                    formatted = f"{header_text}<ul>{list_html}</ul>"
                else:
                    formatted = html.escape(cell_value)
                
                body_html += f'<td class="{col_class}" data-col="{html.escape(col)}">{formatted}</td>'
                skip_until = end_idx  # Skip the enum value rows
            # Special handling for 'Element/Attribute Name' column to add tooltip
            elif col == 'Element/Attribute Name':
                body_html += f'<td class="{col_class}" data-col="{html.escape(col)}">'
                body_html += f'<div class="tooltip-wrapper">'
                body_html += cell_value  # This already includes indentation from above
                body_html += f'<span class="tooltip-text">{path_tooltip}</span>'
                body_html += f'</div>'
                body_html += f'</td>'
            else:
                cell_class = get_col_class(col)
                if col == 'Original ILCD Format Definition (en)' and is_definitions_identical:
                    cell_class += ' gray-definition'

                formatted = format_cell_html(col, cell_value, is_definitions_identical)
                body_html += f'<td class="{cell_class}" data-col="{html.escape(col)}">{formatted}</td>'
        body_html += "</tr>"
    body_html += "</tbody>"

    html_table = f'<table id="report-table">{header_html}{body_html}</table>'

    # --- Final HTML Document with CSS and JS ---
    html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>ILCD+EPD v1.3 Process Dataset</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body class="show-en">
    <h1>ILCD+EPD v1.3 Process Dataset</h1>
    <div class="controls">
        <input type="text" id="search-bar" placeholder="Search by Name, Path (e.g. 'proc/name'), or Regex (e.g. '^process')">
        <div class="lang-buttons">
            <button id="show-en-btn">Show English</button>
            <button id="show-de-btn">Show German</button>
            <button id="show-all-btn">Show Both</button>
        </div>
        <div class="download-buttons">
            <button id="download-csv-btn">Download CSV</button>
            <button id="download-adoc-btn">Download AsciiDoc</button>
        </div>
        <div class="view-options">
            <button id="toggle-stripes-btn">Toggle Stripes</button>
        </div>
        <div class="col-toggles">{checkboxes_html}</div>
    </div>
    {html_table}
    <script src="js/script.js"></script>
</body>
</html>
"""
    return html_template

# --- Main Execution ---
if __name__ == "__main__":
    # Include ALL columns from Excel source (27 columns total)
    PRESENTATION_COLUMNS = [
        'order',
        'ID previous',
        'ID new',
        'Format version ID (when introduced)',
        'Field Name (de)',
        'Field Name (en)',
        'Element/Attribute Name',
        'Technically Required',
        'Occ.',
        'Datatype',
        'Original ILCD Format Definition (en)',
        'Definition (de)',
        'InData Definition (en)',
        'Further explanations (EN)',
        'InData compliance CP-2020',
        'Deviation to ILCD format definition',
        'Extension of ILCD format',
        'InData Compliance Construction Products CPEN2020',
        'eDoc ID',
        'Example of expected information in the field',
        'EN15804+A2 mapping (chapter number)',
        'EN15804+A2 required information',
        'ECO Platform conformity',
        'ISO 22057 mapping (GUID)',
        'ISO 22057 required information',
        'ISO 21930 mapping',
        'ISO 21930 required information',
    ]

    # Column mapping for any renamed columns (if needed for display)
    COLUMN_MAPPING = {
        # No renaming needed - using exact Excel column names
    }

    try:
        df = parse_asciidoc_table(ADOC_SOURCE_FILE)
        html_content = generate_html_report(df, PRESENTATION_COLUMNS, COLUMN_MAPPING)
        with open(HTML_OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"Successfully generated interactive HTML report: {HTML_OUTPUT_FILE}")

    except (FileNotFoundError, ValueError, KeyError) as e:
        print(f"An error occurred: {e}")
