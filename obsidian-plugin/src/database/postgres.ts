/**
 * PostgreSQL Client
 *
 * Handles database connections and CRUD operations for the plugin.
 * Note: In browser/Electron context, we use HTTP API to connect to PostgreSQL
 * since pg module requires Node.js native bindings.
 */

import {
  DatabaseConfig,
  SemanticBlock,
  MathBlock,
  EvidenceBundle,
  SyncState,
} from '../types';

/**
 * PostgreSQL Client for Obsidian
 *
 * Uses HTTP API proxy since Obsidian runs in Electron and can't directly
 * use native PostgreSQL bindings.
 */
export class PostgresClient {
  private config: DatabaseConfig;
  private apiEndpoint: string;
  private connected: boolean = false;
  private lastError: string | null = null;

  constructor(config: DatabaseConfig, apiEndpoint?: string) {
    this.config = config;
    // Default to local Python engine API
    this.apiEndpoint = apiEndpoint || 'http://localhost:5000/db';
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.config),
      });

      if (response.ok) {
        this.connected = true;
        this.lastError = null;
        return true;
      }

      const error = await response.json();
      this.lastError = error.message || 'Connection failed';
      this.connected = false;
      return false;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Network error';
      this.connected = false;
      return false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get last error
   */
  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * Execute a query via API
   */
  private async query<T>(
    action: string,
    data: Record<string, unknown>
  ): Promise<T | null> {
    try {
      const response = await fetch(`${this.apiEndpoint}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: this.config,
          ...data,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        this.lastError = error.message || 'Query failed';
        return null;
      }

      return await response.json() as T;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Network error';
      return null;
    }
  }

  // ===================
  // Semantic Blocks
  // ===================

  /**
   * Save a semantic block
   */
  async saveSemanticBlock(block: SemanticBlock): Promise<boolean> {
    const result = await this.query<{ success: boolean }>('semantic/save', {
      block: {
        uuid: block.uuid,
        note_path: block.notePath,
        block_type: block.blockType,
        semantic_type: block.semanticType,
        content: block.content,
        parent_uuid: block.parentUuid || null,
        ref_id: block.refId || null,
        related_refs: block.relatedRefs,
        position_start: block.position.start,
        position_end: block.position.end,
        position_line: block.position.line,
      },
    });

    return result?.success || false;
  }

  /**
   * Save multiple semantic blocks
   */
  async saveSemanticBlocks(blocks: SemanticBlock[]): Promise<boolean> {
    const result = await this.query<{ success: boolean }>('semantic/save-batch', {
      blocks: blocks.map(block => ({
        uuid: block.uuid,
        note_path: block.notePath,
        block_type: block.blockType,
        semantic_type: block.semanticType,
        content: block.content,
        parent_uuid: block.parentUuid || null,
        ref_id: block.refId || null,
        related_refs: block.relatedRefs,
        position_start: block.position.start,
        position_end: block.position.end,
        position_line: block.position.line,
      })),
    });

    return result?.success || false;
  }

  /**
   * Get semantic blocks for a note
   */
  async getSemanticBlocks(notePath: string): Promise<SemanticBlock[]> {
    const result = await this.query<{ blocks: any[] }>('semantic/get', {
      note_path: notePath,
    });

    if (!result?.blocks) return [];

    return result.blocks.map(row => ({
      uuid: row.uuid,
      notePath: row.note_path,
      blockType: row.block_type,
      semanticType: row.semantic_type,
      content: row.content,
      parentUuid: row.parent_uuid,
      refId: row.ref_id,
      relatedRefs: row.related_refs || [],
      position: {
        start: row.position_start,
        end: row.position_end,
        line: row.position_line,
      },
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Get all semantic blocks
   */
  async getAllSemanticBlocks(): Promise<SemanticBlock[]> {
    const result = await this.query<{ blocks: any[] }>('semantic/get-all', {});

    if (!result?.blocks) return [];

    return result.blocks.map(row => ({
      uuid: row.uuid,
      notePath: row.note_path,
      blockType: row.block_type,
      semanticType: row.semantic_type,
      content: row.content,
      parentUuid: row.parent_uuid,
      refId: row.ref_id,
      relatedRefs: row.related_refs || [],
      position: {
        start: row.position_start,
        end: row.position_end,
        line: row.position_line,
      },
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  /**
   * Delete semantic blocks for a note
   */
  async deleteSemanticBlocksForNote(notePath: string): Promise<boolean> {
    const result = await this.query<{ success: boolean }>('semantic/delete', {
      note_path: notePath,
    });

    return result?.success || false;
  }

  /**
   * Search semantic blocks
   */
  async searchSemanticBlocks(
    query: string,
    type?: string
  ): Promise<SemanticBlock[]> {
    const result = await this.query<{ blocks: any[] }>('semantic/search', {
      query,
      type,
    });

    if (!result?.blocks) return [];

    return result.blocks.map(row => ({
      uuid: row.uuid,
      notePath: row.note_path,
      blockType: row.block_type,
      semanticType: row.semantic_type,
      content: row.content,
      parentUuid: row.parent_uuid,
      refId: row.ref_id,
      relatedRefs: row.related_refs || [],
      position: {
        start: row.position_start,
        end: row.position_end,
        line: row.position_line,
      },
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  // ===================
  // Math Blocks
  // ===================

  /**
   * Save a math block
   */
  async saveMathBlock(block: MathBlock): Promise<boolean> {
    const result = await this.query<{ success: boolean }>('math/save', {
      block: {
        uuid: block.uuid,
        note_path: block.notePath,
        latex_content: block.latexContent,
        is_inline: block.isInline,
        translation_basic: block.translations.basic,
        translation_medium: block.translations.medium,
        translation_academic: block.translations.academic,
        parent_uuid: block.parentUuid || null,
        position_start: block.position.start,
        position_end: block.position.end,
        position_line: block.position.line,
      },
    });

    return result?.success || false;
  }

  /**
   * Get math blocks for a note
   */
  async getMathBlocks(notePath: string): Promise<MathBlock[]> {
    const result = await this.query<{ blocks: any[] }>('math/get', {
      note_path: notePath,
    });

    if (!result?.blocks) return [];

    return result.blocks.map(row => ({
      uuid: row.uuid,
      notePath: row.note_path,
      latexContent: row.latex_content,
      isInline: row.is_inline,
      translations: {
        basic: row.translation_basic || '',
        medium: row.translation_medium || '',
        academic: row.translation_academic || '',
      },
      parentUuid: row.parent_uuid,
      position: {
        start: row.position_start,
        end: row.position_end,
        line: row.position_line,
      },
      createdAt: new Date(row.created_at),
    }));
  }

  // ===================
  // Evidence Bundles
  // ===================

  /**
   * Save an evidence bundle
   */
  async saveEvidenceBundle(bundle: EvidenceBundle): Promise<boolean> {
    const result = await this.query<{ success: boolean }>('evidence/save', {
      bundle: {
        uuid: bundle.uuid,
        claim_uuid: bundle.claimUuid,
        evidence_uuids: bundle.evidenceUuids,
        strength_score: bundle.strengthScore,
      },
    });

    return result?.success || false;
  }

  /**
   * Get evidence bundles for a claim
   */
  async getEvidenceBundles(claimUuid: string): Promise<EvidenceBundle[]> {
    const result = await this.query<{ bundles: any[] }>('evidence/get', {
      claim_uuid: claimUuid,
    });

    if (!result?.bundles) return [];

    return result.bundles.map(row => ({
      uuid: row.uuid,
      claimUuid: row.claim_uuid,
      evidenceUuids: row.evidence_uuids || [],
      strengthScore: row.strength_score,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Get all evidence bundles
   */
  async getAllEvidenceBundles(): Promise<EvidenceBundle[]> {
    const result = await this.query<{ bundles: any[] }>('evidence/get-all', {});

    if (!result?.bundles) return [];

    return result.bundles.map(row => ({
      uuid: row.uuid,
      claimUuid: row.claim_uuid,
      evidenceUuids: row.evidence_uuids || [],
      strengthScore: row.strength_score,
      createdAt: new Date(row.created_at),
    }));
  }

  // ===================
  // Definitions (from existing Python system)
  // ===================

  /**
   * Get definitions from database
   */
  async getDefinitions(): Promise<
    Array<{
      phrase: string;
      aliases: string[];
      definition: string;
      classification: string;
      folder: string;
      vaultLink: string;
    }>
  > {
    const result = await this.query<{ definitions: any[] }>('definitions/get', {});

    if (!result?.definitions) return [];

    return result.definitions.map(row => ({
      phrase: row.phrase,
      aliases: row.aliases || [],
      definition: row.definition,
      classification: row.classification || '',
      folder: row.folder || '',
      vaultLink: row.vault_link || '',
    }));
  }

  /**
   * Save a definition
   */
  async saveDefinition(
    phrase: string,
    definition: string,
    aliases?: string[],
    classification?: string,
    folder?: string,
    vaultLink?: string
  ): Promise<boolean> {
    const result = await this.query<{ success: boolean }>('definitions/save', {
      phrase,
      definition,
      aliases: aliases || [],
      classification: classification || '',
      folder: folder || '',
      vault_link: vaultLink || '',
    });

    return result?.success || false;
  }

  // ===================
  // Research Links
  // ===================

  /**
   * Get research links for a term
   */
  async getResearchLinks(
    term: string
  ): Promise<Array<{ source: string; url: string; priority: number }>> {
    const result = await this.query<{ links: any[] }>('links/get', { term });

    if (!result?.links) return [];

    return result.links.map(row => ({
      source: row.source,
      url: row.url,
      priority: row.priority || 0,
    }));
  }

  /**
   * Save a research link
   */
  async saveResearchLink(
    term: string,
    source: string,
    url: string,
    priority?: number
  ): Promise<boolean> {
    const result = await this.query<{ success: boolean }>('links/save', {
      term,
      source,
      url,
      priority: priority || 0,
    });

    return result?.success || false;
  }
}

/**
 * Create database schema SQL
 */
export function getSchemaSQL(): string {
  return `
    -- Semantic Blocks
    CREATE TABLE IF NOT EXISTS semantic_blocks (
      uuid UUID PRIMARY KEY,
      note_path TEXT NOT NULL,
      block_type TEXT NOT NULL,
      semantic_type TEXT NOT NULL,
      content TEXT NOT NULL,
      parent_uuid UUID REFERENCES semantic_blocks(uuid) ON DELETE SET NULL,
      ref_id TEXT,
      related_refs TEXT[],
      position_start INTEGER,
      position_end INTEGER,
      position_line INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_semantic_blocks_note ON semantic_blocks(note_path);
    CREATE INDEX IF NOT EXISTS idx_semantic_blocks_type ON semantic_blocks(semantic_type);
    CREATE INDEX IF NOT EXISTS idx_semantic_blocks_ref ON semantic_blocks(ref_id);

    -- Math Blocks
    CREATE TABLE IF NOT EXISTS math_blocks (
      uuid UUID PRIMARY KEY,
      note_path TEXT NOT NULL,
      latex_content TEXT NOT NULL,
      is_inline BOOLEAN DEFAULT FALSE,
      translation_basic TEXT,
      translation_medium TEXT,
      translation_academic TEXT,
      parent_uuid UUID REFERENCES semantic_blocks(uuid) ON DELETE SET NULL,
      position_start INTEGER,
      position_end INTEGER,
      position_line INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_math_blocks_note ON math_blocks(note_path);

    -- Evidence Bundles
    CREATE TABLE IF NOT EXISTS evidence_bundles (
      uuid UUID PRIMARY KEY,
      claim_uuid UUID REFERENCES semantic_blocks(uuid) ON DELETE CASCADE,
      evidence_uuids UUID[],
      strength_score FLOAT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_evidence_bundles_claim ON evidence_bundles(claim_uuid);

    -- Research Links
    CREATE TABLE IF NOT EXISTS research_links (
      id SERIAL PRIMARY KEY,
      term TEXT NOT NULL,
      source TEXT NOT NULL,
      url TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(term, source)
    );

    CREATE INDEX IF NOT EXISTS idx_research_links_term ON research_links(term);
  `;
}
