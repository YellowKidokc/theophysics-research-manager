"""
PostgreSQL Manager - Stores definitions, footnotes, research links, and memories.
"""

from typing import List, Dict, Optional, Any
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import sql
from dataclasses import dataclass, asdict
import json
from datetime import datetime


@dataclass
class DatabaseConfig:
    """PostgreSQL connection configuration."""
    host: str = "localhost"
    port: int = 5432
    database: str = "theophysics_research"
    user: str = "postgres"
    password: str = ""


class PostgresManager:
    """Manages PostgreSQL database for Theophysics Research Manager."""
    
    def __init__(self, config: Optional[DatabaseConfig] = None):
        """Initialize PostgreSQL manager."""
        self.config = config or DatabaseConfig()
        self.conn = None
        self._ensure_schema()
    
    def connect(self) -> bool:
        """Connect to PostgreSQL database."""
        try:
            self.conn = psycopg2.connect(
                host=self.config.host,
                port=self.config.port,
                database=self.config.database,
                user=self.config.user,
                password=self.config.password
            )
            return True
        except psycopg2.OperationalError as e:
            print(f"Database connection failed: {e}")
            return False
    
    def disconnect(self) -> None:
        """Disconnect from database."""
        if self.conn:
            self.conn.close()
            self.conn = None
    
    def _ensure_schema(self) -> None:
        """Create database schema if it doesn't exist."""
        if not self.connect():
            return
        
        try:
            with self.conn.cursor() as cur:
                # Definitions table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS definitions (
                        id SERIAL PRIMARY KEY,
                        phrase TEXT NOT NULL UNIQUE,
                        aliases JSONB DEFAULT '[]',
                        definition TEXT NOT NULL,
                        classification TEXT,
                        folder TEXT,
                        vault_link TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Footnotes table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS footnotes (
                        id SERIAL PRIMARY KEY,
                        marker INTEGER NOT NULL,
                        term TEXT NOT NULL,
                        vault_link TEXT,
                        academic_links JSONB DEFAULT '{}',
                        explanation TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Research links table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS research_links (
                        id SERIAL PRIMARY KEY,
                        term TEXT NOT NULL,
                        source TEXT NOT NULL,
                        url TEXT NOT NULL,
                        priority INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(term, source)
                    )
                """)
                
                # Memories table (for AI context)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS memories (
                        id SERIAL PRIMARY KEY,
                        category TEXT NOT NULL,
                        content TEXT NOT NULL,
                        metadata JSONB DEFAULT '{}',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create indexes
                cur.execute("CREATE INDEX IF NOT EXISTS idx_definitions_phrase ON definitions(phrase)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_footnotes_term ON footnotes(term)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_research_links_term ON research_links(term)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)")
                
                self.conn.commit()
        except Exception as e:
            print(f"Schema creation error: {e}")
            if self.conn:
                self.conn.rollback()
        finally:
            self.disconnect()
    
    # Definitions methods
    def save_definition(
        self,
        phrase: str,
        definition: str,
        aliases: List[str] = None,
        classification: str = "",
        folder: str = "",
        vault_link: str = ""
    ) -> bool:
        """Save a definition to the database."""
        if not self.connect():
            return False
        
        try:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO definitions (phrase, aliases, definition, classification, folder, vault_link)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (phrase) 
                    DO UPDATE SET
                        aliases = EXCLUDED.aliases,
                        definition = EXCLUDED.definition,
                        classification = EXCLUDED.classification,
                        folder = EXCLUDED.folder,
                        vault_link = EXCLUDED.vault_link,
                        updated_at = CURRENT_TIMESTAMP
                """, (
                    phrase,
                    json.dumps(aliases or []),
                    definition,
                    classification or None,
                    folder or None,
                    vault_link or None
                ))
                self.conn.commit()
                return True
        except Exception as e:
            print(f"Error saving definition: {e}")
            if self.conn:
                self.conn.rollback()
            return False
        finally:
            self.disconnect()
    
    def get_all_definitions(self) -> List[Dict[str, Any]]:
        """Get all definitions from database."""
        if not self.connect():
            return []
        
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM definitions ORDER BY phrase")
                return [dict(row) for row in cur.fetchall()]
        except Exception as e:
            print(f"Error fetching definitions: {e}")
            return []
        finally:
            self.disconnect()
    
    # Footnotes methods
    def save_footnote(
        self,
        marker: int,
        term: str,
        vault_link: str = "",
        academic_links: Dict[str, str] = None,
        explanation: str = ""
    ) -> bool:
        """Save a footnote to the database."""
        if not self.connect():
            return False
        
        try:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO footnotes (marker, term, vault_link, academic_links, explanation)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (
                    marker,
                    term,
                    vault_link or None,
                    json.dumps(academic_links or {}),
                    explanation or None
                ))
                self.conn.commit()
                return True
        except Exception as e:
            print(f"Error saving footnote: {e}")
            if self.conn:
                self.conn.rollback()
            return False
        finally:
            self.disconnect()
    
    # Research links methods
    def save_research_link(
        self,
        term: str,
        source: str,
        url: str,
        priority: int = 0
    ) -> bool:
        """Save a research link to the database."""
        if not self.connect():
            return False
        
        try:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO research_links (term, source, url, priority)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (term, source)
                    DO UPDATE SET url = EXCLUDED.url, priority = EXCLUDED.priority
                """, (term, source, url, priority))
                self.conn.commit()
                return True
        except Exception as e:
            print(f"Error saving research link: {e}")
            if self.conn:
                self.conn.rollback()
            return False
        finally:
            self.disconnect()
    
    # Memories methods (for AI context)
    def save_memory(
        self,
        category: str,
        content: str,
        metadata: Dict[str, Any] = None
    ) -> bool:
        """Save a memory for AI context."""
        if not self.connect():
            return False
        
        try:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO memories (category, content, metadata)
                    VALUES (%s, %s, %s)
                """, (
                    category,
                    content,
                    json.dumps(metadata or {})
                ))
                self.conn.commit()
                return True
        except Exception as e:
            print(f"Error saving memory: {e}")
            if self.conn:
                self.conn.rollback()
            return False
        finally:
            self.disconnect()
    
    def get_memories(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get memories, optionally filtered by category."""
        if not self.connect():
            return []
        
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                if category:
                    cur.execute("SELECT * FROM memories WHERE category = %s ORDER BY created_at DESC", (category,))
                else:
                    cur.execute("SELECT * FROM memories ORDER BY created_at DESC")
                return [dict(row) for row in cur.fetchall()]
        except Exception as e:
            print(f"Error fetching memories: {e}")
            return []
        finally:
            self.disconnect()
    
    def test_connection(self) -> bool:
        """Test database connection."""
        return self.connect()

