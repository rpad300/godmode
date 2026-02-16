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
