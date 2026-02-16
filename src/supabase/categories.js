
const { getAdminClient } = require('./client');

/**
 * Get categories for a project (including global defaults)
 * @param {string} projectId - The project ID
 * @returns {Promise<{success: boolean, data?: any[], error?: string}>}
 */
async function getCategories(projectId) {
    const supabase = getAdminClient();
    if (!supabase) {
        return { success: false, error: 'Supabase admin client not initialized' };
    }

    try {
        let query = supabase
            .from('categories')
            .select('*')
            .order('name');

        if (projectId) {
            // Fetch global categories (project_id is null) OR project specific ones
            query = query.or(`project_id.is.null,project_id.eq.${projectId}`);
        } else {
            // Only global
            query = query.is('project_id', null);
        }

        const { data, error } = await query;

        if (error) throw error;

        return { success: true, data };
    } catch (error) {
        console.error('Error fetching categories:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Create a new category
 * @param {object} category - Category data
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function createCategory(category) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase admin client not initialized' };

    try {
        const { data, error } = await supabase
            .from('categories')
            .insert(category)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error creating category:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update a category
 * @param {string} id - Category ID
 * @param {object} updates - Updates
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function updateCategory(id, updates) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase admin client not initialized' };

    try {
        const { data, error } = await supabase
            .from('categories')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error updating category:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a category
 * @param {string} id - Category ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteCategory(id) {
    const supabase = getAdminClient();
    if (!supabase) return { success: false, error: 'Supabase admin client not initialized' };

    try {
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting category:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
};
