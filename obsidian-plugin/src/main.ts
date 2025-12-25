/**
 * Theophysics Research Assistant
 *
 * Obsidian plugin for semantic markup, math translation, AI-powered research
 * assistance, and PostgreSQL sync for the Theophysics vault system.
 */

import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
  MarkdownView,
  TFile,
  Notice,
} from 'obsidian';

import {
  TheophysicsSettings,
  DEFAULT_SETTINGS,
} from './types';

import {
  parseSemanticMarkers,
  stripSemanticMarkers,
} from './semantic/parser';

import {
  getSemanticStyles,
  semanticMarkdownPostProcessor,
} from './semantic/renderer';

import {
  MathTranslator,
  parseMathBlocks,
} from './math/translator';

import {
  getMathStyles,
  mathTranslationPostProcessor,
} from './math/display';

import {
  PostgresClient,
} from './database/postgres';

import {
  SyncManager,
  createSyncWatcher,
} from './database/sync';

import {
  ResearchLinkGenerator,
} from './links/generator';

import {
  TheophysicsSidebarView,
  SIDEBAR_VIEW_TYPE,
} from './ui/sidebar';

import {
  registerCommands,
} from './ui/commands';

/**
 * Main Plugin Class
 */
export default class TheophysicsPlugin extends Plugin {
  settings: TheophysicsSettings = DEFAULT_SETTINGS;
  translator: MathTranslator = new MathTranslator();
  dbClient: PostgresClient | null = null;
  syncManager: SyncManager | null = null;
  linkGenerator: ResearchLinkGenerator = new ResearchLinkGenerator();

  /**
   * On plugin load
   */
  async onload(): Promise<void> {
    console.log('Loading Theophysics Research Assistant');

    // Load settings
    await this.loadSettings();

    // Initialize components
    await this.initializeComponents();

    // Register view type
    this.registerView(
      SIDEBAR_VIEW_TYPE,
      (leaf) => new TheophysicsSidebarView(leaf, this.settings)
    );

    // Add ribbon icon
    this.addRibbonIcon('flask-conical', 'Theophysics Research', () => {
      this.activateSidebarView();
    });

    // Register markdown post-processor (hides semantic markers in reading view)
    this.registerMarkdownPostProcessor(semanticMarkdownPostProcessor);

    // Register math translation post-processor
    this.registerMarkdownPostProcessor(
      mathTranslationPostProcessor(
        this.translator,
        this.settings.defaultTranslationLevel,
        this.settings.showTranslationsInline
      )
    );

    // Register commands
    registerCommands(
      this.app,
      this.settings,
      this.translator,
      this.syncManager,
      this.linkGenerator
    );

    // Add settings tab
    this.addSettingTab(new TheophysicsSettingTab(this.app, this));

    // Add styles
    this.addStyles();

    // Initialize sidebar if enabled
    if (this.settings.showSidebarPanel) {
      this.app.workspace.onLayoutReady(() => {
        this.activateSidebarView();
      });
    }

    // Set up file watchers for auto-sync
    if (this.syncManager && this.settings.autoSyncOnSave) {
      createSyncWatcher(this.app, this.syncManager);
    }

    console.log('Theophysics Research Assistant loaded');
  }

  /**
   * On plugin unload
   */
  onunload(): void {
    console.log('Unloading Theophysics Research Assistant');

    // Close sidebar views
    this.app.workspace.detachLeavesOfType(SIDEBAR_VIEW_TYPE);
  }

  /**
   * Initialize plugin components
   */
  async initializeComponents(): Promise<void> {
    // Load math translation table if configured
    if (this.settings.mathTablePath) {
      try {
        const csvContent = await this.loadMathTable(this.settings.mathTablePath);
        if (csvContent) {
          this.translator.loadFromCSV(csvContent);
        }
      } catch (error) {
        console.error('Failed to load math translation table:', error);
      }
    }

    // Initialize database client
    if (this.settings.database.host) {
      this.dbClient = new PostgresClient(this.settings.database);

      // Test connection
      const connected = await this.dbClient.testConnection();
      if (connected) {
        console.log('Database connected');

        // Initialize sync manager
        this.syncManager = new SyncManager(
          this.app,
          this.dbClient,
          this.settings,
          this.translator
        );
      } else {
        console.warn('Database connection failed:', this.dbClient.getLastError());
      }
    }

    // Configure link generator priority
    if (this.settings.linkPriority.length > 0) {
      this.linkGenerator.setPriority(this.settings.linkPriority);
    }
  }

  /**
   * Load math translation table from file
   */
  async loadMathTable(path: string): Promise<string | null> {
    try {
      // Try loading from vault first
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        return await this.app.vault.read(file);
      }

      // Try loading from filesystem via fetch (for absolute paths)
      if (path.startsWith('/') || path.includes(':')) {
        // Use file:// protocol for local files
        const response = await fetch(`file://${path}`);
        if (response.ok) {
          return await response.text();
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to load math table:', error);
      return null;
    }
  }

  /**
   * Activate sidebar view
   */
  async activateSidebarView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: SIDEBAR_VIEW_TYPE,
          active: true,
        });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);

      // Pass sync manager to view
      const view = leaf.view;
      if (view instanceof TheophysicsSidebarView && this.syncManager) {
        view.setSyncManager(this.syncManager);
      }
    }
  }

  /**
   * Add plugin styles
   */
  addStyles(): void {
    const styleEl = document.createElement('style');
    styleEl.id = 'theophysics-styles';
    styleEl.textContent = `
      ${getSemanticStyles()}
      ${getMathStyles()}
      ${this.getPluginStyles()}
    `;
    document.head.appendChild(styleEl);

    // Clean up on unload
    this.register(() => {
      const el = document.getElementById('theophysics-styles');
      if (el) el.remove();
    });
  }

  /**
   * Get additional plugin styles
   */
  getPluginStyles(): string {
    return `
      /* Sidebar styles */
      .theophysics-sidebar-header {
        padding: 1em;
        border-bottom: 1px solid var(--background-modifier-border);
      }

      .theophysics-sidebar-header h4 {
        margin: 0;
      }

      .theophysics-sidebar-content {
        padding: 1em;
        overflow-y: auto;
      }

      .theophysics-sidebar-empty {
        color: var(--text-muted);
        font-style: italic;
      }

      .theophysics-stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5em;
        margin-bottom: 1em;
      }

      .theophysics-stat-card {
        display: flex;
        flex-direction: column;
        padding: 0.5em;
        border-left: 3px solid var(--background-modifier-border);
        background: var(--background-secondary);
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .theophysics-stat-card:hover {
        background: var(--background-modifier-hover);
      }

      .theophysics-stat-total {
        grid-column: span 2;
        border-left-color: var(--interactive-accent);
      }

      .theophysics-stat-icon {
        font-size: 1.2em;
        margin-bottom: 0.2em;
      }

      .theophysics-stat-label {
        font-size: 0.8em;
        color: var(--text-muted);
      }

      .theophysics-stat-value {
        font-size: 1.2em;
        font-weight: 600;
      }

      .theophysics-block-list {
        margin-top: 1em;
      }

      .theophysics-block-list h5 {
        margin: 0 0 0.5em 0;
        font-size: 0.9em;
        color: var(--text-muted);
      }

      .theophysics-block-items {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .theophysics-block-item {
        display: flex;
        gap: 0.5em;
        padding: 0.5em;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .theophysics-block-item:hover {
        background: var(--background-modifier-hover);
      }

      .theophysics-block-icon {
        flex-shrink: 0;
      }

      .theophysics-block-preview {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.9em;
      }

      .theophysics-sidebar-actions {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        padding: 1em;
        border-top: 1px solid var(--background-modifier-border);
      }

      .theophysics-action-btn {
        padding: 0.5em 1em;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        cursor: pointer;
        transition: background 0.2s;
      }

      .theophysics-action-btn:hover {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }

      .theophysics-sidebar-sync {
        padding: 0.5em 1em;
        font-size: 0.85em;
        border-top: 1px solid var(--background-modifier-border);
      }

      .theophysics-sync-status {
        display: block;
      }

      .theophysics-sync-connected {
        color: var(--text-success);
      }

      .theophysics-sync-active {
        color: var(--interactive-accent);
      }

      .theophysics-sync-error {
        color: var(--text-error);
      }

      .theophysics-sync-warning {
        color: var(--text-warning);
      }

      /* Hide translations toggle */
      .hide-math-translations .math-translation-container {
        display: none;
      }

      /* Reading view - hide semantic markers */
      .markdown-preview-view .semantic-marker-text {
        display: none;
      }
    `;
  }

  /**
   * Load settings
   */
  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  /**
   * Save settings
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

/**
 * Settings Tab
 */
class TheophysicsSettingTab extends PluginSettingTab {
  plugin: TheophysicsPlugin;

  constructor(app: App, plugin: TheophysicsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Theophysics Research Assistant' });

    // ===================
    // Semantic Markup Section
    // ===================
    containerEl.createEl('h3', { text: 'Semantic Markup' });

    new Setting(containerEl)
      .setName('Auto-classify on save')
      .setDesc('Automatically classify content when saving a document')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoClassifyOnSave)
          .onChange(async (value) => {
            this.plugin.settings.autoClassifyOnSave = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show markers in edit mode')
      .setDesc('Display semantic markers when editing')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showMarkersInEditMode)
          .onChange(async (value) => {
            this.plugin.settings.showMarkersInEditMode = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Highlight by type')
      .setDesc('Color-code semantic blocks by their type')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.highlightByType)
          .onChange(async (value) => {
            this.plugin.settings.highlightByType = value;
            await this.plugin.saveSettings();
          })
      );

    // ===================
    // Database Section
    // ===================
    containerEl.createEl('h3', { text: 'Database Sync' });

    new Setting(containerEl)
      .setName('PostgreSQL Host')
      .setDesc('Database server hostname')
      .addText((text) =>
        text
          .setPlaceholder('localhost')
          .setValue(this.plugin.settings.database.host)
          .onChange(async (value) => {
            this.plugin.settings.database.host = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('PostgreSQL Port')
      .setDesc('Database server port')
      .addText((text) =>
        text
          .setPlaceholder('5432')
          .setValue(String(this.plugin.settings.database.port))
          .onChange(async (value) => {
            this.plugin.settings.database.port = parseInt(value) || 5432;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Database Name')
      .addText((text) =>
        text
          .setPlaceholder('theophysics_research')
          .setValue(this.plugin.settings.database.database)
          .onChange(async (value) => {
            this.plugin.settings.database.database = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Database User')
      .addText((text) =>
        text
          .setPlaceholder('postgres')
          .setValue(this.plugin.settings.database.user)
          .onChange(async (value) => {
            this.plugin.settings.database.user = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Database Password')
      .addText((text) => {
        text.inputEl.type = 'password';
        return text
          .setPlaceholder('password')
          .setValue(this.plugin.settings.database.password)
          .onChange(async (value) => {
            this.plugin.settings.database.password = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Auto-sync on save')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoSyncOnSave)
          .onChange(async (value) => {
            this.plugin.settings.autoSyncOnSave = value;
            await this.plugin.saveSettings();
          })
      );

    // ===================
    // Math Translation Section
    // ===================
    containerEl.createEl('h3', { text: 'Math Translation' });

    new Setting(containerEl)
      .setName('Default translation level')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('basic', 'Basic')
          .addOption('medium', 'Medium')
          .addOption('academic', 'Academic')
          .setValue(this.plugin.settings.defaultTranslationLevel)
          .onChange(async (value) => {
            this.plugin.settings.defaultTranslationLevel = value as any;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show translations inline')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showTranslationsInline)
          .onChange(async (value) => {
            this.plugin.settings.showTranslationsInline = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Math translation table path')
      .setDesc('Path to CSV file with symbol translations')
      .addText((text) =>
        text
          .setPlaceholder('/path/to/MATH_TRANSLATION_TABLE.csv')
          .setValue(this.plugin.settings.mathTablePath)
          .onChange(async (value) => {
            this.plugin.settings.mathTablePath = value;
            await this.plugin.saveSettings();
          })
      );

    // ===================
    // AI Integration Section
    // ===================
    containerEl.createEl('h3', { text: 'AI Integration' });

    new Setting(containerEl)
      .setName('AI Provider')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('local', 'Local (pattern matching)')
          .addOption('api', 'Custom API')
          .addOption('openai', 'OpenAI')
          .addOption('anthropic', 'Anthropic')
          .setValue(this.plugin.settings.aiProvider.provider)
          .onChange(async (value) => {
            this.plugin.settings.aiProvider.provider = value as any;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.aiProvider.provider !== 'local') {
      new Setting(containerEl)
        .setName('API Key')
        .addText((text) => {
          text.inputEl.type = 'password';
          return text
            .setPlaceholder('sk-...')
            .setValue(this.plugin.settings.aiProvider.apiKey || '')
            .onChange(async (value) => {
              this.plugin.settings.aiProvider.apiKey = value;
              await this.plugin.saveSettings();
            });
        });
    }

    // ===================
    // UI Section
    // ===================
    containerEl.createEl('h3', { text: 'User Interface' });

    new Setting(containerEl)
      .setName('Show sidebar panel')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSidebarPanel)
          .onChange(async (value) => {
            this.plugin.settings.showSidebarPanel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Enable tooltips')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableTooltips)
          .onChange(async (value) => {
            this.plugin.settings.enableTooltips = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
