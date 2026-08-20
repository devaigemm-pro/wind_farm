import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/atoms';
import { InspectStepV2 } from '@/components/organisms/InspectStepV2';
import { AnnotateStepV2 } from '@/components/organisms/AnnotateStepV2';
import { AnalyzeStepV2 } from '@/components/organisms/AnalyzeStepV2';
import { TurbineDetailV2 } from '@/pages/TurbineDetailV2';
import { useInspection } from '@/hooks/useInspection';

const STEPS = [
  { num: 1, label: 'INSPECT', stageValues: ['planned', 'inspect'] },
  { num: 2, label: 'ANNOTATE', stageValues: ['annotate'] },
  { num: 3, label: 'ANALYZE', stageValues: ['analyze'] },
  { num: 4, label: 'RESULTS', stageValues: ['report'] },
];

export function InspectionWorkflowV2() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialStep = Number(searchParams.get('step')) || 0;
  const [currentStep, setCurrentStep] = useState(initialStep || 1);
  const [hasAutoDetected, setHasAutoDetected] = useState(initialStep > 0);

  // Annotate state preserved across step changes — persisted in sessionStorage
  const [annotateThumbId, setAnnotateThumbId] = useState<string | null>(() => {
    return sessionStorage.getItem(`wf-thumb-${id}`) || null;
  });
  const [annotateBlade, setAnnotateBlade] = useState<string | null>(() => {
    return sessionStorage.getItem(`wf-blade-${id}`) || null;
  });

  // Persist annotate state to sessionStorage
  useEffect(() => {
    if (annotateThumbId) sessionStorage.setItem(`wf-thumb-${id}`, annotateThumbId);
    if (annotateBlade) sessionStorage.setItem(`wf-blade-${id}`, annotateBlade);
  }, [annotateThumbId, annotateBlade, id]);

  const { data: inspection, isLoading } = useInspection(id ?? '');

  // Auto-detect step from inspection stage when no explicit step param
  useEffect(() => {
    if (!hasAutoDetected && inspection?.stage) {
      const stageToStep: Record<string, number> = {
        planned: 1,
        inspect: 1,
        annotate: 2,
        analyze: 3,
        report: 4,
      };
      const step = stageToStep[inspection.stage] ?? 1;
      setCurrentStep(step);
      setHasAutoDetected(true);
      if (step !== 1) {
        setSearchParams({ step: String(step) }, { replace: true });
      }
    }
  }, [inspection, hasAutoDetected, setSearchParams]);

  // Sync step from URL changes
  useEffect(() => {
    const stepParam = Number(searchParams.get('step'));
    if (stepParam && stepParam >= 1 && stepParam <= 4) {
      setCurrentStep(stepParam);
    }
  }, [searchParams]);

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
    setSearchParams({ step: String(step) });
  };

  const handleExit = () => {
    // Clean up sessionStorage on exit
    sessionStorage.removeItem(`wf-thumb-${id}`);
    sessionStorage.removeItem(`wf-blade-${id}`);
    navigate(-1);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-white overflow-hidden">
        <div className="flex items-center h-11 px-4 border-b border-gray-100">
          <div className="w-48"><Skeleton variant="text" width="120px" height="16px" /></div>
          <div className="flex-1 flex justify-center"><Skeleton variant="text" width="320px" height="16px" /></div>
          <div className="w-48"><Skeleton variant="text" width="100px" height="16px" /></div>
        </div>
        <div className="flex-1 p-6">
          <Skeleton variant="rect" height="400px" />
        </div>
      </div>
    );
  }

  // Derive info from inspection
  const turbine = inspection?.blade?.turbine ?? inspection?.turbine;
  const turbineId = turbine?.id ?? (inspection as any)?.turbine_id ?? '';
  const windFarm = turbine?.wind_farm ?? inspection?.turbine?.wind_farm;
  const turbineName = turbine?.name ?? '—';
  const farmName = windFarm?.name ?? '—';
  const campaignId = inspection?.campaign_id ?? null;

  // Determine completed steps (all steps before current are "completed")
  const getStepStatus = (stepNum: number): 'completed' | 'active' | 'future' => {
    if (stepNum < currentStep) return 'completed';
    if (stepNum === currentStep) return 'active';
    return 'future';
  };

  // Render current step content
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <InspectStepV2 inspection={inspection} isLoading={isLoading} />;
      case 2:
        return (
          <AnnotateStepV2
            inspectionId={id ?? ''}
            inspection={inspection}
            campaignId={campaignId}
            savedThumbId={annotateThumbId}
            savedBlade={annotateBlade}
            onSelectionChange={(thumbId, blade) => {
              setAnnotateThumbId(thumbId);
              setAnnotateBlade(blade);
            }}
          />
        );
      case 3:
        return (
          <AnalyzeStepV2
            inspectionId={id ?? ''}
            inspection={inspection}
            campaignId={campaignId}
            preselectedDefectId={searchParams.get('defectId') || undefined}
            onOpenPhoto={(photoId, blade) => {
              setAnnotateThumbId(photoId);
              setAnnotateBlade(blade);
              setCurrentStep(2);
              setSearchParams({ step: '2' });
            }}
          />
        );
      case 4:
        return turbineId ? (
          <TurbineDetailV2
            embedded
            embeddedTurbineId={turbineId}
            embeddedInspectionId={id}
            embeddedCampaignId={campaignId}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Skeleton variant="rect" height="300px" />
          </div>
        );
      default:
        return <InspectStepV2 inspection={inspection} isLoading={isLoading} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden font-['Inter',sans-serif]">
      {/* Toolbar — 44px height */}
      <div className="flex items-center h-11 px-4 border-b border-gray-100 bg-white shrink-0">
        {/* Left: Exit button */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <button
            type="button"
            onClick={handleExit}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span>Exit</span>
          </button>
        </div>

        {/* Center: Segmented progress bar */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-0">
            {STEPS.map((step, idx) => {
              const status = getStepStatus(step.num);
              return (
                <div key={step.num} className="flex items-center">
                  {/* Connector line (before node, except first) */}
                  {idx > 0 && (
                    <div
                      className={cn(
                        'w-12 h-0.5 transition-colors',
                        status === 'future' ? 'bg-gray-200' : 'bg-[#5A8F5A]'
                      )}
                    />
                  )}

                  {/* Node + label group */}
                  <button
                    type="button"
                    onClick={() => handleStepClick(step.num)}
                    className="flex flex-col items-center gap-1 cursor-pointer group relative"
                  >
                    {/* Node circle */}
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                        status === 'completed' && 'bg-[#5A8F5A] text-white',
                        status === 'active' && 'bg-[#5A8F5A] text-white ring-4 ring-[#5A8F5A]/20 animate-pulse',
                        status === 'future' && 'border-2 border-gray-300 text-gray-400 bg-white'
                      )}
                    >
                      {status === 'completed' ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : (
                        step.num
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={cn(
                        'text-[10px] tracking-wide whitespace-nowrap transition-colors',
                        status === 'completed' && 'text-[#5A8F5A] font-medium',
                        status === 'active' && 'text-[#5A8F5A] font-bold',
                        status === 'future' && 'text-gray-400 font-normal'
                      )}
                    >
                      {step.label}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Context info */}
        <div className="flex items-center gap-1.5 min-w-[120px] justify-end">
          <span className="text-xs text-gray-500 truncate max-w-[200px]">
            <button
              type="button"
              onClick={() => windFarm?.id && navigate(`/assets-wind/${windFarm.id}`)}
              className="text-[#5A8F5A] hover:underline cursor-pointer"
            >
              {farmName}
            </button>
            <span className="mx-1 text-gray-300">/</span>
            <button
              type="button"
              onClick={() => {
                if (windFarm?.id && turbineId) navigate(`/assets-wind/${windFarm.id}/subasset/${turbineId}`);
              }}
              className="text-[#5A8F5A] hover:underline cursor-pointer"
            >
              {turbineName}
            </button>
          </span>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto min-h-0">
        {renderStep()}
      </div>
    </div>
  );
}
