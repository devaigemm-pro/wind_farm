import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  usersService,
  type CreateUserInput,
  type UpdateUserInput,
} from '@/services/users.service';

/** List of all users (admin maintainer). */
export function useUsersList() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.listUsers(),
  });
}

/** Roles assigned to a specific user (multi-role). */
export function useUserRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-roles', userId],
    queryFn: () => usersService.getUserRoles(userId as string),
    enabled: !!userId,
  });
}

/** Wind farm ids assigned to a specific user. */
export function useUserFarms(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-farms', userId],
    queryFn: () => usersService.getUserFarms(userId as string),
    enabled: !!userId,
  });
}

/** Full wind farm catalog for the assignment selector. */
export function useAdminWindFarms() {
  return useQuery({
    queryKey: ['admin-wind-farms'],
    queryFn: () => usersService.getAllWindFarmsForAdmin(),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersService.createUser(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) => usersService.updateUser(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-farms', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-roles', variables.userId] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => usersService.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
