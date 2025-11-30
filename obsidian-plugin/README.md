# Theophysics Research Assistant

An Obsidian plugin providing semantic markup, math translation, AI-powered research assistance, and PostgreSQL sync for the Theophysics vault system.

## Features

### Semantic Markup System

Invisible classification layer that makes research machine-readable:

- **Paragraph-level**: Hypotheses, axioms, evidence, definitions, derivations
- **Sentence-level**: Claims, citations, cross-references
- **Word-level**: Ontology terms, variables, concepts, proper names, theories

```markdown
==para:hypothesis:H-001:uuid== Content here ==para:end==
==sent:evidence:axiom-5:uuid== Sentence content ==
==word:ontology:logos-field:uuid== Logos Field ==
```

Markers are invisible in reading view but fully machine-readable.

### Math Translation

Converts LaTeX to English at three levels:

- **Basic**: Simple, accessible language
- **Medium**: Technical but readable
- **Academic**: Full mathematical precision

```markdown
$$\chi = \int \nabla \psi d\tau$$

> [!math-translation]
> **Basic:** the Logos Field equals integral of the change across space the consciousness wave d tau
```

Includes 100+ symbol translations with context warnings for ambiguous symbols.

### AI Auto-Classification

Automatically classifies content using pattern matching or AI APIs:

- Local pattern matching (no API required)
- OpenAI integration
- Anthropic integration
- Custom API endpoint support

### PostgreSQL Sync

Bidirectional synchronization with PostgreSQL:

- Syncs all semantic blocks, math blocks, and evidence bundles
- Debounced auto-sync on save
- Conflict detection
- Connection status monitoring

### Evidence Bundling

Automatically finds and links evidence to claims:

- Scans vault for related evidence
- Calculates relevance scores
- Creates evidence bundles with strength ratings
- Stores relationships in database

### Research Link Generation

Auto-generates links to academic sources:

- Stanford Encyclopedia of Philosophy
- Internet Encyclopedia of Philosophy
- arXiv
- Google Scholar
- Wikipedia
- And 8 more sources...

### TTS Export

Export documents for text-to-speech:

- Strips semantic markers
- Converts LaTeX to spoken English
- Cleans markdown formatting
- Ready for accessibility tools

## Installation

1. Copy the plugin folder to your vault's `.obsidian/plugins/` directory
2. Enable the plugin in Obsidian settings
3. Configure database connection (optional)
4. Load your math translation CSV (optional)

## Commands

### Semantic

- **Auto-Classify Document**: Automatically classify all content
- **Mark as Hypothesis/Evidence/Axiom/etc.**: Mark selected text
- **Bundle Evidence for Claims**: Find evidence for all hypotheses

### Math

- **Toggle Translations**: Show/hide math translations
- **Translate Selection**: Get translation for selected LaTeX
- **Insert Translation**: Add translation below math block
- **Export TTS Version**: Create TTS-ready document

### Database

- **Sync Now**: Sync pending changes
- **Sync All Notes**: Sync entire vault
- **View Sync Status**: Check connection status

### Links

- **Generate Proper Name Links**: Add research links section
- **Update All Research Links**: Refresh links vault-wide

## Settings

- **Semantic Markup**: Auto-classify, highlighting options
- **Database**: PostgreSQL connection details
- **Math Translation**: Default level, CSV path, inline display
- **AI Integration**: Provider selection, API keys
- **UI**: Sidebar panel, tooltips

## Database Schema

```sql
CREATE TABLE semantic_blocks (
    uuid UUID PRIMARY KEY,
    note_path TEXT,
    block_type TEXT,
    semantic_type TEXT,
    content TEXT,
    parent_uuid UUID,
    ref_id TEXT,
    related_refs TEXT[],
    position_start INTEGER,
    position_end INTEGER,
    position_line INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE math_blocks (
    uuid UUID PRIMARY KEY,
    note_path TEXT,
    latex_content TEXT,
    is_inline BOOLEAN,
    translation_basic TEXT,
    translation_medium TEXT,
    translation_academic TEXT,
    parent_uuid UUID,
    position_start INTEGER,
    position_end INTEGER,
    position_line INTEGER,
    created_at TIMESTAMP
);

CREATE TABLE evidence_bundles (
    uuid UUID PRIMARY KEY,
    claim_uuid UUID,
    evidence_uuids UUID[],
    strength_score FLOAT,
    created_at TIMESTAMP
);
```

## Development

```bash
# Install dependencies
npm install

# Build for development
npm run dev

# Build for production
npm run build
```

## API Integration

The plugin can connect to a Python engine backend for heavy computation:

```
POST /classify - AI content classification
POST /translate-math - Math translation
POST /bundle-evidence - Evidence bundling
POST /generate-links - Research link generation
```

## File Structure

```
obsidian-plugin/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── src/
│   ├── main.ts
│   ├── types/index.ts
│   ├── semantic/
│   │   ├── parser.ts
│   │   ├── classifier.ts
│   │   ├── bundler.ts
│   │   └── renderer.ts
│   ├── math/
│   │   ├── translator.ts
│   │   ├── display.ts
│   │   └── tts.ts
│   ├── database/
│   │   ├── postgres.ts
│   │   └── sync.ts
│   ├── links/
│   │   └── generator.ts
│   ├── engine/
│   │   └── api.ts
│   └── ui/
│       ├── sidebar.ts
│       ├── settings.ts
│       └── commands.ts
└── README.md
```

## License

MIT

## Credits

Built for the Theophysics Research System.
