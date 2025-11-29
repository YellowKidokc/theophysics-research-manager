# Plugin Aggregation System

## Overview

The Obsidian Definitions Manager now includes a comprehensive data aggregation system that pulls data from all Obsidian plugins and exports to PostgreSQL.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OBSIDIAN PLUGINS                         │
├─────────────────────────────────────────────────────────────┤
│  Word-Ontology          → Classifications, Semantic Blocks  │
│  Module-Notes           → Axioms, Claims, Evidence         │
│  Link-Tag-Plugin        → Classifications, Definitions      │
│  Tags-Data-Analytics    → Tags, Definitions, Analytics      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           PYTHON AGGREGATION PROGRAM                        │
│         (Obsidian-Definitions-Manager)                      │
├─────────────────────────────────────────────────────────────┤
│  • PluginDataAggregator  → Scans all plugins               │
│  • DataAggregationTab     → User interface                  │
│  • PostgreSQL Export      → Writes to database              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         AGGREGATION TARGET                                  │
│    D:\Obsidian-Theophysics-research                        │
├─────────────────────────────────────────────────────────────┤
│  • aggregated_data_YYYYMMDD_HHMMSS.json                    │
│  • aggregated_data_YYYYMMDD_HHMMSS.yaml                   │
│  • Master sheets and organized data                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              POSTGRESQL DATABASE                            │
│    postgresql://...@192.168.1.93:5432/theophysics          │
├─────────────────────────────────────────────────────────────┤
│  • theophysics.notes                                        │
│  • theophysics.classifications                              │
│  • tag_nodes                                                │
│  • tag_definitions                                          │
│  • tag_statistics                                           │
└─────────────────────────────────────────────────────────────┘
```

## Plugin Data Sources

### 1. Word-Ontology (`D:\Word-ontology`)
- **Data**: Classifications, semantic blocks
- **Files**: `data.json`, semantic blocks in markdown
- **Extraction**: JSON parsing, semantic block regex

### 2. Module-Notes (`D:\Obsidian-Plugin-Module-Notes`)
- **Data**: Axioms, Claims, Evidence, Timeline Events, Theories
- **Files**: `03_MASTER_TRUTH/` folder, markdown with semantic blocks
- **Extraction**: Semantic block parsing, YAML frontmatter

### 3. Link-Tag-Plugin (`D:\Obsidian-link-tag-plugin`)
- **Data**: Classifications, Definitions
- **Files**: Glossary manager, PostgreSQL sync data
- **Extraction**: JavaScript parsing (or vault data)

### 4. Tags-Data-Analytics (`D:\Obsidian-Tags-Data-Analytics`)
- **Data**: Tags, Definitions, Analytics
- **Files**: `python/extract_definitions.py` output, JSON files
- **Extraction**: JSON parsing

## Usage

### 1. Open Data Aggregation Tab
- Launch the Obsidian Definitions Manager
- Click on "🔗 Data Aggregation" tab

### 2. Configure Plugin Sources
- Check/uncheck plugins to enable/disable
- Verify plugin paths are correct
- Set aggregation target folder (default: `D:\Obsidian-Theophysics-research`)

### 3. Configure PostgreSQL Connection
- Enter connection string:
  ```
  postgresql://postgres:Moss9pep28$@192.168.1.93:5432/theophysics
  ```
- Click "Test Connection" to verify

### 4. Scan Plugins
- Click "Scan All Plugins"
- Wait for scan to complete
- Review results in the table

### 5. Aggregate Data
- Click "Aggregate Data"
- Data is combined from all enabled plugins
- Saved to aggregation target folder

### 6. Export to PostgreSQL
- Click "Export to PostgreSQL"
- Data is written to the theophysics database
- Tables updated: classifications, tag_definitions, tag_nodes, etc.

## Data Flow

1. **Scan Phase**
   - Each plugin folder is scanned
   - Data files are located and parsed
   - Results stored in memory

2. **Aggregation Phase**
   - Data from all plugins is combined
   - Duplicates are identified and handled
   - Data is normalized to common format

3. **Storage Phase**
   - Aggregated data saved to JSON/YAML
   - Files timestamped for versioning
   - Stored in aggregation target folder

4. **Export Phase**
   - Data converted to PostgreSQL format
   - Tables created/updated as needed
   - Data inserted with conflict handling

## PostgreSQL Schema

The system writes to these tables:

- `theophysics.notes` - Note metadata
- `theophysics.classifications` - Epistemic classifications
- `theophysics.epistemic_types` - Classification types
- `tag_nodes` - Tag occurrences
- `tag_statistics` - Tag frequency stats
- `tag_definitions` - Term definitions
- `tag_cooccurrences` - Tag relationships

## Benefits

1. **Centralized Data**: All plugin data in one place
2. **User Control**: Interface to manage aggregation
3. **PostgreSQL Integration**: Direct database export
4. **Versioning**: Timestamped output files
5. **Extensible**: Easy to add new plugins

## Future Enhancements

- Real-time sync from plugins
- Conflict resolution UI
- Data validation and cleaning
- Incremental updates
- Backup/restore functionality
- Query builder for aggregated data

