/**
 * Evidence Bundler
 *
 * Automatically finds and bundles evidence for claims/hypotheses.
 */

import { App, TFile } from 'obsidian';
import {
  SemanticBlock,
  EvidenceBundle,
  EvidenceMatch,
  AIProviderConfig,
} from '../types';
import { parseSemanticMarkers } from './parser';
import { v4 as uuidv4 } from 'uuid';

/**
 * Evidence Bundler class
 */
export class EvidenceBundler {
  private app: App;
  private aiConfig: AIProviderConfig;

  constructor(app: App, aiConfig: AIProviderConfig) {
    this.app = app;
    this.aiConfig = aiConfig;
  }

  /**
   * Find all claims and hypotheses in the vault
   */
  async findAllClaims(): Promise<SemanticBlock[]> {
    const claims: SemanticBlock[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const content = await this.app.vault.read(file);
      const blocks = parseSemanticMarkers(content, file.path);

      const claimBlocks = blocks.filter(
        b => b.semanticType === 'hypothesis' ||
             b.semanticType === 'claim' ||
             b.semanticType === 'axiom'
      );

      claims.push(...claimBlocks);
    }

    return claims;
  }

  /**
   * Find evidence blocks in the vault
   */
  async findAllEvidence(): Promise<SemanticBlock[]> {
    const evidence: SemanticBlock[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const content = await this.app.vault.read(file);
      const blocks = parseSemanticMarkers(content, file.path);

      const evidenceBlocks = blocks.filter(
        b => b.semanticType === 'evidence' ||
             b.semanticType === 'citation'
      );

      evidence.push(...evidenceBlocks);
    }

    return evidence;
  }

  /**
   * Bundle evidence for a specific claim
   */
  async bundleEvidenceForClaim(
    claim: SemanticBlock,
    allEvidence?: SemanticBlock[]
  ): Promise<EvidenceBundle> {
    const evidence = allEvidence || await this.findAllEvidence();
    const matches: EvidenceMatch[] = [];

    for (const ev of evidence) {
      const score = this.calculateRelevance(claim, ev);

      if (score > 0.3) {
        matches.push({
          blockUuid: ev.uuid,
          content: ev.content,
          notePath: ev.notePath,
          relevanceScore: score,
          matchType: this.determineMatchType(claim, ev),
        });
      }
    }

    // Sort by relevance
    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Take top 10 matches
    const topMatches = matches.slice(0, 10);

    // Calculate overall strength score
    const strengthScore = topMatches.length > 0
      ? topMatches.reduce((sum, m) => sum + m.relevanceScore, 0) / topMatches.length
      : 0;

    return {
      uuid: uuidv4(),
      claimUuid: claim.uuid,
      evidenceUuids: topMatches.map(m => m.blockUuid),
      strengthScore,
      createdAt: new Date(),
    };
  }

  /**
   * Calculate relevance score between claim and evidence
   */
  private calculateRelevance(claim: SemanticBlock, evidence: SemanticBlock): number {
    let score = 0;

    // Extract key terms from claim
    const claimTerms = this.extractKeyTerms(claim.content);
    const evidenceTerms = this.extractKeyTerms(evidence.content);

    // Term overlap
    const overlap = claimTerms.filter(t => evidenceTerms.includes(t));
    score += (overlap.length / Math.max(claimTerms.length, 1)) * 0.5;

    // Check for explicit references
    if (evidence.relatedRefs.some(ref => claim.refId?.includes(ref))) {
      score += 0.3;
    }

    // Same document bonus
    if (claim.notePath === evidence.notePath) {
      score += 0.1;
    }

    // Reference ID match
    if (claim.refId && evidence.content.includes(claim.refId)) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }

  /**
   * Determine match type
   */
  private determineMatchType(
    claim: SemanticBlock,
    evidence: SemanticBlock
  ): 'exact' | 'semantic' | 'related' {
    // Check for exact reference
    if (claim.refId && evidence.content.includes(claim.refId)) {
      return 'exact';
    }

    if (evidence.relatedRefs.some(ref => claim.refId?.includes(ref))) {
      return 'exact';
    }

    // High term overlap = semantic
    const claimTerms = this.extractKeyTerms(claim.content);
    const evidenceTerms = this.extractKeyTerms(evidence.content);
    const overlap = claimTerms.filter(t => evidenceTerms.includes(t));

    if (overlap.length >= 3) {
      return 'semantic';
    }

    return 'related';
  }

  /**
   * Extract key terms from content
   */
  private extractKeyTerms(content: string): string[] {
    // Common stop words to exclude
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'up', 'about', 'into', 'over', 'after', 'beneath', 'under',
      'above', 'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either',
      'neither', 'not', 'only', 'own', 'same', 'than', 'too', 'very',
      'just', 'also', 'now', 'here', 'there', 'when', 'where', 'why',
      'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
      'other', 'some', 'such', 'this', 'that', 'these', 'those',
    ]);

    return content
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter((word, index, self) => self.indexOf(word) === index);
  }

  /**
   * Bundle evidence for all claims in the vault
   */
  async bundleAllEvidence(): Promise<EvidenceBundle[]> {
    const claims = await this.findAllClaims();
    const evidence = await this.findAllEvidence();
    const bundles: EvidenceBundle[] = [];

    for (const claim of claims) {
      const bundle = await this.bundleEvidenceForClaim(claim, evidence);
      if (bundle.evidenceUuids.length > 0) {
        bundles.push(bundle);
      }
    }

    return bundles;
  }

  /**
   * Generate markdown section showing evidence bundle
   */
  formatEvidenceBundleMarkdown(
    bundle: EvidenceBundle,
    evidenceBlocks: SemanticBlock[]
  ): string {
    const lines: string[] = [];

    lines.push(`**Evidence Bundle** (Strength: ${(bundle.strengthScore * 100).toFixed(0)}%)`);
    lines.push('');

    for (const evidenceUuid of bundle.evidenceUuids) {
      const evidence = evidenceBlocks.find(e => e.uuid === evidenceUuid);
      if (evidence) {
        const shortContent = evidence.content.length > 100
          ? evidence.content.substring(0, 100) + '...'
          : evidence.content;

        lines.push(`- [[${evidence.notePath}|${shortContent}]]`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Use AI to find semantic evidence matches
   */
  async findSemanticMatches(
    claim: SemanticBlock,
    evidence: SemanticBlock[]
  ): Promise<EvidenceMatch[]> {
    if (this.aiConfig.provider === 'local') {
      // Fall back to keyword matching
      const matches: EvidenceMatch[] = [];
      for (const ev of evidence) {
        const score = this.calculateRelevance(claim, ev);
        if (score > 0.3) {
          matches.push({
            blockUuid: ev.uuid,
            content: ev.content,
            notePath: ev.notePath,
            relevanceScore: score,
            matchType: this.determineMatchType(claim, ev),
          });
        }
      }
      return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // Use AI for semantic matching
    if (this.aiConfig.provider === 'api' && this.aiConfig.endpoint) {
      try {
        const response = await fetch(this.aiConfig.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.aiConfig.apiKey
              ? { Authorization: `Bearer ${this.aiConfig.apiKey}` }
              : {}),
          },
          body: JSON.stringify({
            action: 'find_evidence',
            claim: claim.content,
            evidence: evidence.map(e => ({
              uuid: e.uuid,
              content: e.content,
              notePath: e.notePath,
            })),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          return result.matches;
        }
      } catch (error) {
        console.error('AI semantic matching failed:', error);
      }
    }

    // Fall back to local matching
    return this.findSemanticMatches(claim, evidence);
  }
}

/**
 * Create evidence bundle summary for a document
 */
export function createEvidenceSummary(
  bundles: EvidenceBundle[],
  blocks: SemanticBlock[]
): string {
  const lines: string[] = [];

  lines.push('## Evidence Summary');
  lines.push('');

  const claimBundles = bundles.map(bundle => {
    const claim = blocks.find(b => b.uuid === bundle.claimUuid);
    return { bundle, claim };
  }).filter(item => item.claim);

  // Group by strength
  const strong = claimBundles.filter(
    item => item.bundle.strengthScore >= 0.7
  );
  const moderate = claimBundles.filter(
    item => item.bundle.strengthScore >= 0.4 && item.bundle.strengthScore < 0.7
  );
  const weak = claimBundles.filter(
    item => item.bundle.strengthScore < 0.4
  );

  if (strong.length > 0) {
    lines.push('### Strong Evidence Support');
    for (const { claim } of strong) {
      if (claim) {
        lines.push(`- ${claim.refId || claim.uuid.slice(0, 8)}: ${claim.content.slice(0, 80)}...`);
      }
    }
    lines.push('');
  }

  if (moderate.length > 0) {
    lines.push('### Moderate Evidence Support');
    for (const { claim } of moderate) {
      if (claim) {
        lines.push(`- ${claim.refId || claim.uuid.slice(0, 8)}: ${claim.content.slice(0, 80)}...`);
      }
    }
    lines.push('');
  }

  if (weak.length > 0) {
    lines.push('### Needs More Evidence');
    for (const { claim } of weak) {
      if (claim) {
        lines.push(`- ${claim.refId || claim.uuid.slice(0, 8)}: ${claim.content.slice(0, 80)}...`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
