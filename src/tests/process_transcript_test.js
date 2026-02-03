/**
 * Test script for processing a transcript with v1.6 prompts
 * 
 * Run: node src/tests/process_transcript_test.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from src/.env manually
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)\s*=\s*["']?([^"'\r\n]*)["']?/);
        if (match) {
            process.env[match[1].trim()] = match[2].trim();
        }
    });
}

// Load the transcript
const transcriptPath = path.join(__dirname, '../../cgi_graph_2_transcript.txt');
const transcriptContent = fs.readFileSync(transcriptPath, 'utf-8');

console.log('=================================================');
console.log('   Transcript Processing Test v1.6');
console.log('=================================================\n');

console.log(`Transcript: ${path.basename(transcriptPath)}`);
console.log(`Content length: ${transcriptContent.length} characters`);
console.log(`Lines: ${transcriptContent.split('\n').length}`);

// Parse transcript to identify speakers
const lines = transcriptContent.split('\n').filter(l => l.trim());
const speakers = new Set();
const turns = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Pattern: "Speaker Name | 00:00"
    const speakerMatch = line.match(/^(.+?)\s*\|\s*(\d{1,2}:\d{2})$/);
    if (speakerMatch) {
        speakers.add(speakerMatch[1].trim());
        // Next line is the content
        if (i + 1 < lines.length && !lines[i + 1].match(/\|/)) {
            turns.push({
                speaker: speakerMatch[1].trim(),
                timestamp: speakerMatch[2],
                text: lines[i + 1]
            });
        }
    }
}

console.log(`\nSpeakers identified: ${speakers.size}`);
speakers.forEach(s => console.log(`  - ${s}`));
console.log(`\nTurns parsed: ${turns.length}`);

// Show first few turns
console.log('\nFirst 5 turns:');
turns.slice(0, 5).forEach((t, i) => {
    console.log(`  [${i}] ${t.timestamp} ${t.speaker}: ${t.text.substring(0, 80)}...`);
});

// Try to process with ContentProcessor
console.log('\n=================================================');
console.log('   Testing ContentProcessor...');
console.log('=================================================\n');

async function testProcessor() {
    try {
        // Load ContentProcessor
        const { AIContentProcessor } = require('../ai/ContentProcessor');
        
        console.log('API Keys found:');
        console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Yes (' + process.env.OPENAI_API_KEY.substring(0, 15) + '...)' : 'No');
        console.log('  CLAUDE_API_KEY:', process.env.CLAUDE_API_KEY ? 'Yes' : 'No');
        console.log('  DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? 'Yes' : 'No');
        console.log('');
        
        // Create config using available keys - match AIContentProcessor expected format
        const config = {
            llmProvider: 'openai',
            llmModel: 'gpt-4o-mini',
            llmConfig: {
                providers: {
                    openai: {
                        apiKey: process.env.OPENAI_API_KEY
                    },
                    anthropic: {
                        apiKey: process.env.CLAUDE_API_KEY
                    },
                    deepseek: {
                        apiKey: process.env.DEEPSEEK_API_KEY
                    }
                }
            }
        };
        
        // Check for API key
        if (!process.env.OPENAI_API_KEY && !process.env.CLAUDE_API_KEY) {
            console.log('No API key found. Showing expected output structure instead.\n');
            showExpectedOutput();
            return;
        }
        
        const processor = new AIContentProcessor(config);
        
        console.log('Processing transcript with LLM (this may take 30-60 seconds)...\n');
        const startTime = Date.now();
        
        // Build transcript object with parsed speakers
        const transcriptObj = {
            title: 'CGI Knowledge Graph Training Session',
            content: transcriptContent,
            speakers: Array.from(speakers),
            filename: 'cgi_graph_2_transcript.txt'
        };
        
        console.log(`Passing ${transcriptContent.length} chars with ${speakers.size} speakers to LLM...\n`);
        
        const result = await processor.processTranscript(transcriptObj);
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('=================================================');
        console.log(`   EXTRACTION RESULT (${elapsed}s)`);
        console.log('=================================================\n');
        
        console.log(JSON.stringify(result, null, 2));
        
        // Show summary
        console.log('\n=================================================');
        console.log('   SUMMARY');
        console.log('=================================================\n');
        console.log('Entities:', result.entities?.length || 0);
        console.log('Relationships:', result.relationships?.length || 0);
        console.log('Facts:', result.facts?.length || 0);
        console.log('Decisions:', result.decisions?.length || 0);
        console.log('Action Items:', result.action_items?.length || 0);
        console.log('Questions:', result.questions?.length || 0);
        console.log('Turns:', result.turns?.length || 0);
        console.log('Notes Key Points:', result.notes?.key_points?.length || 0);
        
        if (result.notes_rendered_text) {
            console.log('\n=================================================');
            console.log('   MEETING NOTES');
            console.log('=================================================\n');
            console.log(result.notes_rendered_text);
        }
        
    } catch (error) {
        console.log('ContentProcessor error:', error.message);
        console.log('Stack:', error.stack);
        console.log('\nShowing expected output structure instead.\n');
        showExpectedOutput();
    }
}

function showExpectedOutput() {
    // Generate expected output based on transcript analysis
    const speakerList = Array.from(speakers);
    
    const expectedOutput = {
        extraction_metadata: {
            source_ref: 'meeting-' + generateHash(transcriptContent),
            source_type: 'transcript',
            filename: 'cgi_graph_2_transcript.txt',
            extracted_at: null,
            extractor_version: '1.6',
            content_hash: generateHash(transcriptContent)
        },
        meeting: {
            id: 'meeting-' + generateHash(transcriptContent),
            title: 'CGI Knowledge Graph Training Session',
            date: null,
            type: 'training',
            duration_minutes: 58
        },
        turns: turns.slice(0, 5).map((t, i) => ({
            turn_index: i,
            speaker_label: t.speaker,
            speaker_id: `person-${t.speaker.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
            timestamp: t.timestamp,
            text: t.text.substring(0, 100) + '...'
        })),
        entities: speakerList.map(s => ({
            id: `person-${s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
            type: 'Person',
            name: s,
            properties: { organization: 'CGI' },
            confidence: 0.95,
            evidence: `${s} | ...`,
            source_ref: 'meeting-' + generateHash(transcriptContent)
        })).concat([
            {
                id: 'meeting-' + generateHash(transcriptContent),
                type: 'Meeting',
                name: 'CGI Knowledge Graph Training Session',
                properties: { type: 'training' },
                confidence: 1.0
            },
            {
                id: 'org-cgi',
                type: 'Organization',
                name: 'CGI',
                properties: {},
                confidence: 0.98
            },
            {
                id: 'org-achmea',
                type: 'Organization',
                name: 'ACHMEA',
                properties: {},
                confidence: 0.95
            },
            {
                id: 'project-achmea-knowledge-graph',
                type: 'Project',
                name: 'ACHMEA Knowledge Graph Implementation',
                properties: {},
                confidence: 0.90
            },
            {
                id: 'technology-linked-data',
                type: 'Technology',
                name: 'Linked Data',
                properties: {},
                confidence: 0.92
            },
            {
                id: 'technology-knowledge-graph',
                type: 'Technology',
                name: 'Knowledge Graph',
                properties: {},
                confidence: 0.95
            }
        ]),
        relationships: [
            {
                id: 'rel-person-alexander-cgi-WORKS_AT-org-cgi',
                from_id: 'person-alexander-cgi',
                from_type: 'Person',
                to_id: 'org-cgi',
                to_type: 'Organization',
                relation: 'WORKS_AT',
                confidence: 0.95
            },
            {
                id: 'rel-person-rui-dias-ATTENDS-meeting',
                from_id: 'person-rui-dias',
                from_type: 'Person',
                to_id: 'meeting-' + generateHash(transcriptContent),
                to_type: 'Meeting',
                relation: 'ATTENDS',
                confidence: 0.98
            }
        ],
        facts: [
            {
                id: 'fact-001',
                content: 'ACHMEA project involves integrating Dutch pension law with knowledge graphs',
                category: 'business',
                confidence: 0.90,
                speaker_id: 'person-luuc-cgi',
                turn_index: 3
            },
            {
                id: 'fact-002',
                content: 'Dutch pension law knowledge graph is available from wetten.overheid.nl',
                category: 'technical',
                confidence: 0.92,
                speaker_id: 'person-alexander-cgi',
                turn_index: 30
            },
            {
                id: 'fact-003',
                content: 'The LIDO graph contains approximately 300 million triples',
                category: 'technical',
                confidence: 0.95,
                speaker_id: 'person-alexander-cgi'
            },
            {
                id: 'fact-004',
                content: 'Two proof of concepts have been completed for ACHMEA',
                category: 'business',
                confidence: 0.90,
                speaker_id: 'person-alexander-cgi'
            },
            {
                id: 'fact-005',
                content: 'Franchise represents portion of pension not dependent on income',
                category: 'technical',
                confidence: 0.88
            }
        ],
        decisions: [
            {
                id: 'decision-001',
                content: 'Team will start with products catalog as reference for building knowledge graph',
                decision_type: 'final',
                confidence: 0.85
            },
            {
                id: 'decision-002',
                content: 'Alexander will share the knowledge graph versions with the team',
                decision_type: 'final',
                confidence: 0.90
            }
        ],
        action_items: [
            {
                id: 'action-001',
                task: 'Alexander to write down concrete next steps and share in chat',
                owner_id: 'person-alexander-cgi',
                status: 'pending',
                priority: 'high',
                confidence: 0.90
            },
            {
                id: 'action-002',
                task: 'Team to download Dutch pension law TTL file from wetten.overheid.nl',
                owner_id: null,
                status: 'pending',
                priority: 'medium',
                confidence: 0.85
            },
            {
                id: 'action-003',
                task: 'Find 1-3 examples of Dutch pension law texts relevant for catalog choices',
                owner_id: 'person-afonso-cgi',
                status: 'pending',
                priority: 'medium',
                confidence: 0.82
            },
            {
                id: 'action-004',
                task: 'Build a basic knowledge graph for the found law texts',
                owner_id: null,
                status: 'pending',
                priority: 'medium',
                confidence: 0.80
            },
            {
                id: 'action-005',
                task: 'Kishor to meet Alexander in office tomorrow',
                owner_id: 'person-kishor-cgi',
                status: 'pending',
                priority: 'medium',
                confidence: 0.95
            }
        ],
        questions: [
            {
                id: 'question-001',
                content: 'Do we have an actual selection of laws related to specific services?',
                status: 'resolved',
                asked_by_id: 'person-afonso-cgi',
                confidence: 0.88
            },
            {
                id: 'question-002',
                content: 'What is the use case for using these knowledge graphs?',
                status: 'resolved',
                asked_by_id: 'person-kishor-cgi',
                confidence: 0.90
            },
            {
                id: 'question-003',
                content: 'What tools are we using to build the knowledge graphs?',
                status: 'resolved',
                asked_by_id: 'person-kishor-cgi',
                confidence: 0.92
            }
        ],
        summary: 'CGI team meeting about ACHMEA knowledge graph project. Alexander explained the pension regulation system where clients make choices that need law compliance checking. The team discussed using Dutch pension law TTL files from wetten.overheid.nl to build knowledge graphs. Action items include downloading the law graph, finding relevant law texts, and building a basic knowledge graph. Next meeting will discuss findings and progress.',
        key_topics: [
            'Knowledge Graphs',
            'Dutch Pension Law',
            'ACHMEA Project',
            'Linked Data',
            'Franchise Value',
            'SHACL Validation',
            'Ontology Design'
        ],
        next_steps: [
            'Alexander shares knowledge graph files and concrete steps',
            'Team downloads Dutch pension law TTL',
            'Find 1-3 law examples relevant for catalog',
            'Build basic knowledge graph',
            'Next meeting to discuss progress'
        ],
        notes_metadata: {
            template_name: 'GodMode Notes',
            started_at: null,
            duration_minutes: 58,
            language: 'en'
        },
        notes: {
            key_points: [
                { text: 'ACHMEA project integrates Dutch pension law with knowledge graphs for compliance checking', source_item_ids: ['fact-001'], confidence: 0.90 },
                { text: 'Two proof of concepts already completed demonstrating the approach', source_item_ids: ['fact-004'], confidence: 0.90 },
                { text: 'Dutch pension law graph available from government site (300M triples)', source_item_ids: ['fact-002', 'fact-003'], confidence: 0.93 },
                { text: 'Team will start with products catalog and find relevant law texts', source_item_ids: ['decision-001'], confidence: 0.85 },
                { text: 'Alexander will share existing knowledge graph files with team', source_item_ids: ['decision-002'], confidence: 0.90 }
            ],
            action_items_rendered: [
                { action_item_id: 'action-001', text: 'Alexander - Write down concrete next steps - A', owner_id: 'person-alexander-cgi', priority: 'high' },
                { action_item_id: 'action-002', text: 'Team - Download Dutch pension law TTL - T', owner_id: null, priority: 'medium' },
                { action_item_id: 'action-003', text: 'Afonso - Find 1-3 law examples - A', owner_id: 'person-afonso-cgi', priority: 'medium' },
                { action_item_id: 'action-004', text: 'Team - Build basic knowledge graph - T', owner_id: null, priority: 'medium' },
                { action_item_id: 'action-005', text: 'Kishor - Meet Alexander tomorrow - K', owner_id: 'person-kishor-cgi', priority: 'medium' }
            ],
            outline: [
                { topic: 'Introduction & Welcome', bullets: [{ text: 'Kishor introduced as new team member', source_item_ids: [] }] },
                { topic: 'Project Overview', bullets: [{ text: 'ACHMEA pension regulation compliance project', source_item_ids: ['fact-001'] }] },
                { topic: 'Technical Discussion', bullets: [{ text: 'Dutch pension law graph from wetten.overheid.nl', source_item_ids: ['fact-002'] }, { text: 'LIDO graph has 300M triples', source_item_ids: ['fact-003'] }] },
                { topic: 'Next Steps', bullets: [{ text: 'Team to build basic knowledge graph', source_item_ids: ['action-004'] }] }
            ]
        },
        notes_rendered_text: `📝 GodMode Notes

Key Points
- ACHMEA project integrates Dutch pension law with knowledge graphs for compliance checking
- Two proof of concepts already completed demonstrating the approach
- Dutch pension law graph available from government site (300M triples)
- Team will start with products catalog and find relevant law texts
- Alexander will share existing knowledge graph files with team

Action Items
- Alexander - Write down concrete next steps - A (HIGH)
- Team - Download Dutch pension law TTL - T
- Afonso - Find 1-3 law examples - A
- Team - Build basic knowledge graph - T
- Kishor - Meet Alexander tomorrow - K

Outline
Introduction & Welcome
  - Kishor introduced as new team member

Project Overview
  - ACHMEA pension regulation compliance project

Technical Discussion
  - Dutch pension law graph from wetten.overheid.nl
  - LIDO graph has 300M triples

Next Steps
  - Team to build basic knowledge graph`,
        extraction_coverage: {
            entities_count: speakerList.length + 6,
            relationships_count: 2,
            facts_count: 5,
            decisions_count: 2,
            risks_count: 0,
            actions_count: 5,
            questions_count: 3,
            turns_count: turns.length,
            notes_key_points_count: 5,
            notes_outline_topics_count: 4,
            overall_confidence: 0.88
        }
    };
    
    console.log('=================================================');
    console.log('   EXPECTED OUTPUT STRUCTURE (v1.6)');
    console.log('=================================================\n');
    
    console.log(JSON.stringify(expectedOutput, null, 2));
}

function generateHash(content) {
    if (!content) return '00000000';
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8).padStart(8, '0');
}

// Run the test
testProcessor().catch(console.error);
