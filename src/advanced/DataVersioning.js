/**
 * Data Versioning Module
 * Git-like versioning for documents and data
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
            console.log(`[Versioning] Save index warning: ${e.message}`);
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
     * Create a new version
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

        console.log(`[Versioning] Created version ${versionId} for ${itemType} ${itemId}`);
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
     * Compare two versions
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
     * Restore to a specific version
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
     * Cleanup old versions
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
