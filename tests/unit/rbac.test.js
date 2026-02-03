/**
 * RBAC Unit Tests
 * Tests for Role-Based Access Control
 */

const rbac = require('../../src/rbac');

describe('RBAC Module', () => {
    describe('ROLES', () => {
        it('should define all expected roles', () => {
            expect(rbac.ROLES).toEqual(['owner', 'admin', 'write', 'read']);
        });
    });

    describe('can()', () => {
        describe('project.view permission', () => {
            it('should allow owner to view project', () => {
                expect(rbac.can('owner', 'project.view')).toBe(true);
            });

            it('should allow admin to view project', () => {
                expect(rbac.can('admin', 'project.view')).toBe(true);
            });

            it('should allow write role to view project', () => {
                expect(rbac.can('write', 'project.view')).toBe(true);
            });

            it('should allow read role to view project', () => {
                expect(rbac.can('read', 'project.view')).toBe(true);
            });

            it('should deny unknown role', () => {
                expect(rbac.can('unknown', 'project.view')).toBe(false);
            });
        });

        describe('project.edit permission', () => {
            it('should allow owner to edit project', () => {
                expect(rbac.can('owner', 'project.edit')).toBe(true);
            });

            it('should allow admin to edit project', () => {
                expect(rbac.can('admin', 'project.edit')).toBe(true);
            });

            it('should deny write role to edit project settings', () => {
                expect(rbac.can('write', 'project.edit')).toBe(false);
            });

            it('should deny read role to edit project', () => {
                expect(rbac.can('read', 'project.edit')).toBe(false);
            });
        });

        describe('project.delete permission', () => {
            it('should allow only owner to delete project', () => {
                expect(rbac.can('owner', 'project.delete')).toBe(true);
                expect(rbac.can('admin', 'project.delete')).toBe(false);
                expect(rbac.can('write', 'project.delete')).toBe(false);
                expect(rbac.can('read', 'project.delete')).toBe(false);
            });
        });

        describe('content permissions', () => {
            it('should allow write and above to create content', () => {
                expect(rbac.can('owner', 'content.create')).toBe(true);
                expect(rbac.can('admin', 'content.create')).toBe(true);
                expect(rbac.can('write', 'content.create')).toBe(true);
                expect(rbac.can('read', 'content.create')).toBe(false);
            });

            it('should allow all roles to view content', () => {
                expect(rbac.can('owner', 'content.view')).toBe(true);
                expect(rbac.can('admin', 'content.view')).toBe(true);
                expect(rbac.can('write', 'content.view')).toBe(true);
                expect(rbac.can('read', 'content.view')).toBe(true);
            });
        });

        describe('member permissions', () => {
            it('should allow owner and admin to invite members', () => {
                expect(rbac.can('owner', 'members.invite')).toBe(true);
                expect(rbac.can('admin', 'members.invite')).toBe(true);
                expect(rbac.can('write', 'members.invite')).toBe(false);
                expect(rbac.can('read', 'members.invite')).toBe(false);
            });

            it('should allow only owner to remove members', () => {
                expect(rbac.can('owner', 'members.remove')).toBe(true);
                expect(rbac.can('admin', 'members.remove')).toBe(true);
                expect(rbac.can('write', 'members.remove')).toBe(false);
            });
        });

        describe('unknown permission', () => {
            it('should deny unknown permissions', () => {
                expect(rbac.can('owner', 'unknown.permission')).toBe(false);
                expect(rbac.can('admin', 'nonexistent')).toBe(false);
            });
        });
    });

    describe('canAll()', () => {
        it('should return true if user can do all actions', () => {
            expect(rbac.canAll('owner', ['project.view', 'project.edit', 'project.delete'])).toBe(true);
        });

        it('should return false if user cannot do any one action', () => {
            expect(rbac.canAll('admin', ['project.view', 'project.edit', 'project.delete'])).toBe(false);
        });

        it('should return true for empty actions array', () => {
            expect(rbac.canAll('read', [])).toBe(true);
        });
    });

    describe('canAny()', () => {
        it('should return true if user can do at least one action', () => {
            expect(rbac.canAny('read', ['project.delete', 'project.view'])).toBe(true);
        });

        it('should return false if user cannot do any action', () => {
            expect(rbac.canAny('read', ['project.delete', 'project.edit'])).toBe(false);
        });

        it('should return false for empty actions array', () => {
            expect(rbac.canAny('owner', [])).toBe(false);
        });
    });

    describe('requirePermission()', () => {
        let mockRes;

        beforeEach(() => {
            mockRes = {
                writeHead: jest.fn(),
                end: jest.fn()
            };
        });

        it('should return true and not send response when permission granted', () => {
            const result = rbac.requirePermission(mockRes, 'owner', 'project.view');
            expect(result).toBe(true);
            expect(mockRes.writeHead).not.toHaveBeenCalled();
        });

        it('should return false and send 403 when permission denied', () => {
            const result = rbac.requirePermission(mockRes, 'read', 'project.delete');
            expect(result).toBe(false);
            expect(mockRes.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
            expect(mockRes.end).toHaveBeenCalled();
        });

        it('should use custom message when provided', () => {
            rbac.requirePermission(mockRes, 'read', 'project.delete', 'Custom error');
            expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Custom error'));
        });
    });

    describe('getRoleLevel()', () => {
        it('should return correct hierarchy levels', () => {
            expect(rbac.getRoleLevel('owner')).toBe(4);
            expect(rbac.getRoleLevel('admin')).toBe(3);
            expect(rbac.getRoleLevel('write')).toBe(2);
            expect(rbac.getRoleLevel('read')).toBe(1);
        });

        it('should return 0 for unknown roles', () => {
            expect(rbac.getRoleLevel('unknown')).toBe(0);
            expect(rbac.getRoleLevel(null)).toBe(0);
            expect(rbac.getRoleLevel(undefined)).toBe(0);
        });
    });

    describe('isHigherRole()', () => {
        it('should correctly compare role hierarchy', () => {
            expect(rbac.isHigherRole('owner', 'admin')).toBe(true);
            expect(rbac.isHigherRole('admin', 'write')).toBe(true);
            expect(rbac.isHigherRole('write', 'read')).toBe(true);
            expect(rbac.isHigherRole('read', 'owner')).toBe(false);
            expect(rbac.isHigherRole('admin', 'owner')).toBe(false);
        });

        it('should return false for equal roles', () => {
            expect(rbac.isHigherRole('admin', 'admin')).toBe(false);
        });
    });
});
