/**
 * Theophysics Research Assistant - Type Definitions
 */

// =====================
// Semantic Block Types
// =====================

export type BlockType = 'para' | 'sent' | 'word';

export type SemanticType =
  // Paragraph level
  | 'hypothesis'
  | 'axiom'
  | 'evidence'
  | 'definition'
  | 'derivation'
  | 'objection'
  | 'resolution'
  // Sentence level
  | 'claim'
  | 'citation'
  | 'cross-ref'
  // Word level
  | 'ontology'
  | 'variable'
  | 'concept'
  | 'proper-name'
  | 'theory';

export interface SemanticBlock {
  uuid: string;
  notePath: string;
  blockType: BlockType;
  semanticType: SemanticType;
  content: string;
  parentUuid?: string;
  refId?: string;
  relatedRefs: string[];
  position: {
    start: number;
    end: number;
    line: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedMarker {
  fullMatch: string;
  blockType: BlockType;
  semanticType: string;
  refId?: string;
  uuid: string;
  content: string;
  startOffset: number;
  endOffset: number;
}

// =====================
// Math Translation Types
// =====================

export type TranslationLevel = 'basic' | 'medium' | 'academic';

export interface MathSymbol {
  latex: string;
  display: string;
  basic: string;
  medium: string;
  academic: string;
  context?: string;
  infoTheory?: string;
}

export interface MathBlock {
  uuid: string;
  notePath: string;
  latexContent: string;
  isInline: boolean;
  translations: {
    basic: string;
    medium: string;
    academic: string;
  };
  parentUuid?: string;
  position: {
    start: number;
    end: number;
    line: number;
  };
  createdAt: Date;
}

// =====================
// Evidence Bundle Types
// =====================

export interface EvidenceBundle {
  uuid: string;
  claimUuid: string;
  evidenceUuids: string[];
  strengthScore: number;
  createdAt: Date;
}

export interface EvidenceMatch {
  blockUuid: string;
  content: string;
  notePath: string;
  relevanceScore: number;
  matchType: 'exact' | 'semantic' | 'related';
}

// =====================
// Database Types
// =====================

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export interface SyncState {
  lastSyncTime: Date | null;
  pendingChanges: number;
  isConnected: boolean;
  isSyncing: boolean;
  error?: string;
}

export interface SyncQueueItem {
  id: string;
  operation: 'insert' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>;
  timestamp: Date;
  retries: number;
}

// =====================
// AI Classification Types
// =====================

export interface ClassificationResult {
  type: SemanticType;
  confidence: number;
  suggestedRefId?: string;
  reasoning?: string;
}

export interface ClassificationContext {
  precedingContent: string;
  followingContent: string;
  documentTitle: string;
  existingBlocks: SemanticBlock[];
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'api';
  apiKey?: string;
  endpoint?: string;
  model?: string;
}

// =====================
// Research Links Types
// =====================

export type LinkSource =
  | 'stanford'
  | 'iep'
  | 'oxford'
  | 'cambridge'
  | 'philpapers'
  | 'philarchive'
  | 'scholar'
  | 'jstor'
  | 'muse'
  | 'britannica'
  | 'arxiv'
  | 'wikipedia';

export interface ResearchLink {
  term: string;
  source: LinkSource;
  url: string;
  priority: number;
  verified: boolean;
}

// =====================
// Plugin Settings Types
// =====================

export interface TheophysicsSettings {
  // Semantic Markup
  autoClassifyOnSave: boolean;
  showMarkersInEditMode: boolean;
  highlightByType: boolean;

  // Database
  database: DatabaseConfig;
  enableBidirectionalSync: boolean;
  autoSyncOnSave: boolean;
  syncDebounceMs: number;

  // Math Translation
  defaultTranslationLevel: TranslationLevel;
  showTranslationsInline: boolean;
  includeInfoTheoryEquivalents: boolean;
  showContextWarnings: boolean;
  mathTablePath: string;

  // AI Integration
  aiProvider: AIProviderConfig;
  enableAutoClassify: boolean;
  enableAutoBundleEvidence: boolean;
  enableAutoGenerateLinks: boolean;

  // UI
  showSidebarPanel: boolean;
  enableTooltips: boolean;

  // Research Links
  linkPriority: LinkSource[];
}

export const DEFAULT_SETTINGS: TheophysicsSettings = {
  // Semantic Markup
  autoClassifyOnSave: true,
  showMarkersInEditMode: true,
  highlightByType: true,

  // Database
  database: {
    host: 'localhost',
    port: 5432,
    database: 'theophysics_research',
    user: 'postgres',
    password: '',
    ssl: false,
  },
  enableBidirectionalSync: true,
  autoSyncOnSave: true,
  syncDebounceMs: 5000,

  // Math Translation
  defaultTranslationLevel: 'medium',
  showTranslationsInline: true,
  includeInfoTheoryEquivalents: true,
  showContextWarnings: false,
  mathTablePath: '',

  // AI Integration
  aiProvider: {
    provider: 'local',
  },
  enableAutoClassify: true,
  enableAutoBundleEvidence: true,
  enableAutoGenerateLinks: true,

  // UI
  showSidebarPanel: true,
  enableTooltips: true,

  // Research Links
  linkPriority: [
    'stanford', 'iep', 'oxford', 'cambridge', 'philpapers',
    'philarchive', 'scholar', 'jstor', 'muse', 'britannica',
    'arxiv', 'wikipedia'
  ],
};

// =====================
// Document Stats Types
// =====================

export interface DocumentStats {
  notePath: string;
  hypotheses: number;
  evidence: number;
  axioms: number;
  definitions: number;
  mathBlocks: number;
  properNames: number;
  totalBlocks: number;
  lastUpdated: Date;
}

// =====================
// TTS Export Types
// =====================

export interface TTSExportOptions {
  translationLevel: TranslationLevel;
  includeHeaders: boolean;
  stripMarkdown: boolean;
  mathPrefix: string;
}

export interface TTSContent {
  displayContent: string;
  ttsContent: string;
  notePath: string;
}
