/**
 * AI Auto-Classification Module
 *
 * Automatically classifies content into semantic types using AI or heuristics.
 */

import {
  SemanticType,
  ClassificationResult,
  ClassificationContext,
  AIProviderConfig,
  SemanticBlock,
} from '../types';

// Classification keywords and patterns
const CLASSIFICATION_PATTERNS: Record<SemanticType, RegExp[]> = {
  hypothesis: [
    /\b(hypothesi[sz]e?|propose|suggest|predict|may|might|could|would)\b/i,
    /\b(we (claim|argue|propose|hypothesize))\b/i,
    /\b(it is (possible|likely|probable) that)\b/i,
    /\b(if .* then)\b/i,
  ],
  axiom: [
    /\b(axiom|fundamental|foundational|principle|postulate)\b/i,
    /\b(we (assume|take as given|accept))\b/i,
    /\b(by definition)\b/i,
  ],
  evidence: [
    /\b(evidence|data|experiment|observation|result|finding|measure)\b/i,
    /\b(show(s|ed|n)?|demonstrate|confirm|support|verify)\b/i,
    /\b(according to|based on)\b/i,
    /\bp\s*[<≤]\s*0\./i, // p-values
    /\bstatistically significant\b/i,
  ],
  definition: [
    /\b(defin(e|ed|ition)|meaning|refers to|denotes)\b/i,
    /\b(is (called|known as|defined as))\b/i,
    /\b:=\b/, // Mathematical definition
    /\bwe (call|term|define)\b/i,
  ],
  derivation: [
    /\b(deriv(e|ation)|follow(s)?|therefore|hence|thus|consequently)\b/i,
    /\b(from .* we (get|obtain|derive))\b/i,
    /\b(substituting|combining|using)\b/i,
    /\bQED\b/i,
  ],
  objection: [
    /\b(objection|counter|criticism|problem|challenge|concern)\b/i,
    /\b(one might argue|critics say|it could be objected)\b/i,
    /\bhowever\b/i,
  ],
  resolution: [
    /\b(resolv(e|ed|ution)|answer|address|overcome|solution)\b/i,
    /\b(in response|we (reply|respond|address))\b/i,
    /\bthis (resolves|addresses|overcomes)\b/i,
  ],
  claim: [
    /\b(claim|assert|state|maintain)\b/i,
    /\b(we (argue|hold|contend))\b/i,
  ],
  citation: [
    /\[\d+\]/,
    /\(\d{4}\)/,
    /\bet al\./i,
    /\b(see|cf\.|ibid\.|op\. cit\.)/i,
  ],
  'cross-ref': [
    /\[\[.*\]\]/,
    /\b(section|chapter|paper|figure|table)\s+\d+/i,
    /\b(as (shown|discussed|mentioned) (in|above|below))\b/i,
  ],
  ontology: [
    /\b(term|concept|entity|category|type)\b/i,
  ],
  variable: [
    /\b[α-ωΑ-Ω]\b/,
    /\\[a-zA-Z]+\b/,
    /\$[^$]+\$/,
  ],
  concept: [
    /\b(concept|idea|notion|framework)\b/i,
  ],
  'proper-name': [
    /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/, // Person names
    /\b(theorem|principle|equation|law)\s+of\s+[A-Z][a-z]+\b/i,
  ],
  theory: [
    /\b(theory|model|framework|paradigm)\b/i,
    /\bIIT\b|\bGR\b|\bQM\b|\bQFT\b/,
  ],
};

// Semantic type weights for ambiguous cases
const TYPE_WEIGHTS: Record<SemanticType, number> = {
  hypothesis: 10,
  axiom: 15,
  evidence: 12,
  definition: 14,
  derivation: 8,
  objection: 9,
  resolution: 9,
  claim: 5,
  citation: 6,
  'cross-ref': 4,
  ontology: 3,
  variable: 2,
  concept: 3,
  'proper-name': 4,
  theory: 5,
};

/**
 * Classify content using pattern matching (local classifier)
 */
export function classifyContentLocal(
  content: string,
  context?: ClassificationContext
): ClassificationResult {
  const scores: Record<string, number> = {};

  // Score each type based on pattern matches
  for (const [type, patterns] of Object.entries(CLASSIFICATION_PATTERNS)) {
    let matchCount = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        matchCount += matches.length;
      }
    }
    if (matchCount > 0) {
      scores[type] = matchCount * TYPE_WEIGHTS[type as SemanticType];
    }
  }

  // Find best match
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return {
      type: 'claim',
      confidence: 0.3,
      reasoning: 'No strong patterns matched, defaulting to claim',
    };
  }

  const [bestType, bestScore] = entries[0];
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = Math.min(bestScore / totalScore, 0.95);

  return {
    type: bestType as SemanticType,
    confidence,
    suggestedRefId: generateRefId(bestType as SemanticType, context),
    reasoning: `Matched ${entries.length} patterns with top score ${bestScore}`,
  };
}

/**
 * Generate a reference ID based on type and context
 */
function generateRefId(
  type: SemanticType,
  context?: ClassificationContext
): string | undefined {
  const prefix = {
    hypothesis: 'H',
    axiom: 'A',
    evidence: 'E',
    definition: 'D',
    derivation: 'DV',
    objection: 'OBJ',
    resolution: 'RES',
    claim: 'C',
    citation: 'CIT',
    'cross-ref': 'CR',
    ontology: 'ONT',
    variable: 'VAR',
    concept: 'CON',
    'proper-name': 'PN',
    theory: 'TH',
  }[type];

  if (!prefix) return undefined;

  // Count existing blocks of same type
  const existingCount = context?.existingBlocks?.filter(
    b => b.semanticType === type
  ).length ?? 0;

  return `${prefix}-${String(existingCount + 1).padStart(3, '0')}`;
}

/**
 * Classify content using AI API
 */
export async function classifyContentAI(
  content: string,
  context: ClassificationContext,
  config: AIProviderConfig
): Promise<ClassificationResult> {
  const prompt = buildClassificationPrompt(content, context);

  try {
    if (config.provider === 'local') {
      // Fall back to local classifier
      return classifyContentLocal(content, context);
    }

    if (config.provider === 'api' && config.endpoint) {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          action: 'classify',
          content,
          context: {
            precedingContent: context.precedingContent,
            followingContent: context.followingContent,
            documentTitle: context.documentTitle,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        type: result.type as SemanticType,
        confidence: result.confidence,
        suggestedRefId: result.suggestedRefId,
        reasoning: result.reasoning,
      };
    }

    if (config.provider === 'openai' && config.apiKey) {
      return await classifyWithOpenAI(prompt, config.apiKey, config.model);
    }

    if (config.provider === 'anthropic' && config.apiKey) {
      return await classifyWithAnthropic(prompt, config.apiKey, config.model);
    }

    // Default to local
    return classifyContentLocal(content, context);
  } catch (error) {
    console.error('AI classification failed, falling back to local:', error);
    return classifyContentLocal(content, context);
  }
}

/**
 * Build classification prompt
 */
function buildClassificationPrompt(
  content: string,
  context: ClassificationContext
): string {
  return `Classify the following academic content into one of these semantic types:
- hypothesis: A testable claim or prediction
- axiom: A foundational truth or assumption
- evidence: Supporting data, citations, or experimental results
- definition: A canonical definition of a term
- derivation: A logical chain or mathematical derivation
- objection: A counterargument or criticism
- resolution: An answer to an objection
- claim: A standalone assertion
- citation: A reference to external work
- cross-ref: A reference to another part of the document

Document: ${context.documentTitle}

Preceding context:
${context.precedingContent}

Content to classify:
${content}

Following context:
${context.followingContent}

Respond with JSON: {"type": "...", "confidence": 0.0-1.0, "reasoning": "..."}`;
}

/**
 * Classify using OpenAI API
 */
async function classifyWithOpenAI(
  prompt: string,
  apiKey: string,
  model?: string
): Promise<ClassificationResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);

  return {
    type: result.type as SemanticType,
    confidence: result.confidence,
    reasoning: result.reasoning,
  };
}

/**
 * Classify using Anthropic API
 */
async function classifyWithAnthropic(
  prompt: string,
  apiKey: string,
  model?: string
): Promise<ClassificationResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse AI response');
  }

  const result = JSON.parse(jsonMatch[0]);

  return {
    type: result.type as SemanticType,
    confidence: result.confidence,
    reasoning: result.reasoning,
  };
}

/**
 * Auto-classify entire document
 */
export async function autoClassifyDocument(
  content: string,
  notePath: string,
  config: AIProviderConfig,
  existingBlocks: SemanticBlock[]
): Promise<Array<{ content: string; result: ClassificationResult; position: { start: number; end: number } }>> {
  const results: Array<{
    content: string;
    result: ClassificationResult;
    position: { start: number; end: number };
  }> = [];

  // Split into paragraphs
  const paragraphs = content.split(/\n\n+/);
  let offset = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];

    // Skip if already has markers
    if (para.includes('==para:') || para.includes('==sent:')) {
      offset += para.length + 2;
      continue;
    }

    // Skip very short paragraphs
    if (para.trim().length < 50) {
      offset += para.length + 2;
      continue;
    }

    const context: ClassificationContext = {
      precedingContent: paragraphs[i - 1] || '',
      followingContent: paragraphs[i + 1] || '',
      documentTitle: notePath.split('/').pop() || '',
      existingBlocks,
    };

    const result =
      config.provider === 'local'
        ? classifyContentLocal(para, context)
        : await classifyContentAI(para, context, config);

    // Only include high-confidence results
    if (result.confidence >= 0.6) {
      results.push({
        content: para,
        result,
        position: {
          start: offset,
          end: offset + para.length,
        },
      });
    }

    offset += para.length + 2;
  }

  return results;
}
