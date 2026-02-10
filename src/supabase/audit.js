/**
 * Audit Module
 * Handles audit log export and compliance features
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'audit' });

// Export formats
const EXPORT_FORMATS = {
    JSON: 'json',
    CSV: 'csv',
    XLSX: 'xlsx'
};

/**
 * Create an audit export job
 */
async function createExportJob({
    projectId,
    requestedBy,
    dateFrom,
    dateTo,
    filters = {},
    format = 'json'
}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Validate dates
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            return { success: false, error: 'Invalid date range' };
        }

        if (from > to) {
            return { success: false, error: 'Start date must be before end date' };
        }

        // Max 1 year range
        const daysDiff = (to - from) / (1000 * 60 * 60 * 24);
        if (daysDiff > 365) {
            return { success: false, error: 'Maximum export range is 1 year' };
        }

        // Create export job
        const { data: job, error } = await supabase
            .from('audit_exports')
            .insert({
                project_id: projectId,
                requested_by: requestedBy,
                date_from: from.toISOString(),
                date_to: to.toISOString(),
                filters,
                format,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        // Start processing in background
        processExportJob(job.id).catch(err => {
            log.error({ event: 'audit_background_job_error', reason: err?.message }, 'Background job error');
        });

        return { success: true, job };
    } catch (error) {
        log.error({ event: 'audit_create_export_error', reason: error?.message }, 'Create export error');
        return { success: false, error: error.message };
    }
}

/**
 * Process an export job (async background task)
 */
async function processExportJob(jobId) {
    const supabase = getAdminClient();
    if (!supabase) return;

    try {
        // Get job details
        const { data: job } = await supabase
            .from('audit_exports')
            .select('*')
            .eq('id', jobId)
            .single();

        if (!job) return;

        // Update status to processing
        await supabase
            .from('audit_exports')
            .update({
                status: 'processing',
                started_at: new Date().toISOString()
            })
            .eq('id', jobId);

        // Fetch activity logs
        let query = supabase
            .from('activity_log')
            .select(`
                *,
                actor:user_profiles!actor_id(id, username, display_name)
            `)
            .eq('project_id', job.project_id)
            .gte('created_at', job.date_from)
            .lte('created_at', job.date_to)
            .order('created_at', { ascending: true });

        // Apply filters
        if (job.filters?.action) {
            query = query.eq('action', job.filters.action);
        }
        if (job.filters?.actor_id) {
            query = query.eq('actor_id', job.filters.actor_id);
        }
        if (job.filters?.target_type) {
            query = query.eq('target_type', job.filters.target_type);
        }

        const { data: logs, error } = await query;

        if (error) throw error;

        // Format data
        const formattedData = formatExportData(logs || [], job.format);
        
        // In production, upload to storage and get URL
        // For now, we'll store a summary
        const exportData = {
            generated_at: new Date().toISOString(),
            project_id: job.project_id,
            date_range: {
                from: job.date_from,
                to: job.date_to
            },
            filters: job.filters,
            record_count: logs?.length || 0,
            data: formattedData
        };

        // Calculate expiry (7 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Update job as completed
        await supabase
            .from('audit_exports')
            .update({
                status: 'completed',
                record_count: logs?.length || 0,
                file_size_bytes: JSON.stringify(exportData).length,
                completed_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString(),
                // In production, this would be a storage URL
                file_url: `data:application/${job.format};base64,${Buffer.from(JSON.stringify(exportData)).toString('base64')}`
            })
            .eq('id', jobId);

    } catch (error) {
        log.error({ event: 'audit_process_job_error', reason: error?.message }, 'Process job error');

        await supabase
            .from('audit_exports')
            .update({
                status: 'failed',
                error_message: error.message,
                completed_at: new Date().toISOString()
            })
            .eq('id', jobId);
    }
}

/**
 * Format export data based on format type
 */
function formatExportData(logs, format) {
    switch (format) {
        case 'csv':
            return formatAsCSV(logs);
        case 'json':
        default:
            return logs.map(log => ({
                id: log.id,
                timestamp: log.created_at,
                action: log.action,
                actor: log.actor?.display_name || log.actor?.username || log.actor_id,
                actor_id: log.actor_id,
                target_type: log.target_type,
                target_id: log.target_id,
                metadata: log.metadata,
                ip_address: log.ip_address
            }));
    }
}

/**
 * Format logs as CSV
 */
function formatAsCSV(logs) {
    const headers = ['timestamp', 'action', 'actor', 'actor_id', 'target_type', 'target_id', 'ip_address'];
    const rows = logs.map(log => [
        log.created_at,
        log.action,
        log.actor?.display_name || log.actor?.username || '',
        log.actor_id,
        log.target_type || '',
        log.target_id || '',
        log.ip_address || ''
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
}

/**
 * Get export job status
 */
async function getExportJob(jobId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: job, error } = await supabase
            .from('audit_exports')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error) throw error;

        return { success: true, job };
    } catch (error) {
        log.error({ event: 'audit_get_job_error', reason: error?.message }, 'Get job error');
        return { success: false, error: error.message };
    }
}

/**
 * List export jobs for a project
 */
async function listExportJobs(projectId, limit = 20) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: jobs, error } = await supabase
            .from('audit_exports')
            .select(`
                *,
                requester:user_profiles!requested_by(id, username, display_name)
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        return { success: true, jobs: jobs || [] };
    } catch (error) {
        log.error({ event: 'audit_list_jobs_error', reason: error?.message }, 'List jobs error');
        return { success: false, error: error.message };
    }
}

/**
 * Download export data
 */
async function downloadExport(jobId, userId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: job, error } = await supabase
            .from('audit_exports')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error || !job) {
            return { success: false, error: 'Export not found' };
        }

        if (job.status !== 'completed') {
            return { success: false, error: 'Export not ready' };
        }

        if (job.expires_at && new Date(job.expires_at) < new Date()) {
            return { success: false, error: 'Export has expired' };
        }

        // Return the file URL/data
        return {
            success: true,
            url: job.file_url,
            format: job.format,
            recordCount: job.record_count,
            fileSize: job.file_size_bytes
        };
    } catch (error) {
        log.error({ event: 'audit_download_error', reason: error?.message }, 'Download error');
        return { success: false, error: error.message };
    }
}

/**
 * Get audit summary statistics
 */
async function getAuditSummary(projectId, days = 30) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const { data: logs, error } = await supabase
            .from('activity_log')
            .select('action, actor_id, created_at')
            .eq('project_id', projectId)
            .gte('created_at', since.toISOString());

        if (error) throw error;

        // Calculate summary
        const summary = {
            totalActions: logs?.length || 0,
            uniqueActors: new Set(logs?.map(l => l.actor_id) || []).size,
            actionBreakdown: {},
            dailyActivity: {}
        };

        for (const log of logs || []) {
            // Action breakdown
            summary.actionBreakdown[log.action] = (summary.actionBreakdown[log.action] || 0) + 1;

            // Daily activity
            const day = log.created_at.split('T')[0];
            summary.dailyActivity[day] = (summary.dailyActivity[day] || 0) + 1;
        }

        return { success: true, summary };
    } catch (error) {
        log.error({ event: 'audit_summary_error', reason: error?.message }, 'Summary error');
        return { success: false, error: error.message };
    }
}

/**
 * Cleanup expired exports
 */
async function cleanupExpiredExports() {
    const supabase = getAdminClient();
    if (!supabase) return;

    try {
        const { error } = await supabase
            .from('audit_exports')
            .update({ status: 'expired', file_url: null })
            .lt('expires_at', new Date().toISOString())
            .eq('status', 'completed');

        if (error) throw error;
    } catch (error) {
        log.error({ event: 'audit_cleanup_error', reason: error?.message }, 'Cleanup error');
    }
}

module.exports = {
    EXPORT_FORMATS,
    createExportJob,
    getExportJob,
    listExportJobs,
    downloadExport,
    getAuditSummary,
    cleanupExpiredExports
};
