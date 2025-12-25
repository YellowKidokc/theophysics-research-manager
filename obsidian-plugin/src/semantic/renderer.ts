/**
 * Semantic Renderer
 *
 * Handles rendering of semantic blocks in reading view and edit mode.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import { SemanticBlock, SemanticType } from '../types';

// Color scheme for semantic types
export const SEMANTIC_COLORS: Record<SemanticType, { bg: string; border: string }> = {
  hypothesis: { bg: 'rgba(255, 193, 7, 0.1)', border: '#ffc107' },
  axiom: { bg: 'rgba(156, 39, 176, 0.1)', border: '#9c27b0' },
  evidence: { bg: 'rgba(76, 175, 80, 0.1)', border: '#4caf50' },
  definition: { bg: 'rgba(33, 150, 243, 0.1)', border: '#2196f3' },
  derivation: { bg: 'rgba(255, 152, 0, 0.1)', border: '#ff9800' },
  objection: { bg: 'rgba(244, 67, 54, 0.1)', border: '#f44336' },
  resolution: { bg: 'rgba(0, 188, 212, 0.1)', border: '#00bcd4' },
  claim: { bg: 'rgba(158, 158, 158, 0.1)', border: '#9e9e9e' },
  citation: { bg: 'rgba(121, 85, 72, 0.1)', border: '#795548' },
  'cross-ref': { bg: 'rgba(63, 81, 181, 0.1)', border: '#3f51b5' },
  ontology: { bg: 'rgba(0, 150, 136, 0.1)', border: '#009688' },
  variable: { bg: 'rgba(233, 30, 99, 0.1)', border: '#e91e63' },
  concept: { bg: 'rgba(103, 58, 183, 0.1)', border: '#673ab7' },
  'proper-name': { bg: 'rgba(255, 87, 34, 0.1)', border: '#ff5722' },
  theory: { bg: 'rgba(96, 125, 139, 0.1)', border: '#607d8b' },
};

// Icons for semantic types
export const SEMANTIC_ICONS: Record<SemanticType, string> = {
  hypothesis: '🔬',
  axiom: '📐',
  evidence: '📊',
  definition: '📖',
  derivation: '🔗',
  objection: '⚠️',
  resolution: '✅',
  claim: '💬',
  citation: '📚',
  'cross-ref': '🔀',
  ontology: '🏷️',
  variable: '𝑥',
  concept: '💡',
  'proper-name': '👤',
  theory: '🧠',
};

/**
 * Create CSS styles for semantic highlighting
 */
export function getSemanticStyles(): string {
  const styles: string[] = [];

  // Add styles for each semantic type
  for (const [type, colors] of Object.entries(SEMANTIC_COLORS)) {
    styles.push(`
      .semantic-block-${type} {
        background-color: ${colors.bg};
        border-left: 3px solid ${colors.border};
        padding: 0.5em 1em;
        margin: 0.5em 0;
        border-radius: 4px;
      }
      .semantic-inline-${type} {
        background-color: ${colors.bg};
        border-bottom: 2px solid ${colors.border};
        padding: 0 0.2em;
        border-radius: 2px;
      }
    `);
  }

  // Add base styles
  styles.push(`
    .semantic-marker-hidden {
      display: none;
    }
    .semantic-type-badge {
      font-size: 0.8em;
      opacity: 0.7;
      margin-right: 0.5em;
    }
    .semantic-block-container {
      position: relative;
    }
    .semantic-block-label {
      position: absolute;
      top: -0.5em;
      left: 0.5em;
      font-size: 0.7em;
      background: white;
      padding: 0 0.3em;
      border-radius: 2px;
      opacity: 0.8;
    }
    .semantic-tooltip {
      position: absolute;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      padding: 1em;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      max-width: 300px;
    }
    .semantic-tooltip-header {
      font-weight: 600;
      margin-bottom: 0.5em;
      border-bottom: 1px solid var(--background-modifier-border);
      padding-bottom: 0.5em;
    }
    .semantic-tooltip-content {
      font-size: 0.9em;
      line-height: 1.4;
    }
    .semantic-tooltip-meta {
      font-size: 0.8em;
      opacity: 0.7;
      margin-top: 0.5em;
    }
  `);

  return styles.join('\n');
}

/**
 * Render a semantic block with highlighting
 */
export function renderSemanticBlock(
  block: SemanticBlock,
  container: HTMLElement,
  showHighlighting: boolean
): void {
  if (!showHighlighting) {
    container.setText(block.content);
    return;
  }

  const colors = SEMANTIC_COLORS[block.semanticType];
  const icon = SEMANTIC_ICONS[block.semanticType];

  const wrapper = container.createDiv({
    cls: `semantic-block-container semantic-block-${block.semanticType}`,
  });

  // Add type label
  const label = wrapper.createSpan({
    cls: 'semantic-block-label',
    text: `${icon} ${block.semanticType}`,
  });

  // Add content
  const content = wrapper.createDiv({
    cls: 'semantic-block-content',
  });
  content.setText(block.content);

  // Add reference ID if present
  if (block.refId) {
    const refBadge = wrapper.createSpan({
      cls: 'semantic-type-badge',
      text: block.refId,
    });
  }
}

/**
 * Post-processor to hide semantic markers in reading view
 */
export function semanticMarkdownPostProcessor(
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext
): void {
  // Pattern to match all semantic markers
  const markerPattern = /==(?:para|sent|word):[^=]+==|==para:end==/g;

  // Walk through text nodes
  const walker = document.createTreeWalker(
    el,
    NodeFilter.SHOW_TEXT,
    null
  );

  const nodesToProcess: Text[] = [];
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    if (markerPattern.test(node.textContent || '')) {
      nodesToProcess.push(node);
    }
  }

  // Process each text node
  for (const textNode of nodesToProcess) {
    const text = textNode.textContent || '';
    const cleaned = text.replace(markerPattern, '');

    if (cleaned !== text) {
      textNode.textContent = cleaned;
    }
  }
}

/**
 * Create tooltip for semantic block
 */
export function createSemanticTooltip(
  block: SemanticBlock,
  x: number,
  y: number
): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.className = 'semantic-tooltip';
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;

  // Header
  const header = tooltip.createDiv({ cls: 'semantic-tooltip-header' });
  const icon = SEMANTIC_ICONS[block.semanticType];
  header.setText(`${icon} ${block.semanticType.toUpperCase()}`);

  // Content preview
  const content = tooltip.createDiv({ cls: 'semantic-tooltip-content' });
  const preview = block.content.length > 150
    ? block.content.substring(0, 150) + '...'
    : block.content;
  content.setText(preview);

  // Metadata
  const meta = tooltip.createDiv({ cls: 'semantic-tooltip-meta' });
  const metaItems: string[] = [];

  if (block.refId) {
    metaItems.push(`Ref: ${block.refId}`);
  }

  metaItems.push(`Line: ${block.position.line}`);

  if (block.relatedRefs.length > 0) {
    metaItems.push(`Related: ${block.relatedRefs.join(', ')}`);
  }

  meta.setText(metaItems.join(' | '));

  return tooltip;
}

/**
 * Highlight semantic blocks in CodeMirror editor
 */
export function getEditorExtensions(): any[] {
  // This would return CodeMirror extensions for highlighting
  // Requires @codemirror/view integration
  return [];
}

/**
 * Strip semantic markers for clean display
 */
export function stripMarkersForDisplay(content: string): string {
  let result = content;

  // Remove paragraph markers
  result = result.replace(/==para:[^=]+==/g, '');
  result = result.replace(/==para:end==/g, '');

  // Remove sentence markers
  result = result.replace(/==sent:[^=]+==/g, '');

  // Remove word markers
  result = result.replace(/==word:[^=]+==/g, '');

  // Clean up double equals at end of inline markers
  result = result.replace(/==(?=\s|$|[.,!?;:])/g, '');

  return result.trim();
}

/**
 * Get display name for semantic type
 */
export function getSemanticTypeDisplayName(type: SemanticType): string {
  const displayNames: Record<SemanticType, string> = {
    hypothesis: 'Hypothesis',
    axiom: 'Axiom',
    evidence: 'Evidence',
    definition: 'Definition',
    derivation: 'Derivation',
    objection: 'Objection',
    resolution: 'Resolution',
    claim: 'Claim',
    citation: 'Citation',
    'cross-ref': 'Cross-Reference',
    ontology: 'Ontology Term',
    variable: 'Variable',
    concept: 'Concept',
    'proper-name': 'Proper Name',
    theory: 'Theory',
  };

  return displayNames[type] || type;
}
