/**
 * Math Translator
 *
 * Translates LaTeX math expressions to English at three levels.
 * Reads from CSV translation table.
 */

import { MathSymbol, TranslationLevel, MathBlock } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Default math symbol translations (used if CSV not loaded)
 */
const DEFAULT_TRANSLATIONS: MathSymbol[] = [
  // Greek letters
  { latex: '\\chi', display: 'χ', basic: 'the Logos Field', medium: 'the information substrate', academic: 'chi, the scalar Logos field', context: 'THE central symbol' },
  { latex: '\\psi', display: 'ψ', basic: 'the consciousness wave', medium: 'the conscious wavefunction', academic: 'psi, the conscious wavefunction', context: 'Consciousness field' },
  { latex: '\\Psi', display: 'Ψ', basic: 'the wave function', medium: 'the quantum wavefunction', academic: 'Psi, the system wavefunction', context: 'Quantum state' },
  { latex: '\\Psi_S', display: 'Ψ_S', basic: 'the soul field', medium: 'the soul field wavefunction', academic: 'Psi_S, the soul field', context: 'Soul field' },
  { latex: '\\phi', display: 'φ', basic: 'the phase', medium: 'the quantum phase', academic: 'phi, the phase angle', context: 'Phase' },
  { latex: '\\Phi', display: 'Φ', basic: 'the integrated information', medium: 'integrated information', academic: 'Phi, the integrated information measure', context: 'IIT measure' },
  { latex: '\\lambda', display: 'λ', basic: 'the coupling constant', medium: 'the coupling strength', academic: 'lambda, the coupling constant', context: 'Coupling' },
  { latex: '\\rho', display: 'ρ', basic: 'the density', medium: 'the density matrix', academic: 'rho, the density matrix', context: 'Density' },
  { latex: '\\sigma', display: 'σ', basic: 'sigma', medium: 'the Pauli matrix', academic: 'sigma, the Pauli spin matrix', context: 'Spin matrix' },
  { latex: '\\tau', display: 'τ', basic: 'time', medium: 'proper time', academic: 'tau, the proper time', context: 'Proper time' },
  { latex: '\\omega', display: 'ω', basic: 'the frequency', medium: 'the angular frequency', academic: 'omega, the angular frequency', context: 'Frequency' },
  { latex: '\\alpha', display: 'α', basic: 'alpha', medium: 'the fine structure constant', academic: 'alpha, approximately 1/137', context: 'Fine structure' },
  { latex: '\\beta', display: 'β', basic: 'beta', medium: 'velocity ratio', academic: 'beta, v/c', context: 'Velocity ratio' },
  { latex: '\\gamma', display: 'γ', basic: 'gamma', medium: 'the Lorentz factor', academic: 'gamma, the relativistic Lorentz factor', context: 'Lorentz factor' },
  { latex: '\\epsilon', display: 'ε', basic: 'epsilon', medium: 'a small quantity', academic: 'epsilon, a perturbation parameter', context: 'Small parameter' },
  { latex: '\\theta', display: 'θ', basic: 'the angle', medium: 'the angle theta', academic: 'theta, the angular coordinate', context: 'Angle' },
  { latex: '\\mu', display: 'μ', basic: 'mu', medium: 'the spacetime index', academic: 'mu, the spacetime coordinate index', context: 'Index' },
  { latex: '\\nu', display: 'ν', basic: 'nu', medium: 'frequency or index', academic: 'nu, the frequency or coordinate index', context: 'Frequency/Index' },
  { latex: '\\pi', display: 'π', basic: 'pi', medium: 'the ratio pi', academic: 'pi, approximately 3.14159', context: 'Mathematical constant' },
  { latex: '\\Delta', display: 'Δ', basic: 'change in', medium: 'the change in', academic: 'Delta, the difference operator', context: 'Difference' },
  { latex: '\\Lambda', display: 'Λ', basic: 'the cosmological constant', medium: 'the cosmological constant', academic: 'Lambda, the cosmological constant', context: 'Dark energy' },
  { latex: '\\Omega', display: 'Ω', basic: 'omega', medium: 'the density parameter', academic: 'Omega, the cosmic density parameter', context: 'Cosmology' },

  // Operators
  { latex: '\\nabla', display: '∇', basic: 'the change across space', medium: 'the gradient operator', academic: 'nabla, the del operator', context: 'Gradient' },
  { latex: '\\partial', display: '∂', basic: 'partial derivative of', medium: 'the partial derivative of', academic: 'partial, the partial differential', context: 'Partial derivative' },
  { latex: '\\int', display: '∫', basic: 'integral of', medium: 'the integral of', academic: 'the integral of', context: 'Integration' },
  { latex: '\\sum', display: 'Σ', basic: 'sum of', medium: 'the summation of', academic: 'the sum over', context: 'Summation' },
  { latex: '\\prod', display: 'Π', basic: 'product of', medium: 'the product of', academic: 'the product over', context: 'Product' },
  { latex: '\\lim', display: 'lim', basic: 'the limit as', medium: 'the limit as', academic: 'the limit as', context: 'Limit' },
  { latex: '\\infty', display: '∞', basic: 'infinity', medium: 'infinity', academic: 'infinity', context: 'Infinity' },
  { latex: '\\rightarrow', display: '→', basic: 'goes to', medium: 'approaches', academic: 'tends to', context: 'Limit/Arrow' },
  { latex: '\\Rightarrow', display: '⇒', basic: 'implies', medium: 'implies that', academic: 'implies', context: 'Implication' },
  { latex: '\\leftrightarrow', display: '↔', basic: 'is equivalent to', medium: 'if and only if', academic: 'is bijective with', context: 'Equivalence' },
  { latex: '\\approx', display: '≈', basic: 'approximately equals', medium: 'is approximately equal to', academic: 'approximately equals', context: 'Approximation' },
  { latex: '\\equiv', display: '≡', basic: 'is defined as', medium: 'is identically equal to', academic: 'is congruent to', context: 'Identity' },
  { latex: '\\propto', display: '∝', basic: 'is proportional to', medium: 'is proportional to', academic: 'scales as', context: 'Proportionality' },
  { latex: '\\sim', display: '~', basic: 'is similar to', medium: 'is of order', academic: 'is asymptotically', context: 'Asymptotic' },
  { latex: '\\pm', display: '±', basic: 'plus or minus', medium: 'plus or minus', academic: 'plus or minus', context: 'Error/Range' },
  { latex: '\\times', display: '×', basic: 'times', medium: 'multiplied by', academic: 'cross product with', context: 'Multiplication' },
  { latex: '\\cdot', display: '·', basic: 'times', medium: 'dot', academic: 'inner product with', context: 'Dot product' },
  { latex: '\\otimes', display: '⊗', basic: 'tensor product of', medium: 'tensor product of', academic: 'tensor product of', context: 'Tensor product' },

  // Special functions
  { latex: '\\mathcal{L}', display: 'ℒ', basic: 'Script L', medium: 'the Lagrangian', academic: 'the Lagrangian density', context: 'Field theory' },
  { latex: '\\mathcal{H}', display: 'ℋ', basic: 'Script H', medium: 'the Hamiltonian', academic: 'the Hamiltonian operator', context: 'Energy operator' },
  { latex: '\\hbar', display: 'ℏ', basic: 'h-bar', medium: 'the reduced Planck constant', academic: 'h-bar, h over 2 pi', context: 'Quantum constant' },
  { latex: '\\ket', display: '|⟩', basic: 'the state', medium: 'the ket state', academic: 'the ket vector', context: 'Quantum state' },
  { latex: '\\bra', display: '⟨|', basic: 'the dual state', medium: 'the bra state', academic: 'the bra vector', context: 'Dual state' },
  { latex: '\\braket', display: '⟨|⟩', basic: 'inner product', medium: 'the inner product', academic: 'the Dirac bracket', context: 'Inner product' },
  { latex: '\\dagger', display: '†', basic: 'dagger', medium: 'Hermitian conjugate', academic: 'the adjoint operator', context: 'Adjoint' },
  { latex: '\\hat', display: '^', basic: '', medium: 'operator', academic: 'the quantum operator', context: 'Operator hat' },

  // Relations
  { latex: '\\in', display: '∈', basic: 'is in', medium: 'is an element of', academic: 'is a member of the set', context: 'Set membership' },
  { latex: '\\subset', display: '⊂', basic: 'is a subset of', medium: 'is a subset of', academic: 'is properly contained in', context: 'Subset' },
  { latex: '\\forall', display: '∀', basic: 'for all', medium: 'for all', academic: 'for all', context: 'Universal quantifier' },
  { latex: '\\exists', display: '∃', basic: 'there exists', medium: 'there exists', academic: 'there exists', context: 'Existential quantifier' },

  // Theophysics-specific
  { latex: 'G', display: 'G', basic: 'Grace', medium: 'the Grace function', academic: 'G, the Grace coherence operator', context: 'Grace vs Gravity - context dependent', infoTheory: 'Coherence measure' },
  { latex: '\\mathcal{G}', display: '𝒢', basic: 'Grace', medium: 'the Grace functional', academic: 'the Grace coherence functional', context: 'Definitely Grace' },
  { latex: 'C', display: 'C', basic: 'coherence', medium: 'coherence measure', academic: 'C, the coherence coefficient', context: 'Coherence' },
  { latex: 'I', display: 'I', basic: 'information', medium: 'integrated information', academic: 'I, the mutual information', context: 'Information measure' },
  { latex: 'S', display: 'S', basic: 'entropy', medium: 'the entropy', academic: 'S, the von Neumann entropy', context: 'Entropy', infoTheory: 'Information uncertainty' },
  { latex: 'H', display: 'H', basic: 'entropy', medium: 'the Shannon entropy', academic: 'H, the Shannon entropy', context: 'Classical entropy', infoTheory: 'Bits of uncertainty' },
];

/**
 * Math Translator Class
 */
export class MathTranslator {
  private symbols: Map<string, MathSymbol> = new Map();
  private loaded: boolean = false;

  constructor() {
    this.loadDefaultSymbols();
  }

  /**
   * Load default symbols
   */
  private loadDefaultSymbols(): void {
    for (const symbol of DEFAULT_TRANSLATIONS) {
      this.symbols.set(symbol.latex, symbol);
    }
    this.loaded = true;
  }

  /**
   * Load symbols from CSV content
   */
  loadFromCSV(csvContent: string): void {
    const lines = csvContent.split('\n');
    if (lines.length < 2) return;

    // Parse header
    const header = this.parseCSVLine(lines[0]);
    const latexIdx = header.indexOf('LaTeX');
    const displayIdx = header.indexOf('Display');
    const basicIdx = header.indexOf('Basic');
    const mediumIdx = header.indexOf('Medium');
    const academicIdx = header.indexOf('Academic');
    const contextIdx = header.indexOf('Context');
    const infoIdx = header.indexOf('InfoTheory');

    // Parse data lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);
      if (values.length < 5) continue;

      const symbol: MathSymbol = {
        latex: values[latexIdx] || '',
        display: values[displayIdx] || '',
        basic: values[basicIdx] || '',
        medium: values[mediumIdx] || '',
        academic: values[academicIdx] || '',
        context: contextIdx >= 0 ? values[contextIdx] : undefined,
        infoTheory: infoIdx >= 0 ? values[infoIdx] : undefined,
      };

      if (symbol.latex) {
        this.symbols.set(symbol.latex, symbol);
      }
    }

    this.loaded = true;
  }

  /**
   * Parse a CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Get translation for a LaTeX expression
   */
  translate(latex: string, level: TranslationLevel = 'medium'): string {
    let result = latex;

    // Sort symbols by length (longest first) to avoid partial matches
    const sortedSymbols = Array.from(this.symbols.entries())
      .sort((a, b) => b[0].length - a[0].length);

    for (const [symbolLatex, symbol] of sortedSymbols) {
      const escaped = this.escapeRegex(symbolLatex);
      const pattern = new RegExp(escaped, 'g');

      const translation = symbol[level] || symbol.basic || symbol.display;
      result = result.replace(pattern, ` ${translation} `);
    }

    // Clean up spacing
    result = result.replace(/\s+/g, ' ').trim();

    // Handle remaining LaTeX
    result = this.cleanupRemainingLatex(result);

    return result;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Clean up remaining LaTeX commands
   */
  private cleanupRemainingLatex(text: string): string {
    let result = text;

    // Remove \frac and format as "X over Y"
    result = result.replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '$1 over $2');

    // Remove \sqrt and format
    result = result.replace(/\\sqrt\s*\{([^}]+)\}/g, 'square root of $1');
    result = result.replace(/\\sqrt\[(\d+)\]\s*\{([^}]+)\}/g, '$1th root of $2');

    // Remove subscripts/superscripts notation
    result = result.replace(/_\{([^}]+)\}/g, ' sub $1');
    result = result.replace(/\^\{([^}]+)\}/g, ' to the $1');
    result = result.replace(/_(\w)/g, ' sub $1');
    result = result.replace(/\^(\w)/g, ' to the $1');

    // Remove remaining curly braces
    result = result.replace(/[{}]/g, '');

    // Remove remaining backslashes before words
    result = result.replace(/\\([a-zA-Z]+)/g, '$1');

    // Clean up dollar signs
    result = result.replace(/\$+/g, '');

    // Clean up spacing
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * Get symbol info
   */
  getSymbol(latex: string): MathSymbol | undefined {
    return this.symbols.get(latex);
  }

  /**
   * Get all symbols
   */
  getAllSymbols(): MathSymbol[] {
    return Array.from(this.symbols.values());
  }

  /**
   * Check if a symbol has context warnings
   */
  hasContextWarning(latex: string): boolean {
    const symbol = this.symbols.get(latex);
    return !!symbol?.context?.toLowerCase().includes('context');
  }

  /**
   * Get context warning for a symbol
   */
  getContextWarning(latex: string): string | undefined {
    const symbol = this.symbols.get(latex);
    return symbol?.context;
  }
}

/**
 * Parse math blocks from content
 */
export function parseMathBlocks(
  content: string,
  notePath: string
): MathBlock[] {
  const blocks: MathBlock[] = [];

  // Display math: $$...$$
  const displayPattern = /\$\$([\s\S]*?)\$\$/g;
  let match;

  while ((match = displayPattern.exec(content)) !== null) {
    const lineNumber = getLineNumber(content, match.index);

    blocks.push({
      uuid: uuidv4(),
      notePath,
      latexContent: match[1].trim(),
      isInline: false,
      translations: {
        basic: '',
        medium: '',
        academic: '',
      },
      position: {
        start: match.index,
        end: match.index + match[0].length,
        line: lineNumber,
      },
      createdAt: new Date(),
    });
  }

  // Inline math: $...$
  const inlinePattern = /\$([^$\n]+)\$/g;

  while ((match = inlinePattern.exec(content)) !== null) {
    // Skip if part of display math
    const before = content.substring(Math.max(0, match.index - 1), match.index);
    const after = content.substring(
      match.index + match[0].length,
      match.index + match[0].length + 1
    );

    if (before === '$' || after === '$') continue;

    const lineNumber = getLineNumber(content, match.index);

    blocks.push({
      uuid: uuidv4(),
      notePath,
      latexContent: match[1].trim(),
      isInline: true,
      translations: {
        basic: '',
        medium: '',
        academic: '',
      },
      position: {
        start: match.index,
        end: match.index + match[0].length,
        line: lineNumber,
      },
      createdAt: new Date(),
    });
  }

  return blocks;
}

/**
 * Get line number from offset
 */
function getLineNumber(content: string, offset: number): number {
  return content.substring(0, offset).split('\n').length;
}

/**
 * Format math translation as callout
 */
export function formatTranslationCallout(
  latexContent: string,
  translation: string,
  level: TranslationLevel
): string {
  const levelLabel = {
    basic: 'Basic',
    medium: 'Medium',
    academic: 'Academic',
  }[level];

  return `\n> [!math-translation]\n> **${levelLabel}:** ${translation}\n`;
}

/**
 * Add translation to content after math block
 */
export function insertMathTranslation(
  content: string,
  block: MathBlock,
  translation: string,
  level: TranslationLevel
): string {
  const callout = formatTranslationCallout(block.latexContent, translation, level);

  const before = content.substring(0, block.position.end);
  const after = content.substring(block.position.end);

  return before + callout + after;
}
