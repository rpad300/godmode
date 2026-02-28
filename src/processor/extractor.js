/**
 * Purpose:
 *   Extracts raw text content from heterogeneous file types (PDF, DOCX, XLSX,
 *   PPTX, HTML, images, plain text) so downstream Analyzer / Synthesizer
 *   modules receive clean textual input.
 *
 * Responsibilities:
 *   - Detect and use MarkItDown CLI (Microsoft) for rich document conversion
 *   - Fall back to pdf-parse for PDFs when MarkItDown is unavailable
 *   - Read plain text files directly (txt, md, json, csv, log)
 *   - Return a sentinel string for image files (vision handled by Analyzer)
 *   - Convert multi-page PDFs to per-page PNG images (pdftoppm or ImageMagick)
 *   - Heuristically detect scanned (image-only) PDFs via chars-per-page ratio
 *
 * Key dependencies:
 *   - fs / path (Node built-in): File I/O
 *   - child_process (Node built-in): Spawning markitdown, pdftoppm, magick
 *   - pdf-parse (optional): Fallback PDF text extraction
 *   - ../logger: Structured logging
 *
 * Side effects:
 *   - Reads files from disk
 *   - Spawns external processes (markitdown, pdftoppm, magick) with timeouts
 *   - Writes temporary PNG files to <dataDir>/temp/pdf_images/
 *
 * Notes:
 *   - MarkItDown availability is checked once and cached for the instance lifetime
 *   - extractWithMarkItDown has a 2-minute timeout and 50 MB output buffer
 *   - convertPdfToImages renders at 150 DPI -- enough for OCR without excessive
 *     file sizes
 *   - isPdfScanned uses < 50 chars/page as the scanned threshold
 */
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { execSync, execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const { logger: rootLogger } = require('../logger');

const log = rootLogger.child({ module: 'processor-extractor' });

/**
 * Extracts raw text from heterogeneous file types using a cascading strategy:
 * MarkItDown CLI (if installed) > pdf-parse > direct read.
 * Also converts scanned PDFs to per-page PNG images for downstream OCR.
 */
class DocumentExtractor {
    constructor(config) {
        this.config = config;
        this._markitdownAvailable = undefined;
    }

    /**
     * Check if MarkItDown CLI is available
     */
    checkMarkItDown() {
        if (this._markitdownAvailable !== undefined) {
            return this._markitdownAvailable;
        }
        try {
            execSync('markitdown --version', { encoding: 'utf8', stdio: 'pipe' });
            this._markitdownAvailable = true;
            log.debug({ event: 'extractor_markitdown_available' }, 'MarkItDown available for document extraction');
        } catch (e) {
            this._markitdownAvailable = false;
            log.debug({ event: 'extractor_markitdown_unavailable' }, 'MarkItDown not installed; falling back to pdf-parse for PDFs');
        }
        return this._markitdownAvailable;
    }

    /**
     * Extract content using MarkItDown CLI (Microsoft's document converter)
     * Supports: PDF, DOCX, XLSX, PPTX, HTML, images, and more
     */
    async extractWithMarkItDown(filePath) {
        // Check if markitdown is available
        if (!this.checkMarkItDown()) {
            return { success: false, error: 'MarkItDown not installed' };
        }

        try {
            const filename = path.basename(filePath);
            log.debug({ event: 'extractor_markitdown_extract', filename }, 'MarkItDown extracting');

            return await execFileAsync('markitdown', [filePath], {
                encoding: 'utf8',
                maxBuffer: 50 * 1024 * 1024, // 50MB buffer
                timeout: 120000 // 2 minute timeout
            }).then(({ stdout }) => {
                log.debug({ event: 'extractor_markitdown_done', filename, chars: stdout.length }, 'MarkItDown extracted');
                return { success: true, content: stdout, method: 'markitdown' };
            });
        } catch (e) {
            log.warn({ event: 'extractor_markitdown_failed', filename: path.basename(filePath), reason: e.message }, 'MarkItDown failed');
            return { success: false, error: e.message };
        }
    }

    /**
     * Read file content based on type
     * Priority: MarkItDown > pdf-parse > raw text
     */
    async readFileContent(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const filename = path.basename(filePath);

        // Text-based files - read directly (async to avoid blocking event loop)
        if (['.txt', '.md', '.json', '.csv', '.log'].includes(ext)) {
            return fsp.readFile(filePath, 'utf8');
        }

        // For PDFs, Office docs, HTML, email files, ODF - try MarkItDown first
        if (['.pdf', '.docx', '.xlsx', '.pptx', '.html', '.htm', '.eml', '.msg', '.rtf', '.odt', '.ods', '.odp'].includes(ext)) {
            const markitResult = await this.extractWithMarkItDown(filePath);
            if (markitResult.success && markitResult.content.length > 100) {
                return markitResult.content;
            }

            // Fallback to pdf-parse for PDFs
            if (ext === '.pdf') {
                try {
                    const pdfParse = require('pdf-parse');
                    const dataBuffer = await fsp.readFile(filePath);
                    const data = await pdfParse(dataBuffer);
                    log.debug({ event: 'extractor_pdf_parse_fallback', filename, pages: data.numpages, chars: data.text.length }, 'pdf-parse fallback');
                    return data.text;
                } catch (e) {
                    log.warn({ event: 'extractor_pdf_parse_failed', reason: e.message }, 'pdf-parse also failed');
                }
            }

            return `[Could not extract content from ${filename}]`;
        }

        // For images - always use vision model (handled by Analyzer/Processor), skip MarkItDown here
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.tif'].includes(ext)) {
            return `[IMAGE:${filePath}]`;
        }

        // Default: try to read as text
        try {
            return await fsp.readFile(filePath, 'utf8');
        } catch (e) {
            return `[Binary file: ${filename} - Could not read as text]`;
        }
    }

    /**
     * Convert PDF to array of image paths (one per page)
     * Requires 'pdftoppm' (from poppler-utils) or 'magick' (ImageMagick)
     */
    async convertPdfToImages(pdfPath) {
        const filename = path.basename(pdfPath);
        const outputDir = path.join(this.config.dataDir, 'temp', 'pdf_images');

        try {
            await fsp.mkdir(outputDir, { recursive: true });

            // Generate unique prefix for this PDF
            const prefix = path.basename(pdfPath, '.pdf').replace(/[^a-z0-9]/gi, '_');
            const outputPath = path.join(outputDir, prefix);

            // Try pdftoppm first (usually faster/better quality)
            try {
                // pdftoppm -png input.pdf output_prefix
                // It automatically adds -1.png, -2.png etc.
                await execFileAsync('pdftoppm', ['-png', '-r', '150', pdfPath, outputPath]); // 150 DPI is usually enough

                // Find generated files
                const files = await fsp.readdir(outputDir);
                const pageFiles = files
                    .filter(f => f.startsWith(prefix) && f.endsWith('.png'))
                    .sort((a, b) => {
                        // Sort by page number
                        const numA = parseInt(a.match(/-(\d+)\.png$/)?.[1] || '0');
                        const numB = parseInt(b.match(/-(\d+)\.png$/)?.[1] || '0');
                        return numA - numB;
                    })
                    .map(f => path.join(outputDir, f));

                log.debug({ event: 'extractor_pdf_to_images_success', pages: pageFiles.length }, 'Converted PDF to images using pdftoppm');
                return pageFiles;
            } catch (popplerErr) {
                // Fallback to ImageMagick if pdftoppm fails
                log.debug({ event: 'extractor_poppler_failed', reason: popplerErr.message }, 'pdftoppm failed, trying ImageMagick');

                // magick -density 150 input.pdf output-%d.png
                await execFileAsync('magick', [
                    '-density', '150',
                    pdfPath,
                    path.join(outputDir, `${prefix}-%d.png`)
                ]);

                const files = await fsp.readdir(outputDir);
                const pageFiles = files
                    .filter(f => f.startsWith(prefix) && f.endsWith('.png'))
                    .sort((a, b) => {
                        const numA = parseInt(a.match(/-(\d+)\.png$/)?.[1] || '0');
                        const numB = parseInt(b.match(/-(\d+)\.png$/)?.[1] || '0');
                        return numA - numB;
                    })
                    .map(f => path.join(outputDir, f));

                log.debug({ event: 'extractor_imagemagick_success', pages: pageFiles.length }, 'Converted PDF to images using ImageMagick');
                return pageFiles;
            }
        } catch (e) {
            log.warn({ event: 'extractor_pdf_conversion_failed', filename, reason: e.message }, 'Failed to convert PDF to images');
            return null;
        }
    }

    /**
     * Check if a PDF is likely scanned (image-only)
     * Heuristic: Extract text. If text length is very low relative to file size/pages, it's likely scanned.
     */
    async isPdfScanned(filePath) {
        try {
            const pdfParse = require('pdf-parse');
            const dataBuffer = await fsp.readFile(filePath);
            const data = await pdfParse(dataBuffer);

            const textLength = data.text.trim().length;
            const pageCount = data.numpages;

            // Heuristic: Less than 50 chars per page usually means scanned or empty
            const charsPerPage = textLength / (pageCount || 1);
            const isScanned = charsPerPage < 50;

            return {
                isScanned,
                textLength,
                pageCount,
                charsPerPage
            };
        } catch (e) {
            log.warn({ event: 'extractor_scan_check_failed', reason: e.message }, 'Failed to check if PDF is scanned');
            // Assume scanned if we can't parse text
            return { isScanned: true, error: e.message };
        }
    }

    /**
     * Clean OCR output string
     */
    cleanOCROutput(text) {
        if (!text) return '';
        // Remove common hallucinated patterns from some vision models
        return text
            .replace(/^Here is the text extracted from the image:/i, '')
            .replace(/^Analysis of the image:/i, '')
            .trim();
    }
}

module.exports = DocumentExtractor;
