/**
 * Math Display Module
 *
 * Handles inline display of math translations in Obsidian.
 */

import { MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import { MathBlock, TranslationLevel } from '../types';
import { MathTranslator } from './translator';

/**
 * CSS styles for math translations
 */
export function getMathStyles(): string {
  return `
    .math-translation-container {
      margin: 0.5em 0;
      padding: 0.5em 1em;
      border-left: 3px solid var(--interactive-accent);
      background-color: var(--background-secondary);
      border-radius: 4px;
    }

    .math-translation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5em;
    }

    .math-translation-label {
      font-weight: 600;
      font-size: 0.85em;
      color: var(--text-muted);
    }

    .math-translation-toggle {
      display: flex;
      gap: 0.5em;
    }

    .math-translation-toggle button {
      padding: 0.2em 0.5em;
      font-size: 0.75em;
      border-radius: 4px;
      border: 1px solid var(--background-modifier-border);
      background: var(--background-primary);
      cursor: pointer;
    }

    .math-translation-toggle button.active {
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      border-color: var(--interactive-accent);
    }

    .math-translation-content {
      font-style: italic;
      line-height: 1.5;
    }

    .math-translation-context {
      margin-top: 0.5em;
      font-size: 0.85em;
      color: var(--text-muted);
    }

    .math-translation-warning {
      background-color: rgba(255, 193, 7, 0.1);
      border-left-color: #ffc107;
      margin-top: 0.5em;
      padding: 0.3em 0.5em;
      font-size: 0.85em;
    }

    .math-inline-translation {
      color: var(--text-muted);
      font-style: italic;
      font-size: 0.9em;
    }

    .math-tooltip {
      position: absolute;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      padding: 0.8em;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      max-width: 350px;
    }

    .math-tooltip-latex {
      font-family: var(--font-monospace);
      font-size: 0.9em;
      margin-bottom: 0.5em;
      padding: 0.3em;
      background: var(--background-secondary);
      border-radius: 4px;
    }

    .math-tooltip-translations {
      font-size: 0.9em;
    }

    .math-tooltip-level {
      margin: 0.3em 0;
    }

    .math-tooltip-level-label {
      font-weight: 600;
      color: var(--text-muted);
    }
  `;
}

/**
 * Create a math translation display component
 */
export function createMathTranslationDisplay(
  container: HTMLElement,
  block: MathBlock,
  translator: MathTranslator,
  initialLevel: TranslationLevel = 'medium'
): HTMLElement {
  const wrapper = container.createDiv({ cls: 'math-translation-container' });

  // Generate translations
  const translations = {
    basic: translator.translate(block.latexContent, 'basic'),
    medium: translator.translate(block.latexContent, 'medium'),
    academic: translator.translate(block.latexContent, 'academic'),
  };

  block.translations = translations;

  let currentLevel = initialLevel;

  // Header with toggle buttons
  const header = wrapper.createDiv({ cls: 'math-translation-header' });
  header.createSpan({ cls: 'math-translation-label', text: 'Translation' });

  const toggle = header.createDiv({ cls: 'math-translation-toggle' });

  const levels: TranslationLevel[] = ['basic', 'medium', 'academic'];
  const buttons: HTMLButtonElement[] = [];

  for (const level of levels) {
    const btn = toggle.createEl('button', {
      text: level.charAt(0).toUpperCase() + level.slice(1),
      cls: level === currentLevel ? 'active' : '',
    });

    btn.addEventListener('click', () => {
      currentLevel = level;
      updateDisplay();
      buttons.forEach(b => b.removeClass('active'));
      btn.addClass('active');
    });

    buttons.push(btn);
  }

  // Content
  const content = wrapper.createDiv({ cls: 'math-translation-content' });

  // Check for context warnings
  const warnings = getContextWarnings(block.latexContent, translator);
  let warningEl: HTMLElement | null = null;

  if (warnings.length > 0) {
    warningEl = wrapper.createDiv({ cls: 'math-translation-warning' });
    warningEl.setText(`Note: ${warnings.join('; ')}`);
  }

  function updateDisplay() {
    content.setText(translations[currentLevel]);
  }

  updateDisplay();

  return wrapper;
}

/**
 * Get context warnings for symbols in expression
 */
function getContextWarnings(
  latex: string,
  translator: MathTranslator
): string[] {
  const warnings: string[] = [];

  // Check each known symbol
  for (const symbol of translator.getAllSymbols()) {
    if (latex.includes(symbol.latex) && translator.hasContextWarning(symbol.latex)) {
      const warning = translator.getContextWarning(symbol.latex);
      if (warning) {
        warnings.push(warning);
      }
    }
  }

  return warnings;
}

/**
 * Post-processor to add math translations
 */
export function mathTranslationPostProcessor(
  translator: MathTranslator,
  defaultLevel: TranslationLevel = 'medium',
  showInline: boolean = true
): (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void {
  return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    // Find math elements
    const mathElements = el.querySelectorAll('.math');

    mathElements.forEach((mathEl) => {
      const latex = mathEl.getAttribute('data-latex') ||
                    mathEl.textContent || '';

      if (!latex.trim()) return;

      const translation = translator.translate(latex, defaultLevel);

      if (showInline) {
        // Add translation as tooltip
        mathEl.setAttribute('title', translation);
        mathEl.addClass('has-translation');
      }
    });
  };
}

/**
 * Create math tooltip
 */
export function createMathTooltip(
  latex: string,
  translator: MathTranslator,
  x: number,
  y: number
): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.className = 'math-tooltip';
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;

  // LaTeX display
  const latexEl = tooltip.createDiv({ cls: 'math-tooltip-latex' });
  latexEl.setText(latex);

  // Translations
  const transEl = tooltip.createDiv({ cls: 'math-tooltip-translations' });

  const levels: TranslationLevel[] = ['basic', 'medium', 'academic'];

  for (const level of levels) {
    const translation = translator.translate(latex, level);

    const levelEl = transEl.createDiv({ cls: 'math-tooltip-level' });
    levelEl.createSpan({
      cls: 'math-tooltip-level-label',
      text: `${level.charAt(0).toUpperCase() + level.slice(1)}: `,
    });
    levelEl.createSpan({ text: translation });
  }

  return tooltip;
}

/**
 * Copy math translation to clipboard
 */
export async function copyMathTranslation(
  latex: string,
  translator: MathTranslator,
  level: TranslationLevel
): Promise<void> {
  const translation = translator.translate(latex, level);
  await navigator.clipboard.writeText(translation);
}

/**
 * Copy LaTeX to clipboard
 */
export async function copyLatex(latex: string): Promise<void> {
  await navigator.clipboard.writeText(latex);
}
