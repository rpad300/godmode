/**
 * OntologyManager - Manages the GodMode knowledge graph ontology
 * 
 * Responsibilities:
 * - Load and parse ontology schema (from Supabase or file)
 * - Validate entities and relationships against schema
 * - Provide entity type information
 * - Generate embedding templates
 * - Support query pattern matching
 * - Persist schema to Supabase (SOTA v2.0)
 */

const fs = require('fs');
const path = require('path');

class OntologyManager {
    constructor(options = {}) {
        this.schemaPath = options.schemaPath || path.join(__dirname, 'schema.json');
        this.schema = null;
        this.entityTypes = {};
        this.relationTypes = {};
        this.queryPatterns = {};
        this.inferenceRules = [];
        this.loaded = false;
        
        // Strict mode: throw errors for invalid types (v1.6)
        this.strictMode = options.strictMode || false;
        
        // Supabase storage for persistence (SOTA v2.0)
        this.storage = options.storage || null;
        this.projectId = options.projectId || null;
        this.useSupabase = options.useSupabase !== false && this.storage !== null;
        
        // Source tracking
        this.loadedFrom = null; // 'supabase' or 'file'
    }

    /**
     * Set the storage backend for Supabase persistence
     * @param {object} storage - SupabaseStorage instance
     */
    setStorage(storage) {
        this.storage = storage;
        this.useSupabase = storage !== null;
    }

    /**
     * Set project ID for project-specific schemas
     * @param {string|null} projectId 
     */
    setProjectId(projectId) {
        this.projectId = projectId;
    }

    /**
     * Load the ontology schema - Supabase first, then file fallback
     * @returns {Promise<boolean>}
     */
    async load() {
        // Try Supabase first if enabled
        if (this.useSupabase && this.storage) {
            try {
                const supabaseSchema = await this.storage.buildSchemaFromSupabase(this.projectId);
                if (supabaseSchema && Object.keys(supabaseSchema.entityTypes || {}).length > 0) {
                    this._applySchema(supabaseSchema);
                    this.loadedFrom = 'supabase';
                    console.log(`[Ontology] Loaded from Supabase v${this.schema.version}: ${Object.keys(this.entityTypes).length} entities, ${Object.keys(this.relationTypes).length} relations`);
                    return true;
                }
                console.log('[Ontology] No schema in Supabase, falling back to file');
            } catch (e) {
                console.log('[Ontology] Supabase load failed, falling back to file:', e.message);
            }
        }
        
        // Fallback to file
        return this._loadFromFile();
    }

    /**
     * Load schema from local file
     * @private
     * @returns {Promise<boolean>}
     */
    async _loadFromFile() {
        try {
            const schemaContent = fs.readFileSync(this.schemaPath, 'utf-8');
            const schema = JSON.parse(schemaContent);
            this._applySchema(schema);
            this.loadedFrom = 'file';
            console.log(`[Ontology] Loaded from file v${this.schema.version}: ${Object.keys(this.entityTypes).length} entity types, ${Object.keys(this.relationTypes).length} relation types`);
            return true;
        } catch (error) {
            console.error('[Ontology] Failed to load schema from file:', error.message);
            return false;
        }
    }

    /**
     * Apply schema object to internal state
     * @private
     * @param {object} schema 
     */
    _applySchema(schema) {
        this.schema = schema;
        this.entityTypes = schema.entityTypes || {};
        this.relationTypes = schema.relationTypes || {};
        this.queryPatterns = schema.queryPatterns || {};
        this.inferenceRules = schema.inferenceRules || [];
        this.loaded = true;
    }

    /**
     * Save schema to file (backup)
     * @private
     * @returns {Promise<boolean>}
     */
    async _saveToFile() {
        try {
            fs.writeFileSync(this.schemaPath, JSON.stringify(this.schema, null, 2));
            return true;
        } catch (error) {
            console.error('[Ontology] Failed to save schema to file:', error.message);
            return false;
        }
    }

    /**
     * Save current schema to Supabase and file
     * @param {string|null} userId - User making the change
     * @returns {Promise<boolean>}
     */
    async save(userId = null) {
        if (!this.schema) {
            console.error('[Ontology] No schema to save');
            return false;
        }

        let savedToSupabase = false;
        let savedToFile = false;

        // Save to Supabase if enabled
        if (this.useSupabase && this.storage) {
            try {
                await this.storage.saveOntologySchema(this.schema, this.projectId, userId);
                savedToSupabase = true;
                console.log('[Ontology] Saved to Supabase');
            } catch (e) {
                console.error('[Ontology] Failed to save to Supabase:', e.message);
            }
        }

        // Always save to file as backup
        savedToFile = await this._saveToFile();
        if (savedToFile) {
            console.log('[Ontology] Saved to file (backup)');
        }

        return savedToSupabase || savedToFile;
    }

    /**
     * Migrate existing schema.json to Supabase
     * @param {string|null} userId - User performing migration
     * @returns {Promise<{success: boolean, counts?: object, error?: string}>}
     */
    async migrateToSupabase(userId = null) {
        if (!this.storage) {
            return { success: false, error: 'No storage configured' };
        }

        // Load from file first
        const loaded = await this._loadFromFile();
        if (!loaded || !this.schema) {
            return { success: false, error: 'No schema to migrate' };
        }

        try {
            const result = await this.storage.saveOntologySchema(this.schema, this.projectId, userId);
            
            // Log the change
            await this.storage.logOntologyChange({
                projectId: this.projectId,
                changeType: 'schema_import',
                targetType: 'schema',
                targetName: 'full_schema',
                newDefinition: {
                    version: this.schema.version,
                    entityCount: Object.keys(this.entityTypes).length,
                    relationCount: Object.keys(this.relationTypes).length,
                    patternCount: Object.keys(this.queryPatterns).length,
                    ruleCount: this.inferenceRules.length
                },
                reason: 'Initial migration from schema.json to Supabase',
                source: 'migration',
                changedBy: userId
            });

            console.log(`[Ontology] Migrated to Supabase: ${result.counts.total} items`);
            return { success: true, counts: result.counts };
        } catch (e) {
            console.error('[Ontology] Migration failed:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * Check if Supabase schema is up-to-date with file
     * @returns {Promise<{synced: boolean, fileVersion: string, dbVersion: string|null}>}
     */
    async checkSyncStatus() {
        // Get file version
        let fileVersion = null;
        try {
            const schemaContent = fs.readFileSync(this.schemaPath, 'utf-8');
            const fileSchema = JSON.parse(schemaContent);
            fileVersion = fileSchema.version;
        } catch (e) {
            // File doesn't exist or is invalid
        }

        // Get Supabase version
        let dbVersion = null;
        if (this.storage) {
            dbVersion = await this.storage.getOntologySchemaVersion(this.projectId);
        }

        return {
            synced: fileVersion === dbVersion,
            fileVersion,
            dbVersion
        };
    }

    /**
     * Get the source from which the schema was loaded
     * @returns {string|null} 'supabase', 'file', or null
     */
    getLoadedFrom() {
        return this.loadedFrom;
    }

    /**
     * Ensure ontology is loaded
     */
    ensureLoaded() {
        if (!this.loaded) {
            this.load();
        }
    }

    /**
     * Set strict mode on/off (v1.6)
     * When enabled, throws errors for invalid entity/relation types
     * @param {boolean} enabled 
     */
    setStrictMode(enabled) {
        this.strictMode = !!enabled;
        console.log(`[Ontology] Strict mode ${this.strictMode ? 'enabled' : 'disabled'}`);
    }

    /**
     * Check if strict mode is enabled
     * @returns {boolean}
     */
    isStrictMode() {
        return this.strictMode;
    }

    // ==================== Schema Access Methods ====================

    /**
     * Get the full schema object
     * @returns {object|null}
     */
    getSchema() {
        this.ensureLoaded();
        if (!this.schema) return null;
        
        return {
            version: this.schema.version,
            entityTypes: this.entityTypes,
            relationTypes: this.relationTypes,
            // Also include legacy names for backwards compatibility
            entities: this.entityTypes,
            relations: this.relationTypes,
            queryPatterns: this.queryPatterns,
            inferenceRules: this.inferenceRules
        };
    }

    /**
     * Update the ontology schema and save to Supabase/file
     * @param {object} newSchema - Updated schema
     * @param {string|null} userId - User making the change
     * @param {string|null} reason - Reason for change
     * @returns {Promise<boolean>}
     */
    async updateSchema(newSchema, userId = null, reason = null) {
        try {
            const oldVersion = this.schema?.version || '1.0';
            
            // Merge with existing schema
            const updatedSchema = {
                ...this.schema,
                version: (parseFloat(oldVersion) + 0.1).toFixed(1),
                lastUpdated: new Date().toISOString(),
                entityTypes: newSchema.entities || this.entityTypes,
                relationTypes: newSchema.relations || this.relationTypes,
                queryPatterns: newSchema.queryPatterns || this.queryPatterns,
                inferenceRules: newSchema.inferenceRules || this.inferenceRules
            };

            // Apply schema
            this._applySchema(updatedSchema);

            // Save to Supabase and file
            await this.save(userId);

            // Log the change
            if (this.storage) {
                await this.storage.logOntologyChange({
                    projectId: this.projectId,
                    changeType: 'version_bump',
                    targetType: 'schema',
                    targetName: 'full_schema',
                    oldDefinition: { version: oldVersion },
                    newDefinition: { version: updatedSchema.version },
                    reason: reason || 'Schema update',
                    source: 'api',
                    changedBy: userId
                });
            }

            console.log(`[Ontology] Schema updated to v${updatedSchema.version}`);
            return true;
        } catch (error) {
            console.error('[Ontology] Failed to update schema:', error.message);
            return false;
        }
    }

    /**
     * Add a new entity type dynamically
     * @param {string} name - Entity type name
     * @param {object} definition - Entity definition
     * @param {string|null} userId - User making the change
     * @param {string|null} reason - Reason for addition
     * @returns {Promise<boolean>}
     */
    async addEntityType(name, definition, userId = null, reason = null) {
        this.ensureLoaded();
        
        const oldDef = this.entityTypes[name];
        this.entityTypes[name] = definition;
        
        const success = await this.updateSchema({ entities: this.entityTypes }, userId, reason);
        
        // Log specific change
        if (success && this.storage) {
            await this.storage.logOntologyChange({
                projectId: this.projectId,
                changeType: oldDef ? 'entity_modified' : 'entity_added',
                targetType: 'entity',
                targetName: name,
                oldDefinition: oldDef || null,
                newDefinition: definition,
                reason: reason || `Added entity type: ${name}`,
                source: 'api',
                changedBy: userId
            });
        }
        
        return success;
    }

    /**
     * Add a new relation type dynamically
     * @param {string} name - Relation type name
     * @param {object} definition - Relation definition
     * @param {string|null} userId - User making the change
     * @param {string|null} reason - Reason for addition
     * @returns {Promise<boolean>}
     */
    async addRelationType(name, definition, userId = null, reason = null) {
        this.ensureLoaded();
        
        const oldDef = this.relationTypes[name];
        this.relationTypes[name] = definition;
        
        const success = await this.updateSchema({ relations: this.relationTypes }, userId, reason);
        
        // Log specific change
        if (success && this.storage) {
            await this.storage.logOntologyChange({
                projectId: this.projectId,
                changeType: oldDef ? 'relation_modified' : 'relation_added',
                targetType: 'relation',
                targetName: name,
                oldDefinition: oldDef || null,
                newDefinition: definition,
                reason: reason || `Added relation type: ${name}`,
                source: 'api',
                changedBy: userId
            });
        }
        
        return success;
    }

    /**
     * Remove an entity type
     * @param {string} name - Entity type name to remove
     * @param {string|null} userId - User making the change
     * @param {string|null} reason - Reason for removal
     * @returns {Promise<boolean>}
     */
    async removeEntityType(name, userId = null, reason = null) {
        this.ensureLoaded();
        
        if (!this.entityTypes[name]) {
            return false;
        }
        
        const oldDef = this.entityTypes[name];
        delete this.entityTypes[name];
        
        const success = await this.updateSchema({ entities: this.entityTypes }, userId, reason);
        
        // Log the removal
        if (success && this.storage) {
            await this.storage.logOntologyChange({
                projectId: this.projectId,
                changeType: 'entity_removed',
                targetType: 'entity',
                targetName: name,
                oldDefinition: oldDef,
                newDefinition: null,
                reason: reason || `Removed entity type: ${name}`,
                source: 'api',
                changedBy: userId
            });
        }
        
        return success;
    }

    /**
     * Remove a relation type
     * @param {string} name - Relation type name to remove
     * @param {string|null} userId - User making the change
     * @param {string|null} reason - Reason for removal
     * @returns {Promise<boolean>}
     */
    async removeRelationType(name, userId = null, reason = null) {
        this.ensureLoaded();
        
        if (!this.relationTypes[name]) {
            return false;
        }
        
        const oldDef = this.relationTypes[name];
        delete this.relationTypes[name];
        
        const success = await this.updateSchema({ relations: this.relationTypes }, userId, reason);
        
        // Log the removal
        if (success && this.storage) {
            await this.storage.logOntologyChange({
                projectId: this.projectId,
                changeType: 'relation_removed',
                targetType: 'relation',
                targetName: name,
                oldDefinition: oldDef,
                newDefinition: null,
                reason: reason || `Removed relation type: ${name}`,
                source: 'api',
                changedBy: userId
            });
        }
        
        return success;
    }

    // ==================== Entity Type Methods ====================

    /**
     * Get all entity type names
     * @returns {string[]}
     */
    getEntityTypes() {
        this.ensureLoaded();
        return Object.keys(this.entityTypes);
    }

    /**
     * Check if an entity type is shared across projects
     * @param {string} typeName 
     * @returns {boolean}
     */
    isSharedEntity(typeName) {
        this.ensureLoaded();
        const entityType = this.entityTypes[typeName];
        return entityType?.sharedEntity === true;
    }

    /**
     * Get all shared entity types (stored in global graph)
     * @returns {string[]}
     */
    getSharedEntityTypes() {
        this.ensureLoaded();
        return Object.entries(this.entityTypes)
            .filter(([_, def]) => def.sharedEntity === true)
            .map(([name]) => name);
    }

    /**
     * Get all project-specific entity types (stored in project graphs)
     * @returns {string[]}
     */
    getProjectEntityTypes() {
        this.ensureLoaded();
        return Object.entries(this.entityTypes)
            .filter(([_, def]) => def.sharedEntity !== true)
            .map(([name]) => name);
    }

    /**
     * Get cross-graph relation types
     * @returns {string[]}
     */
    getCrossGraphRelationTypes() {
        this.ensureLoaded();
        return Object.entries(this.relationTypes)
            .filter(([_, def]) => def.crossGraph === true)
            .map(([name]) => name);
    }

    /**
     * Get cross-project query patterns
     * @returns {object}
     */
    getCrossProjectPatterns() {
        this.ensureLoaded();
        return Object.entries(this.queryPatterns)
            .filter(([_, pattern]) => pattern.crossProject === true)
            .reduce((acc, [name, pattern]) => {
                acc[name] = pattern;
                return acc;
            }, {});
    }

    /**
     * Get entity type definition
     * @param {string} typeName 
     * @returns {object|null}
     */
    getEntityType(typeName) {
        this.ensureLoaded();
        return this.entityTypes[typeName] || null;
    }

    /**
     * Check if entity type exists
     * @param {string} typeName 
     * @returns {boolean}
     */
    hasEntityType(typeName) {
        this.ensureLoaded();
        return typeName in this.entityTypes;
    }

    /**
     * Get properties definition for an entity type
     * @param {string} typeName 
     * @returns {object}
     */
    getEntityProperties(typeName) {
        const entityType = this.getEntityType(typeName);
        return entityType?.properties || {};
    }

    /**
     * Get searchable properties for an entity type
     * @param {string} typeName 
     * @returns {string[]}
     */
    getSearchableProperties(typeName) {
        const properties = this.getEntityProperties(typeName);
        return Object.entries(properties)
            .filter(([_, prop]) => prop.searchable)
            .map(([name, _]) => name);
    }

    /**
     * Get required properties for an entity type
     * @param {string} typeName 
     * @returns {string[]}
     */
    getRequiredProperties(typeName) {
        const properties = this.getEntityProperties(typeName);
        return Object.entries(properties)
            .filter(([_, prop]) => prop.required)
            .map(([name, _]) => name);
    }

    // ==================== Relation Type Methods ====================

    /**
     * Get all relation type names
     * @returns {string[]}
     */
    getRelationTypes() {
        this.ensureLoaded();
        return Object.keys(this.relationTypes);
    }

    /**
     * Get relation type definition
     * @param {string} typeName 
     * @returns {object|null}
     */
    getRelationType(typeName) {
        this.ensureLoaded();
        return this.relationTypes[typeName] || null;
    }

    /**
     * Check if relation is valid between two entity types
     * @param {string} relationName 
     * @param {string} fromType 
     * @param {string} toType 
     * @returns {boolean}
     */
    isValidRelation(relationName, fromType, toType) {
        const relation = this.getRelationType(relationName);
        if (!relation) return false;

        const fromValid = relation.fromTypes.includes('*') || relation.fromTypes.includes(fromType);
        const toValid = relation.toTypes.includes('*') || relation.toTypes.includes(toType);
        
        return fromValid && toValid;
    }

    /**
     * Get valid relations for a given entity type
     * @param {string} entityType 
     * @param {string} direction - 'outgoing', 'incoming', or 'both'
     * @returns {string[]}
     */
    getValidRelationsFor(entityType, direction = 'both') {
        this.ensureLoaded();
        const validRelations = [];
        
        for (const [name, relation] of Object.entries(this.relationTypes)) {
            const canBeFrom = relation.fromTypes.includes('*') || relation.fromTypes.includes(entityType);
            const canBeTo = relation.toTypes.includes('*') || relation.toTypes.includes(entityType);
            
            if (direction === 'outgoing' && canBeFrom) validRelations.push(name);
            else if (direction === 'incoming' && canBeTo) validRelations.push(name);
            else if (direction === 'both' && (canBeFrom || canBeTo)) validRelations.push(name);
        }
        
        return [...new Set(validRelations)];
    }

    /**
     * Get possible target types for a relation from a given source type
     * @param {string} relationName 
     * @param {string} fromType 
     * @returns {string[]}
     */
    getPossibleTargets(relationName, fromType) {
        const relation = this.getRelationType(relationName);
        if (!relation) return [];
        
        const fromValid = relation.fromTypes.includes('*') || relation.fromTypes.includes(fromType);
        if (!fromValid) return [];
        
        if (relation.toTypes.includes('*')) {
            return this.getEntityTypes();
        }
        return relation.toTypes;
    }

    // ==================== Validation Methods ====================

    /**
     * Validate an entity against its type schema
     * @param {string} typeName 
     * @param {object} entity 
     * @returns {{valid: boolean, errors: string[]}}
     */
    validateEntity(typeName, entity) {
        const errors = [];
        const entityType = this.getEntityType(typeName);
        
        if (!entityType) {
            const errorMsg = `Unknown entity type: ${typeName}`;
            
            // In strict mode, throw error to block processing
            if (this.strictMode) {
                throw new Error(`[Ontology] Strict mode violation: ${errorMsg}`);
            }
            
            return { valid: false, errors: [errorMsg] };
        }

        const properties = entityType.properties || {};
        
        // Check required properties
        for (const [propName, propDef] of Object.entries(properties)) {
            if (propDef.required && (entity[propName] === undefined || entity[propName] === null)) {
                errors.push(`Missing required property: ${propName}`);
            }
        }
        
        // Check property types
        for (const [propName, value] of Object.entries(entity)) {
            const propDef = properties[propName];
            if (!propDef) continue; // Allow extra properties
            
            if (value !== undefined && value !== null) {
                const typeError = this.validatePropertyType(propName, value, propDef);
                if (typeError) errors.push(typeError);
            }
        }
        
        return { valid: errors.length === 0, errors };
    }

    /**
     * Validate a single property value
     * @param {string} propName 
     * @param {*} value 
     * @param {object} propDef 
     * @returns {string|null}
     */
    validatePropertyType(propName, value, propDef) {
        const expectedType = propDef.type;
        
        switch (expectedType) {
            case 'string':
                if (typeof value !== 'string') {
                    return `Property ${propName} should be a string`;
                }
                if (propDef.enum && !propDef.enum.includes(value)) {
                    return `Property ${propName} must be one of: ${propDef.enum.join(', ')}`;
                }
                break;
            case 'number':
                if (typeof value !== 'number') {
                    return `Property ${propName} should be a number`;
                }
                if (propDef.minimum !== undefined && value < propDef.minimum) {
                    return `Property ${propName} must be >= ${propDef.minimum}`;
                }
                if (propDef.maximum !== undefined && value > propDef.maximum) {
                    return `Property ${propName} must be <= ${propDef.maximum}`;
                }
                break;
            case 'boolean':
                if (typeof value !== 'boolean') {
                    return `Property ${propName} should be a boolean`;
                }
                break;
            case 'array':
                if (!Array.isArray(value)) {
                    return `Property ${propName} should be an array`;
                }
                break;
        }
        
        return null;
    }

    /**
     * Validate a relationship
     * @param {string} relationName 
     * @param {string} fromType 
     * @param {string} toType 
     * @param {object} properties 
     * @returns {{valid: boolean, errors: string[]}}
     */
    validateRelation(relationName, fromType, toType, properties = {}) {
        const errors = [];
        const relation = this.getRelationType(relationName);
        
        if (!relation) {
            const errorMsg = `Unknown relation type: ${relationName}`;
            
            // In strict mode, throw error to block processing
            if (this.strictMode) {
                throw new Error(`[Ontology] Strict mode violation: ${errorMsg}`);
            }
            
            return { valid: false, errors: [errorMsg] };
        }
        
        if (!this.isValidRelation(relationName, fromType, toType)) {
            const errorMsg = `Relation ${relationName} is not valid from ${fromType} to ${toType}`;
            
            // In strict mode, throw error for invalid relation endpoints
            if (this.strictMode) {
                throw new Error(`[Ontology] Strict mode violation: ${errorMsg}`);
            }
            
            errors.push(errorMsg);
        }
        
        // Validate relation properties
        const relProps = relation.properties || {};
        for (const [propName, value] of Object.entries(properties)) {
            const propDef = relProps[propName];
            if (propDef && value !== undefined && value !== null) {
                const typeError = this.validatePropertyType(propName, value, propDef);
                if (typeError) errors.push(typeError);
            }
        }
        
        return { valid: errors.length === 0, errors };
    }

    // ==================== Embedding Methods ====================

    /**
     * Generate embedding text for an entity using the ontology template
     * @param {string} typeName 
     * @param {object} entity 
     * @returns {string}
     */
    generateEmbeddingText(typeName, entity) {
        const entityType = this.getEntityType(typeName);
        if (!entityType || !entityType.embeddingTemplate) {
            // Fallback: concatenate all searchable properties
            const searchable = this.getSearchableProperties(typeName);
            const parts = searchable
                .map(prop => entity[prop])
                .filter(v => v !== undefined && v !== null && v !== '')
                .map(v => Array.isArray(v) ? v.join(', ') : String(v));
            return `[${typeName}] ${parts.join('. ')}`;
        }
        
        // Replace template placeholders with entity values
        let text = entityType.embeddingTemplate;
        
        for (const [key, value] of Object.entries(entity)) {
            const placeholder = `{${key}}`;
            if (text.includes(placeholder)) {
                const displayValue = Array.isArray(value) ? value.join(', ') : (value ?? '');
                text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), displayValue);
            }
        }
        
        // Remove any remaining empty placeholders
        text = text.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
        
        return text;
    }

    /**
     * Generate embedding text for a relationship
     * @param {string} relationName 
     * @param {object} fromEntity 
     * @param {object} toEntity 
     * @param {object} properties 
     * @returns {string}
     */
    generateRelationEmbeddingText(relationName, fromEntity, toEntity, properties = {}) {
        const relation = this.getRelationType(relationName);
        if (!relation || !relation.embeddingTemplate) {
            return `${fromEntity.name || fromEntity.title || fromEntity.id} ${relationName} ${toEntity.name || toEntity.title || toEntity.id}`;
        }
        
        let text = relation.embeddingTemplate;
        
        // Replace from entity placeholders
        for (const [key, value] of Object.entries(fromEntity)) {
            text = text.replace(new RegExp(`\\{from\\.${key}\\}`, 'g'), value ?? '');
        }
        
        // Replace to entity placeholders
        for (const [key, value] of Object.entries(toEntity)) {
            text = text.replace(new RegExp(`\\{to\\.${key}\\}`, 'g'), value ?? '');
        }
        
        // Replace property placeholders
        for (const [key, value] of Object.entries(properties)) {
            text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value ?? '');
        }
        
        // Clean up
        text = text.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
        
        return text;
    }

    // ==================== Query Pattern Methods ====================

    /**
     * Get all query patterns
     * @returns {object}
     */
    getQueryPatterns() {
        this.ensureLoaded();
        return this.queryPatterns;
    }

    /**
     * Find matching query pattern for a user query
     * @param {string} userQuery 
     * @returns {{pattern: object, matches: object}|null}
     */
    matchQueryPattern(userQuery) {
        const normalizedQuery = userQuery.toLowerCase().trim();
        
        for (const [name, pattern] of Object.entries(this.queryPatterns)) {
            const regex = this.patternToRegex(pattern.pattern);
            const match = normalizedQuery.match(regex);
            
            if (match) {
                const matches = {};
                const placeholders = pattern.pattern.match(/\{(\w+)\}/g) || [];
                
                placeholders.forEach((placeholder, index) => {
                    const key = placeholder.replace(/[{}]/g, '');
                    matches[key] = match[index + 1];
                });
                
                return { 
                    patternName: name,
                    pattern, 
                    matches,
                    cypher: this.buildCypher(pattern.cypher, matches)
                };
            }
        }
        
        return null;
    }

    /**
     * Convert pattern string to regex
     * @param {string} pattern 
     * @returns {RegExp}
     */
    patternToRegex(pattern) {
        let regex = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
            .replace(/\\{(\w+)\\}/g, '(.+?)') // Replace placeholders
            .replace(/\\\(([^)]+)\\\)/g, '(?:$1)'); // Handle optional groups
        
        return new RegExp(regex, 'i');
    }

    /**
     * Build Cypher query with parameters
     * @param {string} cypherTemplate 
     * @param {object} params 
     * @returns {string}
     */
    buildCypher(cypherTemplate, params) {
        let cypher = cypherTemplate;
        for (const [key, value] of Object.entries(params)) {
            cypher = cypher.replace(new RegExp(`\\$${key}`, 'g'), `'${value}'`);
        }
        return cypher;
    }

    // ==================== Inference Methods ====================

    /**
     * Get all inference rules
     * @returns {Array}
     */
    getInferenceRules() {
        this.ensureLoaded();
        return this.inferenceRules;
    }

    /**
     * Get Cypher queries for running inference
     * @returns {Array<{name: string, condition: string, inference: string}>}
     */
    getInferenceCyphers() {
        return this.inferenceRules.map(rule => ({
            name: rule.name,
            description: rule.description,
            cypher: `${rule.condition} ${rule.inference}`
        }));
    }

    // ==================== Entity Extraction Methods ====================

    /**
     * Extract potential entity references from text
     * Uses simple heuristics - for better extraction, use LLM
     * @param {string} text 
     * @returns {Array<{type: string, value: string, confidence: number}>}
     */
    extractEntityHints(text) {
        const hints = [];
        const normalizedText = text.toLowerCase();
        
        // Look for entity type keywords
        const typeKeywords = {
            'Person': ['who', 'person', 'people', 'team member', 'colleague', 'employee'],
            'Project': ['project', 'initiative', 'program'],
            'Meeting': ['meeting', 'call', 'discussion', 'standup', 'review'],
            'Document': ['document', 'doc', 'file', 'report', 'spec', 'specification'],
            'Technology': ['technology', 'tech', 'tool', 'framework', 'language', 'stack'],
            'Client': ['client', 'customer', 'account'],
            'Decision': ['decision', 'decided', 'resolution'],
            'Task': ['task', 'todo', 'action item', 'assignment'],
            'Risk': ['risk', 'issue', 'concern', 'problem'],
            'Fact': ['fact', 'information', 'detail']
        };
        
        for (const [type, keywords] of Object.entries(typeKeywords)) {
            for (const keyword of keywords) {
                if (normalizedText.includes(keyword)) {
                    hints.push({
                        type,
                        keyword,
                        confidence: 0.6
                    });
                    break;
                }
            }
        }
        
        // Look for relation keywords
        const relationKeywords = {
            'WORKS_ON': ['works on', 'working on', 'assigned to project'],
            'ATTENDS': ['attends', 'attended', 'in meeting', 'participated'],
            'AUTHORED': ['wrote', 'authored', 'created', 'wrote'],
            'KNOWS': ['knows', 'know', 'contact'],
            'USES_TECH': ['uses', 'using', 'built with', 'developed with'],
            'HAS_SKILL': ['knows', 'skilled in', 'expert in', 'experienced with']
        };
        
        const relationHints = [];
        for (const [relation, keywords] of Object.entries(relationKeywords)) {
            for (const keyword of keywords) {
                if (normalizedText.includes(keyword)) {
                    relationHints.push({
                        relation,
                        keyword,
                        confidence: 0.6
                    });
                    break;
                }
            }
        }
        
        return { entityHints: hints, relationHints };
    }

    /**
     * Suggest related entity types based on a starting type
     * @param {string} entityType 
     * @returns {Array<{type: string, via: string}>}
     */
    suggestRelatedTypes(entityType) {
        const related = [];
        
        for (const [relationName, relation] of Object.entries(this.relationTypes)) {
            // If this type can be the source
            if (relation.fromTypes.includes('*') || relation.fromTypes.includes(entityType)) {
                for (const targetType of relation.toTypes) {
                    if (targetType !== '*' && targetType !== entityType) {
                        related.push({ type: targetType, via: relationName, direction: 'outgoing' });
                    }
                }
            }
            
            // If this type can be the target
            if (relation.toTypes.includes('*') || relation.toTypes.includes(entityType)) {
                for (const sourceType of relation.fromTypes) {
                    if (sourceType !== '*' && sourceType !== entityType) {
                        related.push({ type: sourceType, via: relationName, direction: 'incoming' });
                    }
                }
            }
        }
        
        return related;
    }

    // ==================== Utility Methods ====================

    /**
     * Get visual info for an entity type (for UI)
     * @param {string} typeName 
     * @returns {{icon: string, color: string, label: string}}
     */
    getEntityVisualInfo(typeName) {
        const entityType = this.getEntityType(typeName);
        if (!entityType) {
            return { icon: 'circle', color: '#888888', label: typeName };
        }
        return {
            icon: entityType.icon || 'circle',
            color: entityType.color || '#888888',
            label: entityType.label || typeName
        };
    }

    /**
     * Get a summary of the ontology
     * @returns {object}
     */
    getSummary() {
        this.ensureLoaded();
        return {
            version: this.schema?.version,
            entityTypes: Object.keys(this.entityTypes),
            relationTypes: Object.keys(this.relationTypes),
            queryPatterns: Object.keys(this.queryPatterns),
            inferenceRules: this.inferenceRules.length
        };
    }

    /**
     * Export ontology as simplified object (for API responses)
     * @returns {object}
     */
    export() {
        this.ensureLoaded();
        return {
            version: this.schema?.version,
            entityTypes: Object.entries(this.entityTypes).map(([name, def]) => ({
                name,
                label: def.label,
                description: def.description,
                icon: def.icon,
                color: def.color,
                properties: Object.keys(def.properties || {})
            })),
            relationTypes: Object.entries(this.relationTypes).map(([name, def]) => ({
                name,
                label: def.label,
                description: def.description,
                fromTypes: def.fromTypes,
                toTypes: def.toTypes
            }))
        };
    }
}

// Singleton instance
let instance = null;

/**
 * Get the OntologyManager singleton instance
 * @param {object} options 
 * @returns {OntologyManager}
 */
function getOntologyManager(options = {}) {
    if (!instance) {
        instance = new OntologyManager(options);
        instance.load();
    }
    return instance;
}

module.exports = {
    OntologyManager,
    getOntologyManager
};
