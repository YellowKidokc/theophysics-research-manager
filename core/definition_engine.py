"""
Theophysics Definition Engine - Auto-fills missing sections, detects contradictions.

Based on user's specification:
- Uses [W] for Wikipedia/external content
- Uses [A] for AI-generated content
- Never overwrites user-authored text
- Adds ### Contradiction blocks under problematic sections
- Adds ## Review Status with [REVIEW] flags
"""

import os
import re
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Set
from dataclasses import dataclass

# Try to import wikipedia
try:
    import wikipedia
    WIKIPEDIA_AVAILABLE = True
except ImportError:
    WIKIPEDIA_AVAILABLE = False
    print("⚠️ wikipedia package not installed. Run: pip install wikipedia")


# -----------------------------
# CONFIG
# -----------------------------

# Section headers we care about
SECTION_ORDER = [
    "## 1. Aliases",
    "## 2. Core Definition",
    "## 3. Operational Definition",
    "## 4. Ontological Context",
    "## 5. Relationships",
    "## 6. Scientific Definition",
    "## 7. Narrative Definition",
]

# Provenance tags
TAG_W = "[W]"  # external (Wikipedia)
TAG_A = "[A]"  # AI-generated
TAG_REVIEW = "[REVIEW]"


@dataclass
class EngineResult:
    """Result of processing a single file."""
    file_path: str
    term_name: str
    updated: bool
    sections_filled: List[str]
    contradictions_found: List[str]
    review_flags: List[str]
    error: Optional[str] = None


# -----------------------------
# UTILITIES
# -----------------------------

def fetch_external_summary(term: str, sentences: int = 4, aliases: List[str] = None) -> Optional[str]:
    """
    Fetch a summary for the term from Wikipedia.
    If main term fails, tries aliases.
    """
    if not WIKIPEDIA_AVAILABLE:
        return None
    
    # Terms to try: main term first, then aliases
    terms_to_try = [term]
    if aliases:
        terms_to_try.extend(aliases)
    
    for search_term in terms_to_try:
        try:
            result = wikipedia.summary(search_term, sentences=sentences)
            if result:
                return result
        except wikipedia.exceptions.DisambiguationError as e:
            # Try the first option
            if e.options:
                try:
                    return wikipedia.summary(e.options[0], sentences=sentences)
                except:
                    continue
        except wikipedia.exceptions.PageError:
            # Page not found, try next alias
            continue
        except Exception:
            continue
    
    return None


def extract_aliases_from_content(content: str) -> List[str]:
    """Extract aliases from the file content (frontmatter or aliases section)."""
    aliases = []
    
    # Check frontmatter for aliases
    if content.startswith('---'):
        fm_end = content.find('---', 3)
        if fm_end > 0:
            frontmatter = content[3:fm_end]
            # Look for aliases: [list] or aliases:\n- item
            alias_match = re.search(r'aliases:\s*\[(.*?)\]', frontmatter)
            if alias_match:
                # Parse [alias1, alias2] format
                alias_str = alias_match.group(1)
                aliases = [a.strip().strip('"\'') for a in alias_str.split(',') if a.strip()]
            else:
                # Parse yaml list format
                alias_match = re.search(r'aliases:\s*\n((?:\s*-\s*[^\n]+\n?)+)', frontmatter)
                if alias_match:
                    alias_lines = alias_match.group(1)
                    aliases = [a.strip() for a in re.findall(r'-\s*([^\n]+)', alias_lines)]
    
    # Also check ## 1. Aliases section
    alias_section = re.search(r'##\s*1\.\s*Aliases\s*\n(.*?)(?=\n##|\Z)', content, re.DOTALL | re.IGNORECASE)
    if alias_section:
        section_text = alias_section.group(1)
        # Extract any terms that look like aliases (comma-separated, bullet points, etc.)
        # Skip comments and provenance tags
        for line in section_text.split('\n'):
            line = line.strip()
            if not line or line.startswith('<!--') or line.startswith('[W]') or line.startswith('[A]'):
                continue
            if line.startswith('*') and line.endswith('*'):
                # Italic list like *alias1, alias2*
                inner = line.strip('*')
                aliases.extend([a.strip() for a in inner.split(',') if a.strip()])
            elif line.startswith('-'):
                # Bullet point
                aliases.append(line[1:].strip())
    
    return list(set(aliases))  # Remove duplicates


def split_glossary_sections(text: str) -> Tuple[str, List[Tuple[str, str]], str]:
    """
    Split markdown text into:
      prefix (before first section)
      sections: list of (header, body)
      suffix (after last recognized section)
    """
    pattern = r"(##\s+[0-9]+\.\s+.+)"
    parts = re.split(pattern, text)

    if len(parts) == 1:
        return text, [], ""

    prefix = parts[0]
    sections = []
    for i in range(1, len(parts), 2):
        header = parts[i].strip()
        body = parts[i + 1] if i + 1 < len(parts) else ""
        sections.append((header, body))

    return prefix, sections, ""


def section_main_body_and_existing_diag(body: str) -> Tuple[str, str]:
    """
    Split a section body into:
      main_body (without any '### Contradiction' block)
      old_diag (any previous '### Contradiction' block)
    """
    idx = body.find("### Contradiction")
    if idx == -1:
        return body.strip(), ""
    main_body = body[:idx].rstrip()
    old_diag = body[idx:].strip()
    return main_body, old_diag


def section_is_empty(main_body: str) -> bool:
    """True if the section has no meaningful content."""
    if not main_body.strip():
        return True
    # Check for just comments
    lines = [l for l in main_body.split('\n') if l.strip() and not l.strip().startswith('<!--')]
    return len(lines) == 0


def section_is_all_tagged(main_body: str) -> bool:
    """
    True if every non-empty line begins with TAG_W or TAG_A.
    That means it's safe for the engine to overwrite it.
    """
    lines = [l.strip() for l in main_body.split("\n") if l.strip() and not l.strip().startswith('<!--')]
    if not lines:
        return True
    for line in lines:
        if not (line.startswith(TAG_W) or line.startswith(TAG_A)):
            return False
    return True


def contains_user_text(main_body: str) -> bool:
    """
    True if there is any line that does NOT start with TAG_W or TAG_A.
    That means user-authored content exists; do not overwrite.
    """
    lines = [l.strip() for l in main_body.split("\n") if l.strip() and not l.strip().startswith('<!--')]
    for line in lines:
        if not (line.startswith(TAG_W) or line.startswith(TAG_A)):
            return True
    return False


def first_non_tag_line(main_body: str) -> str:
    """Return first line that is not a provenance tag, for semantic checks."""
    for line in main_body.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith('<!--'):
            continue
        if stripped.startswith(TAG_W):
            stripped = stripped[len(TAG_W):].strip()
        elif stripped.startswith(TAG_A):
            stripped = stripped[len(TAG_A):].strip()
        return stripped
    return ""


# -----------------------------
# GENERATORS
# -----------------------------

def generate_core_definition(term: str, external_summary: Optional[str]) -> str:
    """Generate a one-sentence 'core' style definition."""
    if not external_summary:
        return f"{TAG_A} {term} is a key concept in the Theophysics framework."
    first_sentence = external_summary.split(".")[0].strip()
    if not first_sentence:
        first_sentence = external_summary.strip()
    return f"{TAG_W} {first_sentence}."


def generate_scientific_definition(external_summary: Optional[str]) -> str:
    """Scientific definition: neutral, external grounding."""
    if not external_summary:
        return f"{TAG_A} No external scientific description is currently available."
    return f"{TAG_W} {external_summary.strip()}"


def generate_operational_definition(term: str, core: str, external_summary: Optional[str]) -> str:
    """Operational definition: how the term functions in Theophysics."""
    base = core if core else term
    return (f"{TAG_A} In the Theophysics framework, {term} functions as an active "
            f"operator that shapes or constrains the behavior of systems consistent "
            f"with its core definition.")


def generate_ontological_context(term: str, external_summary: Optional[str]) -> str:
    """Ontological context: triad/domain/layer."""
    lower = term.lower()
    if "field" in lower:
        triad = "Relation"
        domain = "Observer-Consciousness"
        layer = "Meaning / Information"
    elif "function" in lower or "operator" in lower:
        triad = "Relation"
        domain = "Structure"
        layer = "Mathematical / Dynamical"
    elif "trinity" in lower or "logos" in lower:
        triad = "Necessity"
        domain = "Trinity-Mechanics"
        layer = "Foundational"
    else:
        triad = "Relation"
        domain = "Observer-Consciousness"
        layer = "Meaning"

    return (f"{TAG_A} **Triad Position:** {triad}\n"
            f"{TAG_A} **Domain:** {domain}\n"
            f"{TAG_A} **Layer:** {layer}")


def generate_narrative_definition(term: str, core: str, external_summary: Optional[str]) -> str:
    """Narrative definition: intuitive explanation."""
    if external_summary:
        simplified = external_summary.split(".")[0].strip()
    else:
        simplified = f"{term} is an important idea in both physics and theology"

    return (f"{TAG_A} In simple terms, {term} can be thought of as {simplified.lower()}."
            if simplified else f"{TAG_A} In simple terms, {term} captures a key idea in Theophysics.")


def generate_aliases_section(term: str, external_summary: Optional[str]) -> str:
    """Generate aliases section."""
    return f"{TAG_A} *No aliases defined yet.*"


# -----------------------------
# CONTRADICTION DETECTION
# -----------------------------

def detect_contradictions(core_body: str, sci_body: str,
                          op_body: str, onto_body: str,
                          narr_body: str) -> Dict[str, List[str]]:
    """
    Simple keyword-based contradiction detection.
    Returns a dict mapping section-key -> list of contradiction messages.
    """
    contradictions = {
        "core": [],
        "scientific": [],
        "operational": [],
        "ontology": [],
        "narrative": []
    }

    core_text = first_non_tag_line(core_body) if core_body else ""
    sci_text = first_non_tag_line(sci_body) if sci_body else ""
    op_text = first_non_tag_line(op_body) if op_body else ""
    narr_text = first_non_tag_line(narr_body) if narr_body else ""
    onto_text = onto_body

    def is_physical(text: str) -> bool:
        return any(w in text.lower() for w in ["physical", "material", "spacetime", "energy"])

    def is_nonphysical(text: str) -> bool:
        return any(w in text.lower() for w in ["non-physical", "immaterial", "purely abstract", "purely spiritual"])

    # Core vs Scientific: physical vs non-physical
    if core_text and sci_text:
        if is_nonphysical(core_text) and is_physical(sci_text):
            msg = ("Core Definition implies non-physical/immaterial, "
                   "while Scientific Definition describes it as physical/material.")
            contradictions["core"].append(msg)
            contradictions["scientific"].append(msg)
        if is_physical(core_text) and is_nonphysical(sci_text):
            msg = ("Core Definition implies physical/material, "
                   "while Scientific Definition describes it as non-physical/immaterial.")
            contradictions["core"].append(msg)
            contradictions["scientific"].append(msg)

    # Core should NOT contain functional language
    if core_text:
        if any(word in core_text.lower() for word in ["causes ", "describes ", "is the process", "operates as"]):
            msg = ("Core Definition contains functional/operational language. "
                   "Core should state what the term IS, not how it works.")
            contradictions["core"].append(msg)

    # Ontology vs semantics
    if onto_text:
        triad_match = re.search(r"Triad.*?:\s*(.+)", onto_text, re.IGNORECASE)
        domain_match = re.search(r"Domain.*?:\s*(.+)", onto_text, re.IGNORECASE)
        triad = triad_match.group(1).strip() if triad_match else ""
        domain = domain_match.group(1).strip() if domain_match else ""

        if triad.lower().startswith("necessity"):
            contingent_keywords = ["history", "historical", "contingent", "emergent", "depends on", "developed"]
            if any(k in (sci_text + narr_text).lower() for k in contingent_keywords):
                msg = ("Ontological Context marks this as Necessity, but Scientific/Narrative layers "
                       "describe it as historical or contingent.")
                contradictions["ontology"].append(msg)

        if "Observer" in domain and not any(k in (op_text + core_text).lower()
                                            for k in ["conscious", "observer", "awareness", "witness"]):
            msg = ("Ontological Context places this in Observer-Consciousness, "
                   "but Core/Operational definitions contain no explicit observer/consciousness language.")
            contradictions["ontology"].append(msg)

    return contradictions


def collect_review_flags(section_bodies: Dict[str, str], contradictions: Dict[str, List[str]]) -> List[str]:
    """
    Determine which terms need review.
    """
    flags = []

    for key, body in section_bodies.items():
        if body is None or section_is_empty(body):
            flags.append(f"{TAG_REVIEW} {key} section is missing and was auto-filled or remains empty.")
        elif section_is_all_tagged(body) and not contains_user_text(body):
            flags.append(f"{TAG_REVIEW} {key} section contains only engine-generated or external content.")

    for key, msgs in contradictions.items():
        for msg in msgs:
            flags.append(f"{TAG_REVIEW} Contradiction in {key} section: {msg}")

    return flags


# -----------------------------
# MAIN PROCESSING
# -----------------------------

def process_single_file(path: Path, dry_run: bool = False, skip_wikipedia: bool = False) -> EngineResult:
    """Process a single definition file."""
    result = EngineResult(
        file_path=str(path),
        term_name="",
        updated=False,
        sections_filled=[],
        contradictions_found=[],
        review_flags=[]
    )
    
    try:
        original = path.read_text(encoding='utf-8')
    except Exception as e:
        result.error = f"Failed to read file: {e}"
        return result

    prefix, sections, suffix = split_glossary_sections(original)

    if not sections:
        result.error = "No structured sections found"
        return result

    # Term name from first H1 line
    for line in original.splitlines():
        if line.startswith('# '):
            result.term_name = line.replace("#", "").strip()
            break
    
    if not result.term_name:
        result.term_name = path.stem

    # Extract aliases from file
    aliases = extract_aliases_from_content(original)

    # Map sections by header
    section_map = {header: body for header, body in sections}

    # Get external summary once (tries term first, then aliases)
    # Skip if skip_wikipedia is True for faster processing
    if skip_wikipedia:
        external_summary = None
    else:
        external_summary = fetch_external_summary(result.term_name, aliases=aliases)

    # Track section bodies for analysis
    core_body = ""
    sci_body = ""
    op_body = ""
    onto_body = ""
    narr_body = ""

    new_sections_out = []

    for header in SECTION_ORDER:
        if header not in section_map:
            continue

        raw_body = section_map[header]
        main_body, _old_diag = section_main_body_and_existing_diag(raw_body)

        # Determine section key
        if "Core Definition" in header:
            key = "core"
        elif "Scientific Definition" in header:
            key = "scientific"
        elif "Operational Definition" in header:
            key = "operational"
        elif "Ontological Context" in header:
            key = "ontology"
        elif "Narrative Definition" in header:
            key = "narrative"
        elif "Aliases" in header:
            key = "aliases"
        elif "Relationships" in header:
            key = "relationships"
        else:
            key = "other"

        # Skip relationships - don't auto-generate tables
        if key == "relationships":
            body_final = main_body.strip()
            new_sections_out.append((header, body_final, key))
            continue

        # AUTO-FILL if empty
        if section_is_empty(main_body):
            if key == "core":
                body_final = generate_core_definition(result.term_name, external_summary)
            elif key == "scientific":
                body_final = generate_scientific_definition(external_summary)
            elif key == "operational":
                body_final = generate_operational_definition(result.term_name, "", external_summary)
            elif key == "ontology":
                body_final = generate_ontological_context(result.term_name, external_summary)
            elif key == "narrative":
                body_final = generate_narrative_definition(result.term_name, "", external_summary)
            elif key == "aliases":
                body_final = generate_aliases_section(result.term_name, external_summary)
            else:
                body_final = main_body.strip()
            result.sections_filled.append(key)
            result.updated = True
        else:
            # If section has user content, do NOT overwrite
            if contains_user_text(main_body):
                body_final = main_body.strip()
            else:
                # Only [W]/[A] content: allowed to refresh
                if key == "core":
                    body_final = generate_core_definition(result.term_name, external_summary)
                    result.updated = True
                elif key == "scientific":
                    body_final = generate_scientific_definition(external_summary)
                    result.updated = True
                elif key == "operational":
                    body_final = generate_operational_definition(result.term_name, "", external_summary)
                    result.updated = True
                elif key == "ontology":
                    body_final = generate_ontological_context(result.term_name, external_summary)
                    result.updated = True
                elif key == "narrative":
                    body_final = generate_narrative_definition(result.term_name, "", external_summary)
                    result.updated = True
                else:
                    body_final = main_body.strip()

        # Store for analysis
        if key == "core":
            core_body = body_final
        elif key == "scientific":
            sci_body = body_final
        elif key == "operational":
            op_body = body_final
        elif key == "ontology":
            onto_body = body_final
        elif key == "narrative":
            narr_body = body_final

        new_sections_out.append((header, body_final, key))

    # Detect contradictions
    contradictions = detect_contradictions(core_body, sci_body, op_body, onto_body, narr_body)

    for key, msgs in contradictions.items():
        result.contradictions_found.extend(msgs)

    section_bodies_for_review = {
        "core": core_body,
        "scientific": sci_body,
        "operational": op_body,
        "ontology": onto_body,
        "narrative": narr_body
    }

    result.review_flags = collect_review_flags(section_bodies_for_review, contradictions)

    # Build final output
    final_sections_str = prefix

    for header, body_final, key in new_sections_out:
        final_sections_str += f"{header}\n\n{body_final.strip()}\n\n"

        # Attach contradictions for this section
        if key in contradictions and contradictions[key]:
            for msg in contradictions[key]:
                final_sections_str += f"### Contradiction\n{msg}\n\n"
                result.updated = True

    # Append review status at end
    if result.review_flags:
        final_sections_str += "\n---\n\n## Review Status\n\n"
        for flag in result.review_flags:
            final_sections_str += f"{flag}\n\n"

    if result.updated and not dry_run:
        try:
            path.write_text(final_sections_str, encoding='utf-8')
        except Exception as e:
            result.error = f"Failed to write file: {e}"

    return result


def process_glossary_folder(
    folder: Path, 
    recursive: bool = True,
    dry_run: bool = False,
    skip_wikipedia: bool = False,
    progress_callback=None
) -> List[EngineResult]:
    """Process all definition files in a folder."""
    results = []
    
    if recursive:
        md_files = list(folder.rglob("*.md"))
    else:
        md_files = list(folder.glob("*.md"))
    
    total = len(md_files)
    
    for idx, md_file in enumerate(md_files):
        if progress_callback:
            progress_callback(int((idx / max(total, 1)) * 100), f"Processing {md_file.name}...")
        
        result = process_single_file(md_file, dry_run=dry_run, skip_wikipedia=skip_wikipedia)
        results.append(result)
    
    if progress_callback:
        progress_callback(100, "Complete!")
    
    return results


def fill_single_term_from_wikipedia(term: str) -> Dict[str, str]:
    """
    Fetch Wikipedia data for a single term and return generated sections.
    Does NOT write to file - returns dict of section content.
    """
    external_summary = fetch_external_summary(term)
    
    return {
        'core': generate_core_definition(term, external_summary),
        'scientific': generate_scientific_definition(external_summary),
        'operational': generate_operational_definition(term, "", external_summary),
        'ontology': generate_ontological_context(term, external_summary),
        'narrative': generate_narrative_definition(term, "", external_summary),
        'aliases': generate_aliases_section(term, external_summary),
        'external_summary': external_summary or "No Wikipedia article found."
    }


# -----------------------------
# TEMPLATE INJECTION
# -----------------------------

FULL_TEMPLATE = '''
## 1. Aliases
<!-- Other names, symbols, abbreviations -->
{ALIASES}

## 2. Core Definition
<!-- ONE SENTENCE. What the term IS. -->
{CORE}

## 3. Operational Definition
<!-- How this term FUNCTIONS in Theophysics -->
{OPERATIONAL}

## 4. Ontological Context
<!-- Triad position, domain, layer -->
{ONTOLOGICAL}

## 5. Relationships
<!-- Related terms, prerequisites, contrasts -->
| Relation | Term |
|----------|------|
| Parent | |
| Children | |
| See Also | {SEE_ALSO} |
| Contrasts | |

## 6. Scientific Definition
<!-- Standard physics/science definition -->
{SCIENTIFIC}

## 7. Narrative Definition
<!-- Simple, intuitive explanation -->
{NARRATIVE}

---
## Metadata
**Tags:** {TAGS}
**Links:** {LINKS}
**Papers:** {PAPERS}
'''


def inject_template_into_file(path: Path, dry_run: bool = False) -> dict:
    """
    Add the 7-layer template to a file that doesn't have it.
    Preserves existing content by putting it in appropriate sections.
    """
    result = {
        'file': str(path),
        'action': 'skipped',
        'reason': '',
        'term': ''
    }
    
    try:
        content = path.read_text(encoding='utf-8')
    except Exception as e:
        result['action'] = 'error'
        result['reason'] = str(e)
        return result
    
    # Check if template already exists
    if '## 2. Core Definition' in content or '## 1. Aliases' in content:
        result['action'] = 'skipped'
        result['reason'] = 'Already has template structure'
        return result
    
    # Extract term name
    term_name = path.stem
    for line in content.splitlines():
        if line.startswith('# '):
            term_name = line.replace('#', '').strip()
            break
    result['term'] = term_name
    
    # Extract existing frontmatter
    frontmatter = ""
    body_content = content
    if content.startswith('---'):
        fm_end = content.find('---', 3)
        if fm_end > 0:
            frontmatter = content[:fm_end+3]
            body_content = content[fm_end+3:].strip()
    
    # Extract any existing tags
    existing_tags = re.findall(r'#(\w+)', content)
    tags_str = ' '.join([f'#{t}' for t in existing_tags[:10]]) if existing_tags else '#glossary #theophysics'
    
    # Extract any existing links
    existing_links = re.findall(r'\[\[([^\]]+)\]\]', content)
    links_str = ', '.join([f'[[{l}]]' for l in existing_links[:10]]) if existing_links else ''
    
    # Check for existing content that might be a definition
    # Put it in Core Definition section
    core_content = ""
    if body_content and not body_content.startswith('#'):
        # First paragraph might be a definition
        paragraphs = body_content.split('\n\n')
        if paragraphs:
            first_para = paragraphs[0].strip()
            if len(first_para) > 20 and len(first_para) < 500:
                core_content = first_para
    
    # Build new content
    new_content = frontmatter
    if not frontmatter:
        new_content = f'''---
aliases: []
title: {term_name}
type: definition
status: draft
tags: [{', '.join(existing_tags[:5]) if existing_tags else 'glossary, theophysics'}]
---
'''
    
    new_content += f"\n# {term_name}\n"
    
    # Add template with extracted content
    template_filled = FULL_TEMPLATE.format(
        ALIASES='',
        CORE=core_content if core_content else '',
        OPERATIONAL='',
        ONTOLOGICAL='',
        SEE_ALSO=', '.join([f'[[{l}]]' for l in existing_links[:5]]) if existing_links else '',
        SCIENTIFIC='',
        NARRATIVE='',
        TAGS=tags_str,
        LINKS=links_str,
        PAPERS=''
    )
    
    new_content += template_filled
    
    # Append original body if there's more content
    if body_content and body_content != core_content:
        remaining = body_content.replace(core_content, '').strip() if core_content else body_content
        if remaining:
            new_content += f"\n\n---\n## Original Content\n\n{remaining}\n"
    
    if not dry_run:
        path.write_text(new_content, encoding='utf-8')
    
    result['action'] = 'injected'
    result['reason'] = f'Added 7-layer template'
    return result


def inject_templates_in_folder(
    folder: Path,
    recursive: bool = True,
    dry_run: bool = False,
    progress_callback=None
) -> List[dict]:
    """Inject templates into all files that need them."""
    results = []
    
    if recursive:
        md_files = list(folder.rglob("*.md"))
    else:
        md_files = list(folder.glob("*.md"))
    
    total = len(md_files)
    
    for idx, md_file in enumerate(md_files):
        if progress_callback:
            progress_callback(int((idx / max(total, 1)) * 100), f"Checking {md_file.name}...")
        
        result = inject_template_into_file(md_file, dry_run=dry_run)
        results.append(result)
    
    if progress_callback:
        progress_callback(100, "Complete!")
    
    return results


# CLI entry point
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python definition_engine.py <glossary_folder> [--dry-run]")
        sys.exit(1)
    
    folder = Path(sys.argv[1])
    dry_run = "--dry-run" in sys.argv
    
    if not folder.exists():
        print(f"Folder not found: {folder}")
        sys.exit(1)
    
    print(f"Processing glossary folder: {folder}")
    print(f"Dry run: {dry_run}")
    print()
    
    results = process_glossary_folder(folder, dry_run=dry_run)
    
    updated_count = sum(1 for r in results if r.updated)
    error_count = sum(1 for r in results if r.error)
    
    print(f"\n{'='*50}")
    print(f"Processed: {len(results)} files")
    print(f"Updated: {updated_count}")
    print(f"Errors: {error_count}")
    
    if dry_run:
        print("\n[DRY RUN - no files were modified]")

