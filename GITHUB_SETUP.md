# GitHub Repository Setup

## Repository Name
**theophysics-vault-manager**

## Steps to Push to GitHub

1. **Create the repository on GitHub:**
   - Go to GitHub and create a new repository
   - Name it: `theophysics-vault-manager`
   - Make it public or private (your choice)
   - **Don't** initialize with README, .gitignore, or license (we already have these)

2. **Add remote and push:**
   ```bash
   cd "D:\theophysics-research-manager"
   
   # Initialize git
   git init
   
   # Add all files
   git add .
   
   # Initial commit
   git commit -m "v2.0: Theophysics Vault Manager"
   
   # Add remote (replace YOUR_USERNAME with your GitHub username)
   git remote add origin https://github.com/YOUR_USERNAME/theophysics-vault-manager.git
   
   # Push to GitHub
   git branch -M main
   git push -u origin main
   ```

3. **Future updates:**
   ```bash
   git add .
   git commit -m "Description of changes"
   git push
   ```

## Repository Description

**Theophysics Vault Manager** - A comprehensive research management GUI for Obsidian vaults. Features paper scanning, NLP term detection, definition engine with Wikipedia integration, structure builder, and dashboard generation.

## Topics/Tags for GitHub
- obsidian
- research-management
- academic-linking
- postgresql
- theophysics
- knowledge-management
- python
- pyside6

## What's Included
- ✅ Complete source code
- ✅ README with full documentation
- ✅ .gitignore for Python projects
- ✅ Requirements.txt
- ✅ Setup scripts for Windows
- ✅ Database schema auto-creation
- ✅ All core features implemented

## What's NOT Included (for security)
- `config/settings.ini` (contains user-specific paths)
- `config/research_links.json` (user custom links)
- `venv/` (virtual environment - users create their own)
- Database passwords (stored locally only)

