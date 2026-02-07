/**
 * Data Compression Module
 * Compress embeddings and large data for storage efficiency
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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
     * Compress data
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
     * Decompress data
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
     * Compress embeddings array
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
     * Decompress embeddings array
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
     * Compress a file
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
     * Compress all JSON files in a directory
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
     * Estimate compression ratio for data
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
