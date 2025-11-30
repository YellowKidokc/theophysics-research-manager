/**
 * Command Palette Commands
 *
 * All plugin commands for the Obsidian command palette.
 */

import { App, Editor, MarkdownView, Notice, TFile } from 'obsidian';
import {
  TheophysicsSettings,
  SemanticType,
  BlockType,
  TranslationLevel,
} from '../types';
import {
  parseSemanticMarkers,
  insertSemanticMarker,
  generateUuid,
} from '../semantic/parser';
import {
  classifyContentLocal,
  classifyContentAI,
  autoClassifyDocument,
} from '../semantic/classifier';
import { EvidenceBundler, createEvidenceSummary } from '../semantic/bundler';
import { MathTranslator, parseMathBlocks, insertMathTranslation } from '../math/translator';
import { exportDocumentToTTS } from '../math/tts';
import { SyncManager } from '../database/sync';
import { ResearchLinkGenerator } from '../links/generator';

/**
 * Register all plugin commands
 */
export function registerCommands(
  app: App,
  settings: TheophysicsSettings,
  translator: MathTranslator,
  syncManager: SyncManager | null,
  linkGenerator: ResearchLinkGenerator
): void {
  // ===================
  // Semantic Commands
  // ===================

  app.addCommand({
    id: 'theophysics:auto-classify',
    name: 'Semantic: Auto-Classify Document',
    editorCallback: async (editor: Editor, view: MarkdownView) => {
      const content = editor.getValue();
      const file = view.file;

      if (!file) {
        new Notice('No file open');
        return;
      }

      new Notice('Classifying document...');

      const existingBlocks = parseSemanticMarkers(content, file.path);
      const results = await autoClassifyDocument(
        content,
        file.path,
        settings.aiProvider,
        existingBlocks
      );

      if (results.length === 0) {
        new Notice('No content to classify');
        return;
      }

      // Apply classifications (in reverse order to preserve positions)
      let newContent = content;
      const sorted = results.sort((a, b) => b.position.start - a.position.start);

      for (const result of sorted) {
        const { newContent: updated, block } = insertSemanticMarker(
          newContent,
          result.position.start,
          result.position.end,
          'para',
          result.result.type,
          result.result.suggestedRefId
        );
        newContent = updated;
      }

      editor.setValue(newContent);
      new Notice(`Classified ${results.length} blocks`);
    },
  });

  app.addCommand({
    id: 'theophysics:mark-hypothesis',
    name: 'Semantic: Mark as Hypothesis',
    editorCallback: (editor: Editor) => {
      markSelection(editor, 'para', 'hypothesis');
    },
  });

  app.addCommand({
    id: 'theophysics:mark-evidence',
    name: 'Semantic: Mark as Evidence',
    editorCallback: (editor: Editor) => {
      markSelection(editor, 'para', 'evidence');
    },
  });

  app.addCommand({
    id: 'theophysics:mark-axiom',
    name: 'Semantic: Mark as Axiom',
    editorCallback: (editor: Editor) => {
      markSelection(editor, 'para', 'axiom');
    },
  });

  app.addCommand({
    id: 'theophysics:mark-definition',
    name: 'Semantic: Mark as Definition',
    editorCallback: (editor: Editor) => {
      markSelection(editor, 'para', 'definition');
    },
  });

  app.addCommand({
    id: 'theophysics:mark-claim',
    name: 'Semantic: Mark as Claim (Sentence)',
    editorCallback: (editor: Editor) => {
      markSelection(editor, 'sent', 'claim');
    },
  });

  app.addCommand({
    id: 'theophysics:mark-ontology',
    name: 'Semantic: Mark as Ontology Term (Word)',
    editorCallback: (editor: Editor) => {
      markSelection(editor, 'word', 'ontology');
    },
  });

  app.addCommand({
    id: 'theophysics:mark-proper-name',
    name: 'Semantic: Mark as Proper Name (Word)',
    editorCallback: (editor: Editor) => {
      markSelection(editor, 'word', 'proper-name');
    },
  });

  app.addCommand({
    id: 'theophysics:bundle-evidence',
    name: 'Semantic: Bundle Evidence for Claims',
    callback: async () => {
      new Notice('Bundling evidence...');

      const bundler = new EvidenceBundler(app, settings.aiProvider);
      const bundles = await bundler.bundleAllEvidence();

      if (bundles.length === 0) {
        new Notice('No claims found to bundle evidence for');
        return;
      }

      // Save bundles to database
      if (syncManager) {
        for (const bundle of bundles) {
          syncManager.queueSync('insert', 'evidence_bundles', bundle as any);
        }
        await syncManager.forceSyncNow();
      }

      new Notice(`Created ${bundles.length} evidence bundles`);
    },
  });

  // ===================
  // Math Commands
  // ===================

  app.addCommand({
    id: 'theophysics:toggle-translations',
    name: 'Math: Toggle Translations',
    editorCallback: (editor: Editor, view: MarkdownView) => {
      // Toggle inline translations visibility
      // This would work with CSS classes
      const container = view.containerEl;
      container.classList.toggle('hide-math-translations');

      const hidden = container.classList.contains('hide-math-translations');
      new Notice(hidden ? 'Translations hidden' : 'Translations shown');
    },
  });

  app.addCommand({
    id: 'theophysics:translate-selection',
    name: 'Math: Translate Selection',
    editorCallback: (editor: Editor) => {
      const selection = editor.getSelection();

      if (!selection) {
        new Notice('No text selected');
        return;
      }

      const translation = translator.translate(selection, settings.defaultTranslationLevel);
      new Notice(`Translation: ${translation}`, 10000);
    },
  });

  app.addCommand({
    id: 'theophysics:insert-translation',
    name: 'Math: Insert Translation Below Math Block',
    editorCallback: (editor: Editor, view: MarkdownView) => {
      const cursor = editor.getCursor();
      const content = editor.getValue();
      const file = view.file;

      if (!file) return;

      const mathBlocks = parseMathBlocks(content, file.path);

      // Find math block near cursor
      const currentLine = cursor.line + 1;
      const nearbyBlock = mathBlocks.find(
        b => Math.abs(b.position.line - currentLine) <= 2
      );

      if (!nearbyBlock) {
        new Notice('No math block found near cursor');
        return;
      }

      const translation = translator.translate(
        nearbyBlock.latexContent,
        settings.defaultTranslationLevel
      );

      const newContent = insertMathTranslation(
        content,
        nearbyBlock,
        translation,
        settings.defaultTranslationLevel
      );

      editor.setValue(newContent);
      new Notice('Translation inserted');
    },
  });

  app.addCommand({
    id: 'theophysics:export-tts',
    name: 'Math: Export TTS Version',
    editorCallback: async (editor: Editor, view: MarkdownView) => {
      const content = editor.getValue();
      const file = view.file;

      if (!file) {
        new Notice('No file open');
        return;
      }

      const ttsContent = exportDocumentToTTS(
        content,
        file.path,
        translator,
        { translationLevel: settings.defaultTranslationLevel }
      );

      // Create TTS file
      const ttsPath = file.path.replace('.md', '_TTS.md');
      await app.vault.create(ttsPath, ttsContent);

      new Notice(`TTS version saved to ${ttsPath}`);
    },
  });

  // ===================
  // Links Commands
  // ===================

  app.addCommand({
    id: 'theophysics:generate-links',
    name: 'Links: Generate Proper Name Links',
    editorCallback: async (editor: Editor, view: MarkdownView) => {
      const content = editor.getValue();
      const file = view.file;

      if (!file) return;

      const blocks = parseSemanticMarkers(content, file.path);
      const linksSection = linkGenerator.generateLinksSection(blocks);

      if (!linksSection.includes('###')) {
        new Notice('No proper names found to generate links for');
        return;
      }

      // Append to document
      const newContent = content + '\n\n---\n\n' + linksSection;
      editor.setValue(newContent);

      new Notice('Research links generated');
    },
  });

  app.addCommand({
    id: 'theophysics:update-links',
    name: 'Links: Update All Research Links',
    callback: async () => {
      new Notice('Updating research links across vault...');

      const files = app.vault.getMarkdownFiles();
      let updated = 0;

      for (const file of files) {
        const content = await app.vault.read(file);
        const blocks = parseSemanticMarkers(content, file.path);

        const properNames = blocks.filter(
          b => b.semanticType === 'proper-name' ||
               b.semanticType === 'theory'
        );

        if (properNames.length > 0) {
          // Store links to database
          if (syncManager) {
            for (const block of properNames) {
              const links = linkGenerator.getAllLinks(block.content);
              for (const link of links) {
                syncManager.queueSync('insert', 'research_links', {
                  term: link.term,
                  source: link.source,
                  url: link.url,
                  priority: link.priority,
                });
              }
            }
          }
          updated++;
        }
      }

      if (syncManager) {
        await syncManager.forceSyncNow();
      }

      new Notice(`Updated links for ${updated} files`);
    },
  });

  // ===================
  // Database Commands
  // ===================

  app.addCommand({
    id: 'theophysics:sync-now',
    name: 'Database: Sync Now',
    callback: async () => {
      if (!syncManager) {
        new Notice('Database sync not configured');
        return;
      }

      new Notice('Syncing to database...');
      await syncManager.forceSyncNow();
      new Notice('Sync complete');
    },
  });

  app.addCommand({
    id: 'theophysics:sync-all',
    name: 'Database: Sync All Notes',
    callback: async () => {
      if (!syncManager) {
        new Notice('Database sync not configured');
        return;
      }

      new Notice('Syncing all notes to database...');
      const result = await syncManager.syncAllNotes();
      new Notice(`Synced ${result.synced} notes, ${result.failed} failed`);
    },
  });

  app.addCommand({
    id: 'theophysics:view-sync-status',
    name: 'Database: View Sync Status',
    callback: () => {
      if (!syncManager) {
        new Notice('Database sync not configured');
        return;
      }

      const state = syncManager.getState();
      const status = [
        `Connected: ${state.isConnected ? 'Yes' : 'No'}`,
        `Syncing: ${state.isSyncing ? 'Yes' : 'No'}`,
        `Pending: ${state.pendingChanges}`,
        state.lastSyncTime
          ? `Last sync: ${state.lastSyncTime.toLocaleString()}`
          : 'Never synced',
        state.error ? `Error: ${state.error}` : '',
      ].filter(Boolean).join('\n');

      new Notice(status, 10000);
    },
  });
}

/**
 * Mark selected text with semantic marker
 */
function markSelection(
  editor: Editor,
  blockType: BlockType,
  semanticType: SemanticType,
  refId?: string
): void {
  const selection = editor.getSelection();

  if (!selection) {
    new Notice('No text selected');
    return;
  }

  const content = editor.getValue();
  const from = editor.getCursor('from');
  const to = editor.getCursor('to');

  // Calculate offsets
  const lines = content.split('\n');
  let startOffset = 0;
  let endOffset = 0;

  for (let i = 0; i < from.line; i++) {
    startOffset += lines[i].length + 1;
  }
  startOffset += from.ch;

  for (let i = 0; i < to.line; i++) {
    endOffset += lines[i].length + 1;
  }
  endOffset += to.ch;

  const { newContent, block } = insertSemanticMarker(
    content,
    startOffset,
    endOffset,
    blockType,
    semanticType,
    refId
  );

  editor.setValue(newContent);
  new Notice(`Marked as ${semanticType}`);
}
