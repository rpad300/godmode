/**
 * Purpose:
 *   CRUD for threaded comments attached to any entity (fact, document,
 *   decision, etc.), with @mention extraction, HTML rendering of mentions,
 *   notification creation for mentions and replies, and thread resolution.
 *
 * Responsibilities:
 *   - Create comments with automatic thread-depth calculation
 *   - Extract @username mentions from content and store them in the
 *     `mentions` table
 *   - Generate `content_html` with mention spans for frontend rendering
 *   - Notify mentioned users and parent-comment authors via the
 *     `notifications` table
 *   - Retrieve comments for a target entity, optionally organized into
 *     a nested thread tree
 *   - Update (with ownership check and `is_edited` flag) and delete
 *     comments (owner or admin)
 *   - Resolve / unresolve comment threads
 *
 * Key dependencies:
 *   - ./client (getAdminClient): all queries bypass RLS
 *   - ../logger: structured logging
 *
 * Side effects:
 *   - Writes to `comments`, `mentions`, and `notifications` tables
 *
 * Notes:
 *   - Mentions are matched by the regex /@([a-zA-Z0-9_]+)/. Usernames with
 *     other characters will not be detected.
 *   - organizeThreads() builds an in-memory tree; orphaned replies (whose
 *     parent was deleted) fall to the root level.
 *   - Thread depth is stored on each comment so the frontend can limit
 *     nesting visually without re-computing.
 *   - Self-mentions (author mentioning themselves) are silently ignored.
 *
 * Supabase tables accessed:
 *   - comments: { id, project_id, author_id, target_type, target_id,
 *     content, content_html, parent_id, thread_depth, is_edited,
 *     is_resolved, resolved_by, resolved_at, created_at, updated_at }
 *   - mentions: { comment_id, mentioned_user_id }
 *   - notifications: { user_id, project_id, type, title, body,
 *     reference_type, reference_id, actor_id }
 *   - user_profiles: joined for author display info and mention lookups
 */

const { logger } = require('../logger');
const { getAdminClient } = require('./client');

const log = logger.child({ module: 'comments' });

/**
 * Create a new comment on a target entity.
 *
 * Side effects beyond the insert:
 *   - Calculates thread_depth from parent comment (if parentId given)
 *   - Extracts @mentions from content and creates rows in `mentions` table
 *   - Generates content_html with mention spans
 *   - Creates notifications for mentioned users
 *   - Creates a reply notification for the parent comment's author
 *
 * @param {object} params
 * @param {string} params.projectId
 * @param {string} params.authorId
 * @param {string} params.targetType - e.g. 'fact', 'document', 'decision'
 * @param {string} params.targetId - UUID of the entity being commented on
 * @param {string} params.content - Raw text (may contain @mentions)
 * @param {string} [params.parentId] - Parent comment ID for threading
 * @returns {Promise<{success: boolean, comment?: object, error?: string}>}
 */
async function createComment({
    projectId,
    authorId,
    targetType,
    targetId,
    content,
    parentId = null
}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Calculate thread depth
        let threadDepth = 0;
        if (parentId) {
            const { data: parent } = await supabase
                .from('comments')
                .select('thread_depth')
                .eq('id', parentId)
                .single();
            
            if (parent) {
                threadDepth = (parent.thread_depth || 0) + 1;
            }
        }

        // Extract mentions from content
        const mentionedUsernames = extractMentions(content);
        
        // Render HTML with mention links
        const contentHtml = renderMentions(content);

        // Create comment
        const { data: comment, error } = await supabase
            .from('comments')
            .insert({
                project_id: projectId,
                author_id: authorId,
                target_type: targetType,
                target_id: targetId,
                content,
                content_html: contentHtml,
                parent_id: parentId,
                thread_depth: threadDepth
            })
            .select(`
                *,
                author:user_profiles!author_id(id, username, display_name, avatar_url)
            `)
            .single();

        if (error) throw error;

        // Process mentions
        if (mentionedUsernames.length > 0) {
            await processMentions(supabase, comment.id, projectId, authorId, mentionedUsernames);
        }

        // Create notification for parent comment author (reply)
        if (parentId) {
            await createReplyNotification(supabase, comment, parentId);
        }

        return { success: true, comment };
    } catch (error) {
        log.error({ event: 'comments_create_error', reason: error?.message }, 'Create error');
        return { success: false, error: error.message };
    }
}

/**
 * Retrieve comments for a target entity with optional thread organization.
 *
 * When `includeReplies` is true (default), flat results are reorganized
 * into a tree via organizeThreads(). Each root comment gets a `replies`
 * array containing nested children.
 *
 * @param {string} projectId
 * @param {string} targetType
 * @param {string} targetId
 * @param {object} [options]
 * @param {boolean} [options.includeReplies=true] - If false, only top-level
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @returns {Promise<{success: boolean, comments?: object[], total?: number}>}
 */
async function getComments(projectId, targetType, targetId, options = {}) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    const { includeReplies = true, limit = 50, offset = 0 } = options;

    try {
        let query = supabase
            .from('comments')
            .select(`
                *,
                author:user_profiles!author_id(id, username, display_name, avatar_url),
                mentions(mentioned_user_id)
            `, { count: 'exact' })
            .eq('project_id', projectId)
            .eq('target_type', targetType)
            .eq('target_id', targetId)
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1);

        if (!includeReplies) {
            query = query.is('parent_id', null);
        }

        const { data: comments, error, count } = await query;

        if (error) throw error;

        // Organize into threads if needed
        const organized = includeReplies ? organizeThreads(comments) : comments;

        return { 
            success: true, 
            comments: organized,
            total: count 
        };
    } catch (error) {
        log.error({ event: 'comments_get_error', reason: error?.message }, 'Get error');
        return { success: false, error: error.message };
    }
}

/**
 * Update a comment
 */
async function updateComment(commentId, authorId, content) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Verify ownership
        const { data: existing } = await supabase
            .from('comments')
            .select('author_id')
            .eq('id', commentId)
            .single();

        if (!existing) {
            return { success: false, error: 'Comment not found' };
        }

        if (existing.author_id !== authorId) {
            return { success: false, error: 'Not authorized to edit this comment' };
        }

        const contentHtml = renderMentions(content);

        const { data: comment, error } = await supabase
            .from('comments')
            .update({
                content,
                content_html: contentHtml,
                is_edited: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', commentId)
            .select()
            .single();

        if (error) throw error;

        return { success: true, comment };
    } catch (error) {
        log.error({ event: 'comments_update_error', reason: error?.message }, 'Update error');
        return { success: false, error: error.message };
    }
}

/**
 * Delete a comment
 */
async function deleteComment(commentId, userId, isAdmin = false) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        // Verify ownership or admin
        const { data: existing } = await supabase
            .from('comments')
            .select('author_id')
            .eq('id', commentId)
            .single();

        if (!existing) {
            return { success: false, error: 'Comment not found' };
        }

        if (existing.author_id !== userId && !isAdmin) {
            return { success: false, error: 'Not authorized to delete this comment' };
        }

        const { error } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        log.error({ event: 'comments_delete_error', reason: error?.message }, 'Delete error');
        return { success: false, error: error.message };
    }
}

/**
 * Resolve/unresolve a comment thread
 */
async function resolveComment(commentId, userId, resolved = true) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data: comment, error } = await supabase
            .from('comments')
            .update({
                is_resolved: resolved,
                resolved_by: resolved ? userId : null,
                resolved_at: resolved ? new Date().toISOString() : null
            })
            .eq('id', commentId)
            .select()
            .single();

        if (error) throw error;

        return { success: true, comment };
    } catch (error) {
        log.error({ event: 'comments_resolve_error', reason: error?.message }, 'Resolve error');
        return { success: false, error: error.message };
    }
}

// ==================== Helper Functions ====================

/**
 * Extract @mentions from content
 */
function extractMentions(content) {
    const regex = /@([a-zA-Z0-9_]+)/g;
    const matches = [];
    let match;
    
    while ((match = regex.exec(content)) !== null) {
        matches.push(match[1].toLowerCase());
    }
    
    return [...new Set(matches)]; // Unique
}

/**
 * Render content with mention links
 */
function renderMentions(content) {
    return content.replace(
        /@([a-zA-Z0-9_]+)/g,
        '<span class="mention" data-username="$1">@$1</span>'
    );
}

/**
 * Process mentions and create notifications
 */
async function processMentions(supabase, commentId, projectId, authorId, usernames) {
    try {
        // Find user IDs by username
        const { data: users } = await supabase
            .from('user_profiles')
            .select('id, username')
            .in('username', usernames);

        if (!users || users.length === 0) return;

        // Create mention records
        const mentions = users
            .filter(u => u.id !== authorId) // Don't mention yourself
            .map(u => ({
                comment_id: commentId,
                mentioned_user_id: u.id
            }));

        if (mentions.length > 0) {
            await supabase.from('mentions').insert(mentions);

            // Create notifications for each mentioned user
            const { data: author } = await supabase
                .from('user_profiles')
                .select('username, display_name')
                .eq('id', authorId)
                .single();

            const authorName = author?.display_name || author?.username || 'Someone';

            for (const mention of mentions) {
                await supabase.from('notifications').insert({
                    user_id: mention.mentioned_user_id,
                    project_id: projectId,
                    type: 'mention',
                    title: `${authorName} mentioned you`,
                    body: 'You were mentioned in a comment',
                    reference_type: 'comment',
                    reference_id: commentId,
                    actor_id: authorId
                });
            }
        }
    } catch (error) {
        log.error({ event: 'comments_process_mentions_error', reason: error?.message }, 'Process mentions error');
    }
}

/**
 * Create notification for reply
 */
async function createReplyNotification(supabase, comment, parentId) {
    try {
        const { data: parent } = await supabase
            .from('comments')
            .select('author_id, project_id')
            .eq('id', parentId)
            .single();

        if (!parent || parent.author_id === comment.author_id) return;

        const { data: author } = await supabase
            .from('user_profiles')
            .select('username, display_name')
            .eq('id', comment.author_id)
            .single();

        const authorName = author?.display_name || author?.username || 'Someone';

        await supabase.from('notifications').insert({
            user_id: parent.author_id,
            project_id: parent.project_id,
            type: 'reply',
            title: `${authorName} replied to your comment`,
            body: comment.content.substring(0, 100),
            reference_type: 'comment',
            reference_id: comment.id,
            actor_id: comment.author_id
        });
    } catch (error) {
        log.error({ event: 'comments_reply_notification_error', reason: error?.message }, 'Reply notification error');
    }
}

/**
 * Organize a flat array of comments into a nested tree.
 * Each node gets a `replies` array. Orphaned replies (parent deleted)
 * are promoted to root level rather than being dropped.
 */
function organizeThreads(comments) {
    const byId = {};
    const roots = [];

    // Index by ID
    comments.forEach(c => {
        byId[c.id] = { ...c, replies: [] };
    });

    // Build tree
    comments.forEach(c => {
        if (c.parent_id && byId[c.parent_id]) {
            byId[c.parent_id].replies.push(byId[c.id]);
        } else {
            roots.push(byId[c.id]);
        }
    });

    return roots;
}

module.exports = {
    createComment,
    getComments,
    updateComment,
    deleteComment,
    resolveComment,
    extractMentions,
    renderMentions
};
