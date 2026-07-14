import { supabase } from '@/lib/supabase';
import type { Inspection } from '@/types';

export class TransitionError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'TransitionError';
  }
}

export const inspectionTransitionsService = {
  /**
   * Complete an inspection (in_progress → completed).
   * Only the inspector who owns the inspection can complete it.
   */
  async completeInspection(inspectionId: string): Promise<Inspection> {
    const { data, error } = await supabase.functions.invoke('complete-inspection', {
      body: { inspectionId },
    });

    if (error) {
      throw new TransitionError(error.message ?? 'Failed to complete inspection');
    }

    if (data?.error) {
      throw new TransitionError(data.error, data.statusCode);
    }

    return data.inspection as Inspection;
  },

  /**
   * Approve an inspection (completed → approved).
   * Only supervisors/admins can approve.
   */
  async approveInspection(inspectionId: string): Promise<Inspection> {
    const { data, error } = await supabase.functions.invoke('approve-inspection', {
      body: { inspectionId },
    });

    if (error) {
      throw new TransitionError(error.message ?? 'Failed to approve inspection');
    }

    if (data?.error) {
      throw new TransitionError(data.error, data.statusCode);
    }

    return data.inspection as Inspection;
  },
};
