

const { getCategories, createCategory, updateCategory, deleteCategory } = require('../../supabase/categories');
const { jsonResponse } = require('../../server/response');
const { parseBody } = require('../../server/request');

/**
 * Handle Categories routes
 * @param {object} params
 * @param {IncomingMessage} params.req
 * @param {ServerResponse} params.res
 * @param {string} params.pathname
 * @returns {Promise<boolean>} True if handled
 */
async function handleCategories({ req, res, pathname }) {
    // GET /api/categories - Get global categories
    if (pathname === '/api/categories' && req.method === 'GET') {
        const result = await getCategories();
        if (result.success) {
            jsonResponse(res, result.data);
        } else {
            console.error('Failed to fetch categories:', result.error);
            jsonResponse(res, { error: 'Failed to fetch categories' }, 500);
        }
        return true;
    }

    // GET /api/projects/:projectId/categories - Get project categories (includes global)
    const getProjectCategoriesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/categories$/);
    if (getProjectCategoriesMatch && req.method === 'GET') {
        const projectId = getProjectCategoriesMatch[1];
        const result = await getCategories(projectId);
        if (result.success) {
            jsonResponse(res, result.data);
        } else {
            console.error('Failed to fetch project categories:', result.error);
            jsonResponse(res, { error: 'Failed to fetch categories' }, 500);
        }
        return true;
    }

    // POST /api/projects/:projectId/categories - Create category
    const createCategoryMatch = pathname.match(/^\/api\/projects\/([^/]+)\/categories$/);
    if (createCategoryMatch && req.method === 'POST') {
        const projectId = createCategoryMatch[1];
        try {
            const body = await parseBody(req);
            if (!body.name) {
                jsonResponse(res, { error: 'Name is required' }, 400);
                return true;
            }

            const categoryData = {
                ...body,
                project_id: projectId
            };

            const result = await createCategory(categoryData);
            if (result.success) {
                jsonResponse(res, result.data);
            } else {
                console.error('Failed to create category:', result.error);
                jsonResponse(res, { error: 'Failed to create category' }, 500);
            }
        } catch (error) {
            console.error('Error parsing body:', error);
            jsonResponse(res, { error: 'Invalid request body' }, 400);
        }
        return true;
    }

    // PUT /api/projects/:projectId/categories/:categoryId - Update category
    const updateCategoryMatch = pathname.match(/^\/api\/projects\/([^/]+)\/categories\/([^/]+)$/);
    if (updateCategoryMatch && req.method === 'PUT') {
        const categoryId = updateCategoryMatch[2];
        try {
            const body = await parseBody(req);
            const result = await updateCategory(categoryId, body);
            if (result.success) {
                jsonResponse(res, result.data);
            } else {
                console.error('Failed to update category:', result.error);
                jsonResponse(res, { error: 'Failed to update category' }, 500);
            }
        } catch (error) {
            console.error('Error parsing body:', error);
            jsonResponse(res, { error: 'Invalid request body' }, 400);
        }
        return true;
    }

    // DELETE /api/projects/:projectId/categories/:categoryId - Delete category
    const deleteCategoryMatch = pathname.match(/^\/api\/projects\/([^/]+)\/categories\/([^/]+)$/);
    if (deleteCategoryMatch && req.method === 'DELETE') {
        const categoryId = deleteCategoryMatch[2];
        const result = await deleteCategory(categoryId);
        if (result.success) {
            jsonResponse(res, { success: true });
        } else {
            console.error('Failed to delete category:', result.error);
            jsonResponse(res, { error: 'Failed to delete category' }, 500);
        }
        return true;
    }

    return false;
}

module.exports = {
    handleCategories
};

