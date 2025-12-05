"""
Definitions Scanner Tab - Scan vault, validate completeness, edit definitions.
Integrates with Definition Engine for Wikipedia auto-fill.
"""

from __future__ import annotations

import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, TYPE_CHECKING
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QMessageBox, QSplitter, QListWidget, QListWidgetItem,
    QTextEdit, QLineEdit, QComboBox, QProgressBar, QCheckBox,
    QScrollArea, QFrame
)
from PySide6.QtCore import Qt, QThread, Signal
from PySide6.QtGui import QColor

if TYPE_CHECKING:
    from core.obsidian_definitions_manager import ObsidianDefinitionsManager


@dataclass
class DefinitionValidation:
    """Validation result for a single definition."""
    file_path: str
    term: str
    has_aliases: bool = False
    has_core_definition: bool = False
    has_operational_definition: bool = False
    has_ontological_context: bool = False
    has_relationships: bool = False
    has_scientific_definition: bool = False
    has_narrative_definition: bool = False
    has_metadata: bool = False
    
    # Raw content for editing
    raw_content: str = ""
    frontmatter: Dict = field(default_factory=dict)
    
    @property
    def completeness_score(self) -> int:
        """Calculate completeness percentage (0-100)."""
        fields = [
            self.has_aliases,
            self.has_core_definition,
            self.has_operational_definition,
            self.has_ontological_context,
            self.has_relationships,
            self.has_scientific_definition,
            self.has_narrative_definition,
            self.has_metadata
        ]
        return int(sum(fields) / len(fields) * 100)
    
    @property
    def missing_sections(self) -> List[str]:
        """Get list of missing sections."""
        missing = []
        if not self.has_aliases:
            missing.append("Aliases")
        if not self.has_core_definition:
            missing.append("Core Definition")
        if not self.has_operational_definition:
            missing.append("Operational Definition")
        if not self.has_ontological_context:
            missing.append("Ontological Context")
        if not self.has_relationships:
            missing.append("Relationships")
        if not self.has_scientific_definition:
            missing.append("Scientific Definition")
        if not self.has_narrative_definition:
            missing.append("Narrative Definition")
        if not self.has_metadata:
            missing.append("Metadata")
        return missing


class DefinitionScannerThread(QThread):
    """Background thread for scanning definitions."""
    progress = Signal(int, str)
    finished = Signal(dict)
    
    def __init__(self, definitions_folder: Path, recursive: bool = True):
        super().__init__()
        self.definitions_folder = definitions_folder
        self.recursive = recursive
    
    def run(self):
        results = {
            'total_files': 0,
            'total_definitions': 0,
            'complete_definitions': 0,
            'incomplete_definitions': 0,
            'validations': [],
            'by_completeness': {
                '100%': [],
                '75-99%': [],
                '50-74%': [],
                '25-49%': [],
                '0-24%': []
            },
            'missing_sections_count': {}
        }
        
        # Find all definition files
        if self.recursive:
            md_files = list(self.definitions_folder.rglob("*.md"))
        else:
            md_files = list(self.definitions_folder.glob("*.md"))
        
        total_files = len(md_files)
        
        for idx, md_file in enumerate(md_files):
            progress_pct = int((idx / max(total_files, 1)) * 100)
            self.progress.emit(progress_pct, f"Scanning {md_file.name}...")
            
            validation = self._validate_definition_file(md_file)
            if validation:
                results['total_files'] += 1
                results['total_definitions'] += 1
                results['validations'].append(validation)
                
                # Categorize by completeness
                score = validation.completeness_score
                if score == 100:
                    results['complete_definitions'] += 1
                    results['by_completeness']['100%'].append(validation)
                elif score >= 75:
                    results['by_completeness']['75-99%'].append(validation)
                elif score >= 50:
                    results['by_completeness']['50-74%'].append(validation)
                elif score >= 25:
                    results['by_completeness']['25-49%'].append(validation)
                else:
                    results['by_completeness']['0-24%'].append(validation)
                
                if score < 100:
                    results['incomplete_definitions'] += 1
                
                # Count missing sections
                for section in validation.missing_sections:
                    results['missing_sections_count'][section] = \
                        results['missing_sections_count'].get(section, 0) + 1
        
        self.progress.emit(100, "Scan complete!")
        self.finished.emit(results)
    
    def _validate_definition_file(self, file_path: Path) -> Optional[DefinitionValidation]:
        """Validate a single definition file against template."""
        try:
            content = file_path.read_text(encoding='utf-8')
            
            # Skip non-definition files
            if 'type: definition' not in content.lower() and '## core definition' not in content.lower():
                # Check if it looks like a definition anyway
                if '# ' not in content:
                    return None
            
            # Extract term name from first heading or filename
            term_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
            term = term_match.group(1).strip() if term_match else file_path.stem
            
            # Parse frontmatter
            frontmatter = {}
            if content.startswith('---'):
                fm_end = content.find('---', 3)
                if fm_end > 0:
                    fm_text = content[3:fm_end]
                    for line in fm_text.split('\n'):
                        if ':' in line:
                            key, val = line.split(':', 1)
                            frontmatter[key.strip()] = val.strip()
            
            validation = DefinitionValidation(
                file_path=str(file_path),
                term=term,
                raw_content=content,
                frontmatter=frontmatter
            )
            
            content_lower = content.lower()
            
            # Check for each section
            validation.has_aliases = (
                '## 1. aliases' in content_lower or
                '## aliases' in content_lower or
                'aliases:' in content_lower and frontmatter.get('aliases', '[]') != '[]'
            )
            
            validation.has_core_definition = (
                '## 2. core definition' in content_lower or
                '## core definition' in content_lower or
                '## 1. core definition' in content_lower
            )
            
            validation.has_operational_definition = (
                '## 3. operational definition' in content_lower or
                '## operational definition' in content_lower or
                '## 2. ontological category' in content_lower
            )
            
            validation.has_ontological_context = (
                '## 4. ontological context' in content_lower or
                '## ontological context' in content_lower or
                '## 3. logical dependencies' in content_lower or
                'ontological category' in content_lower
            )
            
            validation.has_relationships = (
                '## 5. relationships' in content_lower or
                '## relationships' in content_lower or
                '## 4. crosslinks' in content_lower or
                '| relation type |' in content_lower
            )
            
            validation.has_scientific_definition = (
                '## 6. scientific definition' in content_lower or
                '## scientific definition' in content_lower or
                '## 5. mathematical formalization' in content_lower
            )
            
            validation.has_narrative_definition = (
                '## 7. narrative definition' in content_lower or
                '## narrative definition' in content_lower or
                '## 6. theological mapping' in content_lower or
                '## 7. practical application' in content_lower
            )
            
            validation.has_metadata = (
                '## metadata' in content_lower or
                'tags:' in content_lower or
                '#glossary' in content_lower or
                '#theophysics' in content_lower
            )
            
            return validation
            
        except Exception as e:
            print(f"Error validating {file_path}: {e}")
            return None


class DefinitionsScannerTab(QWidget):
    """Tab for scanning and validating definitions."""
    
    def __init__(self, definitions_manager: 'ObsidianDefinitionsManager'):
        super().__init__()
        self.definitions_manager = definitions_manager
        self.scan_results = None
        self.scanner_thread = None
        self.current_validation = None
        self._setup_ui()
    
    def _setup_ui(self) -> None:
        """Setup the user interface."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(10)
        
        # Title
        title = QLabel("📚 Definition Scanner & Validator")
        title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 10px;")
        layout.addWidget(title)
        
        # Create splitter
        splitter = QSplitter(Qt.Horizontal)
        layout.addWidget(splitter)
        
        # LEFT: Controls and list
        left_panel = self._create_left_panel()
        splitter.addWidget(left_panel)
        
        # RIGHT: Editor
        right_panel = self._create_right_panel()
        splitter.addWidget(right_panel)
        
        splitter.setSizes([400, 600])
    
    def _create_left_panel(self) -> QWidget:
        """Create left panel with controls and definition list."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(5, 5, 5, 5)
        
        # Folder selection
        folder_group = QGroupBox("📁 Definitions Folder")
        folder_layout = QVBoxLayout()
        
        self.folder_label = QLabel("No folder selected")
        self.folder_label.setWordWrap(True)
        self.folder_label.setStyleSheet("color: #888; padding: 5px; background: #2a2a2a;")
        folder_layout.addWidget(self.folder_label)
        
        folder_btn_layout = QHBoxLayout()
        browse_btn = QPushButton("📂 Browse...")
        browse_btn.clicked.connect(self._browse_folder)
        folder_btn_layout.addWidget(browse_btn)
        
        use_glossary_btn = QPushButton("📖 Use Glossary")
        use_glossary_btn.clicked.connect(self._use_glossary_folder)
        folder_btn_layout.addWidget(use_glossary_btn)
        folder_layout.addLayout(folder_btn_layout)
        
        self.recursive_cb = QCheckBox("🔄 Scan recursively")
        self.recursive_cb.setChecked(True)
        folder_layout.addWidget(self.recursive_cb)
        
        folder_group.setLayout(folder_layout)
        layout.addWidget(folder_group)
        
        # Scan controls
        scan_group = QGroupBox("🔍 Scan & Validate")
        scan_layout = QVBoxLayout()
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        scan_layout.addWidget(self.progress_bar)
        
        self.scan_btn = QPushButton("🚀 SCAN DEFINITIONS")
        self.scan_btn.setStyleSheet("""
            QPushButton {
                background-color: #2d7d46;
                color: white;
                font-weight: bold;
                padding: 10px;
            }
            QPushButton:hover { background-color: #3d9d56; }
        """)
        self.scan_btn.clicked.connect(self._start_scan)
        scan_layout.addWidget(self.scan_btn)
        
        # Inject Templates button (NEW - adds 7-layer structure)
        self.inject_btn = QPushButton("📋 INJECT TEMPLATES (Add Structure)")
        self.inject_btn.setStyleSheet("""
            QPushButton {
                background-color: #7c3aed;
                color: white;
                font-weight: bold;
                padding: 10px;
            }
            QPushButton:hover { background-color: #8b5cf6; }
        """)
        self.inject_btn.clicked.connect(self._inject_templates)
        scan_layout.addWidget(self.inject_btn)
        
        # Run Engine button
        self.engine_btn = QPushButton("⚡ RUN ENGINE (Auto-Fill All)")
        self.engine_btn.setStyleSheet("""
            QPushButton {
                background-color: #d97706;
                color: white;
                font-weight: bold;
                padding: 10px;
            }
            QPushButton:hover { background-color: #f59e0b; }
        """)
        self.engine_btn.clicked.connect(self._run_engine)
        scan_layout.addWidget(self.engine_btn)
        
        # Dry run checkbox
        self.dry_run_cb = QCheckBox("🔍 Dry run (preview only, no changes)")
        self.dry_run_cb.setChecked(True)
        scan_layout.addWidget(self.dry_run_cb)
        
        # Skip Wikipedia checkbox (for speed)
        self.skip_wiki_cb = QCheckBox("⚡ Skip Wikipedia (fast mode, AI-only)")
        self.skip_wiki_cb.setChecked(False)
        self.skip_wiki_cb.setToolTip("Wikipedia lookups take ~3 sec each. Check this to use [A] AI stubs only.")
        scan_layout.addWidget(self.skip_wiki_cb)
        
        scan_group.setLayout(scan_layout)
        layout.addWidget(scan_group)
        
        # Statistics
        stats_group = QGroupBox("📊 Statistics")
        stats_layout = QVBoxLayout()
        
        self.stats_label = QLabel("No scan performed yet")
        self.stats_label.setWordWrap(True)
        stats_layout.addWidget(self.stats_label)
        
        stats_group.setLayout(stats_layout)
        layout.addWidget(stats_group)
        
        # Filter
        filter_layout = QHBoxLayout()
        filter_layout.addWidget(QLabel("Filter:"))
        self.filter_combo = QComboBox()
        self.filter_combo.addItems([
            "🔴 Incomplete Only",
            "🟢 Complete Only",
            "📋 All Definitions",
            "⚠️ Missing Core Definition",
            "⚠️ Missing Relationships"
        ])
        self.filter_combo.currentIndexChanged.connect(self._apply_filter)
        filter_layout.addWidget(self.filter_combo)
        layout.addLayout(filter_layout)
        
        # Definition list
        list_label = QLabel("📋 Definitions:")
        layout.addWidget(list_label)
        
        self.def_list = QListWidget()
        self.def_list.itemClicked.connect(self._on_definition_selected)
        layout.addWidget(self.def_list)
        
        return panel
    
    def _create_right_panel(self) -> QWidget:
        """Create right panel with editor."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(5, 5, 5, 5)
        
        # Term info
        info_group = QGroupBox("📝 Definition Details")
        info_layout = QVBoxLayout()
        
        # Term name
        term_layout = QHBoxLayout()
        term_layout.addWidget(QLabel("Term:"))
        self.term_edit = QLineEdit()
        self.term_edit.setStyleSheet("font-size: 14px; font-weight: bold; padding: 8px;")
        term_layout.addWidget(self.term_edit)
        info_layout.addLayout(term_layout)
        
        # File path
        self.file_path_label = QLabel("File: (none)")
        self.file_path_label.setStyleSheet("color: #888; font-size: 10px;")
        info_layout.addWidget(self.file_path_label)
        
        # Completeness bar
        completeness_layout = QHBoxLayout()
        completeness_layout.addWidget(QLabel("Completeness:"))
        self.completeness_bar = QProgressBar()
        self.completeness_bar.setMaximum(100)
        self.completeness_bar.setTextVisible(True)
        completeness_layout.addWidget(self.completeness_bar)
        info_layout.addLayout(completeness_layout)
        
        info_group.setLayout(info_layout)
        layout.addWidget(info_group)
        
        # Missing sections
        missing_group = QGroupBox("⚠️ Missing Sections")
        missing_layout = QVBoxLayout()
        
        self.missing_label = QLabel("Select a definition to see what's missing")
        self.missing_label.setWordWrap(True)
        self.missing_label.setStyleSheet("color: #ff6b6b;")
        missing_layout.addWidget(self.missing_label)
        
        # Quick fill buttons
        fill_layout = QHBoxLayout()
        self.fill_wikipedia_btn = QPushButton("🌐 Fill from Wikipedia")
        self.fill_wikipedia_btn.clicked.connect(self._fill_from_wikipedia)
        self.fill_wikipedia_btn.setEnabled(False)
        fill_layout.addWidget(self.fill_wikipedia_btn)
        
        self.fill_template_btn = QPushButton("📋 Insert Template")
        self.fill_template_btn.clicked.connect(self._insert_template)
        self.fill_template_btn.setEnabled(False)
        fill_layout.addWidget(self.fill_template_btn)
        missing_layout.addLayout(fill_layout)
        
        missing_group.setLayout(missing_layout)
        layout.addWidget(missing_group)
        
        # Section checklist
        sections_group = QGroupBox("✅ Section Checklist")
        sections_layout = QVBoxLayout()
        
        self.section_checks = {}
        sections = [
            ("aliases", "1. Aliases"),
            ("core", "2. Core Definition"),
            ("operational", "3. Operational Definition"),
            ("ontological", "4. Ontological Context"),
            ("relationships", "5. Relationships"),
            ("scientific", "6. Scientific Definition"),
            ("narrative", "7. Narrative Definition"),
            ("metadata", "Metadata")
        ]
        
        for key, label in sections:
            cb = QCheckBox(label)
            cb.setEnabled(False)  # Read-only indicator
            self.section_checks[key] = cb
            sections_layout.addWidget(cb)
        
        sections_group.setLayout(sections_layout)
        layout.addWidget(sections_group)
        
        # Editor
        editor_group = QGroupBox("📝 Content Editor")
        editor_layout = QVBoxLayout()
        
        self.content_editor = QTextEdit()
        self.content_editor.setPlaceholderText("Select a definition to edit...")
        self.content_editor.setMinimumHeight(200)
        editor_layout.addWidget(self.content_editor)
        
        # Save button
        save_layout = QHBoxLayout()
        self.save_btn = QPushButton("💾 Save Changes")
        self.save_btn.clicked.connect(self._save_changes)
        self.save_btn.setEnabled(False)
        self.save_btn.setStyleSheet("""
            QPushButton {
                background-color: #4a90d9;
                color: white;
                font-weight: bold;
                padding: 10px;
            }
            QPushButton:hover { background-color: #5aa0e9; }
            QPushButton:disabled { background-color: #555; }
        """)
        save_layout.addWidget(self.save_btn)
        
        self.open_file_btn = QPushButton("📂 Open in Explorer")
        self.open_file_btn.clicked.connect(self._open_in_explorer)
        self.open_file_btn.setEnabled(False)
        save_layout.addWidget(self.open_file_btn)
        
        editor_layout.addLayout(save_layout)
        
        editor_group.setLayout(editor_layout)
        layout.addWidget(editor_group)
        
        return panel
    
    def _browse_folder(self) -> None:
        """Browse for definitions folder."""
        from PySide6.QtWidgets import QFileDialog
        
        start_dir = str(self.definitions_manager.vault_path) if self.definitions_manager.vault_path else ""
        
        folder = QFileDialog.getExistingDirectory(self, "Select Definitions Folder", start_dir)
        if folder:
            self.definitions_folder = Path(folder)
            self.folder_label.setText(f"📁 {folder}")
    
    def _use_glossary_folder(self) -> None:
        """Use the vault's Glossary folder."""
        vault_path = self.definitions_manager.vault_path
        if not vault_path:
            QMessageBox.warning(self, "No Vault", "Set vault path in main window first.")
            return
        
        # Look for glossary folder
        candidates = [
            vault_path / "02_LIBRARY" / "Glossary",
            vault_path / "Glossary",
            vault_path / "definitions",
        ]
        
        for candidate in candidates:
            if candidate.exists():
                self.definitions_folder = candidate
                self.folder_label.setText(f"📁 {candidate}")
                return
        
        QMessageBox.warning(self, "Not Found", "Could not find Glossary folder in vault.")
    
    def _start_scan(self) -> None:
        """Start scanning definitions."""
        if not hasattr(self, 'definitions_folder') or not self.definitions_folder:
            QMessageBox.warning(self, "No Folder", "Select a definitions folder first.")
            return
        
        self.scan_btn.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        
        self.scanner_thread = DefinitionScannerThread(
            self.definitions_folder,
            self.recursive_cb.isChecked()
        )
        self.scanner_thread.progress.connect(self._on_progress)
        self.scanner_thread.finished.connect(self._on_scan_finished)
        self.scanner_thread.start()
    
    def _inject_templates(self) -> None:
        """Inject 7-layer template into files that don't have it."""
        if not hasattr(self, 'definitions_folder') or not self.definitions_folder:
            QMessageBox.warning(self, "No Folder", "Select a definitions folder first.")
            return
        
        try:
            from core.definition_engine import inject_templates_in_folder
        except ImportError as e:
            QMessageBox.critical(self, "Error", f"Could not load definition engine: {e}")
            return
        
        dry_run = self.dry_run_cb.isChecked()
        
        # Confirm action
        mode_text = "PREVIEW ONLY (dry run)" if dry_run else "MODIFY FILES"
        reply = QMessageBox.question(
            self,
            f"Inject Templates - {mode_text}",
            f"This will add the 7-layer template to files in:\n{self.definitions_folder}\n\n"
            f"Mode: {mode_text}\n\n"
            "This will:\n"
            "• Add ## 1. Aliases through ## 7. Narrative Definition\n"
            "• Add ## Metadata with Tags, Links, Papers\n"
            "• Preserve existing content in appropriate sections\n"
            "• Skip files that already have the template\n\n"
            "After this, run the ENGINE to fill empty sections.\n\n"
            "Continue?",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply != QMessageBox.Yes:
            return
        
        # Disable buttons
        self.inject_btn.setEnabled(False)
        self.scan_btn.setEnabled(False)
        self.inject_btn.setText("📋 Injecting...")
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        
        try:
            def progress_callback(pct, msg):
                self.progress_bar.setValue(pct)
            
            results = inject_templates_in_folder(
                self.definitions_folder,
                recursive=self.recursive_cb.isChecked(),
                dry_run=dry_run,
                progress_callback=progress_callback
            )
            
            # Summarize results
            injected = [r for r in results if r['action'] == 'injected']
            skipped = [r for r in results if r['action'] == 'skipped']
            errors = [r for r in results if r['action'] == 'error']
            
            summary = f"Template Injection Complete!\n\n"
            summary += f"📄 Files checked: {len(results)}\n"
            summary += f"📋 Templates {'would be ' if dry_run else ''}injected: {len(injected)}\n"
            summary += f"⏭️ Already have template: {len(skipped)}\n"
            summary += f"❌ Errors: {len(errors)}\n\n"
            
            if injected:
                summary += "Injected into:\n"
                for r in injected[:15]:
                    summary += f"• {r['term']}\n"
                if len(injected) > 15:
                    summary += f"... and {len(injected) - 15} more\n"
            
            if dry_run:
                summary += "\n[DRY RUN - No files were modified]"
                summary += "\n\nUncheck 'Dry run' and run again to apply changes."
                summary += "\nThen run ENGINE to fill empty sections."
            
            QMessageBox.information(self, "Injection Results", summary)
            
            # Refresh scan
            self._start_scan()
            
        except Exception as e:
            QMessageBox.critical(self, "Injection Error", f"Failed: {e}")
        
        finally:
            self.inject_btn.setEnabled(True)
            self.inject_btn.setText("📋 INJECT TEMPLATES (Add Structure)")
            self.progress_bar.setVisible(False)
    
    def _run_engine(self) -> None:
        """Run the Definition Engine to auto-fill all missing sections."""
        if not hasattr(self, 'definitions_folder') or not self.definitions_folder:
            QMessageBox.warning(self, "No Folder", "Select a definitions folder first.")
            return
        
        try:
            from core.definition_engine import process_glossary_folder, WIKIPEDIA_AVAILABLE
        except ImportError as e:
            QMessageBox.critical(self, "Error", f"Could not load definition engine: {e}")
            return
        
        if not WIKIPEDIA_AVAILABLE:
            reply = QMessageBox.question(
                self,
                "Wikipedia Not Available",
                "The 'wikipedia' package is not installed.\n\n"
                "Install it with: pip install wikipedia\n\n"
                "Continue anyway? (Will use AI-generated stubs only)",
                QMessageBox.Yes | QMessageBox.No
            )
            if reply != QMessageBox.Yes:
                return
        
        dry_run = self.dry_run_cb.isChecked()
        
        # Confirm action
        mode_text = "PREVIEW ONLY (dry run)" if dry_run else "MODIFY FILES"
        reply = QMessageBox.question(
            self,
            f"Run Definition Engine - {mode_text}",
            f"This will process all definition files in:\n{self.definitions_folder}\n\n"
            f"Mode: {mode_text}\n\n"
            "The engine will:\n"
            "• Fill empty sections with [W] Wikipedia or [A] AI content\n"
            "• Detect contradictions and add ### Contradiction blocks\n"
            "• Add ## Review Status with [REVIEW] flags\n"
            "• NEVER overwrite your own text\n\n"
            "Continue?",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply != QMessageBox.Yes:
            return
        
        # Disable buttons
        self.engine_btn.setEnabled(False)
        self.scan_btn.setEnabled(False)
        self.engine_btn.setText("⚡ Running...")
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        
        # Process
        try:
            def progress_callback(pct, msg):
                self.progress_bar.setValue(pct)
            
            results = process_glossary_folder(
                self.definitions_folder,
                recursive=self.recursive_cb.isChecked(),
                dry_run=dry_run,
                skip_wikipedia=self.skip_wiki_cb.isChecked(),
                progress_callback=progress_callback
            )
            
            # Summarize results
            updated = [r for r in results if r.updated]
            errors = [r for r in results if r.error]
            contradictions = sum(len(r.contradictions_found) for r in results)
            
            summary = f"Engine Complete!\n\n"
            summary += f"📄 Files processed: {len(results)}\n"
            summary += f"✏️ Files {'would be ' if dry_run else ''}updated: {len(updated)}\n"
            summary += f"⚠️ Contradictions found: {contradictions}\n"
            summary += f"❌ Errors: {len(errors)}\n\n"
            
            if updated:
                summary += "Updated files:\n"
                for r in updated[:10]:
                    sections = ", ".join(r.sections_filled) if r.sections_filled else "reviewed"
                    summary += f"• {r.term_name}: {sections}\n"
                if len(updated) > 10:
                    summary += f"... and {len(updated) - 10} more\n"
            
            if errors:
                summary += f"\nErrors:\n"
                for r in errors[:5]:
                    summary += f"• {Path(r.file_path).name}: {r.error}\n"
            
            if dry_run:
                summary += "\n[DRY RUN - No files were modified]"
            
            QMessageBox.information(self, "Engine Results", summary)
            
            # Refresh scan
            self._start_scan()
            
        except Exception as e:
            QMessageBox.critical(self, "Engine Error", f"Failed to run engine: {e}")
        
        finally:
            self.engine_btn.setEnabled(True)
            self.engine_btn.setText("⚡ RUN ENGINE (Auto-Fill All)")
            self.progress_bar.setVisible(False)
    
    def _on_progress(self, progress: int, message: str) -> None:
        """Handle progress updates."""
        self.progress_bar.setValue(progress)
    
    def _on_scan_finished(self, results: dict) -> None:
        """Handle scan completion."""
        self.scan_results = results
        self.scan_btn.setEnabled(True)
        self.progress_bar.setVisible(False)
        
        # Update stats
        total = results['total_definitions']
        complete = results['complete_definitions']
        incomplete = results['incomplete_definitions']
        avg_completeness = sum(v.completeness_score for v in results['validations']) / max(total, 1)
        
        stats_text = f"""📊 Scan Complete!

📄 Total definitions: {total}
✅ Complete (100%): {complete}
⚠️ Incomplete: {incomplete}
📈 Average completeness: {avg_completeness:.0f}%

Most commonly missing:"""
        
        for section, count in sorted(results['missing_sections_count'].items(), key=lambda x: -x[1])[:5]:
            stats_text += f"\n• {section}: {count} definitions"
        
        self.stats_label.setText(stats_text)
        
        # Apply filter
        self._apply_filter()
    
    def _apply_filter(self) -> None:
        """Apply filter to definition list."""
        if not self.scan_results:
            return
        
        self.def_list.clear()
        filter_idx = self.filter_combo.currentIndex()
        
        validations = self.scan_results['validations']
        
        if filter_idx == 0:  # Incomplete only
            validations = [v for v in validations if v.completeness_score < 100]
        elif filter_idx == 1:  # Complete only
            validations = [v for v in validations if v.completeness_score == 100]
        elif filter_idx == 3:  # Missing core definition
            validations = [v for v in validations if not v.has_core_definition]
        elif filter_idx == 4:  # Missing relationships
            validations = [v for v in validations if not v.has_relationships]
        
        # Sort by completeness (lowest first for incomplete, highest first for complete)
        validations.sort(key=lambda v: v.completeness_score)
        
        for validation in validations:
            score = validation.completeness_score
            if score == 100:
                icon = "✅"
                color = QColor(100, 200, 100)
            elif score >= 75:
                icon = "🟡"
                color = QColor(200, 200, 100)
            elif score >= 50:
                icon = "🟠"
                color = QColor(200, 150, 100)
            else:
                icon = "🔴"
                color = QColor(200, 100, 100)
            
            item = QListWidgetItem(f"{icon} {validation.term} ({score}%)")
            item.setData(Qt.UserRole, validation)
            item.setForeground(color)
            self.def_list.addItem(item)
    
    def _on_definition_selected(self, item: QListWidgetItem) -> None:
        """Handle definition selection."""
        validation = item.data(Qt.UserRole)
        if not validation:
            return
        
        self.current_validation = validation
        
        # Update term info
        self.term_edit.setText(validation.term)
        self.file_path_label.setText(f"File: {validation.file_path}")
        self.completeness_bar.setValue(validation.completeness_score)
        
        # Update missing sections
        if validation.missing_sections:
            self.missing_label.setText("Missing:\n• " + "\n• ".join(validation.missing_sections))
            self.missing_label.setStyleSheet("color: #ff6b6b;")
        else:
            self.missing_label.setText("✅ All sections complete!")
            self.missing_label.setStyleSheet("color: #6bff6b;")
        
        # Update checklist
        self.section_checks['aliases'].setChecked(validation.has_aliases)
        self.section_checks['core'].setChecked(validation.has_core_definition)
        self.section_checks['operational'].setChecked(validation.has_operational_definition)
        self.section_checks['ontological'].setChecked(validation.has_ontological_context)
        self.section_checks['relationships'].setChecked(validation.has_relationships)
        self.section_checks['scientific'].setChecked(validation.has_scientific_definition)
        self.section_checks['narrative'].setChecked(validation.has_narrative_definition)
        self.section_checks['metadata'].setChecked(validation.has_metadata)
        
        # Load content
        self.content_editor.setPlainText(validation.raw_content)
        
        # Enable buttons
        self.save_btn.setEnabled(True)
        self.open_file_btn.setEnabled(True)
        self.fill_wikipedia_btn.setEnabled(True)
        self.fill_template_btn.setEnabled(True)
    
    def _save_changes(self) -> None:
        """Save changes to the definition file."""
        if not self.current_validation:
            return
        
        try:
            file_path = Path(self.current_validation.file_path)
            new_content = self.content_editor.toPlainText()
            file_path.write_text(new_content, encoding='utf-8')
            
            QMessageBox.information(self, "Saved", f"Changes saved to {file_path.name}")
            
            # Rescan this file
            self._start_scan()
            
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to save: {e}")
    
    def _open_in_explorer(self) -> None:
        """Open file location in explorer."""
        if not self.current_validation:
            return
        
        import subprocess
        file_path = Path(self.current_validation.file_path)
        subprocess.Popen(f'explorer /select,"{file_path}"')
    
    def _fill_from_wikipedia(self) -> None:
        """Fill missing sections from Wikipedia."""
        if not self.current_validation:
            return
        
        try:
            from core.definition_engine import fill_single_term_from_wikipedia
        except ImportError:
            QMessageBox.warning(self, "Error", "Definition engine not available.")
            return
        
        term = self.current_validation.term
        
        # Show progress
        self.fill_wikipedia_btn.setEnabled(False)
        self.fill_wikipedia_btn.setText("🔄 Fetching...")
        
        # Fetch from Wikipedia
        try:
            sections = fill_single_term_from_wikipedia(term)
            
            # Show what was found
            preview = f"Wikipedia found for '{term}':\n\n"
            preview += f"Summary: {sections.get('external_summary', 'None')[:200]}...\n\n"
            preview += "Generated sections:\n"
            preview += f"• Core: {sections.get('core', 'None')[:100]}...\n"
            preview += f"• Scientific: {sections.get('scientific', 'None')[:100]}...\n"
            
            reply = QMessageBox.question(
                self,
                "Wikipedia Data Found",
                f"{preview}\n\nInsert these into the definition?",
                QMessageBox.Yes | QMessageBox.No
            )
            
            if reply == QMessageBox.Yes:
                # Get current content and insert Wikipedia data
                content = self.content_editor.toPlainText()
                
                # Insert into empty sections only
                for section_key, section_content in sections.items():
                    if section_key == 'external_summary':
                        continue
                    
                    # Find the section header
                    section_patterns = {
                        'core': r'(## 2\. Core Definition.*?)(\n## |\n---|\Z)',
                        'scientific': r'(## 6\. Scientific Definition.*?)(\n## |\n---|\Z)',
                        'operational': r'(## 3\. Operational Definition.*?)(\n## |\n---|\Z)',
                        'ontology': r'(## 4\. Ontological Context.*?)(\n## |\n---|\Z)',
                        'narrative': r'(## 7\. Narrative Definition.*?)(\n## |\n---|\Z)',
                    }
                    
                    if section_key in section_patterns:
                        pattern = section_patterns[section_key]
                        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
                        
                        if match:
                            section_text = match.group(1)
                            # Check if section is empty (just comments)
                            lines = [l for l in section_text.split('\n')[1:] 
                                    if l.strip() and not l.strip().startswith('<!--')]
                            
                            if not lines:
                                # Insert the content
                                header_end = section_text.find('\n')
                                if header_end > 0:
                                    new_section = section_text[:header_end+1] + "\n" + section_content + "\n"
                                    content = content.replace(section_text, new_section)
                
                self.content_editor.setPlainText(content)
                QMessageBox.information(self, "Inserted", "Wikipedia data inserted! Review and save.")
        
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to fetch: {e}")
        
        finally:
            self.fill_wikipedia_btn.setEnabled(True)
            self.fill_wikipedia_btn.setText("🌐 Fill from Wikipedia")
    
    def _insert_template(self) -> None:
        """Insert the definition template into the editor."""
        if not self.current_validation:
            return
        
        term = self.current_validation.term
        
        template = f'''---
aliases: []
uuid:
title: {term}
author: David Lowe
type: definition
created: 
updated: 
status: draft
category:
pillars: []
---

# {term}

## 1. Aliases
<!-- Semantic anchoring: other names, symbols, abbreviations -->


## 2. Core Definition
<!-- ONE SENTENCE. Immutable. What the term IS, not what it implies. This NEVER changes. -->


## 3. Operational Definition
<!-- How this term FUNCTIONS within the Theophysics framework. This layer evolves with new discoveries. -->


## 4. Ontological Context
<!-- Where does this term sit in the framework? Choose primary domain(s): -->
<!-- - Trinity-Mechanics -->
<!-- - Logos-Information -->
<!-- - Observer-Consciousness -->
<!-- - Quantum-Collapse -->
<!-- - Moral-Geometry -->
<!-- - Cosmological-Structure -->


## 5. Relationships
<!-- Forms the coherence network. Link to related terms. -->
| Relation Type | Term |
|---------------|------|
| Parent | |
| Children | |
| Prerequisites | |
| See Also | |
| Contrasts With | |


## 6. Scientific Definition
<!-- Textbook/standard physics definition. Neutral grounding for defensibility. -->


## 7. Narrative Definition
<!-- Intuitive explanation for teaching. Analogies welcome here. -->


---
## Metadata

**Related Terms:**
**Prerequisites:**
**Used In Papers:**
**Tags:** #glossary #theophysics
'''
        
        self.content_editor.setPlainText(template)
        QMessageBox.information(self, "Template Inserted", "Template inserted! Edit and save.")

