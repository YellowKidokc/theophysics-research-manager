"""
NLP Term Detector - Uses spaCy for intelligent term detection and automatic linking.

This module:
1. Uses spaCy NER for named entity recognition
2. Uses domain-specific dictionaries for Theophysics terms
3. Falls back to Stanford Encyclopedia of Philosophy search
4. Automatically generates hyperlinks
"""

from __future__ import annotations

import re
import json
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from collections import Counter
from dataclasses import dataclass, field

# Try to import spaCy - graceful fallback if not available
try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    print("⚠️ spaCy not installed. Run: pip install spacy && python -m spacy download en_core_web_lg")

# Try to import requests for SEP search
try:
    import requests
    from bs4 import BeautifulSoup
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("⚠️ requests/beautifulsoup4 not installed. Run: pip install requests beautifulsoup4")


@dataclass
class DetectedTerm:
    """A term detected in text."""
    text: str
    label: str  # PERSON, THEORY, CONCEPT, MATH, etc.
    count: int = 1
    sources: List[str] = field(default_factory=list)  # Which files it was found in
    link: Optional[str] = None
    link_source: Optional[str] = None  # 'dictionary', 'sep', 'wikipedia', etc.
    

class NLPTermDetector:
    """
    Intelligent term detector using NLP and domain knowledge.
    """
    
    # Theophysics-specific terms dictionary with links
    THEOPHYSICS_DICTIONARY = {
        # Core Theophysics concepts
        "χ-field": {"link": None, "type": "THEOPHYSICS"},
        "Φ-field": {"link": None, "type": "THEOPHYSICS"},
        "Logos Field": {"link": None, "type": "THEOPHYSICS"},
        "Witness Field": {"link": None, "type": "THEOPHYSICS"},
        "Trinity Operator": {"link": None, "type": "THEOPHYSICS"},
        "Grace Function": {"link": None, "type": "THEOPHYSICS"},
        "Coherence Functional": {"link": None, "type": "THEOPHYSICS"},
        "Syzygy": {"link": None, "type": "THEOPHYSICS"},
        
        # Physics concepts with SEP links
        "quantum mechanics": {"link": "https://plato.stanford.edu/entries/qm/", "type": "PHYSICS"},
        "general relativity": {"link": "https://plato.stanford.edu/entries/spacetime-theories/", "type": "PHYSICS"},
        "wave function": {"link": "https://plato.stanford.edu/entries/qm/", "type": "PHYSICS"},
        "decoherence": {"link": "https://plato.stanford.edu/entries/qm-decoherence/", "type": "PHYSICS"},
        "quantum entanglement": {"link": "https://plato.stanford.edu/entries/qt-entangle/", "type": "PHYSICS"},
        "wave function collapse": {"link": "https://plato.stanford.edu/entries/qm-collapse/", "type": "PHYSICS"},
        "Copenhagen interpretation": {"link": "https://plato.stanford.edu/entries/qm-copenhagen/", "type": "PHYSICS"},
        "Many-Worlds": {"link": "https://plato.stanford.edu/entries/qm-manyworlds/", "type": "PHYSICS"},
        "Bohmian mechanics": {"link": "https://plato.stanford.edu/entries/qm-bohm/", "type": "PHYSICS"},
        "string theory": {"link": "https://plato.stanford.edu/entries/string-theory/", "type": "PHYSICS"},
        "loop quantum gravity": {"link": "https://plato.stanford.edu/entries/quantum-gravity/", "type": "PHYSICS"},
        "entropy": {"link": "https://plato.stanford.edu/entries/information-entropy/", "type": "PHYSICS"},
        "thermodynamics": {"link": "https://plato.stanford.edu/entries/thermodynamics/", "type": "PHYSICS"},
        "spacetime": {"link": "https://plato.stanford.edu/entries/spacetime-theories/", "type": "PHYSICS"},
        "quantum field theory": {"link": "https://plato.stanford.edu/entries/quantum-field-theory/", "type": "PHYSICS"},
        "Planck scale": {"link": "https://plato.stanford.edu/entries/quantum-gravity/", "type": "PHYSICS"},
        "holographic principle": {"link": "https://plato.stanford.edu/entries/physics-holography/", "type": "PHYSICS"},
        
        # Philosophy of mind
        "consciousness": {"link": "https://plato.stanford.edu/entries/consciousness/", "type": "PHILOSOPHY"},
        "hard problem of consciousness": {"link": "https://plato.stanford.edu/entries/consciousness/", "type": "PHILOSOPHY"},
        "qualia": {"link": "https://plato.stanford.edu/entries/qualia/", "type": "PHILOSOPHY"},
        "dualism": {"link": "https://plato.stanford.edu/entries/dualism/", "type": "PHILOSOPHY"},
        "panpsychism": {"link": "https://plato.stanford.edu/entries/panpsychism/", "type": "PHILOSOPHY"},
        "physicalism": {"link": "https://plato.stanford.edu/entries/physicalism/", "type": "PHILOSOPHY"},
        "emergentism": {"link": "https://plato.stanford.edu/entries/properties-emergent/", "type": "PHILOSOPHY"},
        "free will": {"link": "https://plato.stanford.edu/entries/freewill/", "type": "PHILOSOPHY"},
        "determinism": {"link": "https://plato.stanford.edu/entries/determinism-causal/", "type": "PHILOSOPHY"},
        "causation": {"link": "https://plato.stanford.edu/entries/causation-metaphysics/", "type": "PHILOSOPHY"},
        "ontology": {"link": "https://plato.stanford.edu/entries/logic-ontology/", "type": "PHILOSOPHY"},
        "epistemology": {"link": "https://plato.stanford.edu/entries/epistemology/", "type": "PHILOSOPHY"},
        
        # Theology
        "Trinity": {"link": "https://plato.stanford.edu/entries/trinity/", "type": "THEOLOGY"},
        "divine simplicity": {"link": "https://plato.stanford.edu/entries/divine-simplicity/", "type": "THEOLOGY"},
        "divine omniscience": {"link": "https://plato.stanford.edu/entries/omniscience/", "type": "THEOLOGY"},
        "theodicy": {"link": "https://plato.stanford.edu/entries/evil/", "type": "THEOLOGY"},
        "incarnation": {"link": "https://plato.stanford.edu/entries/incarnation/", "type": "THEOLOGY"},
        "resurrection": {"link": "https://plato.stanford.edu/entries/resurrection/", "type": "THEOLOGY"},
        "creation ex nihilo": {"link": "https://plato.stanford.edu/entries/creation-conservation/", "type": "THEOLOGY"},
        "imago Dei": {"link": None, "type": "THEOLOGY"},
        "perichoresis": {"link": None, "type": "THEOLOGY"},
        
        # Mathematics
        "Kolmogorov complexity": {"link": "https://plato.stanford.edu/entries/kolmogorov-complexity/", "type": "MATH"},
        "information theory": {"link": "https://plato.stanford.edu/entries/information/", "type": "MATH"},
        "Hilbert space": {"link": "https://plato.stanford.edu/entries/qm/", "type": "MATH"},
        "Lagrangian": {"link": "https://plato.stanford.edu/entries/lagrangian-mechanics/", "type": "MATH"},
        "Hamiltonian": {"link": "https://plato.stanford.edu/entries/hamiltonian/", "type": "MATH"},
        "tensor": {"link": None, "type": "MATH"},
        "manifold": {"link": None, "type": "MATH"},
        "eigenvalue": {"link": None, "type": "MATH"},
        "wave equation": {"link": None, "type": "MATH"},
        
        # Key physicists/philosophers
        "Einstein": {"link": "https://plato.stanford.edu/entries/einstein-philscience/", "type": "PERSON"},
        "Bohr": {"link": "https://plato.stanford.edu/entries/qm-copenhagen/", "type": "PERSON"},
        "Wheeler": {"link": "https://en.wikipedia.org/wiki/John_Archibald_Wheeler", "type": "PERSON"},
        "Penrose": {"link": "https://en.wikipedia.org/wiki/Roger_Penrose", "type": "PERSON"},
        "Chalmers": {"link": "https://plato.stanford.edu/entries/consciousness/", "type": "PERSON"},
        "Tononi": {"link": "https://en.wikipedia.org/wiki/Giulio_Tononi", "type": "PERSON"},
        "von Neumann": {"link": "https://plato.stanford.edu/entries/von-neumann/", "type": "PERSON"},
        "Schrödinger": {"link": "https://plato.stanford.edu/entries/qm/", "type": "PERSON"},
        "Heisenberg": {"link": "https://plato.stanford.edu/entries/qm/", "type": "PERSON"},
        "Dirac": {"link": "https://plato.stanford.edu/entries/qm/", "type": "PERSON"},
        "Feynman": {"link": "https://en.wikipedia.org/wiki/Richard_Feynman", "type": "PERSON"},
        "Hawking": {"link": "https://en.wikipedia.org/wiki/Stephen_Hawking", "type": "PERSON"},
        "Aquinas": {"link": "https://plato.stanford.edu/entries/aquinas/", "type": "PERSON"},
        "Augustine": {"link": "https://plato.stanford.edu/entries/augustine/", "type": "PERSON"},
        "Polkinghorne": {"link": "https://en.wikipedia.org/wiki/John_Polkinghorne", "type": "PERSON"},
    }
    
    # Terms to exclude (common words that aren't special)
    EXCLUDE_TERMS = {
        'the', 'this', 'that', 'these', 'those', 'what', 'when', 'where',
        'which', 'while', 'with', 'would', 'will', 'was', 'were', 'are',
        'has', 'have', 'had', 'does', 'did', 'may', 'might', 'must',
        'can', 'could', 'should', 'from', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'between', 'under', 'over',
        'section', 'chapter', 'paper', 'figure', 'table', 'equation',
        'note', 'example', 'part', 'references', 'appendix', 'abstract',
        'introduction', 'conclusion', 'discussion', 'methods', 'results',
        'however', 'therefore', 'thus', 'hence', 'indeed', 'rather',
        'physical', 'theological', 'mathematical', 'scientific',
    }
    
    def __init__(self, custom_dictionary_path: Optional[Path] = None):
        """Initialize the detector."""
        self.nlp = None
        self.custom_dictionary: Dict[str, dict] = {}
        
        # Load spaCy model
        if SPACY_AVAILABLE:
            try:
                self.nlp = spacy.load("en_core_web_lg")
            except OSError:
                try:
                    self.nlp = spacy.load("en_core_web_sm")
                except OSError:
                    print("⚠️ No spaCy model found. Run: python -m spacy download en_core_web_lg")
        
        # Load custom dictionary if provided
        if custom_dictionary_path and custom_dictionary_path.exists():
            self.load_custom_dictionary(custom_dictionary_path)
    
    def load_custom_dictionary(self, path: Path) -> None:
        """Load a custom term dictionary from JSON."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                self.custom_dictionary = json.load(f)
        except Exception as e:
            print(f"Error loading custom dictionary: {e}")
    
    def save_custom_dictionary(self, path: Path) -> None:
        """Save the custom dictionary to JSON."""
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(self.custom_dictionary, f, indent=2)
        except Exception as e:
            print(f"Error saving custom dictionary: {e}")
    
    def detect_terms(self, text: str, source_file: str = "") -> List[DetectedTerm]:
        """
        Detect important terms in text using NLP and dictionaries.
        
        Returns list of DetectedTerm objects.
        """
        detected = {}
        
        # Method 1: Check against our dictionaries (most reliable)
        combined_dict = {**self.THEOPHYSICS_DICTIONARY, **self.custom_dictionary}
        
        text_lower = text.lower()
        for term, info in combined_dict.items():
            term_lower = term.lower()
            if term_lower in text_lower:
                count = text_lower.count(term_lower)
                if term_lower not in detected:
                    detected[term_lower] = DetectedTerm(
                        text=term,
                        label=info.get('type', 'CONCEPT'),
                        count=count,
                        sources=[source_file] if source_file else [],
                        link=info.get('link'),
                        link_source='dictionary' if info.get('link') else None
                    )
                else:
                    detected[term_lower].count += count
                    if source_file and source_file not in detected[term_lower].sources:
                        detected[term_lower].sources.append(source_file)
        
        # Method 2: Use spaCy NER if available
        if self.nlp:
            doc = self.nlp(text)
            
            for ent in doc.ents:
                term = ent.text.strip()
                term_lower = term.lower()
                
                # Skip excluded terms
                if term_lower in self.EXCLUDE_TERMS:
                    continue
                
                # Skip very short terms
                if len(term) < 3:
                    continue
                
                # Map spaCy labels to our categories
                label_map = {
                    'PERSON': 'PERSON',
                    'ORG': 'ORGANIZATION',
                    'GPE': 'PLACE',
                    'WORK_OF_ART': 'WORK',
                    'LAW': 'CONCEPT',
                    'NORP': 'GROUP',
                    'EVENT': 'EVENT',
                    'PRODUCT': 'CONCEPT',
                }
                
                label = label_map.get(ent.label_, 'CONCEPT')
                
                if term_lower not in detected:
                    detected[term_lower] = DetectedTerm(
                        text=term,
                        label=label,
                        count=1,
                        sources=[source_file] if source_file else [],
                        link=None,
                        link_source=None
                    )
                else:
                    detected[term_lower].count += 1
                    if source_file and source_file not in detected[term_lower].sources:
                        detected[term_lower].sources.append(source_file)
        
        # Method 3: Regex patterns for things NLP might miss
        patterns = [
            # Greek letters
            (r'[ΨΦΛΩχψφλωΓγΔδΣσΠπΘθ](?:-field)?', 'SYMBOL'),
            # Capitalized multi-word (e.g., "General Relativity")
            (r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b', 'CONCEPT'),
            # Terms with hyphens (e.g., "wave-particle duality")
            (r'\b[A-Za-z]+-[A-Za-z]+(?:\s+[a-z]+)?\b', 'CONCEPT'),
        ]
        
        for pattern, label in patterns:
            for match in re.finditer(pattern, text):
                term = match.group().strip()
                term_lower = term.lower()
                
                if term_lower in self.EXCLUDE_TERMS or len(term) < 3:
                    continue
                
                if term_lower not in detected:
                    detected[term_lower] = DetectedTerm(
                        text=term,
                        label=label,
                        count=1,
                        sources=[source_file] if source_file else [],
                        link=None,
                        link_source=None
                    )
        
        return list(detected.values())
    
    def search_sep(self, term: str) -> Optional[str]:
        """
        Search Stanford Encyclopedia of Philosophy for a term.
        Returns the URL if found, None otherwise.
        """
        if not REQUESTS_AVAILABLE:
            return None
        
        try:
            url = f"https://plato.stanford.edu/search/searcher.py?query={term.replace(' ', '+')}"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                # Find first result that's an entry
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    if 'entries/' in href:
                        if href.startswith('/'):
                            return f"https://plato.stanford.edu{href}"
                        return href
        except Exception as e:
            print(f"SEP search error for '{term}': {e}")
        
        return None
    
    def search_wikipedia(self, term: str) -> Optional[str]:
        """
        Search Wikipedia for a term.
        Returns the URL if found, None otherwise.
        """
        if not REQUESTS_AVAILABLE:
            return None
        
        try:
            # Use Wikipedia API
            url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={term.replace(' ', '+')}&format=json"
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('query', {}).get('search', [])
                if results:
                    title = results[0]['title']
                    return f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"
        except Exception as e:
            print(f"Wikipedia search error for '{term}': {e}")
        
        return None
    
    def resolve_links(self, terms: List[DetectedTerm], use_sep: bool = True, use_wikipedia: bool = True) -> List[DetectedTerm]:
        """
        Try to find links for terms that don't have them.
        """
        for term in terms:
            if term.link:
                continue
            
            # Try SEP first
            if use_sep:
                link = self.search_sep(term.text)
                if link:
                    term.link = link
                    term.link_source = 'sep'
                    continue
            
            # Try Wikipedia
            if use_wikipedia:
                link = self.search_wikipedia(term.text)
                if link:
                    term.link = link
                    term.link_source = 'wikipedia'
        
        return terms
    
    def generate_linked_markdown(self, text: str, terms: List[DetectedTerm]) -> str:
        """
        Generate markdown with hyperlinks for detected terms.
        """
        # Sort by length (longest first) to avoid partial replacements
        terms_with_links = [(t.text, t.link) for t in terms if t.link]
        terms_with_links.sort(key=lambda x: len(x[0]), reverse=True)
        
        result = text
        for term, link in terms_with_links:
            # Only replace whole words
            pattern = rf'\b{re.escape(term)}\b'
            replacement = f'[{term}]({link})'
            result = re.sub(pattern, replacement, result, count=1)  # Only first occurrence
        
        return result
    
    def generate_link_section(self, terms: List[DetectedTerm], title: str = "Research Links") -> str:
        """
        Generate a markdown section with all links.
        """
        sections = {
            'PERSON': [],
            'PHYSICS': [],
            'PHILOSOPHY': [],
            'THEOLOGY': [],
            'MATH': [],
            'CONCEPT': [],
            'THEOPHYSICS': [],
        }
        
        for term in terms:
            if term.link:
                entry = f"- [{term.text}]({term.link})"
                label = term.label if term.label in sections else 'CONCEPT'
                sections[label].append(entry)
        
        result = f"## {title}\n\n"
        
        section_titles = {
            'PERSON': '### People',
            'PHYSICS': '### Physics Concepts',
            'PHILOSOPHY': '### Philosophy',
            'THEOLOGY': '### Theology',
            'MATH': '### Mathematics',
            'THEOPHYSICS': '### Theophysics Terms',
            'CONCEPT': '### Other Concepts',
        }
        
        for label, title in section_titles.items():
            if sections[label]:
                result += f"{title}\n\n"
                result += "\n".join(sorted(set(sections[label])))
                result += "\n\n"
        
        return result


# Convenience function for quick use
def detect_and_link(text: str, source_file: str = "") -> Tuple[List[DetectedTerm], str]:
    """
    Quick function to detect terms and generate linked markdown.
    
    Returns: (list of detected terms, markdown with links)
    """
    detector = NLPTermDetector()
    terms = detector.detect_terms(text, source_file)
    terms = detector.resolve_links(terms)
    linked_text = detector.generate_linked_markdown(text, terms)
    return terms, linked_text

