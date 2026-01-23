# GitHub Actions Workflows

This directory contains GitHub Actions workflows that automate documentation building and deployment for the ILCD-EPD-Data-Format project.

## Overview

Documentation is automatically built and deployed to GitHub Pages using the `gitActions` branch. The site is available at:
`https://indatawg.github.io/ILCD-EPD-Data-Format/`

## Workflows

### 1. Build and Deploy Documentation (`build-and-deploy.yml`)

**Purpose**: Builds and deploys documentation for all branches.

**Triggers**:
- Push to any branch (when files in `doc/` or `.github/build/` change)
- Manual workflow dispatch

**What it does**:
- Generates main documentation pages from AsciiDoc source files
- Creates CSV-to-HTML conversions
- Copies schemadoc HTML files
- Deploys main docs to `/doc/` (for main/release branches only)
- Deploys branch-specific docs to `/gitBranches/{branch-name}/`

**Key features**:
- Uses `peaceiris/actions-gh-pages` action for deployment
- No manual git operations required
- Preserves existing content with `keep_files: true`
- Uses pinned Python dependencies from `requirements.txt`

### 2. Cleanup Branch Documentation (`cleanup.yml`)

**Purpose**: Removes documentation when a branch is deleted.

**Triggers**:
- Branch deletion

**What it does**:
- Checks out the `gitActions` branch
- Removes the directory for the deleted branch from `/gitBranches/`
- Commits and pushes changes

### 3. Create Version and Release (`version_release.yml`)

**Purpose**: Creates versioned documentation releases.

**Triggers**:
- Push of version tags (e.g., `v1.3.0`, `v1.3`)

**What it does**:
- Creates a ZIP package of the entire repository
- Copies documentation to `/doc/releases/{version}/`
- Generates a landing page for the version
- Deploys to GitHub Pages
- Updates README.md with the new version link

## Directory Structure on GitHub Pages

```
/ (root of gitActions branch)
├── doc/                           # Main documentation (from main/release branches)
│   ├── index.html
│   ├── attribute_pages/
│   ├── schemadoc/
│   └── releases/
│       └── v1.3/                  # Versioned releases
│           ├── index.html
│           ├── v1.3.zip
│           └── doc/
└── gitBranches/                   # Branch-specific documentation
    ├── release-v1.3/
    │   ├── identifiers/
    │   └── schemadoc/
    └── feature-x/
        ├── identifiers/
        └── schemadoc/
```

## Python Build Scripts

Located in `.github/build/`, these scripts generate documentation:

1. **convert_csv_to_html.py** - Converts CSV files to HTML tables
2. **generate_attribute_pages.py** - Creates individual attribute detail pages
3. **generate_csv_from_adoc.py** - Extracts CSV data from AsciiDoc
4. **generate_html_report.py** - Generates main interactive HTML report
5. **generate_schemadoc_attribute_pages.py** - Creates schemadoc attribute pages
6. **generate_schemadoc_html_report.py** - Generates schemadoc HTML reports

All scripts include:
- Structured logging for easier debugging
- Proper error handling with specific exceptions
- Exit codes for CI/CD integration

## Testing Changes Locally

To test documentation generation locally:

```bash
# Install dependencies
pip install -r requirements.txt

# Generate main documentation
cd .github/build
python generate_html_report.py
python generate_attribute_pages.py

# Generate CSV-to-HTML
python convert_csv_to_html.py ../../doc/identifiers

# Generate schemadoc
python generate_schemadoc_html_report.py
python generate_schemadoc_attribute_pages.py
```

## Troubleshooting

### Workflow fails with "File not found"
- Check that the source AsciiDoc files exist in `doc/asciidoc/`
- Verify path references in Python scripts

### Documentation not updating on GitHub Pages
- Check workflow run logs in the Actions tab
- Verify the `gitActions` branch exists
- Ensure GitHub Pages is configured to serve from `gitActions` branch

### Python script errors
- Check Python version (workflows use Python 3.10)
- Verify all dependencies are in `requirements.txt`
- Review script logs for specific error messages

## Common Issues

**Q: Why do I see multiple versions of the same docs?**
A: Each branch gets its own directory under `/gitBranches/`. This allows previewing changes before merging.

**Q: How do I remove old branch documentation?**
A: Delete the branch - the cleanup workflow will automatically remove its documentation.

**Q: Can I trigger a documentation rebuild without pushing code?**
A: Yes, go to Actions → "Build and Deploy Documentation" → "Run workflow"

## Maintenance

### Updating Dependencies

Dependencies are automatically checked by Dependabot (see `dependabot.yml`).

To manually update:
```bash
pip install --upgrade pandas openpyxl
pip freeze > requirements.txt
```

### Adding New Documentation Files

1. Add source files to `doc/asciidoc/` or `doc/asciidoc/schemadoc_adoc/`
2. If needed, update Python scripts in `.github/build/`
3. Test locally
4. Push changes - workflows will automatically build and deploy

## Version History

- **v2.0** (2025-01) - Simplified workflows, removed dual-checkout patterns
- **v1.0** (2024) - Initial workflow implementation
