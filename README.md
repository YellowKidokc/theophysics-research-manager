# Theophysics Research Manager

**A comprehensive research management system for Obsidian vaults**

The most formalized, logical, easy-to-use but rigorous system that Obsidian has ever had.

## 🎯 Purpose

This application provides a complete research management ecosystem for Obsidian users, combining:
- **Definition Management** - Organize and manage glossary entries
- **Research Linking** - Auto-generate links to academic sources (Stanford, arXiv, etc.)
- **Footnote System** - Create footnotes with both academic and vault links
- **PostgreSQL Integration** - Persistent storage for definitions, links, and AI memories
- **Vault Analytics** - Track and aggregate data across multiple vault instances

## ✨ Features

### 📚 Definitions Manager
- Create, edit, and organize definitions
- Aliases support
- Classification system (Theory, Proper Name, Scientific Method, etc.)
- Folder organization (physics, theories, terms, etc.)

### 🔗 Research Linking System
- 12-source academic cascade (Stanford, IEP, Oxford, Cambridge, PhilPapers, arXiv, etc.)
- Configurable priority ordering
- Auto-link generation
- Custom link management

### 📝 Footnote System
- Auto-generate footnotes with academic + vault links
- Simple explanations (not "42 pages of formalism")
- Text processing with automatic footnote markers
- Formatted footnote sections

### 🗄️ PostgreSQL Database
- Persistent storage for all data
- AI memory system for context retention
- Sync definitions, footnotes, and research links
- Full database management interface

## 🚀 Quick Start

### First Time Setup

**Double-click `setup_and_launch.bat`**

This will:
- ✅ Check Python installation
- ✅ Create virtual environment
- ✅ Install all dependencies
- ✅ Launch the application

### Quick Launch (After Setup)

**Double-click `QUICK_START.bat`**

### Manual Launch

```bash
cd "D:\THEOPHYSICS_MASTER\Apps\Obsidian-Definitions-Manager"
venv\Scripts\activate
python app.py
```

## 📋 Requirements

- Python 3.8+
- PostgreSQL (optional, for database features)
- Obsidian vault (for definitions management)

## 🗄️ Database Setup

1. Install PostgreSQL
2. Create database: `CREATE DATABASE theophysics_research;`
3. Open the app → **Database** tab
4. Enter connection details
5. Click "Test Connection" then "Save & Connect"

The schema will be created automatically on first connection.

## 📁 Project Structure

```
Obsidian-Definitions-Manager/
├── app.py                 # Main entry point
├── core/                  # Core business logic
│   ├── obsidian_definitions_manager.py
│   ├── research_linker.py
│   ├── footnote_system.py
│   ├── postgres_manager.py
│   └── ...
├── ui/                    # User interface
│   ├── main_window.py
│   └── tabs/             # Tab components
├── config/               # Configuration files
└── requirements.txt      # Python dependencies
```

## 🔧 Configuration

Configuration files are stored in `config/`:
- `settings.ini` - Application settings
- `research_links.json` - Custom research links
- `research_priority.json` - Link priority order

## 🤝 Contributing

This is a research tool for Theophysics. Contributions welcome!

## 📄 License

See LICENSE file for details.

## 🙏 Acknowledgments

Built for the Theophysics research framework - making rigorous research accessible and organized.

---

**Version:** 1.0.0  
**Status:** Active Development  
**Author:** David Lowe & AI Collaboration
