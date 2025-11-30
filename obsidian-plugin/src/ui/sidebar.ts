/**
 * Semantic Blocks Sidebar Panel
 *
 * Displays document statistics and provides quick actions.
 */

import { App, ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import {
  SemanticBlock,
  DocumentStats,
  TheophysicsSettings,
  SemanticType,
} from '../types';
import { parseSemanticMarkers } from '../semantic/parser';
import { SEMANTIC_ICONS, SEMANTIC_COLORS } from '../semantic/renderer';
import { SyncManager } from '../database/sync';

export const SIDEBAR_VIEW_TYPE = 'theophysics-sidebar';

/**
 * Sidebar View
 */
export class TheophysicsSidebarView extends ItemView {
  private settings: TheophysicsSettings;
  private syncManager: SyncManager | null = null;
  private currentFile: TFile | null = null;
  private blocks: SemanticBlock[] = [];
  private contentEl: HTMLElement | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    settings: TheophysicsSettings
  ) {
    super(leaf);
    this.settings = settings;
  }

  /**
   * Set sync manager
   */
  setSyncManager(manager: SyncManager): void {
    this.syncManager = manager;
  }

  /**
   * Get view type
   */
  getViewType(): string {
    return SIDEBAR_VIEW_TYPE;
  }

  /**
   * Get display text
   */
  getDisplayText(): string {
    return 'Theophysics Research';
  }

  /**
   * Get icon
   */
  getIcon(): string {
    return 'flask-conical';
  }

  /**
   * On open
   */
  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    // Header
    const header = container.createDiv({ cls: 'theophysics-sidebar-header' });
    header.createEl('h4', { text: 'Semantic Blocks' });

    // Stats container
    this.contentEl = container.createDiv({ cls: 'theophysics-sidebar-content' });

    // Actions container
    const actions = container.createDiv({ cls: 'theophysics-sidebar-actions' });
    this.createActionButtons(actions);

    // Sync status
    const syncStatus = container.createDiv({ cls: 'theophysics-sidebar-sync' });
    this.updateSyncStatus(syncStatus);

    // Watch for active file changes
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.updateContent();
      })
    );

    // Watch for file changes
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file === this.currentFile) {
          this.updateContent();
        }
      })
    );

    // Initial update
    this.updateContent();
  }

  /**
   * Update content based on active file
   */
  async updateContent(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile || activeFile.extension !== 'md') {
      if (this.contentEl) {
        this.contentEl.empty();
        this.contentEl.createEl('p', {
          text: 'Open a markdown file to see semantic blocks.',
          cls: 'theophysics-sidebar-empty',
        });
      }
      this.currentFile = null;
      return;
    }

    this.currentFile = activeFile;
    const content = await this.app.vault.read(activeFile);
    this.blocks = parseSemanticMarkers(content, activeFile.path);

    this.renderStats();
    this.renderBlockList();
  }

  /**
   * Render statistics
   */
  private renderStats(): void {
    if (!this.contentEl) return;
    this.contentEl.empty();

    const stats = this.calculateStats();

    // Stats grid
    const statsGrid = this.contentEl.createDiv({ cls: 'theophysics-stats-grid' });

    const typeOrder: SemanticType[] = [
      'hypothesis', 'evidence', 'axiom', 'definition',
      'derivation', 'claim', 'citation', 'cross-ref',
    ];

    for (const type of typeOrder) {
      const count = stats.byType[type] || 0;
      if (count > 0 || type === 'hypothesis' || type === 'evidence') {
        this.createStatCard(statsGrid, type, count);
      }
    }

    // Total
    const totalCard = statsGrid.createDiv({ cls: 'theophysics-stat-card theophysics-stat-total' });
    totalCard.createSpan({ text: 'Total' });
    totalCard.createSpan({ text: String(stats.total), cls: 'theophysics-stat-value' });
  }

  /**
   * Create a stat card
   */
  private createStatCard(
    container: HTMLElement,
    type: SemanticType,
    count: number
  ): void {
    const colors = SEMANTIC_COLORS[type];
    const icon = SEMANTIC_ICONS[type];

    const card = container.createDiv({ cls: 'theophysics-stat-card' });
    card.style.borderLeftColor = colors.border;

    const iconSpan = card.createSpan({ text: icon, cls: 'theophysics-stat-icon' });
    const labelSpan = card.createSpan({
      text: this.formatTypeName(type),
      cls: 'theophysics-stat-label',
    });
    const valueSpan = card.createSpan({
      text: String(count),
      cls: 'theophysics-stat-value',
    });

    // Click to filter
    card.addEventListener('click', () => {
      this.filterBlocksByType(type);
    });
  }

  /**
   * Render block list
   */
  private renderBlockList(): void {
    if (!this.contentEl) return;

    const listContainer = this.contentEl.createDiv({
      cls: 'theophysics-block-list',
    });

    listContainer.createEl('h5', { text: 'Recent Blocks' });

    // Show last 10 blocks
    const recentBlocks = this.blocks.slice(-10).reverse();

    if (recentBlocks.length === 0) {
      listContainer.createEl('p', {
        text: 'No semantic blocks found.',
        cls: 'theophysics-sidebar-empty',
      });
      return;
    }

    const list = listContainer.createEl('ul', { cls: 'theophysics-block-items' });

    for (const block of recentBlocks) {
      const item = list.createEl('li', { cls: 'theophysics-block-item' });

      const icon = SEMANTIC_ICONS[block.semanticType];
      const preview = block.content.length > 50
        ? block.content.substring(0, 50) + '...'
        : block.content;

      item.createSpan({ text: icon, cls: 'theophysics-block-icon' });
      item.createSpan({ text: preview, cls: 'theophysics-block-preview' });

      // Click to navigate
      item.addEventListener('click', () => {
        this.navigateToBlock(block);
      });
    }
  }

  /**
   * Create action buttons
   */
  private createActionButtons(container: HTMLElement): void {
    const createButton = (text: string, callback: () => void) => {
      const btn = container.createEl('button', {
        text,
        cls: 'theophysics-action-btn',
      });
      btn.addEventListener('click', callback);
      return btn;
    };

    createButton('Auto-Classify', () => {
      this.app.commands.executeCommandById('theophysics:auto-classify');
    });

    createButton('Bundle Evidence', () => {
      this.app.commands.executeCommandById('theophysics:bundle-evidence');
    });

    createButton('Sync to Database', () => {
      this.app.commands.executeCommandById('theophysics:sync-now');
    });
  }

  /**
   * Update sync status display
   */
  private updateSyncStatus(container: HTMLElement): void {
    container.empty();

    if (!this.syncManager) {
      container.createEl('span', {
        text: 'Sync: Not configured',
        cls: 'theophysics-sync-status theophysics-sync-warning',
      });
      return;
    }

    const state = this.syncManager.getState();

    let statusText: string;
    let statusClass: string;

    if (state.isSyncing) {
      statusText = `Syncing... (${state.pendingChanges} pending)`;
      statusClass = 'theophysics-sync-active';
    } else if (state.isConnected) {
      statusText = state.lastSyncTime
        ? `Last sync: ${this.formatTime(state.lastSyncTime)}`
        : 'Connected';
      statusClass = 'theophysics-sync-connected';
    } else {
      statusText = state.error || 'Disconnected';
      statusClass = 'theophysics-sync-error';
    }

    container.createEl('span', {
      text: statusText,
      cls: `theophysics-sync-status ${statusClass}`,
    });
  }

  /**
   * Calculate statistics
   */
  private calculateStats(): { byType: Record<string, number>; total: number } {
    const byType: Record<string, number> = {};

    for (const block of this.blocks) {
      byType[block.semanticType] = (byType[block.semanticType] || 0) + 1;
    }

    return {
      byType,
      total: this.blocks.length,
    };
  }

  /**
   * Filter blocks by type (highlight in editor)
   */
  private filterBlocksByType(type: SemanticType): void {
    const filtered = this.blocks.filter(b => b.semanticType === type);
    console.log(`Filtering ${filtered.length} blocks of type ${type}`);
    // TODO: Implement highlighting in editor
  }

  /**
   * Navigate to a block in the editor
   */
  private navigateToBlock(block: SemanticBlock): void {
    if (!this.currentFile) return;

    const leaf = this.app.workspace.getLeaf();
    leaf.openFile(this.currentFile).then(() => {
      const view = this.app.workspace.getActiveViewOfType(
        require('obsidian').MarkdownView
      );
      if (view) {
        const editor = view.editor;
        const line = block.position.line - 1;
        editor.setCursor({ line, ch: 0 });
        editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } });
      }
    });
  }

  /**
   * Format type name for display
   */
  private formatTypeName(type: SemanticType): string {
    return type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
  }

  /**
   * Format time for display
   */
  private formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString();
  }

  /**
   * On close
   */
  async onClose(): Promise<void> {
    // Cleanup
  }
}

/**
 * Register the sidebar view
 */
export function registerSidebarView(
  app: App,
  settings: TheophysicsSettings
): void {
  app.workspace.on('layout-ready', () => {
    // Add the view if not present
    if (!app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE).length) {
      app.workspace.getRightLeaf(false)?.setViewState({
        type: SIDEBAR_VIEW_TYPE,
        active: true,
      });
    }
  });
}
