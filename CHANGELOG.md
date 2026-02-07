# Changelog

All notable changes to Document Processor are documented in this file.

## [1.0.0] - 2026-01-24

### Added

#### Core Features
- Ollama AI integration for document processing
- Support for text, vision, reasoning, and embedding models
- Automatic model detection and categorization
- Configurable prompts for document, vision, and transcript processing

#### Document Processing
- Multi-format support: PDF, DOCX, XLSX, PPTX, HTML, TXT, MD, CSV, JSON
- MarkItDown integration for enhanced extraction (Microsoft's document converter)
- Automatic chunking for large documents with overlap for context continuity
- Vision model support for scanned PDFs and images
- PDF-to-image conversion for vision processing
- Duplicate document detection to prevent reprocessing

#### Knowledge Extraction
- Facts extraction with category classification (technical, process, policy, people, timeline, general)
- Decisions tracking with owner and date
- Questions with priority levels (critical, high, medium) and assignees
- Risk identification with impact/likelihood assessment and mitigation
- Action items with deadlines and completion tracking
- People/contacts extraction with roles and organizations
- Relationship extraction for org chart (reports_to, manages, leads, member_of, works_with)

#### RAG (Retrieval Augmented Generation)
- Vector embedding generation using Ollama embedding models
- Semantic search across all knowledge items
- Cosine similarity matching for relevant context retrieval
- RAG-powered chat with source attribution
- Automatic RAG index rebuild after processing

#### User Interface
- Dashboard with visual statistics and charts
- Questions by priority pie chart
- Risks by impact distribution
- Timeline view with decisions, milestones, and dated facts
- Interactive org chart visualization using vis.js
- Filter dropdowns for Actions, Risks, and Questions panels
- Pending vs completed item counts in panel headers
- Full-text search across all data types
- Drag-and-drop file upload

#### Storage & Export
- JSON-based storage (portable, no database server required)
- Automatic markdown generation (SOURCE_OF_TRUTH.md, PENDING_QUESTIONS.md)
- Knowledge base export
- Copy to clipboard functionality
- Change log tracking for all modifications

#### API
- RESTful API with 30+ endpoints
- CORS support for cross-origin requests
- File upload via multipart form data
- Processing status polling
- Comprehensive data access endpoints

### Technical
- Pure Node.js HTTP server (no framework dependencies)
- Vanilla JavaScript frontend
- pkg support for standalone executables
- Graceful shutdown handling
- Garbage content filtering to reject placeholder text
- Text similarity deduplication using Jaccard similarity

## [0.9.0] - 2026-01-23 (Pre-release)

### Added
- Initial document processing pipeline
- Basic Ollama integration
- SQLite storage (later replaced with JSON)
- Simple extraction prompts

### Changed
- Migrated from SQLite to JSON storage for portability
- Improved extraction prompts for better accuracy

---

## Roadmap

### Planned Features
- [ ] Batch export to multiple formats
- [ ] Scheduled automatic processing
- [ ] Multi-user support
- [ ] Cloud sync integration
- [ ] Custom extraction templates
- [ ] Webhook notifications
