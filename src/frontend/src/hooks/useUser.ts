/**
 * Purpose:
 *   Fetches and caches the current user's profile, and provides a mutation
 *   to update it. Acts as the single source of truth for user identity
 *   throughout the frontend.
 *
 * Responsibilities:
 *   - Fetch profile from /api/profile (returns null on auth failure)
 *   - Optimistically update the query cache after a successful profile mutation
 *   - Expose isAuthenticated derived from the presence of user data
 *
 * Key dependencies:
 *   - @tanstack/react-query: caching with 5-minute staleTime
 *   - lib/api-client: authenticated HTTP requests
 *
 * Side effects:
 *   - Network request to /api/profile; errors are logged but swallowed
 *     (returns null so downstream code can treat the user as unauthenticated)
 *
 * Notes:
 *   - retry is set to 1 to avoid hammering the server on auth failures
 *   - updateProfile.onSuccess writes directly to the cache for instant UI feedback
 *
 * @returns {{ user, isLoading, error, updateProfile, isAuthenticated }}
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface UserProfile {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string; // Optional, might be null
    sidebar_collapsed?: boolean;
    theme?: string;
    timezone?: string;
    created_at?: string;
    username?: string;
}

interface UserResponse {
    profile: UserProfile;
}

export function useUser() {
    const queryClient = useQueryClient();

    const { data: user, isLoading, error } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const response = await apiClient.get<UserResponse>('/api/profile');
                return response.profile;
            } catch (err) {
                console.error('Error fetching user:', err);
                return null; // Return null on error (e.g. not authenticated)
            }
        },
        retry: 1,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const updateProfile = useMutation({
        mutationFn: async (updates: Partial<UserProfile>) => {
            const response = await apiClient.put<{ profile: UserProfile }>('/api/profile', updates);
            return response.profile;
        },
        onSuccess: (newProfile) => {
            queryClient.setQueryData(['user'], newProfile);
        },
    });

    return {
        user,
        isLoading,
        error,
        updateProfile,
        isAuthenticated: !!user,
    };
}
