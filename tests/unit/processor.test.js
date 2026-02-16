
const DocumentProcessor = require('../../src/processor');

// Mock dependencies
jest.mock('../../src/processor/extractor');
jest.mock('../../src/processor/analyzer');
jest.mock('../../src/processor/synthesizer');
jest.mock('../../src/logger', () => ({
    logger: {
        child: () => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        })
    }
}));

const DocumentExtractor = require('../../src/processor/extractor');
const DocumentAnalyzer = require('../../src/processor/analyzer');
const DocumentSynthesizer = require('../../src/processor/synthesizer');

describe('DocumentProcessor', () => {
    let processor;
    let mockStorage;
    let mockConfig;

    beforeEach(() => {
        jest.clearAllMocks();

        mockStorage = {
            addDocument: jest.fn().mockResolvedValue('doc-123'),
            addFacts: jest.fn().mockResolvedValue({ inserted: 5 }),
            deleteFactsByDocument: jest.fn().mockResolvedValue(5),
            deleteRisksByDocument: jest.fn().mockResolvedValue(2),
            getDocuments: jest.fn().mockReturnValue([{ id: 'doc-123', filename: 'test.md' }])
        };

        mockConfig = {
            dataDir: '/tmp/data',
            projectId: 'proj-123'
        };

        // Setup mock implementations
        DocumentExtractor.mockImplementation(() => ({
            checkMarkItDownAvailability: jest.fn().mockResolvedValue(true),
            readFileContent: jest.fn().mockResolvedValue({ content: 'test content must be longer than 50 characters to pass the validation check in processFile so this is a long string now', id: 'doc-123' })
        }));

        DocumentAnalyzer.mockImplementation(() => ({
            loadPromptsFromSupabase: jest.fn().mockResolvedValue(),
            loadContextVariables: jest.fn().mockResolvedValue(),
            buildExtractionPrompt: jest.fn().mockReturnValue('prompt'),
            llmGenerateText: jest.fn().mockResolvedValue({ success: true, response: '{}' }),
            parseAIResponse: jest.fn().mockReturnValue({ facts: [{ content: 'fact1' }] }),
            checkAndResolveQuestions: jest.fn().mockResolvedValue(0),
            checkAndCompleteActions: jest.fn().mockReturnValue(0),
            generateFileSummary: jest.fn().mockResolvedValue({ title: 'Title', summary: 'Summary' })
        }));

        DocumentSynthesizer.mockImplementation(() => ({
            getContentFiles: jest.fn().mockReturnValue([{ name: 'test.md', path: '/path/test.md' }]),
            holisticSynthesis: jest.fn().mockResolvedValue({ success: true }),
            _getContentHash: jest.fn().mockReturnValue('hash')
        }));

        processor = new DocumentProcessor(mockStorage, mockConfig);
    });

    test('initialize calls dependencies', async () => {
        await processor.initialize();
        expect(processor.analyzer.loadPromptsFromSupabase).toHaveBeenCalled();
        expect(processor.extractor.checkMarkItDownAvailability).toHaveBeenCalled();
    });

    test('processAll orchestrates flow', async () => {
        const result = await processor.processAll('model');

        expect(result.success).toBe(true);
        expect(processor.synthesizer.getContentFiles).toHaveBeenCalled();
        expect(processor.extractor.readFileContent).toHaveBeenCalled();
        expect(processor.analyzer.buildExtractionPrompt).toHaveBeenCalled();
        expect(processor.analyzer.llmGenerateText).toHaveBeenCalled();
        expect(processor.synthesizer.holisticSynthesis).toHaveBeenCalled();
    });

    test('reprocessDocument clears data and reprocesses', async () => {
        await processor.reprocessDocument('test.md', 'model');

        expect(mockStorage.getDocuments).toHaveBeenCalled();
        expect(mockStorage.deleteFactsByDocument).toHaveBeenCalledWith('doc-123');
        expect(processor.extractor.readFileContent).toHaveBeenCalled();
    });
});
