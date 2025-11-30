/**
 * Settings Tab
 *
 * Plugin settings configuration UI.
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import {
  TheophysicsSettings,
  DEFAULT_SETTINGS,
  TranslationLevel,
  LinkSource,
} from '../types';

/**
 * Settings Tab
 */
export class TheophysicsSettingTab extends PluginSettingTab {
  private settings: TheophysicsSettings;
  private saveSettings: () => Promise<void>;

  constructor(
    app: App,
    containerEl: HTMLElement,
    settings: TheophysicsSettings,
    saveSettings: () => Promise<void>
  ) {
    // Create a minimal plugin object for the parent class
    const plugin = { app, manifest: { id: 'theophysics-research-assistant', name: 'Theophysics Research Assistant' } } as any;
    super(app, plugin);
    this.containerEl = containerEl;
    this.settings = settings;
    this.saveSettings = saveSettings;
  }

  /**
   * Display settings
   */
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
          .setValue(this.settings.autoClassifyOnSave)
          .onChange(async (value) => {
            this.settings.autoClassifyOnSave = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show markers in edit mode')
      .setDesc('Display semantic markers when editing (they are always hidden in reading view)')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.showMarkersInEditMode)
          .onChange(async (value) => {
            this.settings.showMarkersInEditMode = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Highlight by type')
      .setDesc('Color-code semantic blocks by their type')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.highlightByType)
          .onChange(async (value) => {
            this.settings.highlightByType = value;
            await this.saveSettings();
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
          .setValue(this.settings.database.host)
          .onChange(async (value) => {
            this.settings.database.host = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('PostgreSQL Port')
      .setDesc('Database server port')
      .addText((text) =>
        text
          .setPlaceholder('5432')
          .setValue(String(this.settings.database.port))
          .onChange(async (value) => {
            this.settings.database.port = parseInt(value) || 5432;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Database Name')
      .setDesc('Name of the PostgreSQL database')
      .addText((text) =>
        text
          .setPlaceholder('theophysics_research')
          .setValue(this.settings.database.database)
          .onChange(async (value) => {
            this.settings.database.database = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Database User')
      .setDesc('PostgreSQL username')
      .addText((text) =>
        text
          .setPlaceholder('postgres')
          .setValue(this.settings.database.user)
          .onChange(async (value) => {
            this.settings.database.user = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Database Password')
      .setDesc('PostgreSQL password')
      .addText((text) => {
        text.inputEl.type = 'password';
        return text
          .setPlaceholder('password')
          .setValue(this.settings.database.password)
          .onChange(async (value) => {
            this.settings.database.password = value;
            await this.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Enable bidirectional sync')
      .setDesc('Sync changes both to and from the database')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.enableBidirectionalSync)
          .onChange(async (value) => {
            this.settings.enableBidirectionalSync = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto-sync on save')
      .setDesc('Automatically sync to database when saving')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.autoSyncOnSave)
          .onChange(async (value) => {
            this.settings.autoSyncOnSave = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Sync debounce (ms)')
      .setDesc('Wait time before syncing after changes')
      .addText((text) =>
        text
          .setPlaceholder('5000')
          .setValue(String(this.settings.syncDebounceMs))
          .onChange(async (value) => {
            this.settings.syncDebounceMs = parseInt(value) || 5000;
            await this.saveSettings();
          })
      );

    // ===================
    // Math Translation Section
    // ===================
    containerEl.createEl('h3', { text: 'Math Translation' });

    new Setting(containerEl)
      .setName('Default translation level')
      .setDesc('Level of detail for math translations')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('basic', 'Basic')
          .addOption('medium', 'Medium')
          .addOption('academic', 'Academic')
          .setValue(this.settings.defaultTranslationLevel)
          .onChange(async (value) => {
            this.settings.defaultTranslationLevel = value as TranslationLevel;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show translations inline')
      .setDesc('Display translations below math blocks')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.showTranslationsInline)
          .onChange(async (value) => {
            this.settings.showTranslationsInline = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Include info theory equivalents')
      .setDesc('Show information theory interpretations when available')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.includeInfoTheoryEquivalents)
          .onChange(async (value) => {
            this.settings.includeInfoTheoryEquivalents = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show context warnings')
      .setDesc('Display warnings for ambiguous symbols (e.g., G = Grace or Gravity)')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.showContextWarnings)
          .onChange(async (value) => {
            this.settings.showContextWarnings = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Math translation table path')
      .setDesc('Path to CSV file with symbol translations')
      .addText((text) =>
        text
          .setPlaceholder('/path/to/MATH_TRANSLATION_TABLE.csv')
          .setValue(this.settings.mathTablePath)
          .onChange(async (value) => {
            this.settings.mathTablePath = value;
            await this.saveSettings();
          })
      );

    // ===================
    // AI Integration Section
    // ===================
    containerEl.createEl('h3', { text: 'AI Integration' });

    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select the AI provider for classification')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('local', 'Local (pattern matching)')
          .addOption('api', 'Custom API')
          .addOption('openai', 'OpenAI')
          .addOption('anthropic', 'Anthropic')
          .setValue(this.settings.aiProvider.provider)
          .onChange(async (value) => {
            this.settings.aiProvider.provider = value as any;
            await this.saveSettings();
            this.display(); // Refresh to show/hide API key fields
          })
      );

    if (this.settings.aiProvider.provider !== 'local') {
      new Setting(containerEl)
        .setName('API Key')
        .setDesc('API key for the selected provider')
        .addText((text) => {
          text.inputEl.type = 'password';
          return text
            .setPlaceholder('sk-...')
            .setValue(this.settings.aiProvider.apiKey || '')
            .onChange(async (value) => {
              this.settings.aiProvider.apiKey = value;
              await this.saveSettings();
            });
        });

      if (this.settings.aiProvider.provider === 'api') {
        new Setting(containerEl)
          .setName('API Endpoint')
          .setDesc('Custom API endpoint URL')
          .addText((text) =>
            text
              .setPlaceholder('http://localhost:5000')
              .setValue(this.settings.aiProvider.endpoint || '')
              .onChange(async (value) => {
                this.settings.aiProvider.endpoint = value;
                await this.saveSettings();
              })
          );
      }

      new Setting(containerEl)
        .setName('Model')
        .setDesc('Specific model to use (optional)')
        .addText((text) =>
          text
            .setPlaceholder('gpt-4o-mini')
            .setValue(this.settings.aiProvider.model || '')
            .onChange(async (value) => {
              this.settings.aiProvider.model = value;
              await this.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName('Enable auto-classify')
      .setDesc('Automatically classify content using AI')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.enableAutoClassify)
          .onChange(async (value) => {
            this.settings.enableAutoClassify = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Enable auto-bundle evidence')
      .setDesc('Automatically find and bundle evidence for claims')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.enableAutoBundleEvidence)
          .onChange(async (value) => {
            this.settings.enableAutoBundleEvidence = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Enable auto-generate links')
      .setDesc('Automatically generate research links for proper names')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.enableAutoGenerateLinks)
          .onChange(async (value) => {
            this.settings.enableAutoGenerateLinks = value;
            await this.saveSettings();
          })
      );

    // ===================
    // UI Section
    // ===================
    containerEl.createEl('h3', { text: 'User Interface' });

    new Setting(containerEl)
      .setName('Show sidebar panel')
      .setDesc('Display the semantic blocks panel in the sidebar')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.showSidebarPanel)
          .onChange(async (value) => {
            this.settings.showSidebarPanel = value;
            await this.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Enable tooltips')
      .setDesc('Show tooltips when hovering over semantic blocks')
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.enableTooltips)
          .onChange(async (value) => {
            this.settings.enableTooltips = value;
            await this.saveSettings();
          })
      );

    // ===================
    // Reset Section
    // ===================
    containerEl.createEl('h3', { text: 'Reset' });

    new Setting(containerEl)
      .setName('Reset to defaults')
      .setDesc('Reset all settings to their default values')
      .addButton((button) =>
        button
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            Object.assign(this.settings, DEFAULT_SETTINGS);
            await this.saveSettings();
            this.display();
          })
      );
  }
}

/**
 * Create settings tab for a plugin
 */
export function createSettingsTab(
  app: App,
  containerEl: HTMLElement,
  settings: TheophysicsSettings,
  saveSettings: () => Promise<void>
): TheophysicsSettingTab {
  return new TheophysicsSettingTab(app, containerEl, settings, saveSettings);
}
