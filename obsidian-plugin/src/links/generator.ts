/**
 * Research Link Generator
 *
 * Automatically generates links to academic sources for proper names and terms.
 */

import { LinkSource, ResearchLink, SemanticBlock } from '../types';

/**
 * Link templates for various sources
 */
const LINK_TEMPLATES: Record<
  LinkSource,
  {
    baseUrl: string;
    format: (term: string) => string;
    displayName: string;
  }
> = {
  stanford: {
    baseUrl: 'https://plato.stanford.edu/entries/',
    format: (term) => {
      const slug = term.toLowerCase().replace(/\s+/g, '-');
      return `https://plato.stanford.edu/entries/${slug}/`;
    },
    displayName: 'Stanford Encyclopedia of Philosophy',
  },
  iep: {
    baseUrl: 'https://iep.utm.edu/',
    format: (term) => {
      const slug = term.toLowerCase().replace(/\s+/g, '-');
      return `https://iep.utm.edu/${slug}/`;
    },
    displayName: 'Internet Encyclopedia of Philosophy',
  },
  oxford: {
    baseUrl: 'https://www.oxfordreference.com/search?q=',
    format: (term) => {
      return `https://www.oxfordreference.com/search?q=${encodeURIComponent(term)}`;
    },
    displayName: 'Oxford Reference',
  },
  cambridge: {
    baseUrl: 'https://www.cambridge.org/core/search?q=',
    format: (term) => {
      return `https://www.cambridge.org/core/search?q=${encodeURIComponent(term)}`;
    },
    displayName: 'Cambridge',
  },
  philpapers: {
    baseUrl: 'https://philpapers.org/s/',
    format: (term) => {
      return `https://philpapers.org/s/${encodeURIComponent(term)}`;
    },
    displayName: 'PhilPapers',
  },
  philarchive: {
    baseUrl: 'https://philarchive.org/search?q=',
    format: (term) => {
      return `https://philarchive.org/search?q=${encodeURIComponent(term)}`;
    },
    displayName: 'PhilArchive',
  },
  scholar: {
    baseUrl: 'https://scholar.google.com/scholar?q=',
    format: (term) => {
      return `https://scholar.google.com/scholar?q=${encodeURIComponent(term)}`;
    },
    displayName: 'Google Scholar',
  },
  jstor: {
    baseUrl: 'https://www.jstor.org/action/doBasicSearch?Query=',
    format: (term) => {
      return `https://www.jstor.org/action/doBasicSearch?Query=${encodeURIComponent(term)}`;
    },
    displayName: 'JSTOR',
  },
  muse: {
    baseUrl: 'https://muse.jhu.edu/search?q=',
    format: (term) => {
      return `https://muse.jhu.edu/search?q=${encodeURIComponent(term)}`;
    },
    displayName: 'Project MUSE',
  },
  britannica: {
    baseUrl: 'https://www.britannica.com/search?query=',
    format: (term) => {
      return `https://www.britannica.com/search?query=${encodeURIComponent(term)}`;
    },
    displayName: 'Britannica',
  },
  arxiv: {
    baseUrl: 'https://arxiv.org/search/?query=',
    format: (term) => {
      return `https://arxiv.org/search/?query=${encodeURIComponent(term)}&searchtype=all`;
    },
    displayName: 'arXiv',
  },
  wikipedia: {
    baseUrl: 'https://en.wikipedia.org/wiki/',
    format: (term) => {
      const slug = term.replace(/\s+/g, '_');
      return `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
    },
    displayName: 'Wikipedia',
  },
};

/**
 * Known term mappings (for terms with non-obvious URLs)
 */
const KNOWN_MAPPINGS: Record<string, Record<LinkSource, string>> = {
  'quantum mechanics': {
    stanford: 'https://plato.stanford.edu/entries/qm/',
    wikipedia: 'https://en.wikipedia.org/wiki/Quantum_mechanics',
  } as Record<LinkSource, string>,
  'general relativity': {
    stanford: 'https://plato.stanford.edu/entries/spacetime-theories-classical/',
    wikipedia: 'https://en.wikipedia.org/wiki/General_relativity',
  } as Record<LinkSource, string>,
  consciousness: {
    stanford: 'https://plato.stanford.edu/entries/consciousness/',
    iep: 'https://iep.utm.edu/consciou/',
  } as Record<LinkSource, string>,
  'integrated information theory': {
    stanford: 'https://plato.stanford.edu/entries/consciousness-higher/',
    wikipedia: 'https://en.wikipedia.org/wiki/Integrated_information_theory',
  } as Record<LinkSource, string>,
  'measurement problem': {
    stanford: 'https://plato.stanford.edu/entries/qt-measurement/',
    wikipedia: 'https://en.wikipedia.org/wiki/Measurement_problem',
  } as Record<LinkSource, string>,
  'copenhagen interpretation': {
    stanford: 'https://plato.stanford.edu/entries/qm-copenhagen/',
    wikipedia: 'https://en.wikipedia.org/wiki/Copenhagen_interpretation',
  } as Record<LinkSource, string>,
  'wheeler delayed-choice': {
    arxiv: 'https://arxiv.org/abs/quant-ph/0504091',
    wikipedia: 'https://en.wikipedia.org/wiki/Wheeler%27s_delayed-choice_experiment',
  } as Record<LinkSource, string>,
};

/**
 * Research Link Generator class
 */
export class ResearchLinkGenerator {
  private customMappings: Record<string, Record<LinkSource, string>> = {};
  private priority: LinkSource[] = [
    'stanford', 'iep', 'oxford', 'cambridge', 'philpapers',
    'philarchive', 'scholar', 'jstor', 'muse', 'britannica',
    'arxiv', 'wikipedia',
  ];

  /**
   * Set priority order for sources
   */
  setPriority(priority: LinkSource[]): void {
    this.priority = priority;
  }

  /**
   * Get priority order
   */
  getPriority(): LinkSource[] {
    return [...this.priority];
  }

  /**
   * Add custom mapping
   */
  addCustomMapping(
    term: string,
    source: LinkSource,
    url: string
  ): void {
    const termLower = term.toLowerCase();
    if (!this.customMappings[termLower]) {
      this.customMappings[termLower] = {} as Record<LinkSource, string>;
    }
    this.customMappings[termLower][source] = url;
  }

  /**
   * Generate a link for a term
   */
  generateLink(term: string, source?: LinkSource): string | null {
    const termLower = term.toLowerCase();

    // Check custom mappings first
    if (this.customMappings[termLower]) {
      if (source && this.customMappings[termLower][source]) {
        return this.customMappings[termLower][source];
      }
      // Return highest priority available
      for (const s of this.priority) {
        if (this.customMappings[termLower][s]) {
          return this.customMappings[termLower][s];
        }
      }
    }

    // Check known mappings
    if (KNOWN_MAPPINGS[termLower]) {
      if (source && KNOWN_MAPPINGS[termLower][source]) {
        return KNOWN_MAPPINGS[termLower][source];
      }
      for (const s of this.priority) {
        if (KNOWN_MAPPINGS[termLower][s]) {
          return KNOWN_MAPPINGS[termLower][s];
        }
      }
    }

    // Generate from template
    if (source && LINK_TEMPLATES[source]) {
      return LINK_TEMPLATES[source].format(term);
    }

    // Use first priority source
    for (const s of this.priority) {
      if (LINK_TEMPLATES[s]) {
        return LINK_TEMPLATES[s].format(term);
      }
    }

    return null;
  }

  /**
   * Get all links for a term
   */
  getAllLinks(term: string): ResearchLink[] {
    const termLower = term.toLowerCase();
    const links: ResearchLink[] = [];

    for (const source of this.priority) {
      let url: string | null = null;

      // Check custom mappings
      if (this.customMappings[termLower]?.[source]) {
        url = this.customMappings[termLower][source];
      }
      // Check known mappings
      else if (KNOWN_MAPPINGS[termLower]?.[source]) {
        url = KNOWN_MAPPINGS[termLower][source];
      }
      // Generate from template
      else if (LINK_TEMPLATES[source]) {
        url = LINK_TEMPLATES[source].format(term);
      }

      if (url) {
        links.push({
          term,
          source,
          url,
          priority: this.priority.indexOf(source),
          verified: !!(
            this.customMappings[termLower]?.[source] ||
            KNOWN_MAPPINGS[termLower]?.[source]
          ),
        });
      }
    }

    return links;
  }

  /**
   * Get source display name
   */
  getSourceDisplayName(source: LinkSource): string {
    return LINK_TEMPLATES[source]?.displayName || source;
  }

  /**
   * Generate links for all proper names in blocks
   */
  generateLinksForBlocks(
    blocks: SemanticBlock[]
  ): Map<string, ResearchLink[]> {
    const results = new Map<string, ResearchLink[]>();

    const properNameBlocks = blocks.filter(
      b => b.semanticType === 'proper-name' ||
           b.semanticType === 'theory' ||
           b.semanticType === 'concept'
    );

    for (const block of properNameBlocks) {
      const term = block.content.trim();
      if (!results.has(term)) {
        results.set(term, this.getAllLinks(term));
      }
    }

    return results;
  }

  /**
   * Format links as markdown
   */
  formatLinksMarkdown(term: string, links: ResearchLink[]): string {
    const lines = [`### ${term}`];

    for (const link of links) {
      const icon = link.verified ? '' : ' (auto-generated)';
      lines.push(
        `- [${this.getSourceDisplayName(link.source)}](${link.url})${icon}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate a complete research links section
   */
  generateLinksSection(
    blocks: SemanticBlock[],
    title: string = 'Research Links'
  ): string {
    const linksMap = this.generateLinksForBlocks(blocks);
    const sections: string[] = [`## ${title}`, ''];

    for (const [term, links] of linksMap) {
      sections.push(this.formatLinksMarkdown(term, links));
      sections.push('');
    }

    return sections.join('\n');
  }
}

/**
 * Validate if a URL is accessible
 */
export async function validateUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Find broken links in research links
 */
export async function findBrokenLinks(
  links: ResearchLink[]
): Promise<ResearchLink[]> {
  const broken: ResearchLink[] = [];

  for (const link of links) {
    const valid = await validateUrl(link.url);
    if (!valid) {
      broken.push(link);
    }
  }

  return broken;
}
