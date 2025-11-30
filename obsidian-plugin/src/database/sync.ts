/**
 * Sync Manager
 *
 * Handles bidirectional synchronization between Obsidian and PostgreSQL.
 */

import { App, TFile, debounce } from 'obsidian';
import {
  SemanticBlock,
  MathBlock,
  EvidenceBundle,
  SyncState,
  SyncQueueItem,
  TheophysicsSettings,
} from '../types';
import { PostgresClient } from './postgres';
import { parseSemanticMarkers } from '../semantic/parser';
import { parseMathBlocks, MathTranslator } from '../math/translator';

/**
 * Sync Manager class
 */
export class SyncManager {
  private app: App;
  private client: PostgresClient;
  private settings: TheophysicsSettings;
  private translator: MathTranslator;
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing: boolean = false;
  private lastSyncTime: Date | null = null;

  // Debounced sync function
  private debouncedSync: () => void;

  constructor(
    app: App,
    client: PostgresClient,
    settings: TheophysicsSettings,
    translator: MathTranslator
  ) {
    this.app = app;
    this.client = client;
    this.settings = settings;
    this.translator = translator;

    this.debouncedSync = debounce(
      () => this.processQueue(),
      settings.syncDebounceMs,
      true
    );
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return {
      lastSyncTime: this.lastSyncTime,
      pendingChanges: this.syncQueue.length,
      isConnected: this.client.isConnected(),
      isSyncing: this.isSyncing,
      error: this.client.getLastError() || undefined,
    };
  }

  /**
   * Queue a sync operation
   */
  queueSync(
    operation: 'insert' | 'update' | 'delete',
    table: string,
    data: Record<string, unknown>
  ): void {
    const item: SyncQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      operation,
      table,
      data,
      timestamp: new Date(),
      retries: 0,
    };

    this.syncQueue.push(item);

    if (this.settings.autoSyncOnSave) {
      this.debouncedSync();
    }
  }

  /**
   * Process the sync queue
   */
  async processQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    this.isSyncing = true;

    try {
      // Test connection first
      const connected = await this.client.testConnection();
      if (!connected) {
        console.error('Database connection failed, skipping sync');
        return;
      }

      // Process items in batches
      const batch = this.syncQueue.splice(0, 50);

      for (const item of batch) {
        try {
          await this.processSyncItem(item);
        } catch (error) {
          console.error('Sync item failed:', error);

          // Retry logic
          if (item.retries < 3) {
            item.retries++;
            this.syncQueue.push(item);
          }
        }
      }

      this.lastSyncTime = new Date();
    } finally {
      this.isSyncing = false;

      // If more items in queue, continue
      if (this.syncQueue.length > 0) {
        this.debouncedSync();
      }
    }
  }

  /**
   * Process a single sync item
   */
  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    switch (item.table) {
      case 'semantic_blocks':
        if (item.operation === 'delete') {
          await this.client.deleteSemanticBlocksForNote(
            item.data.note_path as string
          );
        } else {
          await this.client.saveSemanticBlock(item.data as unknown as SemanticBlock);
        }
        break;

      case 'math_blocks':
        await this.client.saveMathBlock(item.data as unknown as MathBlock);
        break;

      case 'evidence_bundles':
        await this.client.saveEvidenceBundle(item.data as unknown as EvidenceBundle);
        break;

      default:
        console.warn(`Unknown table: ${item.table}`);
    }
  }

  /**
   * Sync a note to database
   */
  async syncNote(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);

    // Parse semantic blocks
    const semanticBlocks = parseSemanticMarkers(content, file.path);

    // Parse math blocks
    const mathBlocks = parseMathBlocks(content, file.path);

    // Translate math blocks
    for (const block of mathBlocks) {
      block.translations = {
        basic: this.translator.translate(block.latexContent, 'basic'),
        medium: this.translator.translate(block.latexContent, 'medium'),
        academic: this.translator.translate(block.latexContent, 'academic'),
      };
    }

    // Delete existing blocks for this note
    this.queueSync('delete', 'semantic_blocks', { note_path: file.path });

    // Queue new blocks
    for (const block of semanticBlocks) {
      this.queueSync('insert', 'semantic_blocks', block as unknown as Record<string, unknown>);
    }

    for (const block of mathBlocks) {
      this.queueSync('insert', 'math_blocks', block as unknown as Record<string, unknown>);
    }
  }

  /**
   * Sync all notes in vault
   */
  async syncAllNotes(): Promise<{ synced: number; failed: number }> {
    const files = this.app.vault.getMarkdownFiles();
    let synced = 0;
    let failed = 0;

    for (const file of files) {
      try {
        await this.syncNote(file);
        synced++;
      } catch (error) {
        console.error(`Failed to sync ${file.path}:`, error);
        failed++;
      }
    }

    // Process queue
    await this.processQueue();

    return { synced, failed };
  }

  /**
   * Pull updates from database
   */
  async pullUpdates(notePath: string): Promise<{
    semanticBlocks: SemanticBlock[];
    mathBlocks: MathBlock[];
  }> {
    const [semanticBlocks, mathBlocks] = await Promise.all([
      this.client.getSemanticBlocks(notePath),
      this.client.getMathBlocks(notePath),
    ]);

    return { semanticBlocks, mathBlocks };
  }

  /**
   * Check for conflicts between local and remote
   */
  async checkConflicts(
    notePath: string,
    localBlocks: SemanticBlock[]
  ): Promise<
    Array<{
      local: SemanticBlock;
      remote: SemanticBlock;
      type: 'content' | 'position';
    }>
  > {
    const remoteBlocks = await this.client.getSemanticBlocks(notePath);
    const conflicts: Array<{
      local: SemanticBlock;
      remote: SemanticBlock;
      type: 'content' | 'position';
    }> = [];

    for (const local of localBlocks) {
      const remote = remoteBlocks.find(r => r.uuid === local.uuid);

      if (remote) {
        // Check content conflict
        if (local.content !== remote.content) {
          conflicts.push({ local, remote, type: 'content' });
        }
        // Check position conflict
        else if (
          local.position.start !== remote.position.start ||
          local.position.end !== remote.position.end
        ) {
          conflicts.push({ local, remote, type: 'position' });
        }
      }
    }

    return conflicts;
  }

  /**
   * Force sync now (bypass debounce)
   */
  async forceSyncNow(): Promise<void> {
    await this.processQueue();
  }

  /**
   * Clear sync queue
   */
  clearQueue(): void {
    this.syncQueue = [];
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.syncQueue.length;
  }
}

/**
 * Create a file watcher for auto-sync
 */
export function createSyncWatcher(
  app: App,
  syncManager: SyncManager
): void {
  // Watch for file changes
  app.vault.on('modify', async (file) => {
    if (file instanceof TFile && file.extension === 'md') {
      await syncManager.syncNote(file);
    }
  });

  // Watch for file deletions
  app.vault.on('delete', (file) => {
    if (file instanceof TFile && file.extension === 'md') {
      syncManager.queueSync('delete', 'semantic_blocks', {
        note_path: file.path,
      });
    }
  });

  // Watch for file renames
  app.vault.on('rename', (file, oldPath) => {
    if (file instanceof TFile && file.extension === 'md') {
      // Delete old path records
      syncManager.queueSync('delete', 'semantic_blocks', {
        note_path: oldPath,
      });

      // Sync with new path
      syncManager.syncNote(file);
    }
  });
}
