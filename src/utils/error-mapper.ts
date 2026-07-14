export interface AppError {
  code: string;
  message: string;
  field?: string;
}

/**
 * Maps Supabase/Postgres error codes to user-friendly application errors.
 */
export function mapSupabaseError(error: { code?: string; message?: string }): AppError {
  switch (error.code) {
    case '23505':
      return { code: 'CONFLICT', message: 'A record with this value already exists' };
    case '23503':
      return {
        code: 'CONSTRAINT_VIOLATION',
        message: 'Cannot perform this action due to linked records',
      };
    case '23514':
      return {
        code: 'VALIDATION_ERROR',
        message: error.message ?? 'Validation failed',
      };
    case '42501':
      return {
        code: 'FORBIDDEN',
        message: 'You do not have permission for this action',
      };
    case 'PGRST116':
      return { code: 'NOT_FOUND', message: 'Record not found' };
    default:
      return {
        code: 'INTERNAL_ERROR',
        message: error.message ?? 'An unexpected error occurred',
      };
  }
}
