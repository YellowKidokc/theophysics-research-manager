"""
Structure Builder Tab - Visual folder/file template builder.
Users can create custom project structures and save them as reusable templates.
"""

from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, TYPE_CHECKING
from dataclasses import dataclass, field, asdict
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTreeWidget, QTreeWidgetItem, QGroupBox, QLineEdit,
    QTextEdit, QComboBox, QMessageBox, QSplitter, QInputDialog,
    QFileDialog, QCheckBox, QSpinBox, QMenu
)
from PySide6.QtCore import Qt
from PySide6.QtGui import QAction

if TYPE_CHECKING:
    from core.obsidian_definitions_manager import ObsidianDefinitionsManager


@dataclass
class FolderItem:
    """A folder or file in the structure."""
    name: str
    is_folder: bool = True
    template_type: str = "empty"  # empty, markdown, python, json, csv, custom
    template_content: str = ""
    children: List['FolderItem'] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            'name': self.name,
            'is_folder': self.is_folder,
            'template_type': self.template_type,
            'template_content': self.template_content,
            'children': [c.to_dict() for c in self.children]
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'FolderItem':
        item = cls(
            name=data['name'],
            is_folder=data.get('is_folder', True),
            template_type=data.get('template_type', 'empty'),
            template_content=data.get('template_content', '')
        )
        item.children = [cls.from_dict(c) for c in data.get('children', [])]
        return item


@dataclass
class ProjectTemplate:
    """A complete project template."""
    name: str
    description: str = ""
    author: str = ""
    created: str = ""
    version: str = "1.0"
    variables: Dict[str, str] = field(default_factory=dict)  # e.g., {PROJECT_NAME: "My Project"}
    root_items: List[FolderItem] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            'name': self.name,
            'description': self.description,
            'author': self.author,
            'created': self.created,
            'version': self.version,
            'variables': self.variables,
            'root_items': [item.to_dict() for item in self.root_items]
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'ProjectTemplate':
        template = cls(
            name=data['name'],
            description=data.get('description', ''),
            author=data.get('author', ''),
            created=data.get('created', ''),
            version=data.get('version', '1.0'),
            variables=data.get('variables', {})
        )
        template.root_items = [FolderItem.from_dict(item) for item in data.get('root_items', [])]
        return template
    
    def save(self, path: Path) -> None:
        """Save template to JSON file."""
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, indent=2)
    
    @classmethod
    def load(cls, path: Path) -> 'ProjectTemplate':
        """Load template from JSON file."""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return cls.from_dict(data)


class StructureBuilderTab(QWidget):
    """Tab for building custom folder structures."""
    
    # Built-in templates
    BUILTIN_TEMPLATES = {
        "Academic Paper": {
            "name": "Academic Paper",
            "description": "Standard academic paper structure with supplemental materials",
            "variables": {"PAPER_NUM": "P01", "PAPER_TITLE": "My-Paper", "AUTHOR": "Author Name"},
            "root_items": [
                {"name": "{PAPER_NUM}-{PAPER_TITLE}", "is_folder": True, "children": [
                    {"name": "README.md", "is_folder": False, "template_type": "markdown"},
                    {"name": "{PAPER_NUM}-Academic.md", "is_folder": False, "template_type": "markdown"},
                    {"name": "{PAPER_NUM}-Beginners.md", "is_folder": False, "template_type": "markdown"},
                    {"name": "_Supplemental", "is_folder": True, "children": [
                        {"name": "What_We_Got_Right.md", "is_folder": False, "template_type": "markdown"},
                        {"name": "What_We_Got_Wrong.md", "is_folder": False, "template_type": "markdown"},
                        {"name": "Open_Questions.md", "is_folder": False, "template_type": "markdown"},
                    ]},
                    {"name": "_Math", "is_folder": True, "children": [
                        {"name": "{PAPER_NUM}-Formalism.md", "is_folder": False, "template_type": "markdown"},
                        {"name": "{PAPER_NUM}-Definitions.md", "is_folder": False, "template_type": "markdown"},
                    ]},
                    {"name": "_Python", "is_folder": True, "children": [
                        {"name": "main.py", "is_folder": False, "template_type": "python"},
                        {"name": "requirements.txt", "is_folder": False, "template_type": "empty"},
                    ]},
                    {"name": "_Assets", "is_folder": True, "children": [
                        {"name": "Images", "is_folder": True},
                        {"name": "Figures", "is_folder": True},
                    ]},
                    {"name": "_Drafts", "is_folder": True},
                ]}
            ]
        },
        "Research Project": {
            "name": "Research Project",
            "description": "General research project with data, analysis, and documentation",
            "variables": {"PROJECT_NAME": "My-Research", "AUTHOR": "Researcher"},
            "root_items": [
                {"name": "{PROJECT_NAME}", "is_folder": True, "children": [
                    {"name": "README.md", "is_folder": False, "template_type": "markdown"},
                    {"name": "data", "is_folder": True, "children": [
                        {"name": "raw", "is_folder": True},
                        {"name": "processed", "is_folder": True},
                        {"name": "external", "is_folder": True},
                    ]},
                    {"name": "src", "is_folder": True, "children": [
                        {"name": "__init__.py", "is_folder": False, "template_type": "python"},
                        {"name": "main.py", "is_folder": False, "template_type": "python"},
                        {"name": "utils.py", "is_folder": False, "template_type": "python"},
                    ]},
                    {"name": "notebooks", "is_folder": True, "children": [
                        {"name": "01_exploration.ipynb", "is_folder": False, "template_type": "empty"},
                    ]},
                    {"name": "docs", "is_folder": True, "children": [
                        {"name": "methodology.md", "is_folder": False, "template_type": "markdown"},
                        {"name": "results.md", "is_folder": False, "template_type": "markdown"},
                    ]},
                    {"name": "outputs", "is_folder": True, "children": [
                        {"name": "figures", "is_folder": True},
                        {"name": "tables", "is_folder": True},
                        {"name": "reports", "is_folder": True},
                    ]},
                    {"name": "requirements.txt", "is_folder": False, "template_type": "empty"},
                ]}
            ]
        },
        "Obsidian Vault": {
            "name": "Obsidian Vault",
            "description": "Organized Obsidian vault structure",
            "variables": {"VAULT_NAME": "My-Vault"},
            "root_items": [
                {"name": "{VAULT_NAME}", "is_folder": True, "children": [
                    {"name": "00_Inbox", "is_folder": True},
                    {"name": "01_Projects", "is_folder": True},
                    {"name": "02_Areas", "is_folder": True},
                    {"name": "03_Resources", "is_folder": True},
                    {"name": "04_Archive", "is_folder": True},
                    {"name": "Templates", "is_folder": True, "children": [
                        {"name": "Note Template.md", "is_folder": False, "template_type": "markdown"},
                        {"name": "Project Template.md", "is_folder": False, "template_type": "markdown"},
                    ]},
                    {"name": "Attachments", "is_folder": True},
                ]}
            ]
        },
        "Empty Template": {
            "name": "Empty Template",
            "description": "Start from scratch",
            "variables": {"PROJECT_NAME": "New-Project"},
            "root_items": []
        }
    }
    
    def __init__(self, definitions_manager: 'ObsidianDefinitionsManager'):
        super().__init__()
        self.definitions_manager = definitions_manager
        self.current_template: Optional[ProjectTemplate] = None
        self._setup_ui()
        self._load_empty_template()
    
    def _setup_ui(self) -> None:
        """Setup the user interface."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 10, 10, 10)
        layout.setSpacing(10)
        
        # Title
        title = QLabel("🏗️ Structure Builder - Create Custom Folder Templates")
        title.setStyleSheet("font-size: 16px; font-weight: bold; margin-bottom: 10px;")
        layout.addWidget(title)
        
        # Main splitter
        splitter = QSplitter(Qt.Horizontal)
        layout.addWidget(splitter)
        
        # LEFT: Template tree
        left_panel = self._create_tree_panel()
        splitter.addWidget(left_panel)
        
        # RIGHT: Properties & preview
        right_panel = self._create_properties_panel()
        splitter.addWidget(right_panel)
        
        splitter.setSizes([400, 600])
    
    def _create_tree_panel(self) -> QWidget:
        """Create the folder tree panel."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(5, 5, 5, 5)
        
        # Template selection
        template_group = QGroupBox("📋 Template")
        template_layout = QVBoxLayout()
        
        # Load template dropdown
        load_layout = QHBoxLayout()
        load_layout.addWidget(QLabel("Load:"))
        self.template_combo = QComboBox()
        self.template_combo.addItems(list(self.BUILTIN_TEMPLATES.keys()))
        self.template_combo.currentTextChanged.connect(self._load_builtin_template)
        load_layout.addWidget(self.template_combo)
        template_layout.addLayout(load_layout)
        
        # Template name
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("Name:"))
        self.template_name_edit = QLineEdit()
        self.template_name_edit.setPlaceholderText("My Template")
        name_layout.addWidget(self.template_name_edit)
        template_layout.addLayout(name_layout)
        
        # Save/Load buttons
        btn_layout = QHBoxLayout()
        save_btn = QPushButton("💾 Save Template")
        save_btn.clicked.connect(self._save_template)
        btn_layout.addWidget(save_btn)
        
        load_file_btn = QPushButton("📂 Load File")
        load_file_btn.clicked.connect(self._load_template_file)
        btn_layout.addWidget(load_file_btn)
        template_layout.addLayout(btn_layout)
        
        template_group.setLayout(template_layout)
        layout.addWidget(template_group)
        
        # Folder tree
        tree_group = QGroupBox("📁 Folder Structure")
        tree_layout = QVBoxLayout()
        
        # Tree widget
        self.tree = QTreeWidget()
        self.tree.setHeaderLabels(["Name", "Type"])
        self.tree.setColumnWidth(0, 250)
        self.tree.setContextMenuPolicy(Qt.CustomContextMenu)
        self.tree.customContextMenuRequested.connect(self._show_context_menu)
        self.tree.itemClicked.connect(self._on_item_selected)
        tree_layout.addWidget(self.tree)
        
        # Add buttons
        add_layout = QHBoxLayout()
        
        add_folder_btn = QPushButton("📁 Add Folder")
        add_folder_btn.clicked.connect(lambda: self._add_item(is_folder=True))
        add_layout.addWidget(add_folder_btn)
        
        add_file_btn = QPushButton("📄 Add File")
        add_file_btn.clicked.connect(lambda: self._add_item(is_folder=False))
        add_layout.addWidget(add_file_btn)
        
        delete_btn = QPushButton("🗑️ Delete")
        delete_btn.clicked.connect(self._delete_item)
        add_layout.addWidget(delete_btn)
        
        tree_layout.addLayout(add_layout)
        
        tree_group.setLayout(tree_layout)
        layout.addWidget(tree_group)
        
        return panel
    
    def _create_properties_panel(self) -> QWidget:
        """Create the properties and preview panel."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(5, 5, 5, 5)
        
        # Variables section
        vars_group = QGroupBox("🔤 Variables (use {VAR_NAME} in names)")
        vars_layout = QVBoxLayout()
        
        self.vars_text = QTextEdit()
        self.vars_text.setPlaceholderText("One variable per line:\nPROJECT_NAME=My Project\nAUTHOR=Your Name")
        self.vars_text.setMaximumHeight(100)
        vars_layout.addWidget(self.vars_text)
        
        vars_group.setLayout(vars_layout)
        layout.addWidget(vars_group)
        
        # Item properties
        props_group = QGroupBox("⚙️ Selected Item Properties")
        props_layout = QVBoxLayout()
        
        # Name
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("Name:"))
        self.item_name_edit = QLineEdit()
        self.item_name_edit.textChanged.connect(self._update_item_name)
        name_layout.addWidget(self.item_name_edit)
        props_layout.addLayout(name_layout)
        
        # Type (for files)
        type_layout = QHBoxLayout()
        type_layout.addWidget(QLabel("Template:"))
        self.item_type_combo = QComboBox()
        self.item_type_combo.addItems(["empty", "markdown", "python", "json", "csv", "custom"])
        self.item_type_combo.currentTextChanged.connect(self._update_item_type)
        type_layout.addWidget(self.item_type_combo)
        props_layout.addLayout(type_layout)
        
        # Custom content
        props_layout.addWidget(QLabel("Custom Content:"))
        self.item_content_edit = QTextEdit()
        self.item_content_edit.setPlaceholderText("Custom file content (use {VARIABLES})")
        self.item_content_edit.textChanged.connect(self._update_item_content)
        props_layout.addWidget(self.item_content_edit)
        
        props_group.setLayout(props_layout)
        layout.addWidget(props_group)
        
        # Generate section
        gen_group = QGroupBox("🚀 Generate Structure")
        gen_layout = QVBoxLayout()
        
        # Target folder
        target_layout = QHBoxLayout()
        target_layout.addWidget(QLabel("Target:"))
        self.target_edit = QLineEdit()
        self.target_edit.setPlaceholderText("Select target folder...")
        target_layout.addWidget(self.target_edit)
        
        browse_btn = QPushButton("📂")
        browse_btn.clicked.connect(self._browse_target)
        target_layout.addWidget(browse_btn)
        gen_layout.addLayout(target_layout)
        
        # Repeat count
        repeat_layout = QHBoxLayout()
        repeat_layout.addWidget(QLabel("Create copies:"))
        self.repeat_spin = QSpinBox()
        self.repeat_spin.setMinimum(1)
        self.repeat_spin.setMaximum(100)
        self.repeat_spin.setValue(1)
        repeat_layout.addWidget(self.repeat_spin)
        repeat_layout.addWidget(QLabel("(use {N} for number)"))
        repeat_layout.addStretch()
        gen_layout.addLayout(repeat_layout)
        
        # Options
        self.dry_run_cb = QCheckBox("🔍 Dry run (preview only)")
        self.dry_run_cb.setChecked(True)
        gen_layout.addWidget(self.dry_run_cb)
        
        self.overwrite_cb = QCheckBox("⚠️ Overwrite existing files")
        gen_layout.addWidget(self.overwrite_cb)
        
        # Generate button
        self.generate_btn = QPushButton("🚀 GENERATE STRUCTURE")
        self.generate_btn.setStyleSheet("""
            QPushButton {
                background-color: #2d7d46;
                color: white;
                font-weight: bold;
                padding: 12px;
                font-size: 14px;
            }
            QPushButton:hover { background-color: #3d9d56; }
        """)
        self.generate_btn.clicked.connect(self._generate_structure)
        gen_layout.addWidget(self.generate_btn)
        
        # Results
        self.results_text = QTextEdit()
        self.results_text.setReadOnly(True)
        self.results_text.setMaximumHeight(150)
        self.results_text.setPlaceholderText("Generation results will appear here...")
        gen_layout.addWidget(self.results_text)
        
        gen_group.setLayout(gen_layout)
        layout.addWidget(gen_group)
        
        return panel
    
    def _load_empty_template(self) -> None:
        """Load an empty template."""
        self.current_template = ProjectTemplate(
            name="New Template",
            created=datetime.now().strftime("%Y-%m-%d")
        )
        self._refresh_tree()
    
    def _load_builtin_template(self, name: str) -> None:
        """Load a built-in template."""
        if name in self.BUILTIN_TEMPLATES:
            data = self.BUILTIN_TEMPLATES[name]
            self.current_template = ProjectTemplate.from_dict(data)
            self.template_name_edit.setText(name)
            
            # Update variables text
            vars_lines = [f"{k}={v}" for k, v in self.current_template.variables.items()]
            self.vars_text.setPlainText("\n".join(vars_lines))
            
            self._refresh_tree()
    
    def _refresh_tree(self) -> None:
        """Refresh the tree widget from current template."""
        self.tree.clear()
        
        if not self.current_template:
            return
        
        for item in self.current_template.root_items:
            tree_item = self._create_tree_item(item)
            self.tree.addTopLevelItem(tree_item)
        
        self.tree.expandAll()
    
    def _create_tree_item(self, folder_item: FolderItem) -> QTreeWidgetItem:
        """Create a tree widget item from a FolderItem."""
        icon = "📁" if folder_item.is_folder else "📄"
        tree_item = QTreeWidgetItem([f"{icon} {folder_item.name}", folder_item.template_type])
        tree_item.setData(0, Qt.UserRole, folder_item)
        
        for child in folder_item.children:
            child_item = self._create_tree_item(child)
            tree_item.addChild(child_item)
        
        return tree_item
    
    def _add_item(self, is_folder: bool) -> None:
        """Add a new folder or file."""
        name, ok = QInputDialog.getText(
            self,
            "Add " + ("Folder" if is_folder else "File"),
            "Name:" + (" (use {VARIABLES})" if is_folder else " (with extension)"),
            text="New_Folder" if is_folder else "new_file.md"
        )
        
        if not ok or not name:
            return
        
        new_item = FolderItem(
            name=name,
            is_folder=is_folder,
            template_type="empty" if is_folder else "markdown" if name.endswith('.md') else "empty"
        )
        
        # Add to selected item or root
        selected = self.tree.currentItem()
        if selected:
            parent_item = selected.data(0, Qt.UserRole)
            if parent_item and parent_item.is_folder:
                parent_item.children.append(new_item)
            else:
                # Add as sibling
                self.current_template.root_items.append(new_item)
        else:
            self.current_template.root_items.append(new_item)
        
        self._refresh_tree()
    
    def _delete_item(self) -> None:
        """Delete selected item."""
        selected = self.tree.currentItem()
        if not selected:
            return
        
        folder_item = selected.data(0, Qt.UserRole)
        if not folder_item:
            return
        
        reply = QMessageBox.question(
            self, "Delete",
            f"Delete '{folder_item.name}' and all its contents?",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply != QMessageBox.Yes:
            return
        
        # Remove from parent
        def remove_from_list(items: List[FolderItem], target: FolderItem) -> bool:
            for i, item in enumerate(items):
                if item is target:
                    items.pop(i)
                    return True
                if remove_from_list(item.children, target):
                    return True
            return False
        
        remove_from_list(self.current_template.root_items, folder_item)
        self._refresh_tree()
    
    def _on_item_selected(self, item: QTreeWidgetItem) -> None:
        """Handle item selection."""
        folder_item = item.data(0, Qt.UserRole)
        if not folder_item:
            return
        
        self.item_name_edit.setText(folder_item.name)
        self.item_type_combo.setCurrentText(folder_item.template_type)
        self.item_content_edit.setPlainText(folder_item.template_content)
        
        # Enable/disable based on type
        is_file = not folder_item.is_folder
        self.item_type_combo.setEnabled(is_file)
        self.item_content_edit.setEnabled(is_file)
    
    def _update_item_name(self, name: str) -> None:
        """Update selected item's name."""
        selected = self.tree.currentItem()
        if selected:
            folder_item = selected.data(0, Qt.UserRole)
            if folder_item:
                folder_item.name = name
                icon = "📁" if folder_item.is_folder else "📄"
                selected.setText(0, f"{icon} {name}")
    
    def _update_item_type(self, template_type: str) -> None:
        """Update selected item's template type."""
        selected = self.tree.currentItem()
        if selected:
            folder_item = selected.data(0, Qt.UserRole)
            if folder_item:
                folder_item.template_type = template_type
                selected.setText(1, template_type)
    
    def _update_item_content(self) -> None:
        """Update selected item's content."""
        selected = self.tree.currentItem()
        if selected:
            folder_item = selected.data(0, Qt.UserRole)
            if folder_item:
                folder_item.template_content = self.item_content_edit.toPlainText()
    
    def _show_context_menu(self, pos) -> None:
        """Show context menu for tree items."""
        menu = QMenu(self)
        
        add_folder_action = menu.addAction("📁 Add Subfolder")
        add_folder_action.triggered.connect(lambda: self._add_item(True))
        
        add_file_action = menu.addAction("📄 Add File")
        add_file_action.triggered.connect(lambda: self._add_item(False))
        
        menu.addSeparator()
        
        delete_action = menu.addAction("🗑️ Delete")
        delete_action.triggered.connect(self._delete_item)
        
        menu.exec_(self.tree.mapToGlobal(pos))
    
    def _browse_target(self) -> None:
        """Browse for target folder."""
        folder = QFileDialog.getExistingDirectory(self, "Select Target Folder")
        if folder:
            self.target_edit.setText(folder)
    
    def _save_template(self) -> None:
        """Save template to file."""
        if not self.current_template:
            return
        
        self.current_template.name = self.template_name_edit.text() or "Untitled"
        
        # Parse variables
        vars_text = self.vars_text.toPlainText()
        self.current_template.variables = {}
        for line in vars_text.split('\n'):
            if '=' in line:
                key, val = line.split('=', 1)
                self.current_template.variables[key.strip()] = val.strip()
        
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Save Template",
            f"{self.current_template.name}.json",
            "JSON Files (*.json)"
        )
        
        if file_path:
            self.current_template.save(Path(file_path))
            QMessageBox.information(self, "Saved", f"Template saved to {file_path}")
    
    def _load_template_file(self) -> None:
        """Load template from file."""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Load Template",
            "",
            "JSON Files (*.json)"
        )
        
        if file_path:
            try:
                self.current_template = ProjectTemplate.load(Path(file_path))
                self.template_name_edit.setText(self.current_template.name)
                
                vars_lines = [f"{k}={v}" for k, v in self.current_template.variables.items()]
                self.vars_text.setPlainText("\n".join(vars_lines))
                
                self._refresh_tree()
                QMessageBox.information(self, "Loaded", f"Template loaded from {file_path}")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Failed to load template: {e}")
    
    def _generate_structure(self) -> None:
        """Generate the folder structure."""
        if not self.current_template:
            QMessageBox.warning(self, "No Template", "Please create or load a template first.")
            return
        
        target = self.target_edit.text()
        if not target:
            QMessageBox.warning(self, "No Target", "Please select a target folder.")
            return
        
        target_path = Path(target)
        dry_run = self.dry_run_cb.isChecked()
        overwrite = self.overwrite_cb.isChecked()
        repeat = self.repeat_spin.value()
        
        # Parse variables
        variables = {}
        for line in self.vars_text.toPlainText().split('\n'):
            if '=' in line:
                key, val = line.split('=', 1)
                variables[key.strip()] = val.strip()
        
        results = []
        
        for n in range(1, repeat + 1):
            # Add {N} variable for current iteration
            vars_with_n = {**variables, 'N': str(n).zfill(2)}
            
            for item in self.current_template.root_items:
                self._generate_item(target_path, item, vars_with_n, dry_run, overwrite, results)
        
        # Show results
        created = sum(1 for r in results if r.startswith("Created"))
        skipped = sum(1 for r in results if r.startswith("Skipped"))
        
        summary = f"{'DRY RUN - ' if dry_run else ''}Generation Complete!\n\n"
        summary += f"✅ Created: {created}\n"
        summary += f"⏭️ Skipped: {skipped}\n\n"
        
        if len(results) <= 20:
            summary += "Details:\n" + "\n".join(results)
        else:
            summary += "Details (first 20):\n" + "\n".join(results[:20])
            summary += f"\n... and {len(results) - 20} more"
        
        self.results_text.setPlainText(summary)
        
        if not dry_run:
            QMessageBox.information(self, "Complete", f"Created {created} items!")
    
    def _generate_item(
        self,
        parent_path: Path,
        item: FolderItem,
        variables: Dict[str, str],
        dry_run: bool,
        overwrite: bool,
        results: List[str]
    ) -> None:
        """Recursively generate a folder/file item."""
        # Replace variables in name
        name = item.name
        for var, val in variables.items():
            name = name.replace(f"{{{var}}}", val)
        
        item_path = parent_path / name
        
        if item.is_folder:
            if not item_path.exists():
                if not dry_run:
                    item_path.mkdir(parents=True, exist_ok=True)
                results.append(f"Created folder: {item_path}")
            else:
                results.append(f"Skipped (exists): {item_path}")
            
            # Generate children
            for child in item.children:
                self._generate_item(item_path, child, variables, dry_run, overwrite, results)
        else:
            # File
            if item_path.exists() and not overwrite:
                results.append(f"Skipped (exists): {item_path}")
            else:
                content = self._generate_file_content(item, variables)
                if not dry_run:
                    item_path.parent.mkdir(parents=True, exist_ok=True)
                    item_path.write_text(content, encoding='utf-8')
                results.append(f"Created file: {item_path}")
    
    def _generate_file_content(self, item: FolderItem, variables: Dict[str, str]) -> str:
        """Generate content for a file based on its template type."""
        # Replace variables in custom content
        content = item.template_content
        for var, val in variables.items():
            content = content.replace(f"{{{var}}}", val)
        
        if content:
            return content
        
        # Generate default content based on type
        date = datetime.now().strftime("%Y-%m-%d")
        project = variables.get('PROJECT_NAME', variables.get('PAPER_TITLE', 'Project'))
        
        templates = {
            "markdown": f"""---
created: {date}
---

# {item.name.replace('.md', '')}

## Overview

[Content here]

---
""",
            "python": f'''"""
{item.name}
{'=' * len(item.name)}

Created: {date}
"""

def main():
    """Main entry point."""
    pass


if __name__ == "__main__":
    main()
''',
            "json": "{\n  \n}\n",
            "csv": "column1,column2,column3\n",
            "empty": "",
        }
        
        return templates.get(item.template_type, "")

