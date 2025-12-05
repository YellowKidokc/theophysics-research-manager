"""
Paper Scanner Tab - Scan papers for proper nouns and terms that need definitions.
Uses NLP (spaCy) for intelligent term detection and can link to SEP/Wikipedia.
"""

from __future__ import annotations

import re
from pathlib import Path
from collections import Counter
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QGroupBox,
    QMessageBox, QSplitter, QListWidget, QListWidgetItem,
    QCheckBox, QProgressBar, QTextEdit, QComboBox
)
from PySide6.QtCore import Qt, QThread, Signal

from typing import TYPE_CHECKING, List, Dict, Set

if TYPE_CHECKING:
    from core.obsidian_definitions_manager import ObsidianDefinitionsManager

# Try to import NLP detector
try:
    from core.nlp_term_detector import NLPTermDetector, DetectedTerm
    NLP_AVAILABLE = True
except ImportError:
    NLP_AVAILABLE = False
    print("⚠️ NLP Term Detector not available")


class ScannerThread(QThread):
    """Background thread for scanning papers using NLP."""
    progress = Signal(int, str)  # progress %, message
    finished = Signal(dict)  # results
    
    def __init__(self, papers_folder: Path, papers_to_scan: List[str], existing_definitions: Set[str], use_nlp: bool = True):
        super().__init__()
        self.papers_folder = papers_folder
        self.papers_to_scan = papers_to_scan
        self.existing_definitions = existing_definitions
        self.use_nlp = use_nlp and NLP_AVAILABLE
        
    def run(self):
        results = {
            'proper_nouns': Counter(),
            'undefined_terms': [],
            'defined_terms': [],
            'terms_with_links': [],  # NEW: terms that have SEP/Wikipedia links
            'by_paper': {},
            'total_files': 0,
            'detected_terms': []  # Full DetectedTerm objects
        }
        
        # Initialize NLP detector if available
        detector = None
        if self.use_nlp:
            try:
                detector = NLPTermDetector()
                self.progress.emit(5, "NLP model loaded...")
            except Exception as e:
                print(f"NLP init error: {e}")
                detector = None
        
        all_detected: Dict[str, 'DetectedTerm'] = {}
        
        # Handle recursive mode vs specific subfolder mode
        is_recursive = self.papers_to_scan == ["__RECURSIVE__"]
        
        if is_recursive:
            # Scan all .md files in the entire folder recursively
            self.progress.emit(10, f"Scanning all files in {self.papers_folder.name}...")
            all_md_files = list(self.papers_folder.rglob("*.md"))
            total_files = len(all_md_files)
            
            for idx, md_file in enumerate(all_md_files):
                progress_pct = int(10 + (idx / max(total_files, 1)) * 70)
                self.progress.emit(progress_pct, f"Scanning {md_file.name}...")
                results['total_files'] += 1
                
                # Determine which "paper/folder" this belongs to
                try:
                    rel_path = md_file.relative_to(self.papers_folder)
                    paper_name = rel_path.parts[0] if len(rel_path.parts) > 1 else "root"
                except:
                    paper_name = "root"
                
                if paper_name not in results['by_paper']:
                    results['by_paper'][paper_name] = Counter()
                
                try:
                    content = md_file.read_text(encoding='utf-8')
                    
                    if detector:
                        terms = detector.detect_terms(content, str(md_file))
                        for term in terms:
                            key = term.text.lower()
                            results['by_paper'][paper_name][term.text] += term.count
                            results['proper_nouns'][term.text] += term.count
                            
                            if key not in all_detected:
                                all_detected[key] = term
                            else:
                                all_detected[key].count += term.count
                                if str(md_file) not in all_detected[key].sources:
                                    all_detected[key].sources.append(str(md_file))
                    else:
                        terms = self._regex_detect(content)
                        for term, count in terms.items():
                            results['by_paper'][paper_name][term] += count
                            results['proper_nouns'][term] += count
                except Exception as e:
                    print(f"Error reading {md_file}: {e}")
            
            # Convert by_paper counters to dicts with top 50
            for paper_name in results['by_paper']:
                results['by_paper'][paper_name] = dict(
                    Counter(results['by_paper'][paper_name]).most_common(50)
                )
        else:
            # Original mode: scan specific subfolders
            total_papers = len(self.papers_to_scan)
            
            for idx, paper_name in enumerate(self.papers_to_scan):
                progress_pct = int(10 + (idx / total_papers) * 70)
                self.progress.emit(progress_pct, f"Scanning {paper_name}...")
                
                paper_folder = self.papers_folder / paper_name
                if not paper_folder.exists():
                    continue
                    
                paper_terms = Counter()
                
                # Scan all .md files in the paper folder
                for md_file in paper_folder.rglob("*.md"):
                    results['total_files'] += 1
                    
                    try:
                        content = md_file.read_text(encoding='utf-8')
                        
                        if detector:
                            # Use NLP-based detection
                            terms = detector.detect_terms(content, str(md_file))
                            for term in terms:
                                key = term.text.lower()
                                paper_terms[term.text] += term.count
                                results['proper_nouns'][term.text] += term.count
                                
                                if key not in all_detected:
                                    all_detected[key] = term
                                else:
                                    all_detected[key].count += term.count
                                    if str(md_file) not in all_detected[key].sources:
                                        all_detected[key].sources.append(str(md_file))
                        else:
                            # Fallback to regex-based detection
                            terms = self._regex_detect(content)
                            for term, count in terms.items():
                                paper_terms[term] += count
                                results['proper_nouns'][term] += count
                                    
                    except Exception as e:
                        print(f"Error reading {md_file}: {e}")
                
                results['by_paper'][paper_name] = dict(paper_terms.most_common(50))
        
        # Resolve links for terms (SEP/Wikipedia)
        if detector and all_detected:
            self.progress.emit(85, "Resolving links (SEP/Wikipedia)...")
            try:
                terms_list = list(all_detected.values())
                # Only resolve for top 50 terms to avoid rate limiting
                top_terms = sorted(terms_list, key=lambda t: t.count, reverse=True)[:50]
                detector.resolve_links(top_terms, use_sep=True, use_wikipedia=True)
            except Exception as e:
                print(f"Link resolution error: {e}")
        
        results['detected_terms'] = list(all_detected.values())
        
        # Categorize as defined or undefined
        self.progress.emit(95, "Categorizing terms...")
        
        for term_obj in all_detected.values():
            term = term_obj.text
            count = term_obj.count
            term_lower = term.lower()
            
            is_defined = any(
                term_lower == d.lower() or term_lower in d.lower() or d.lower() in term_lower
                for d in self.existing_definitions
            )
            
            if is_defined:
                results['defined_terms'].append((term, count, term_obj.link, term_obj.label))
            else:
                results['undefined_terms'].append((term, count, term_obj.link, term_obj.label))
            
            if term_obj.link:
                results['terms_with_links'].append((term, term_obj.link, term_obj.link_source))
        
        # Sort by count
        results['undefined_terms'].sort(key=lambda x: -x[1])
        results['defined_terms'].sort(key=lambda x: -x[1])
        
        self.progress.emit(100, "Scan complete!")
        self.finished.emit(results)
    
    def _regex_detect(self, content: str) -> Dict[str, int]:
        """Fallback regex-based detection."""
        terms = Counter()
        
        patterns = [
            r'[ΨΦΛΩχψφλωΓγΔδΣσΠπΘθ]',
            r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b',
            r'\b[A-Z][a-z]{3,}\b',
        ]
        
        exclude_words = {
            'The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where',
            'Which', 'While', 'With', 'Would', 'Will', 'Was', 'Were', 'Are',
            'Section', 'Chapter', 'Paper', 'Figure', 'Table', 'Equation',
            'However', 'Therefore', 'Thus', 'Physical', 'Theological',
        }
        
        for pattern in patterns:
            for match in re.findall(pattern, content):
                term = match.strip() if isinstance(match, str) else match
                if term and len(term) > 2 and term not in exclude_words:
                    terms[term] += 1
        
        return dict(terms)


class PaperScannerTab(QWidget):
    """Tab for scanning papers for proper nouns and terms."""
    
    def __init__(self, definitions_manager: 'ObsidianDefinitionsManager'):
        super().__init__()
        self.definitions_manager = definitions_manager
        self.scan_results = None
        self.scanner_thread = None
        self._setup_ui()
        self._refresh_papers_list()
    
    def _setup_ui(self) -> None:
        """Setup the user interface."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(10)
        
        # Title
        title = QLabel("📄 Paper Scanner - Find Terms Needing Definitions")
        title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 10px;")
        layout.addWidget(title)
        
        # Create splitter
        splitter = QSplitter(Qt.Horizontal)
        layout.addWidget(splitter)
        
        # LEFT: Paper selection
        left_panel = self._create_paper_selection_panel()
        splitter.addWidget(left_panel)
        
        # RIGHT: Results
        right_panel = self._create_results_panel()
        splitter.addWidget(right_panel)
        
        splitter.setSizes([300, 700])
    
    def _create_paper_selection_panel(self) -> QWidget:
        """Create the paper selection panel."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(5, 5, 5, 5)
        
        # Folder selection group
        folder_group = QGroupBox("📁 Select Folder to Scan")
        folder_layout = QVBoxLayout()
        
        # Current folder display
        self.current_folder_label = QLabel("No folder selected")
        self.current_folder_label.setWordWrap(True)
        self.current_folder_label.setStyleSheet("color: #888; padding: 5px; background: #2a2a2a; border-radius: 3px;")
        folder_layout.addWidget(self.current_folder_label)
        
        # Browse button
        browse_layout = QHBoxLayout()
        browse_btn = QPushButton("📂 Browse for Folder...")
        browse_btn.clicked.connect(self._browse_folder)
        browse_layout.addWidget(browse_btn)
        
        use_vault_btn = QPushButton("🏠 Use Vault Papers")
        use_vault_btn.clicked.connect(self._use_vault_papers)
        browse_layout.addWidget(use_vault_btn)
        folder_layout.addLayout(browse_layout)
        
        # Scan mode options
        folder_layout.addWidget(QLabel("Scan Mode:"))
        
        self.recursive_cb = QCheckBox("🔄 Recursive (scan ALL subfolders)")
        self.recursive_cb.setChecked(False)
        self.recursive_cb.stateChanged.connect(self._on_scan_mode_changed)
        folder_layout.addWidget(self.recursive_cb)
        
        self.pick_subfolders_cb = QCheckBox("📋 Pick specific subfolders")
        self.pick_subfolders_cb.setChecked(True)
        self.pick_subfolders_cb.stateChanged.connect(self._on_scan_mode_changed)
        folder_layout.addWidget(self.pick_subfolders_cb)
        
        folder_group.setLayout(folder_layout)
        layout.addWidget(folder_group)
        
        # Papers/Subfolders group
        papers_group = QGroupBox("📚 Select Subfolders to Scan")
        papers_layout = QVBoxLayout()
        
        # Select all checkbox
        self.select_all_cb = QCheckBox("Select All")
        self.select_all_cb.stateChanged.connect(self._toggle_all_papers)
        papers_layout.addWidget(self.select_all_cb)
        
        # Papers list
        self.papers_list = QListWidget()
        self.papers_list.setSelectionMode(QListWidget.MultiSelection)
        papers_layout.addWidget(self.papers_list)
        
        # Refresh button
        refresh_btn = QPushButton("🔄 Refresh Folder List")
        refresh_btn.clicked.connect(self._refresh_papers_list)
        papers_layout.addWidget(refresh_btn)
        
        papers_group.setLayout(papers_layout)
        self.papers_group = papers_group  # Store reference
        layout.addWidget(papers_group)
        
        # Scan controls
        scan_group = QGroupBox("🔍 Scan Controls")
        scan_layout = QVBoxLayout()
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        scan_layout.addWidget(self.progress_bar)
        
        # Status label
        self.status_label = QLabel("Ready to scan")
        self.status_label.setStyleSheet("color: #888;")
        scan_layout.addWidget(self.status_label)
        
        # Scan button
        self.scan_btn = QPushButton("🚀 SCAN SELECTED PAPERS")
        self.scan_btn.setStyleSheet("""
            QPushButton {
                background-color: #2d7d46;
                color: white;
                font-weight: bold;
                padding: 12px;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #3d9d56;
            }
        """)
        self.scan_btn.clicked.connect(self._start_scan)
        scan_layout.addWidget(self.scan_btn)
        
        scan_group.setLayout(scan_layout)
        layout.addWidget(scan_group)
        
        # Stats group
        stats_group = QGroupBox("📊 Scan Statistics")
        stats_layout = QVBoxLayout()
        
        self.stats_label = QLabel("No scan performed yet")
        self.stats_label.setWordWrap(True)
        stats_layout.addWidget(self.stats_label)
        
        stats_group.setLayout(stats_layout)
        layout.addWidget(stats_group)
        
        layout.addStretch()
        return panel
    
    def _create_results_panel(self) -> QWidget:
        """Create the results panel."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(5, 5, 5, 5)
        
        # Filter controls
        filter_layout = QHBoxLayout()
        filter_layout.addWidget(QLabel("Filter:"))
        
        self.filter_combo = QComboBox()
        self.filter_combo.addItems([
            "🔴 Undefined Terms (Need Definitions)",
            "🟢 Already Defined Terms",
            "🔗 Terms with Links (SEP/Wikipedia)",
            "📋 All Terms"
        ])
        self.filter_combo.currentIndexChanged.connect(self._apply_filter)
        filter_layout.addWidget(self.filter_combo)
        
        # NLP status
        nlp_status = "✅ NLP Active" if NLP_AVAILABLE else "⚠️ NLP Unavailable (using regex)"
        self.nlp_label = QLabel(nlp_status)
        self.nlp_label.setStyleSheet("color: #888; font-size: 10px;")
        filter_layout.addWidget(self.nlp_label)
        
        filter_layout.addStretch()
        layout.addLayout(filter_layout)
        
        # Results table (expanded columns)
        self.results_table = QTableWidget()
        self.results_table.setColumnCount(6)
        self.results_table.setHorizontalHeaderLabels(["Term", "Type", "Count", "Link", "Status", "Action"])
        self.results_table.horizontalHeader().setStretchLastSection(True)
        self.results_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.results_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.results_table.setColumnWidth(1, 100)  # Type
        self.results_table.setColumnWidth(2, 60)   # Count
        self.results_table.setColumnWidth(3, 150)  # Link
        self.results_table.setColumnWidth(4, 100)  # Status
        layout.addWidget(self.results_table)
        
        # Action buttons row 1
        action_layout = QHBoxLayout()
        
        add_def_btn = QPushButton("➕ Add Definition for Selected")
        add_def_btn.clicked.connect(self._add_definition_for_selected)
        action_layout.addWidget(add_def_btn)
        
        export_btn = QPushButton("📥 Export Undefined Terms")
        export_btn.clicked.connect(self._export_undefined)
        action_layout.addWidget(export_btn)
        
        export_links_btn = QPushButton("🔗 Export Link Section")
        export_links_btn.clicked.connect(self._export_link_section)
        action_layout.addWidget(export_links_btn)
        
        action_layout.addStretch()
        layout.addLayout(action_layout)
        
        # Action buttons row 2 - Integration
        action_layout2 = QHBoxLayout()
        
        create_all_defs_btn = QPushButton("📚 Create All Definitions")
        create_all_defs_btn.setToolTip("Create definition files for ALL undefined terms")
        create_all_defs_btn.clicked.connect(self._create_all_definitions)
        create_all_defs_btn.setStyleSheet("background-color: #7c3aed; color: white; padding: 8px;")
        action_layout2.addWidget(create_all_defs_btn)
        
        update_dashboard_btn = QPushButton("📊 Update Dashboard")
        update_dashboard_btn.setToolTip("Generate statistics dashboard from scan results")
        update_dashboard_btn.clicked.connect(self._update_dashboard)
        update_dashboard_btn.setStyleSheet("background-color: #0891b2; color: white; padding: 8px;")
        action_layout2.addWidget(update_dashboard_btn)
        
        action_layout2.addStretch()
        layout.addLayout(action_layout2)
        
        # By-paper breakdown
        breakdown_group = QGroupBox("📁 Terms by Paper")
        breakdown_layout = QVBoxLayout()
        
        self.breakdown_text = QTextEdit()
        self.breakdown_text.setReadOnly(True)
        self.breakdown_text.setMaximumHeight(200)
        breakdown_layout.addWidget(self.breakdown_text)
        
        breakdown_group.setLayout(breakdown_layout)
        layout.addWidget(breakdown_group)
        
        return panel
    
    def _browse_folder(self) -> None:
        """Browse for a folder to scan."""
        from PySide6.QtWidgets import QFileDialog
        
        start_dir = str(self.definitions_manager.vault_path) if self.definitions_manager.vault_path else ""
        
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Folder to Scan",
            start_dir
        )
        
        if folder:
            self.papers_folder = Path(folder)
            self.current_folder_label.setText(f"📁 {folder}")
            self._refresh_papers_list()
    
    def _use_vault_papers(self) -> None:
        """Use the default vault papers folder."""
        vault_path = self.definitions_manager.vault_path
        if not vault_path:
            QMessageBox.warning(self, "No Vault", "Please set the vault path in the main window first.")
            return
        
        # Look for papers folder
        papers_folder = vault_path / "00_CANONICAL" / "PAPERS"
        if not papers_folder.exists():
            papers_folder = vault_path / "PAPERS"
        if not papers_folder.exists():
            # Try to find any folder with P01, P02, etc.
            for folder in vault_path.rglob("P01*"):
                papers_folder = folder.parent
                break
        
        if papers_folder.exists():
            self.papers_folder = papers_folder
            self.current_folder_label.setText(f"📁 {papers_folder}")
            self._refresh_papers_list()
        else:
            QMessageBox.warning(self, "Not Found", "Could not find a papers folder in the vault.")
    
    def _on_scan_mode_changed(self, state: int) -> None:
        """Handle scan mode checkbox changes."""
        sender = self.sender()
        
        if sender == self.recursive_cb and state == Qt.Checked:
            self.pick_subfolders_cb.setChecked(False)
            self.papers_group.setEnabled(False)
            self.papers_group.setTitle("📚 Subfolders (disabled - scanning ALL recursively)")
        elif sender == self.pick_subfolders_cb and state == Qt.Checked:
            self.recursive_cb.setChecked(False)
            self.papers_group.setEnabled(True)
            self.papers_group.setTitle("📚 Select Subfolders to Scan")
        elif sender == self.recursive_cb and state == Qt.Unchecked:
            if not self.pick_subfolders_cb.isChecked():
                self.pick_subfolders_cb.setChecked(True)
        elif sender == self.pick_subfolders_cb and state == Qt.Unchecked:
            if not self.recursive_cb.isChecked():
                self.recursive_cb.setChecked(True)
    
    def _refresh_papers_list(self) -> None:
        """Refresh the list of available subfolders."""
        self.papers_list.clear()
        
        if not hasattr(self, 'papers_folder') or not self.papers_folder:
            # Try to use vault papers folder
            vault_path = self.definitions_manager.vault_path
            if not vault_path:
                self.status_label.setText("⚠️ No folder selected. Click 'Browse' or 'Use Vault Papers'.")
                return
            
            # Look for papers folder
            papers_folder = vault_path / "00_CANONICAL" / "PAPERS"
            if not papers_folder.exists():
                papers_folder = vault_path / "PAPERS"
            if not papers_folder.exists():
                for folder in vault_path.rglob("P01*"):
                    papers_folder = folder.parent
                    break
            
            if papers_folder.exists():
                self.papers_folder = papers_folder
                self.current_folder_label.setText(f"📁 {papers_folder}")
            else:
                self.status_label.setText("⚠️ No folder selected. Click 'Browse' to select a folder.")
                return
        
        if not self.papers_folder.exists():
            self.status_label.setText(f"⚠️ Folder not found: {self.papers_folder}")
            return
        
        # Find all subfolders
        subfolders = sorted([
            f.name for f in self.papers_folder.iterdir() 
            if f.is_dir() and not f.name.startswith('.')
        ])
        
        for folder_name in subfolders:
            item = QListWidgetItem(folder_name)
            item.setCheckState(Qt.Unchecked)
            
            # Show file count in tooltip
            folder_path = self.papers_folder / folder_name
            md_count = len(list(folder_path.rglob("*.md")))
            item.setToolTip(f"{md_count} markdown files")
            
            self.papers_list.addItem(item)
        
        self.status_label.setText(f"Found {len(subfolders)} subfolders in {self.papers_folder.name}")
    
    def _toggle_all_papers(self, state: int) -> None:
        """Toggle all paper checkboxes."""
        check_state = Qt.Checked if state == Qt.Checked else Qt.Unchecked
        for i in range(self.papers_list.count()):
            self.papers_list.item(i).setCheckState(check_state)
    
    def _start_scan(self) -> None:
        """Start scanning selected papers/folders."""
        if not hasattr(self, 'papers_folder') or not self.papers_folder:
            QMessageBox.warning(self, "No Folder", "Please select a folder to scan first.\nClick 'Browse' or 'Use Vault Papers'.")
            return
        
        # Determine what to scan based on mode
        is_recursive = self.recursive_cb.isChecked()
        
        if is_recursive:
            # Scan the entire folder recursively - pass special marker
            selected_items = ["__RECURSIVE__"]
        else:
            # Get selected subfolders
            selected_items = []
            for i in range(self.papers_list.count()):
                item = self.papers_list.item(i)
                if item.checkState() == Qt.Checked:
                    selected_items.append(item.text())
            
            if not selected_items:
                QMessageBox.warning(self, "No Selection", "Please select at least one subfolder to scan,\nor enable 'Recursive' mode to scan everything.")
                return
        
        # Get existing definitions
        existing_defs = set()
        for def_obj in self.definitions_manager.get_all_definitions():
            existing_defs.add(def_obj.phrase.lower())
            for alias in def_obj.aliases:
                existing_defs.add(alias.lower())
        
        # Start scan in background
        self.scan_btn.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        
        self.scanner_thread = ScannerThread(
            self.papers_folder, 
            selected_items, 
            existing_defs,
            use_nlp=NLP_AVAILABLE
        )
        self.scanner_thread.progress.connect(self._on_scan_progress)
        self.scanner_thread.finished.connect(self._on_scan_finished)
        self.scanner_thread.start()
    
    def _on_scan_progress(self, progress: int, message: str) -> None:
        """Handle scan progress updates."""
        self.progress_bar.setValue(progress)
        self.status_label.setText(message)
    
    def _on_scan_finished(self, results: dict) -> None:
        """Handle scan completion."""
        self.scan_results = results
        self.scan_btn.setEnabled(True)
        self.progress_bar.setVisible(False)
        
        # Update stats
        total_terms = len(results['proper_nouns'])
        undefined = len(results['undefined_terms'])
        defined = len(results['defined_terms'])
        linked = len(results.get('terms_with_links', []))
        
        self.stats_label.setText(
            f"📊 Scan Complete!\n\n"
            f"📁 Files scanned: {results['total_files']}\n"
            f"📝 Unique terms found: {total_terms}\n"
            f"🔴 Undefined terms: {undefined}\n"
            f"🟢 Already defined: {defined}\n"
            f"🔗 Terms with links: {linked}\n"
            f"\n{'✅ NLP analysis used' if NLP_AVAILABLE else '⚠️ Regex fallback used'}"
        )
        
        # Update breakdown
        breakdown = "## Terms by Paper\n\n"
        for paper, terms in results['by_paper'].items():
            if terms:
                top_terms = list(terms.items())[:10]
                breakdown += f"### {paper}\n"
                for term, count in top_terms:
                    breakdown += f"- {term}: {count}\n"
                breakdown += "\n"
        
        # Add linked terms section
        if results.get('terms_with_links'):
            breakdown += "---\n\n## 🔗 Discovered Links\n\n"
            for term, link, source in results['terms_with_links'][:20]:
                breakdown += f"- [{term}]({link}) *({source})*\n"
        
        self.breakdown_text.setMarkdown(breakdown)
        
        # Apply filter to show results
        self._apply_filter()
    
    def _apply_filter(self) -> None:
        """Apply the selected filter to results."""
        if not self.scan_results:
            return
        
        self.results_table.setRowCount(0)
        
        filter_idx = self.filter_combo.currentIndex()
        
        if filter_idx == 0:  # Undefined
            terms = self.scan_results['undefined_terms']
            status = "🔴 Undefined"
        elif filter_idx == 1:  # Defined
            terms = self.scan_results['defined_terms']
            status = "🟢 Defined"
        elif filter_idx == 2:  # With links
            terms = [(t, 0, link, src) for t, link, src in self.scan_results.get('terms_with_links', [])]
            status = "🔗 Linked"
        else:  # All
            terms = self.scan_results['undefined_terms'] + self.scan_results['defined_terms']
            status = None
        
        for term_data in terms:
            # Handle both old format (term, count) and new format (term, count, link, label)
            if len(term_data) == 2:
                term, count = term_data
                link, label = None, "CONCEPT"
            elif len(term_data) == 4:
                term, count, link, label = term_data
            else:
                term = term_data[0]
                count = term_data[1] if len(term_data) > 1 else 0
                link = term_data[2] if len(term_data) > 2 else None
                label = term_data[3] if len(term_data) > 3 else "CONCEPT"
            
            row = self.results_table.rowCount()
            self.results_table.insertRow(row)
            
            # Column 0: Term
            self.results_table.setItem(row, 0, QTableWidgetItem(term))
            
            # Column 1: Type/Label
            label_display = label if label else "CONCEPT"
            self.results_table.setItem(row, 1, QTableWidgetItem(label_display))
            
            # Column 2: Count
            self.results_table.setItem(row, 2, QTableWidgetItem(str(count)))
            
            # Column 3: Link
            if link:
                link_short = link[:40] + "..." if len(link) > 40 else link
                link_item = QTableWidgetItem(f"🔗 {link_short}")
                link_item.setToolTip(link)
                self.results_table.setItem(row, 3, link_item)
            else:
                self.results_table.setItem(row, 3, QTableWidgetItem("—"))
            
            # Column 4: Status
            if status:
                self.results_table.setItem(row, 4, QTableWidgetItem(status))
            else:
                is_undefined = any(t[0] == term for t in self.scan_results['undefined_terms'])
                self.results_table.setItem(row, 4, QTableWidgetItem("🔴 Undefined" if is_undefined else "🟢 Defined"))
            
            # Column 5: Action button
            is_undefined = any(t[0] == term for t in self.scan_results['undefined_terms'])
            if is_undefined:
                action_btn = QPushButton("➕ Add Def")
                action_btn.clicked.connect(lambda checked, t=term: self._quick_add_definition(t))
                self.results_table.setCellWidget(row, 5, action_btn)
            elif link:
                open_btn = QPushButton("🔗 Open")
                open_btn.clicked.connect(lambda checked, url=link: self._open_link(url))
                self.results_table.setCellWidget(row, 5, open_btn)
    
    def _open_link(self, url: str) -> None:
        """Open a link in the browser."""
        import webbrowser
        webbrowser.open(url)
    
    def _create_all_definitions(self) -> None:
        """Create definition files for ALL undefined terms."""
        if not self.scan_results or not self.scan_results.get('undefined_terms'):
            QMessageBox.warning(self, "No Data", "No undefined terms found. Run a scan first.")
            return
        
        # Get definitions folder
        vault_path = self.definitions_manager.vault_path
        if not vault_path:
            QMessageBox.warning(self, "No Vault", "Set vault path first.")
            return
        
        # Find or create glossary folder
        glossary_folder = vault_path / "02_LIBRARY" / "Glossary"
        if not glossary_folder.exists():
            glossary_folder = vault_path / "Glossary"
        if not glossary_folder.exists():
            glossary_folder.mkdir(parents=True, exist_ok=True)
        
        undefined_terms = self.scan_results['undefined_terms']
        
        reply = QMessageBox.question(
            self,
            "Create Definitions",
            f"This will create {len(undefined_terms)} definition files in:\n{glossary_folder}\n\n"
            "Each file will have the 7-layer template.\n"
            "You can then run the Definition Engine to fill them.\n\n"
            "Continue?",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply != QMessageBox.Yes:
            return
        
        created = 0
        skipped = 0
        
        # Template for new definitions
        template = '''---
aliases: []
title: {term}
type: definition
status: draft
created: {date}
papers: [{papers}]
---

# {term}

## 1. Aliases
<!-- Other names, symbols -->

## 2. Core Definition
<!-- ONE SENTENCE. What this IS. -->

## 3. Operational Definition
<!-- How it FUNCTIONS in Theophysics -->

## 4. Ontological Context
<!-- Triad/Domain/Layer -->

## 5. Relationships
| Relation | Term |
|----------|------|
| Parent | |
| Children | |
| See Also | |

## 6. Scientific Definition
<!-- Standard physics definition -->

## 7. Narrative Definition
<!-- Simple explanation -->

---
## Metadata
**Found in papers:** {papers}
**Occurrences:** {count}
**Tags:** #glossary #theophysics #needs-definition
'''
        
        from datetime import datetime
        date = datetime.now().strftime("%Y-%m-%d")
        
        for term_data in undefined_terms:
            term = term_data[0]
            count = term_data[1] if len(term_data) > 1 else 1
            
            # Clean term for filename
            safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in term)
            file_path = glossary_folder / f"{safe_name}.md"
            
            if file_path.exists():
                skipped += 1
                continue
            
            # Determine which papers this term appears in
            papers = []
            if 'by_paper' in self.scan_results:
                for paper, terms in self.scan_results['by_paper'].items():
                    if term in terms:
                        papers.append(paper)
            papers_str = ", ".join(papers) if papers else "various"
            
            content = template.format(
                term=term,
                date=date,
                papers=papers_str,
                count=count
            )
            
            try:
                file_path.write_text(content, encoding='utf-8')
                created += 1
            except Exception as e:
                print(f"Error creating {file_path}: {e}")
        
        QMessageBox.information(
            self,
            "Definitions Created",
            f"✅ Created: {created} definition files\n"
            f"⏭️ Skipped (exist): {skipped}\n\n"
            f"Location: {glossary_folder}\n\n"
            "Next steps:\n"
            "1. Go to Definition Scanner tab\n"
            "2. Run the Engine to fill sections"
        )
    
    def _update_dashboard(self) -> None:
        """Generate statistics dashboard from scan results."""
        if not self.scan_results:
            QMessageBox.warning(self, "No Data", "Run a scan first.")
            return
        
        vault_path = self.definitions_manager.vault_path
        if not vault_path:
            QMessageBox.warning(self, "No Vault", "Set vault path first.")
            return
        
        # Create dashboard folder
        dashboard_folder = vault_path / "00_VAULT_SYSTEM" / "Dashboards"
        if not dashboard_folder.exists():
            dashboard_folder = vault_path / "Dashboards"
        dashboard_folder.mkdir(parents=True, exist_ok=True)
        
        from datetime import datetime
        date = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        # Build dashboard content
        total_terms = len(self.scan_results.get('proper_nouns', {}))
        undefined = len(self.scan_results.get('undefined_terms', []))
        defined = len(self.scan_results.get('defined_terms', []))
        linked = len(self.scan_results.get('terms_with_links', []))
        
        coverage = (defined / max(total_terms, 1)) * 100
        
        dashboard = f'''---
type: dashboard
updated: {date}
---

# 📊 Paper Scanner Dashboard

> Last updated: {date}

## Overview

| Metric | Value |
|--------|-------|
| **Total Unique Terms** | {total_terms} |
| **✅ Defined** | {defined} |
| **🔴 Undefined** | {undefined} |
| **🔗 With External Links** | {linked} |
| **📈 Coverage** | {coverage:.1f}% |

## Progress Bar

```
Defined:    {"█" * int(coverage / 5)}{"░" * (20 - int(coverage / 5))} {coverage:.1f}%
Undefined:  {"█" * int((100-coverage) / 5)}{"░" * (20 - int((100-coverage) / 5))} {100-coverage:.1f}%
```

## Terms by Paper

'''
        
        if 'by_paper' in self.scan_results:
            for paper, terms in sorted(self.scan_results['by_paper'].items()):
                term_count = len(terms) if isinstance(terms, dict) else 0
                dashboard += f"### {paper}\n"
                dashboard += f"- **Terms found:** {term_count}\n"
                if isinstance(terms, dict):
                    top_5 = list(terms.items())[:5]
                    for term, count in top_5:
                        dashboard += f"  - {term}: {count}\n"
                dashboard += "\n"
        
        dashboard += '''
## Top Undefined Terms

| Term | Occurrences | Status |
|------|-------------|--------|
'''
        
        for term_data in self.scan_results.get('undefined_terms', [])[:20]:
            term = term_data[0]
            count = term_data[1] if len(term_data) > 1 else 0
            dashboard += f"| {term} | {count} | 🔴 Needs definition |\n"
        
        dashboard += '''

## Actions Needed

- [ ] Create definitions for undefined terms
- [ ] Run Definition Engine to auto-fill
- [ ] Review [W] and [A] tagged content
- [ ] Add relationships between terms

---

*Generated by Theophysics Research Manager*
'''
        
        # Save dashboard
        dashboard_file = dashboard_folder / "Paper_Scanner_Dashboard.md"
        dashboard_file.write_text(dashboard, encoding='utf-8')
        
        QMessageBox.information(
            self,
            "Dashboard Updated",
            f"✅ Dashboard saved to:\n{dashboard_file}\n\n"
            f"Coverage: {coverage:.1f}%\n"
            f"Undefined terms: {undefined}"
        )
    
    def _export_link_section(self) -> None:
        """Export a markdown section with all discovered links."""
        if not self.scan_results or not self.scan_results.get('terms_with_links'):
            QMessageBox.warning(self, "No Links", "No linked terms to export. Run a scan first.")
            return
        
        from PySide6.QtWidgets import QFileDialog
        
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Export Link Section",
            "research_links.md",
            "Markdown Files (*.md);;All Files (*)"
        )
        
        if file_path:
            content = "## Research Links\n\n"
            content += "*Auto-generated from paper scan*\n\n"
            
            # Group by source
            sep_links = []
            wiki_links = []
            other_links = []
            
            for term, link, source in self.scan_results['terms_with_links']:
                entry = f"- [{term}]({link})"
                if source == 'sep' or 'plato.stanford' in link:
                    sep_links.append(entry)
                elif source == 'wikipedia' or 'wikipedia' in link:
                    wiki_links.append(entry)
                else:
                    other_links.append(entry)
            
            if sep_links:
                content += "### Stanford Encyclopedia of Philosophy\n\n"
                content += "\n".join(sorted(set(sep_links)))
                content += "\n\n"
            
            if wiki_links:
                content += "### Wikipedia\n\n"
                content += "\n".join(sorted(set(wiki_links)))
                content += "\n\n"
            
            if other_links:
                content += "### Other Sources\n\n"
                content += "\n".join(sorted(set(other_links)))
                content += "\n\n"
            
            Path(file_path).write_text(content, encoding='utf-8')
            QMessageBox.information(self, "Exported", f"Exported {len(self.scan_results['terms_with_links'])} links to {file_path}")
    
    def _add_definition_for_selected(self) -> None:
        """Add definition for selected term."""
        selected_rows = self.results_table.selectionModel().selectedRows()
        if not selected_rows:
            QMessageBox.warning(self, "No Selection", "Please select a term from the table.")
            return
        
        row = selected_rows[0].row()
        term = self.results_table.item(row, 0).text()
        self._quick_add_definition(term)
    
    def _quick_add_definition(self, term: str) -> None:
        """Quick add a definition for a term."""
        from PySide6.QtWidgets import QInputDialog
        
        definition, ok = QInputDialog.getMultiLineText(
            self,
            f"Add Definition for '{term}'",
            "Enter definition:",
            ""
        )
        
        if ok and definition:
            success = self.definitions_manager.add_definition(term, definition, [])
            if success:
                QMessageBox.information(self, "Success", f"Definition added for '{term}'!")
                # Rescan to update status
                if self.scan_results:
                    # Move from undefined to defined
                    self.scan_results['undefined_terms'] = [
                        (t, c) for t, c in self.scan_results['undefined_terms'] if t != term
                    ]
                    count = next((c for t, c in self.scan_results['proper_nouns'].items() if t == term), 1)
                    self.scan_results['defined_terms'].append((term, count))
                    self._apply_filter()
            else:
                QMessageBox.warning(self, "Error", "Failed to add definition.")
    
    def _export_undefined(self) -> None:
        """Export undefined terms to a file."""
        if not self.scan_results or not self.scan_results['undefined_terms']:
            QMessageBox.warning(self, "No Data", "No undefined terms to export. Run a scan first.")
            return
        
        from PySide6.QtWidgets import QFileDialog
        
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Export Undefined Terms",
            "undefined_terms.md",
            "Markdown Files (*.md);;All Files (*)"
        )
        
        if file_path:
            content = "# Undefined Terms Report\n\n"
            content += f"Generated from paper scan\n\n"
            content += "| Term | Occurrences |\n"
            content += "|------|-------------|\n"
            
            for term, count in sorted(self.scan_results['undefined_terms'], key=lambda x: -x[1]):
                content += f"| {term} | {count} |\n"
            
            Path(file_path).write_text(content, encoding='utf-8')
            QMessageBox.information(self, "Exported", f"Exported {len(self.scan_results['undefined_terms'])} terms to {file_path}")

