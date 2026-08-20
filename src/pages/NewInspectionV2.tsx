import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  useWindFarmsList,
  useSubassetsForSelection,
  useCreateCampaignInspections,
} from '@/hooks/useNewInspection';
import { useToast } from '@/store/toastStore';
import { useLanguage } from '@/components/design-system';
import { newCampaignInspectionSchema } from '@/utils/validation';
import type { InspectionType, InspectionMethod } from '@/types';

function getDefaultCampaignName(): string {
  return new Date().toLocaleString('en', { month: 'long', year: 'numeric' });
}

export function NewInspectionV2() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { t } = useLanguage();

  const { data: windFarms = [], isLoading: isLoadingFarms } = useWindFarmsList();
  const createMutation = useCreateCampaignInspections();

  const [step, setStep] = useState(1);
  const [windFarmId, setWindFarmId] = useState<string | null>(searchParams.get('windFarm') || null);
  const [inspectionType, setInspectionType] = useState<InspectionType>('blades');
  const [inspectionMethod, setInspectionMethod] = useState<InspectionMethod>('skyvisor');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]!);
  const [campaignName, setCampaignName] = useState(getDefaultCampaignName());
  const [notes, setNotes] = useState('');
  const [selectedTurbineIds, setSelectedTurbineIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: subassets = [] } = useSubassetsForSelection(windFarmId);

  useEffect(() => {
    if (!windFarmId && windFarms.length > 0) setWindFarmId(windFarms[0]!.id);
  }, [windFarms, windFarmId]);

  useEffect(() => {
    if (subassets.length > 0) setSelectedTurbineIds(subassets.map((s: any) => s.id));
  }, [subassets]);

  const handleCreate = async () => {
    setErrors({});
    const input = {
      windFarmId: windFarmId ?? '',
      campaignName: campaignName.trim(),
      inspectionType,
      inspectionMethod,
      scheduledDate,
      notes,
      selectedTurbineIds,
    };

    const result = newCampaignInspectionSchema.safeParse(input);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      setStep(1);
      return;
    }

    try {
      await createMutation.mutateAsync(input as any);
      toast.success('Inspection created successfully');
      navigate(windFarmId ? `/assets-wind/${windFarmId}` : '/inspections');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create inspection');
    }
  };

  const toggleTurbine = (id: string) => {
    setSelectedTurbineIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Create New Inspection</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition',
              s < step ? 'bg-[#5A8F5A] text-white' :
              s === step ? 'bg-[#5A8F5A] text-white ring-4 ring-[#5A8F5A]/20' :
              'bg-gray-200 text-gray-500'
            )}>
              {s < step ? '✓' : s}
            </div>
            <span className={cn('text-xs font-medium', s === step ? 'text-gray-900' : 'text-gray-400')}>
              {s === 1 ? 'Configure' : s === 2 ? 'Select Turbines' : 'Review'}
            </span>
            {s < 3 && <div className={cn('w-12 h-0.5 mx-2', s < step ? 'bg-[#5A8F5A]' : 'bg-gray-200')} />}
          </div>
        ))}
      </div>

      {/* Step 1: Configure */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Wind Farm</label>
              <select
                value={windFarmId || ''}
                onChange={e => setWindFarmId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20 focus:border-[#5A8F5A]"
              >
                {windFarms.map((wf: any) => <option key={wf.id} value={wf.id}>{wf.name}</option>)}
              </select>
              {errors.windFarmId && <p className="text-xs text-red-500 mt-1">{errors.windFarmId}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Type</label>
                <select value={inspectionType} onChange={e => setInspectionType(e.target.value as InspectionType)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20">
                  <option value="blades">Blades</option>
                  <option value="tower">Tower</option>
                  <option value="nacelle">Nacelle</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Method</label>
                <select value={inspectionMethod} onChange={e => setInspectionMethod(e.target.value as InspectionMethod)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20">
                  <option value="skyvisor">Drone (Automated)</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Date</label>
                <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Campaign Name</label>
                <input type="text" value={campaignName} onChange={e => setCampaignName(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20" placeholder="Add inspection notes..." />
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setStep(2)} className="px-5 py-2.5 text-sm font-medium bg-[#5A8F5A] text-white rounded-lg hover:bg-[#4a7a4a] transition">
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Select Turbines */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Select turbines to inspect:</h3>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {subassets.map((s: any) => (
              <div
                key={s.id}
                onClick={() => toggleTurbine(s.id)}
                className={cn(
                  'p-4 rounded-lg border-2 cursor-pointer transition',
                  selectedTurbineIds.includes(s.id)
                    ? 'border-[#5A8F5A] bg-[#5A8F5A]/5'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{s.name}</span>
                  {selectedTurbineIds.includes(s.id) && (
                    <span className="w-5 h-5 rounded-full bg-[#5A8F5A] flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">{(s as any).model || 'Turbine'}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-4">{selectedTurbineIds.length} of {subassets.length} selected</p>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-5 py-2.5 text-sm font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button onClick={() => setStep(3)} disabled={selectedTurbineIds.length === 0} className="px-5 py-2.5 text-sm font-medium bg-[#5A8F5A] text-white rounded-lg hover:bg-[#4a7a4a] disabled:opacity-50 transition">
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Review your inspection:</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-6">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Wind Farm</span><span className="font-medium">{windFarms.find((w: any) => w.id === windFarmId)?.name || '—'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Type</span><span className="font-medium capitalize">{inspectionType}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Method</span><span className="font-medium">{inspectionMethod === 'skyvisor' ? 'Drone' : 'Manual'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Date</span><span className="font-medium">{scheduledDate}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Campaign</span><span className="font-medium">{campaignName}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Turbines</span><span className="font-medium">{selectedTurbineIds.length} selected</span></div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="px-5 py-2.5 text-sm font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-5 py-2.5 text-sm font-medium bg-[#5A8F5A] text-white rounded-lg hover:bg-[#4a7a4a] disabled:opacity-60 transition"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Inspection →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
