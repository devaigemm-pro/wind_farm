import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesService } from '@/services/quotes.service';
import { useAuth } from '@/hooks/useAuth';
import type {
  Quote,
  QuotableDefect,
  QuoteCurrency,
  QuoteMaterial,
  TraceabilityRow,
  TraceabilitySummary,
  RepairCampaign,
} from '@/types';

// ─── Quotable defects (left column of the new quote screen) ──────────────────

export function useQuotableDefects(turbineId: string | undefined) {
  return useQuery<QuotableDefect[]>({
    queryKey: ['quotable-defects', turbineId],
    queryFn: () => quotesService.listQuotableDefects(turbineId!),
    enabled: !!turbineId,
  });
}

// ─── Quotes list (role-aware) ────────────────────────────────────────────────

export function useQuotes() {
  const { role, user } = useAuth();
  return useQuery<Quote[]>({
    queryKey: ['quotes', role, user?.id],
    queryFn: () => quotesService.listQuotes({ role, userId: user?.id ?? null }),
  });
}

// ─── Single quote detail ─────────────────────────────────────────────────────

export function useQuote(id: string | undefined) {
  return useQuery<Quote>({
    queryKey: ['quote', id],
    queryFn: () => quotesService.getQuote(id!),
    enabled: !!id,
  });
}

// ─── Work orders for a quote ─────────────────────────────────────────────────

export function useQuoteWorkOrders(quoteId: string | undefined, enabled: boolean) {
  return useQuery<TraceabilityRow[]>({
    queryKey: ['quote-work-orders', quoteId],
    queryFn: () => quotesService.listWorkOrdersByQuote(quoteId!),
    enabled: !!quoteId && enabled,
  });
}

// ─── Repair campaign generated on approval ───────────────────────────────────

export function useRepairCampaign(quoteId: string | undefined, enabled: boolean) {
  return useQuery<RepairCampaign | null>({
    queryKey: ['repair-campaign', quoteId],
    queryFn: () => quotesService.getRepairCampaign(quoteId!),
    enabled: !!quoteId && enabled,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      turbineId,
      windFarmId,
      defectIds,
    }: {
      turbineId: string;
      windFarmId: string;
      defectIds: string[];
    }) => quotesService.createQuote(turbineId, windFarmId, defectIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useSubmitQuoteResponse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      quoteId,
      items,
      currency,
    }: {
      quoteId: string;
      items: {
        id: string;
        labor_hours: number;
        hourly_rate: number;
        materials: QuoteMaterial[];
      }[];
      currency: QuoteCurrency;
    }) => quotesService.submitQuoteResponse(quoteId, items, currency),
    onSuccess: (_, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

export function useApproveQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => quotesService.approveQuote(quoteId),
    onSuccess: (_, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote-work-orders', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['repair-campaign', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['traceability'] });
    },
  });
}

export function useRejectQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => quotesService.rejectQuote(quoteId),
    onSuccess: (_, quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

// ─── Traceability ─────────────────────────────────────────────────────────────

export function useTraceability(params: { windFarmId?: string; turbineId?: string }) {
  return useQuery<TraceabilitySummary>({
    queryKey: ['traceability', params.windFarmId, params.turbineId],
    queryFn: () => quotesService.getTraceability(params),
  });
}
