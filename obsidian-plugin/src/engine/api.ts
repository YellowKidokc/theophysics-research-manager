/**
 * Python Engine API Connector
 *
 * Communicates with the Python backend engine for heavy computation,
 * AI classification, and external API access.
 */

import {
  SemanticBlock,
  MathBlock,
  ClassificationResult,
  EvidenceBundle,
  AIProviderConfig,
} from '../types';

/**
 * Engine API Client
 */
export class EngineAPIClient {
  private baseUrl: string;
  private connected: boolean = false;
  private lastError: string | null = null;

  constructor(baseUrl: string = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Set base URL
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Test connection to engine
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (response.ok) {
        this.connected = true;
        this.lastError = null;
        return true;
      }
      this.connected = false;
      this.lastError = 'Engine not responding';
      return false;
    } catch (error) {
      this.connected = false;
      this.lastError = error instanceof Error ? error.message : 'Connection failed';
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
   * Make an API request
   */
  private async request<T>(
    endpoint: string,
    data: Record<string, unknown>
  ): Promise<T | null> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        this.lastError = error.message || 'Request failed';
        return null;
      }

      return await response.json() as T;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Request error';
      return null;
    }
  }

  /**
   * Classify content using AI
   */
  async classify(
    content: string,
    context?: Record<string, unknown>
  ): Promise<ClassificationResult | null> {
    const result = await this.request<{
      type: string;
      confidence: number;
      reasoning?: string;
    }>('/classify', {
      content,
      context: context || {},
    });

    if (!result) return null;

    return {
      type: result.type as ClassificationResult['type'],
      confidence: result.confidence,
      reasoning: result.reasoning,
    };
  }

  /**
   * Translate math expression
   */
  async translateMath(
    latex: string,
    level: 'basic' | 'medium' | 'academic'
  ): Promise<string | null> {
    const result = await this.request<{ translation: string }>(
      '/translate-math',
      { latex, level }
    );

    return result?.translation || null;
  }

  /**
   * Bundle evidence for claims
   */
  async bundleEvidence(
    hypothesis: string,
    scope: 'document' | 'vault'
  ): Promise<EvidenceBundle | null> {
    const result = await this.request<{
      uuid: string;
      evidence_uuids: string[];
      strength_score: number;
    }>('/bundle-evidence', {
      hypothesis,
      scope,
    });

    if (!result) return null;

    return {
      uuid: result.uuid,
      claimUuid: '',
      evidenceUuids: result.evidence_uuids,
      strengthScore: result.strength_score,
      createdAt: new Date(),
    };
  }

  /**
   * Generate research links for terms
   */
  async generateLinks(
    terms: string[]
  ): Promise<Record<string, Record<string, string>> | null> {
    return this.request<Record<string, Record<string, string>>>(
      '/generate-links',
      { terms }
    );
  }

  /**
   * Analyze document structure
   */
  async analyzeDocument(
    notePath: string,
    content: string
  ): Promise<{
    semanticBlocks: SemanticBlock[];
    mathBlocks: MathBlock[];
    suggestions: string[];
    warnings: string[];
  } | null> {
    const result = await this.request<{
      semantic_blocks: any[];
      math_blocks: any[];
      suggestions: string[];
      warnings: string[];
    }>('/analyze-document', {
      note_path: notePath,
      content,
    });

    if (!result) return null;

    return {
      semanticBlocks: result.semantic_blocks.map(b => ({
        uuid: b.uuid,
        notePath: b.note_path,
        blockType: b.block_type,
        semanticType: b.semantic_type,
        content: b.content,
        parentUuid: b.parent_uuid,
        refId: b.ref_id,
        relatedRefs: b.related_refs || [],
        position: {
          start: b.position_start,
          end: b.position_end,
          line: b.position_line,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      mathBlocks: result.math_blocks.map(b => ({
        uuid: b.uuid,
        notePath: b.note_path,
        latexContent: b.latex_content,
        isInline: b.is_inline,
        translations: {
          basic: b.translation_basic || '',
          medium: b.translation_medium || '',
          academic: b.translation_academic || '',
        },
        position: {
          start: b.position_start,
          end: b.position_end,
          line: b.position_line,
        },
        createdAt: new Date(),
      })),
      suggestions: result.suggestions,
      warnings: result.warnings,
    };
  }

  /**
   * Get vault statistics
   */
  async getVaultStats(): Promise<{
    totalBlocks: number;
    byType: Record<string, number>;
    recentActivity: Array<{ date: string; count: number }>;
  } | null> {
    return this.request<{
      totalBlocks: number;
      byType: Record<string, number>;
      recentActivity: Array<{ date: string; count: number }>;
    }>('/vault-stats', {});
  }

  /**
   * Search across all blocks
   */
  async search(
    query: string,
    filters?: {
      type?: string;
      notePath?: string;
      dateRange?: { start: string; end: string };
    }
  ): Promise<SemanticBlock[] | null> {
    const result = await this.request<{ blocks: any[] }>('/search', {
      query,
      filters: filters || {},
    });

    if (!result?.blocks) return null;

    return result.blocks.map(b => ({
      uuid: b.uuid,
      notePath: b.note_path,
      blockType: b.block_type,
      semanticType: b.semantic_type,
      content: b.content,
      parentUuid: b.parent_uuid,
      refId: b.ref_id,
      relatedRefs: b.related_refs || [],
      position: {
        start: b.position_start,
        end: b.position_end,
        line: b.position_line,
      },
      createdAt: new Date(b.created_at),
      updatedAt: new Date(b.updated_at),
    }));
  }
}

/**
 * Singleton instance
 */
let engineClient: EngineAPIClient | null = null;

/**
 * Get engine client instance
 */
export function getEngineClient(baseUrl?: string): EngineAPIClient {
  if (!engineClient) {
    engineClient = new EngineAPIClient(baseUrl);
  } else if (baseUrl) {
    engineClient.setBaseUrl(baseUrl);
  }
  return engineClient;
}
