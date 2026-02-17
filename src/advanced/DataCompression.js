/**
 * Purpose:
 *   Provide gzip-based compression for in-memory data, embedding vectors,
 *   and on-disk JSON files to reduce storage and transfer sizes.
 *
 * Responsibilities:
 *   - Compress / decompress arbitrary data (string or JSON-serializable)
 *   - Compress / decompress arrays of embedding objects, replacing the
 *     raw float arrays with gzip+base64 representations
 *   - Compress / decompress individual files and entire directories of
 *     JSON files
 *   - Track cumulative compression statistics
 *
 * Key dependencies:
 *   - zlib (Node built-in): gzip/gunzip operations (synchronous variants)
 *   - fs / path: file and directory I/O for compressFile / compressDirectory
 *
 * Side effects:
 *   - compressFile / decompressFile / compressDirectory write to the filesystem
 *   - compressDirectory with deleteOriginal=true removes source .json files
 *
 * Notes:
 *   - All compression uses zlib.gzipSync; output is base64-encoded for safe
 *     embedding in JSON payloads (encoding tag: 'gzip+base64').
 *   - Data smaller than minSizeToCompress (default 1 KB) is returned as-is
 *     to avoid overhead on tiny payloads.
 *   - Compression is skipped when the compressed output is not smaller than
 *     the original.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Stateful gzip compressor with configurable level and minimum-size threshold.
 *
 * All public methods are synchronous except where noted. Compression level
 * defaults to 6 (zlib's default), balancing speed and ratio.
 */
class DataCompression {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.compressionLevel = options.compressionLevel || 6; // 1-9
        this.minSizeToCompress = options.minSizeToCompress || 1024; // 1KB
        this.stats = {
            totalCompressed: 0,
            totalOriginalSize: 0,
            totalCompressedSize: 0
        };
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
    }

    /**
     * Compress a value using gzip and return a descriptor object.
     * Returns uncompressed if the input is below minSizeToCompress or if
     * compression does not reduce size.
     *
     * @param {string|Object|Array} data - String or JSON-serializable value
     * @returns {Object} Descriptor with `compressed` flag, `data` (base64 if
     *   compressed, raw string otherwise), sizes, and ratio.
     */
    compress(data) {
        const input = typeof data === 'string' ? data : JSON.stringify(data);
        const originalSize = Buffer.byteLength(input);

        if (originalSize < this.minSizeToCompress) {
            return {
                compressed: false,
                data: input,
                originalSize,
                reason: 'Below minimum size'
            };
        }

        try {
            const compressed = zlib.gzipSync(input, { level: this.compressionLevel });
            const compressedSize = compressed.length;
            const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

            // Only use compressed if actually smaller
            if (compressedSize >= originalSize) {
                return {
                    compressed: false,
                    data: input,
                    originalSize,
                    reason: 'Compression not beneficial'
                };
            }

            this.stats.totalCompressed++;
            this.stats.totalOriginalSize += originalSize;
            this.stats.totalCompressedSize += compressedSize;

            return {
                compressed: true,
                data: compressed.toString('base64'),
                originalSize,
                compressedSize,
                ratio: `${ratio}%`,
                encoding: 'gzip+base64'
            };
        } catch (e) {
            return {
                compressed: false,
                data: input,
                originalSize,
                error: e.message
            };
        }
    }

    /**
     * Decompress a previously compressed payload.
     *
     * @param {string} compressedData - Base64-encoded gzip data
     * @param {string} [encoding='gzip+base64'] - Must match the encoding used at compression
     * @returns {{ success: boolean, data?: string, error?: string }}
     */
    decompress(compressedData, encoding = 'gzip+base64') {
        try {
            if (encoding === 'gzip+base64') {
                const buffer = Buffer.from(compressedData, 'base64');
                const decompressed = zlib.gunzipSync(buffer);
                return {
                    success: true,
                    data: decompressed.toString('utf8')
                };
            }
            return { success: false, error: 'Unknown encoding' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Compress embedding vectors in-place within an array of embedding objects.
     * Each object with an `embedding` array larger than 512 bytes gets its vector
     * replaced with `embeddingCompressed` / `embeddingEncoding` fields.
     *
     * @param {Object[]} embeddings - Array of objects, each optionally containing
     *   an `embedding` float array
     * @returns {Object} Summary with counts, sizes, ratio, and the transformed array
     */
    compressEmbeddings(embeddings) {
        if (!Array.isArray(embeddings) || embeddings.length === 0) {
            return { compressed: false, data: embeddings };
        }

        const results = {
            totalEmbeddings: embeddings.length,
            compressed: 0,
            originalSize: 0,
            compressedSize: 0,
            embeddings: []
        };

        for (const emb of embeddings) {
            if (emb.embedding && Array.isArray(emb.embedding)) {
                // Compress the embedding vector
                const embStr = JSON.stringify(emb.embedding);
                const originalSize = Buffer.byteLength(embStr);
                results.originalSize += originalSize;

                if (originalSize > 512) { // Only compress if > 512 bytes
                    const compressed = this.compress(emb.embedding);
                    if (compressed.compressed) {
                        results.embeddings.push({
                            ...emb,
                            embedding: null,
                            embeddingCompressed: compressed.data,
                            embeddingEncoding: compressed.encoding
                        });
                        results.compressedSize += compressed.compressedSize;
                        results.compressed++;
                        continue;
                    }
                }
                results.compressedSize += originalSize;
            }
            results.embeddings.push(emb);
        }

        results.ratio = results.originalSize > 0
            ? `${((1 - results.compressedSize / results.originalSize) * 100).toFixed(1)}%`
            : '0%';

        return results;
    }

    /**
     * Restore compressed embedding vectors back to their original float arrays.
     * Inverse of compressEmbeddings().
     *
     * @param {Object[]} embeddings - Array potentially containing compressed entries
     * @returns {Object[]} Array with embedding vectors restored
     */
    decompressEmbeddings(embeddings) {
        if (!Array.isArray(embeddings)) return embeddings;

        return embeddings.map(emb => {
            if (emb.embeddingCompressed && emb.embeddingEncoding) {
                const result = this.decompress(emb.embeddingCompressed, emb.embeddingEncoding);
                if (result.success) {
                    const decompressed = { ...emb };
                    decompressed.embedding = JSON.parse(result.data);
                    delete decompressed.embeddingCompressed;
                    delete decompressed.embeddingEncoding;
                    return decompressed;
                }
            }
            return emb;
        });
    }

    /**
     * Gzip a file on disk. Defaults to writing alongside the original with a .gz suffix.
     *
     * @param {string} inputPath - Absolute path to the source file
     * @param {string|null} [outputPath] - Destination; defaults to inputPath + '.gz'
     * @returns {{ success: boolean, ratio?: string, error?: string }}
     */
    compressFile(inputPath, outputPath = null) {
        if (!fs.existsSync(inputPath)) {
            return { success: false, error: 'File not found' };
        }

        const outPath = outputPath || `${inputPath}.gz`;
        
        try {
            const input = fs.readFileSync(inputPath);
            const originalSize = input.length;
            
            const compressed = zlib.gzipSync(input, { level: this.compressionLevel });
            fs.writeFileSync(outPath, compressed);
            
            const compressedSize = compressed.length;
            const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

            return {
                success: true,
                inputFile: inputPath,
                outputFile: outPath,
                originalSize,
                compressedSize,
                ratio: `${ratio}%`
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Decompress a file
     */
    decompressFile(inputPath, outputPath = null) {
        if (!fs.existsSync(inputPath)) {
            return { success: false, error: 'File not found' };
        }

        const outPath = outputPath || inputPath.replace(/\.gz$/, '');
        
        try {
            const input = fs.readFileSync(inputPath);
            const decompressed = zlib.gunzipSync(input);
            fs.writeFileSync(outPath, decompressed);
            
            return {
                success: true,
                inputFile: inputPath,
                outputFile: outPath,
                compressedSize: input.length,
                decompressedSize: decompressed.length
            };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Compress every .json file in a directory (non-recursive).
     * Files already ending in .gz and files below minSizeToCompress are skipped.
     *
     * @param {string} dirPath
     * @param {Object} [options]
     * @param {boolean} [options.deleteOriginal=false] - Remove source .json after compression
     * @returns {Object} Aggregate stats: files seen, compressed, skipped, sizes, ratio
     */
    compressDirectory(dirPath, options = {}) {
        const results = {
            files: 0,
            compressed: 0,
            skipped: 0,
            totalOriginalSize: 0,
            totalCompressedSize: 0,
            errors: []
        };

        if (!fs.existsSync(dirPath)) {
            return { ...results, error: 'Directory not found' };
        }

        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            if (!file.endsWith('.json') || file.endsWith('.gz')) continue;
            
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            
            if (!stat.isFile()) continue;
            results.files++;
            results.totalOriginalSize += stat.size;

            if (stat.size < this.minSizeToCompress) {
                results.skipped++;
                results.totalCompressedSize += stat.size;
                continue;
            }

            const result = this.compressFile(filePath);
            if (result.success) {
                results.compressed++;
                results.totalCompressedSize += result.compressedSize;
                
                // Optionally delete original
                if (options.deleteOriginal) {
                    fs.unlinkSync(filePath);
                }
            } else {
                results.errors.push({ file, error: result.error });
                results.totalCompressedSize += stat.size;
            }
        }

        results.ratio = results.totalOriginalSize > 0
            ? `${((1 - results.totalCompressedSize / results.totalOriginalSize) * 100).toFixed(1)}%`
            : '0%';

        return results;
    }

    /**
     * Get compression stats
     */
    getStats() {
        return {
            ...this.stats,
            ratio: this.stats.totalOriginalSize > 0
                ? `${((1 - this.stats.totalCompressedSize / this.stats.totalOriginalSize) * 100).toFixed(1)}%`
                : '0%',
            savedBytes: this.stats.totalOriginalSize - this.stats.totalCompressedSize,
            savedMB: ((this.stats.totalOriginalSize - this.stats.totalCompressedSize) / (1024 * 1024)).toFixed(2)
        };
    }

    /**
     * Trial-compress data to estimate the achievable ratio without persisting.
     *
     * @param {*} data - Value to test
     * @returns {{ wouldCompress: boolean, estimatedRatio: string, originalSize: number, estimatedSize: number }}
     */
    estimateRatio(data) {
        const sample = this.compress(data);
        return {
            wouldCompress: sample.compressed,
            estimatedRatio: sample.ratio || '0%',
            originalSize: sample.originalSize,
            estimatedSize: sample.compressedSize || sample.originalSize
        };
    }
}

// Singleton
let instance = null;
function getDataCompression(options = {}) {
    if (!instance) {
        instance = new DataCompression(options);
    }
    if (options.dataDir) instance.setDataDir(options.dataDir);
    return instance;
}

module.exports = { DataCompression, getDataCompression };
