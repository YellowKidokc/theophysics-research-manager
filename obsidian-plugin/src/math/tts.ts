/**
 * TTS Export Module
 *
 * Generates TTS-ready content by converting LaTeX to spoken English
 * and stripping semantic markers.
 */

import {
  MathBlock,
  TranslationLevel,
  TTSExportOptions,
  TTSContent,
} from '../types';
import { MathTranslator, parseMathBlocks } from './translator';
import { stripSemanticMarkers } from '../semantic/parser';

const DEFAULT_TTS_OPTIONS: TTSExportOptions = {
  translationLevel: 'basic',
  includeHeaders: true,
  stripMarkdown: true,
  mathPrefix: 'Math notation:',
};

/**
 * TTS Exporter class
 */
export class TTSExporter {
  private translator: MathTranslator;
  private options: TTSExportOptions;

  constructor(translator: MathTranslator, options?: Partial<TTSExportOptions>) {
    this.translator = translator;
    this.options = { ...DEFAULT_TTS_OPTIONS, ...options };
  }

  /**
   * Convert content to TTS-ready format
   */
  export(content: string, notePath: string): TTSContent {
    let ttsContent = content;

    // Step 1: Strip semantic markers
    ttsContent = stripSemanticMarkers(ttsContent);

    // Step 2: Convert math to English
    ttsContent = this.convertMathToEnglish(ttsContent, notePath);

    // Step 3: Handle special characters
    ttsContent = this.convertSpecialCharacters(ttsContent);

    // Step 4: Clean up markdown if requested
    if (this.options.stripMarkdown) {
      ttsContent = this.stripMarkdown(ttsContent);
    }

    // Step 5: Handle headers
    if (this.options.includeHeaders) {
      ttsContent = this.formatHeaders(ttsContent);
    } else {
      ttsContent = this.removeHeaders(ttsContent);
    }

    // Step 6: Clean up spacing and formatting
    ttsContent = this.cleanupForTTS(ttsContent);

    return {
      displayContent: content,
      ttsContent,
      notePath,
    };
  }

  /**
   * Convert all math blocks to English
   */
  private convertMathToEnglish(content: string, notePath: string): string {
    let result = content;

    // Handle display math first
    const displayPattern = /\$\$([\s\S]*?)\$\$/g;
    result = result.replace(displayPattern, (match, latex) => {
      const translation = this.translator.translate(
        latex.trim(),
        this.options.translationLevel
      );
      return `\n${this.options.mathPrefix} ${translation}\n`;
    });

    // Handle inline math
    const inlinePattern = /\$([^$\n]+)\$/g;
    result = result.replace(inlinePattern, (match, latex) => {
      const translation = this.translator.translate(
        latex.trim(),
        this.options.translationLevel
      );
      return translation;
    });

    return result;
  }

  /**
   * Convert special characters to spoken form
   */
  private convertSpecialCharacters(content: string): string {
    const replacements: [RegExp, string][] = [
      // Greek letters that might not have been translated
      [/α/g, 'alpha'],
      [/β/g, 'beta'],
      [/γ/g, 'gamma'],
      [/δ/g, 'delta'],
      [/ε/g, 'epsilon'],
      [/ζ/g, 'zeta'],
      [/η/g, 'eta'],
      [/θ/g, 'theta'],
      [/ι/g, 'iota'],
      [/κ/g, 'kappa'],
      [/λ/g, 'lambda'],
      [/μ/g, 'mu'],
      [/ν/g, 'nu'],
      [/ξ/g, 'xi'],
      [/π/g, 'pi'],
      [/ρ/g, 'rho'],
      [/σ/g, 'sigma'],
      [/τ/g, 'tau'],
      [/υ/g, 'upsilon'],
      [/φ/g, 'phi'],
      [/χ/g, 'chi'],
      [/ψ/g, 'psi'],
      [/ω/g, 'omega'],
      [/Γ/g, 'Gamma'],
      [/Δ/g, 'Delta'],
      [/Θ/g, 'Theta'],
      [/Λ/g, 'Lambda'],
      [/Ξ/g, 'Xi'],
      [/Π/g, 'Pi'],
      [/Σ/g, 'Sigma'],
      [/Φ/g, 'Phi'],
      [/Ψ/g, 'Psi'],
      [/Ω/g, 'Omega'],

      // Math symbols
      [/∞/g, 'infinity'],
      [/∑/g, 'sum of'],
      [/∏/g, 'product of'],
      [/∫/g, 'integral of'],
      [/∂/g, 'partial'],
      [/∇/g, 'nabla'],
      [/√/g, 'square root of'],
      [/±/g, 'plus or minus'],
      [/×/g, 'times'],
      [/÷/g, 'divided by'],
      [/≈/g, 'approximately equals'],
      [/≠/g, 'is not equal to'],
      [/≤/g, 'is less than or equal to'],
      [/≥/g, 'is greater than or equal to'],
      [/→/g, 'goes to'],
      [/←/g, 'comes from'],
      [/↔/g, 'is equivalent to'],
      [/⇒/g, 'implies'],
      [/⇔/g, 'if and only if'],
      [/∈/g, 'is in'],
      [/∉/g, 'is not in'],
      [/⊂/g, 'is a subset of'],
      [/⊃/g, 'is a superset of'],
      [/∀/g, 'for all'],
      [/∃/g, 'there exists'],
      [/∧/g, 'and'],
      [/∨/g, 'or'],
      [/¬/g, 'not'],
      [/ℏ/g, 'h-bar'],
      [/ℒ/g, 'the Lagrangian'],
      [/ℋ/g, 'the Hamiltonian'],

      // Common abbreviations
      [/e\.g\./gi, 'for example'],
      [/i\.e\./gi, 'that is'],
      [/et al\./gi, 'and others'],
      [/etc\./gi, 'and so on'],
      [/vs\./gi, 'versus'],
      [/cf\./gi, 'compare'],

      // Units
      [/(\d+)\s*m\/s/g, '$1 meters per second'],
      [/(\d+)\s*km\/h/g, '$1 kilometers per hour'],
      [/(\d+)\s*kg/g, '$1 kilograms'],
      [/(\d+)\s*eV/g, '$1 electron volts'],
      [/(\d+)\s*GeV/g, '$1 giga electron volts'],
      [/(\d+)\s*Hz/g, '$1 hertz'],
    ];

    let result = content;
    for (const [pattern, replacement] of replacements) {
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  /**
   * Strip markdown formatting
   */
  private stripMarkdown(content: string): string {
    let result = content;

    // Remove bold/italic
    result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
    result = result.replace(/\*([^*]+)\*/g, '$1');
    result = result.replace(/__([^_]+)__/g, '$1');
    result = result.replace(/_([^_]+)_/g, '$1');

    // Remove inline code
    result = result.replace(/`([^`]+)`/g, '$1');

    // Remove code blocks
    result = result.replace(/```[\s\S]*?```/g, '');

    // Remove links but keep text
    result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    result = result.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, link, text) => text || link);

    // Remove images
    result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, 'Image: $1');

    // Remove blockquotes
    result = result.replace(/^>\s*/gm, '');

    // Remove callouts
    result = result.replace(/>\s*\[![\w-]+\]\s*/g, '');

    // Remove horizontal rules
    result = result.replace(/^-{3,}$/gm, '');
    result = result.replace(/^\*{3,}$/gm, '');

    // Remove list markers
    result = result.replace(/^[\s]*[-*+]\s+/gm, '');
    result = result.replace(/^[\s]*\d+\.\s+/gm, '');

    // Remove HTML tags
    result = result.replace(/<[^>]+>/g, '');

    return result;
  }

  /**
   * Format headers for TTS
   */
  private formatHeaders(content: string): string {
    let result = content;

    // Convert headers to spoken pauses
    result = result.replace(/^#{1,6}\s+(.+)$/gm, (_, header) => {
      return `\n\nSection: ${header}.\n\n`;
    });

    return result;
  }

  /**
   * Remove headers
   */
  private removeHeaders(content: string): string {
    return content.replace(/^#{1,6}\s+.+$/gm, '');
  }

  /**
   * Clean up for TTS readability
   */
  private cleanupForTTS(content: string): string {
    let result = content;

    // Remove extra whitespace
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.replace(/[ \t]+/g, ' ');

    // Add pauses after sentences
    result = result.replace(/\.\s+/g, '. ');

    // Remove footnote markers
    result = result.replace(/\[\d+\]/g, '');
    result = result.replace(/<sup>\[\d+\]<\/sup>/g, '');

    // Clean up punctuation
    result = result.replace(/\s+([.,!?;:])/g, '$1');

    // Trim
    result = result.trim();

    return result;
  }

  /**
   * Set translation level
   */
  setTranslationLevel(level: TranslationLevel): void {
    this.options.translationLevel = level;
  }

  /**
   * Set options
   */
  setOptions(options: Partial<TTSExportOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Quick export function
 */
export function exportToTTS(
  content: string,
  notePath: string,
  translator: MathTranslator,
  options?: Partial<TTSExportOptions>
): TTSContent {
  const exporter = new TTSExporter(translator, options);
  return exporter.export(content, notePath);
}

/**
 * Export entire document to TTS file content
 */
export function exportDocumentToTTS(
  content: string,
  notePath: string,
  translator: MathTranslator,
  options?: Partial<TTSExportOptions>
): string {
  const ttsContent = exportToTTS(content, notePath, translator, options);

  const header = `# TTS Export: ${notePath.split('/').pop()}\n\nGenerated at: ${new Date().toISOString()}\n\n---\n\n`;

  return header + ttsContent.ttsContent;
}
