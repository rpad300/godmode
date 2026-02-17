/**
 * Purpose:
 *   Git-inspired content versioning for individual knowledge-base items.
 *   Each version is content-addressed (SHA-256) and stored as a separate
 *   JSON file, enabling diff, restore, and history browsing.
 *
 * Responsibilities:
 *   - Create immutable version snapshots of any serializable content
 *   - Skip duplicate versions when content hash is unchanged
 *   - Maintain a per-item version chain via parent pointers
 *   - Compare two versions with a field-level diff
 *   - Restore content from any historical version
 *   - Enforce a configurable maximum version count per item (default 50)
 *   - Persist/load a version-index.json manifest to disk
 *
 * Key dependencies:
 *   - crypto: SHA-256 hashing for content-addressing (truncated to 12 hex chars)
 *   - fs / path: per-version JSON files and the index manifest
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - createVersion() writes a JSON file per version under <dataDir>/versions/
 *   - Trimming old versions deletes their files from disk
 *   - load() / saveIndex() read/write version-index.json
 *
 * Notes:
 *   - The compare algorithm is shallow: it JSON-stringifies each top-level
 *     field and reports changed fields. Nested diffs are not provided.
 *   - restoreVersion() returns the content but does NOT write it back to the
 *     storage backend -- the caller is responsible for that.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../logger');

const log = logger.child({ module: 'data-versioning' });

/**
 * Content-addressable version store for knowledge-base items.
 *
 * Invariants:
 *   - versionIndex maps itemId -> array of version metadata, newest first
 *   - Each version file on disk contains the full content snapshot (not a delta)
 *   - versions.length <= maxVersions for every item (excess trimmed on create)
 *
 * Lifecycle: construct (auto-loads index) -> createVersion / getVersion / compareVersions
 */
class DataVersioning {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './data';
        this.versionsDir = path.join(this.dataDir, 'versions');
        this.maxVersions = options.maxVersions || 50; // Keep last 50 versions per item
        this.versionIndex = new Map(); // itemId -> versions[]
        this.indexFile = path.join(this.versionsDir, 'version-index.json');
        this.load();
    }

    setDataDir(dataDir) {
        this.dataDir = dataDir;
        this.versionsDir = path.join(this.dataDir, 'versions');
        this.indexFile = path.join(this.versionsDir, 'version-index.json');
        this.load();
    }

    load() {
        try {
            if (!fs.existsSync(this.versionsDir)) {
                fs.mkdirSync(this.versionsDir, { recursive: true });
            }
            if (fs.existsSync(this.indexFile)) {
                const data = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
                this.versionIndex = new Map(Object.entries(data || {}));
            } else {
                this.versionIndex = new Map();
            }
        } catch (e) {
            this.versionIndex = new Map();
        }
    }

    saveIndex() {
        try {
            if (!fs.existsSync(this.versionsDir)) {
                fs.mkdirSync(this.versionsDir, { recursive: true });
            }
            const data = Object.fromEntries(this.versionIndex);
            fs.writeFileSync(this.indexFile, JSON.stringify(data, null, 2));
        } catch (e) {
            log.warn({ event: 'versioning_save_index_warning', reason: e.message }, 'Save index warning');
        }
    }

    /**
     * Create a hash for content
     */
    hashContent(content) {
        const str = typeof content === 'string' ? content : JSON.stringify(content);
        return crypto.createHash('sha256').update(str).digest('hex').substring(0, 12);
    }

    /**
     * Snapshot the current content of an item as a new version.
     * Skips if the content hash matches the most recent version.
     *
     * @param {string} itemId - Unique identifier of the versioned item
     * @param {string} itemType - Category label (e.g. 'fact', 'decision')
     * @param {*} content - JSON-serializable content to snapshot
     * @param {Object} [options]
     * @param {string} [options.createdBy='system']
     * @param {string} [options.message='Auto-saved version']
     * @returns {{ success?: boolean, version?: Object, skipped?: boolean, error?: string }}
     */
    createVersion(itemId, itemType, content, options = {}) {
        const hash = this.hashContent(content);
        const versionId = `v_${Date.now()}_${hash}`;
        
        const version = {
            id: versionId,
            itemId,
            itemType,
            hash,
            createdAt: new Date().toISOString(),
            createdBy: options.createdBy || 'system',
            message: options.message || 'Auto-saved version',
            size: JSON.stringify(content).length,
            parent: null
        };

        // Get existing versions
        const versions = this.versionIndex.get(itemId) || [];
        
        // Check if content changed (skip if same hash)
        if (versions.length > 0 && versions[0].hash === hash) {
            return { skipped: true, reason: 'No changes detected', existingVersion: versions[0].id };
        }

        // Set parent
        if (versions.length > 0) {
            version.parent = versions[0].id;
        }

        // Save version content
        const versionFile = path.join(this.versionsDir, `${versionId}.json`);
        try {
            fs.writeFileSync(versionFile, JSON.stringify({
                ...version,
                content
            }, null, 2));
        } catch (e) {
            return { error: e.message };
        }

        // Update index
        versions.unshift(version);
        
        // Trim old versions
        while (versions.length > this.maxVersions) {
            const old = versions.pop();
            try {
                const oldFile = path.join(this.versionsDir, `${old.id}.json`);
                if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
            } catch (e) {}
        }

        this.versionIndex.set(itemId, versions);
        this.saveIndex();

        log.debug({ event: 'versioning_created', versionId, itemType, itemId }, 'Created version');
        return { success: true, version };
    }

    /**
     * Get all versions of an item
     */
    getVersions(itemId) {
        return this.versionIndex.get(itemId) || [];
    }

    /**
     * Get a specific version's content
     */
    getVersion(versionId) {
        const versionFile = path.join(this.versionsDir, `${versionId}.json`);
        try {
            if (fs.existsSync(versionFile)) {
                return JSON.parse(fs.readFileSync(versionFile, 'utf8'));
            }
        } catch (e) {}
        return null;
    }

    /**
     * Produce a shallow field-level diff between two version snapshots.
     *
     * @param {string} versionId1 - "before" version
     * @param {string} versionId2 - "after" version
     * @returns {{ v1: Object, v2: Object, changes: Array<{ field, before, after }> }|{ error: string }}
     */
    compareVersions(versionId1, versionId2) {
        const v1 = this.getVersion(versionId1);
        const v2 = this.getVersion(versionId2);

        if (!v1 || !v2) {
            return { error: 'Version not found' };
        }

        const diff = {
            v1: { id: versionId1, createdAt: v1.createdAt },
            v2: { id: versionId2, createdAt: v2.createdAt },
            changes: []
        };

        // Simple diff for objects
        const c1 = v1.content;
        const c2 = v2.content;

        if (typeof c1 === 'object' && typeof c2 === 'object') {
            const allKeys = new Set([...Object.keys(c1 || {}), ...Object.keys(c2 || {})]);
            for (const key of allKeys) {
                const val1 = JSON.stringify(c1?.[key]);
                const val2 = JSON.stringify(c2?.[key]);
                if (val1 !== val2) {
                    diff.changes.push({
                        field: key,
                        before: c1?.[key],
                        after: c2?.[key]
                    });
                }
            }
        }

        return diff;
    }

    /**
     * Retrieve the content of a specific version for restoration.
     * The caller is responsible for writing the content back to storage.
     *
     * @param {string} versionId
     * @returns {{ success: boolean, content: *, itemId: string, itemType: string }|{ error: string }}
     */
    restoreVersion(versionId) {
        const version = this.getVersion(versionId);
        if (!version) {
            return { error: 'Version not found' };
        }

        return {
            success: true,
            itemId: version.itemId,
            itemType: version.itemType,
            content: version.content,
            restoredFrom: versionId
        };
    }

    /**
     * Get version history stats
     */
    getStats() {
        let totalVersions = 0;
        let totalSize = 0;
        const byType = {};

        for (const [itemId, versions] of this.versionIndex) {
            totalVersions += versions.length;
            for (const v of versions) {
                totalSize += v.size || 0;
                byType[v.itemType] = (byType[v.itemType] || 0) + 1;
            }
        }

        return {
            totalItems: this.versionIndex.size,
            totalVersions,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            byType
        };
    }

    /**
     * Trim all items to at most `keepLast` versions, deleting older files from disk.
     *
     * @param {number} [keepLast=10] - Maximum versions to retain per item
     * @returns {{ cleaned: number }} Count of version files deleted
     */
    cleanup(keepLast = 10) {
        let cleaned = 0;
        for (const [itemId, versions] of this.versionIndex) {
            while (versions.length > keepLast) {
                const old = versions.pop();
                try {
                    const oldFile = path.join(this.versionsDir, `${old.id}.json`);
                    if (fs.existsSync(oldFile)) {
                        fs.unlinkSync(oldFile);
                        cleaned++;
                    }
                } catch (e) {}
            }
            this.versionIndex.set(itemId, versions);
        }
        this.saveIndex();
        return { cleaned };
    }
}

// Singleton
let instance = null;
function getDataVersioning(options = {}) {
    if (!instance) {
        instance = new DataVersioning(options);
    }
    if (options.dataDir) instance.setDataDir(options.dataDir);
    return instance;
}

module.exports = { DataVersioning, getDataVersioning };
