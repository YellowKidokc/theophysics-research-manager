/**
 * Semantic Markup Parser
 *
 * Parses and manages semantic markers in documents.
 * Syntax: ==TYPE:subtype:ref-id:uuid== content ==
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SemanticBlock,
  ParsedMarker,
  BlockType,
  SemanticType,
} from '../types';

// Pattern for paragraph-level markers
// ==para:TYPE:uuid== content ==para:end==
const PARA_PATTERN = /==para:(\w+):([^=]+)==([\s\S]*?)==para:end==/g;

// Pattern for paragraph markers with ref-id
// ==para:TYPE:ref-id:uuid== content ==para:end==
const PARA_WITH_REF_PATTERN = /==para:(\w+):([^:]+):([^=]+)==([\s\S]*?)==para:end==/g;

// Pattern for sentence-level markers
// ==sent:TYPE:ref-id:uuid== content ==
const SENT_PATTERN = /==sent:(\w+):([^:]+):([^=]+)==([^=]*?)==/g;

// Pattern for word-level markers
// ==word:TYPE:term-id:uuid== content ==
const WORD_PATTERN = /==word:(\w+):([^:]+):([^=]+)==([^=]*?)==/g;

// Simple patterns without ref-id
const SENT_SIMPLE_PATTERN = /==sent:(\w+):([^=]+)==([^=]*?)==/g;
const WORD_SIMPLE_PATTERN = /==word:(\w+):([^=]+)==([^=]*?)==/g;

/**
 * Generates a new UUID for semantic blocks
 */
export function generateUuid(): string {
  return uuidv4();
}

/**
 * Parses all semantic markers from document content
 */
export function parseSemanticMarkers(
  content: string,
  notePath: string
): SemanticBlock[] {
  const blocks: SemanticBlock[] = [];

  // Parse paragraph-level markers
  blocks.push(...parseParagraphMarkers(content, notePath));

  // Parse sentence-level markers
  blocks.push(...parseSentenceMarkers(content, notePath));

  // Parse word-level markers
  blocks.push(...parseWordMarkers(content, notePath));

  return blocks;
}

/**
 * Parse paragraph-level semantic markers
 */
function parseParagraphMarkers(
  content: string,
  notePath: string
): SemanticBlock[] {
  const blocks: SemanticBlock[] = [];
  let match: RegExpExecArray | null;

  // Try pattern with ref-id first
  const withRefPattern = new RegExp(PARA_WITH_REF_PATTERN.source, 'g');
  while ((match = withRefPattern.exec(content)) !== null) {
    const [fullMatch, semanticType, refId, uuid, blockContent] = match;
    const lineNumber = getLineNumber(content, match.index);

    blocks.push({
      uuid: uuid.trim(),
      notePath,
      blockType: 'para',
      semanticType: semanticType as SemanticType,
      content: blockContent.trim(),
      refId: refId.trim(),
      relatedRefs: extractRelatedRefs(blockContent),
      position: {
        start: match.index,
        end: match.index + fullMatch.length,
        line: lineNumber,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Then try simple pattern (no ref-id)
  const simplePattern = new RegExp(PARA_PATTERN.source, 'g');
  while ((match = simplePattern.exec(content)) !== null) {
    const [fullMatch, semanticType, uuid, blockContent] = match;

    // Skip if already parsed (check if position overlaps)
    const startPos = match.index;
    const alreadyParsed = blocks.some(
      b => b.position.start <= startPos && b.position.end >= startPos
    );
    if (alreadyParsed) continue;

    const lineNumber = getLineNumber(content, match.index);

    blocks.push({
      uuid: uuid.trim(),
      notePath,
      blockType: 'para',
      semanticType: semanticType as SemanticType,
      content: blockContent.trim(),
      relatedRefs: extractRelatedRefs(blockContent),
      position: {
        start: match.index,
        end: match.index + fullMatch.length,
        line: lineNumber,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return blocks;
}

/**
 * Parse sentence-level semantic markers
 */
function parseSentenceMarkers(
  content: string,
  notePath: string
): SemanticBlock[] {
  const blocks: SemanticBlock[] = [];
  let match: RegExpExecArray | null;

  // Try pattern with ref-id first
  const withRefPattern = new RegExp(SENT_PATTERN.source, 'g');
  while ((match = withRefPattern.exec(content)) !== null) {
    const [fullMatch, semanticType, refId, uuid, blockContent] = match;
    const lineNumber = getLineNumber(content, match.index);

    blocks.push({
      uuid: uuid.trim(),
      notePath,
      blockType: 'sent',
      semanticType: semanticType as SemanticType,
      content: blockContent.trim(),
      refId: refId.trim(),
      relatedRefs: extractRelatedRefs(blockContent),
      position: {
        start: match.index,
        end: match.index + fullMatch.length,
        line: lineNumber,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Simple pattern (no ref-id)
  const simplePattern = new RegExp(SENT_SIMPLE_PATTERN.source, 'g');
  while ((match = simplePattern.exec(content)) !== null) {
    const [fullMatch, semanticType, uuid, blockContent] = match;

    const startPos = match.index;
    const alreadyParsed = blocks.some(
      b => b.position.start <= startPos && b.position.end >= startPos
    );
    if (alreadyParsed) continue;

    const lineNumber = getLineNumber(content, match.index);

    blocks.push({
      uuid: uuid.trim(),
      notePath,
      blockType: 'sent',
      semanticType: semanticType as SemanticType,
      content: blockContent.trim(),
      relatedRefs: extractRelatedRefs(blockContent),
      position: {
        start: match.index,
        end: match.index + fullMatch.length,
        line: lineNumber,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return blocks;
}

/**
 * Parse word-level semantic markers
 */
function parseWordMarkers(
  content: string,
  notePath: string
): SemanticBlock[] {
  const blocks: SemanticBlock[] = [];
  let match: RegExpExecArray | null;

  // Try pattern with term-id first
  const withRefPattern = new RegExp(WORD_PATTERN.source, 'g');
  while ((match = withRefPattern.exec(content)) !== null) {
    const [fullMatch, semanticType, termId, uuid, blockContent] = match;
    const lineNumber = getLineNumber(content, match.index);

    blocks.push({
      uuid: uuid.trim(),
      notePath,
      blockType: 'word',
      semanticType: semanticType as SemanticType,
      content: blockContent.trim(),
      refId: termId.trim(),
      relatedRefs: [],
      position: {
        start: match.index,
        end: match.index + fullMatch.length,
        line: lineNumber,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Simple pattern
  const simplePattern = new RegExp(WORD_SIMPLE_PATTERN.source, 'g');
  while ((match = simplePattern.exec(content)) !== null) {
    const [fullMatch, semanticType, uuid, blockContent] = match;

    const startPos = match.index;
    const alreadyParsed = blocks.some(
      b => b.position.start <= startPos && b.position.end >= startPos
    );
    if (alreadyParsed) continue;

    const lineNumber = getLineNumber(content, match.index);

    blocks.push({
      uuid: uuid.trim(),
      notePath,
      blockType: 'word',
      semanticType: semanticType as SemanticType,
      content: blockContent.trim(),
      relatedRefs: [],
      position: {
        start: match.index,
        end: match.index + fullMatch.length,
        line: lineNumber,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return blocks;
}

/**
 * Get line number from character offset
 */
function getLineNumber(content: string, offset: number): number {
  const lines = content.substring(0, offset).split('\n');
  return lines.length;
}

/**
 * Extract related reference IDs from content
 */
function extractRelatedRefs(content: string): string[] {
  const refs: string[] = [];

  // Extract axiom references (axiom-1, A-05, etc.)
  const axiomPattern = /(?:axiom|A)-(\d+)/gi;
  let match;
  while ((match = axiomPattern.exec(content)) !== null) {
    refs.push(`axiom-${match[1]}`);
  }

  // Extract hypothesis references (H-001, etc.)
  const hypPattern = /H-(\d+)/gi;
  while ((match = hypPattern.exec(content)) !== null) {
    refs.push(`H-${match[1]}`);
  }

  // Extract paper references (P05, Paper-5, etc.)
  const paperPattern = /(?:P|Paper-)(\d+)/gi;
  while ((match = paperPattern.exec(content)) !== null) {
    refs.push(`P-${match[1].padStart(2, '0')}`);
  }

  return [...new Set(refs)]; // Remove duplicates
}

/**
 * Insert a semantic marker around selected content
 */
export function insertSemanticMarker(
  content: string,
  startOffset: number,
  endOffset: number,
  blockType: BlockType,
  semanticType: SemanticType,
  refId?: string
): { newContent: string; block: SemanticBlock } {
  const selectedContent = content.substring(startOffset, endOffset);
  const uuid = generateUuid();

  let marker: string;
  let endMarker: string;

  if (blockType === 'para') {
    marker = refId
      ? `==para:${semanticType}:${refId}:${uuid}==`
      : `==para:${semanticType}:${uuid}==`;
    endMarker = '==para:end==';
  } else if (blockType === 'sent') {
    marker = refId
      ? `==sent:${semanticType}:${refId}:${uuid}==`
      : `==sent:${semanticType}:${uuid}==`;
    endMarker = '==';
  } else {
    marker = refId
      ? `==word:${semanticType}:${refId}:${uuid}==`
      : `==word:${semanticType}:${uuid}==`;
    endMarker = '==';
  }

  const before = content.substring(0, startOffset);
  const after = content.substring(endOffset);
  const markedContent = blockType === 'para'
    ? `${marker}\n${selectedContent}\n${endMarker}`
    : `${marker} ${selectedContent}${endMarker}`;

  const newContent = before + markedContent + after;

  const block: SemanticBlock = {
    uuid,
    notePath: '',
    blockType,
    semanticType,
    content: selectedContent.trim(),
    refId,
    relatedRefs: extractRelatedRefs(selectedContent),
    position: {
      start: startOffset,
      end: startOffset + markedContent.length,
      line: getLineNumber(newContent, startOffset),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { newContent, block };
}

/**
 * Remove semantic markers from content (for reading view)
 */
export function stripSemanticMarkers(content: string): string {
  let result = content;

  // Remove paragraph markers
  result = result.replace(/==para:[^=]+==\n?/g, '');
  result = result.replace(/\n?==para:end==/g, '');

  // Remove sentence markers
  result = result.replace(/==sent:[^=]+==/g, '');
  result = result.replace(/==$/, '').replace(/==(?=\s|$)/g, '');

  // Remove word markers
  result = result.replace(/==word:[^=]+==/g, '');
  result = result.replace(/==$/, '').replace(/==(?=\s|$)/g, '');

  return result.trim();
}

/**
 * Validate semantic markers in content
 */
export function validateSemanticMarkers(content: string): {
  valid: boolean;
  errors: Array<{ line: number; message: string }>;
} {
  const errors: Array<{ line: number; message: string }> = [];

  // Check for unclosed paragraph markers
  const paraOpens = (content.match(/==para:\w+:[^=]+==/g) || []).length;
  const paraCloses = (content.match(/==para:end==/g) || []).length;

  if (paraOpens !== paraCloses) {
    errors.push({
      line: 0,
      message: `Mismatched paragraph markers: ${paraOpens} opens, ${paraCloses} closes`,
    });
  }

  // Check for duplicate UUIDs
  const uuidPattern = /==(?:para|sent|word):[^:]+:(?:[^:]+:)?([a-f0-9-]{36})==/gi;
  const uuids: string[] = [];
  let match;

  while ((match = uuidPattern.exec(content)) !== null) {
    const uuid = match[1];
    if (uuids.includes(uuid)) {
      const line = getLineNumber(content, match.index);
      errors.push({
        line,
        message: `Duplicate UUID: ${uuid}`,
      });
    }
    uuids.push(uuid);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Find parent block for a given position
 */
export function findParentBlock(
  blocks: SemanticBlock[],
  position: number
): SemanticBlock | undefined {
  // Sort by position, largest first
  const sorted = blocks
    .filter(b => b.blockType === 'para')
    .sort((a, b) => b.position.start - a.position.start);

  return sorted.find(
    b => b.position.start < position && b.position.end > position
  );
}

/**
 * Get block hierarchy (parent chain)
 */
export function getBlockHierarchy(
  blocks: SemanticBlock[],
  block: SemanticBlock
): SemanticBlock[] {
  const hierarchy: SemanticBlock[] = [block];

  let currentPos = block.position.start;
  let parent = findParentBlock(blocks, currentPos);

  while (parent && parent.uuid !== block.uuid) {
    hierarchy.unshift(parent);
    currentPos = parent.position.start;
    parent = findParentBlock(
      blocks.filter(b => b.uuid !== parent?.uuid),
      currentPos
    );
  }

  return hierarchy;
}
