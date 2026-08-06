import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Check } from 'lucide-react';
import { Skeleton } from '@/components/atoms';
import { InspectStep } from '@/components/organisms/InspectStep';
import { AnnotateStep } from '@/components/organisms/AnnotateStep';
import { AnalyzeStep } from '@/components/organisms/AnalyzeStep';
import { useInspection } from '@/hooks/useInspection';

const STEPS = [
  { num: 1, label: '1. INSPECT' },
  { num: 2, label: '2. ANNOTATE' },
  { num: 3, label: '3. ANALYZE' },
  { num: 4, label: '4. RESULTS' },
];

export function InspectionWorkflow() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialStep = Number(searchParams.get('step')) || 1;
  const [currentStep, setCurrentStep] = useState(initialStep);

  // Annotate state preserved across step changes (resets when leaving workflow)
  // Restore from sessionStorage when returning from TurbineDetail (step 4 navigation)
  const [annotateThumbId, setAnnotateThumbId] = useState<string | null>(() => {
    return sessionStorage.getItem(`wf-thumb-${id}`) || null;
  });
  const [annotateBlade, setAnnotateBlade] = useState<string | null>(() => {
    return sessionStorage.getItem(`wf-blade-${id}`) || null;
  });

  const { data: inspection, isLoading } = useInspection(id ?? '');

  // Sync step from URL
  useEffect(() => {
    const stepParam = Number(searchParams.get('step'));
    if (stepParam && stepParam >= 1 && stepParam <= 4) {
      setCurrentStep(stepParam);
    }
  }, [searchParams]);

  const handleStepClick = (step: number) => {
    if (step === 4) {
      // Save annotate state before navigating away
      if (annotateThumbId) sessionStorage.setItem(`wf-thumb-${id}`, annotateThumbId);
      if (annotateBlade) sessionStorage.setItem(`wf-blade-${id}`, annotateBlade);
      // Navigate to TurbineDetail (full results view) with inspection context
      const turbine = inspection?.blade?.turbine ?? inspection?.turbine;
      const windFarm = turbine?.wind_farm ?? inspection?.turbine?.wind_farm;
      if (windFarm && turbine) {
        const campaignParam = inspection?.campaign_id ? `&campaignId=${inspection.campaign_id}` : '';
        navigate(`/assets-wind/${windFarm.id}/turbine/${turbine.id}?inspectionId=${id}${campaignParam}`);
        return;
      }
    }
    setCurrentStep(step);
    setSearchParams({ step: String(step) });
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={toolbarRow}>
          <Skeleton variant="text" width="200px" height="20px" />
        </div>
        <div style={contentStyle}>
          <Skeleton variant="rect" height="400px" />
        </div>
      </div>
    );
  }

  // Render current step content
  const campaignId = inspection?.campaign_id ?? null;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <InspectStep inspection={inspection} isLoading={isLoading} />;
      case 2:
        return <AnnotateStep 
          inspectionId={id ?? ''} 
          inspection={inspection} 
          campaignId={campaignId}
          savedThumbId={annotateThumbId}
          savedBlade={annotateBlade}
          onSelectionChange={(thumbId, blade) => { setAnnotateThumbId(thumbId); setAnnotateBlade(blade); }}
        />;
      case 3:
        return <AnalyzeStep inspectionId={id ?? ''} inspection={inspection} campaignId={campaignId} />;
      default:
        return <InspectStep inspection={inspection} isLoading={isLoading} />;
    }
  };

  // Derive title from inspection (support both blade-based and turbine-based inspections)
  const turbine = inspection?.blade?.turbine ?? inspection?.turbine;
  const windFarm = turbine?.wind_farm ?? inspection?.turbine?.wind_farm;
  const bladePosition = inspection?.blade?.position ?? '—';
  const turbineName = turbine?.name ?? '—';
  const farmName = windFarm?.name ?? '—';

  return (
    <div style={pageStyle}>
      {/* Toolbar matching TurbineDetail style */}
      <div style={toolbarRow}>
        <div style={toolbarLeftSt}>
          <button onClick={() => navigate(-1)} style={backBtnSt} aria-label="Go back">
            <ArrowLeft size={16} />
          </button>
          <span style={breadcrumbSt}>
            {farmName} &gt; {turbineName} &gt; Blade {bladePosition}
          </span>
        </div>
        <div style={toolbarCenterSt}>
          {STEPS.map((step) => (
            <button
              key={step.num}
              type="button"
              style={step.num === currentStep ? phaseBtnActive : phaseBtnNormal}
              onClick={() => handleStepClick(step.num)}
            >
              {step.num < currentStep && <Check size={12} style={{ marginRight: 4 }} />}
              <span style={step.num === currentStep ? phaseLabelActive : phaseLabelNormal}>
                {step.label}
              </span>
            </button>
          ))}
        </div>
        <div style={toolbarRightSt}>
          <div style={searchBarSt}>
            <Search size={14} style={{ color: '#999' }} />
            <input type="text" placeholder="Search all" style={searchInputSt} aria-label="Search" />
          </div>
        </div>
      </div>

      {/* Step content */}
      <div style={contentStyle}>
        {renderStep()}
      </div>
    </div>
  );
}

// ─── Styles matching TurbineDetail toolbar ────────────────────────────────────
const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  fontFamily: 'var(--font-family-sans)',
  overflow: 'hidden',
  background: '#fff',
};

const toolbarRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 20px',
  borderBottom: '1px solid #E5E7EB',
  background: '#fff',
  gap: 12,
  minHeight: 48,
};

const toolbarLeftSt: React.CSSProperties = {
  flex: '0 0 25%',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const toolbarCenterSt: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
};

const toolbarRightSt: React.CSSProperties = {
  flex: '0 0 25%',
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
};

const backBtnSt: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  border: '1px solid #E5E7EB',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
  color: '#555',
};

const breadcrumbSt: React.CSSProperties = {
  fontSize: 13,
  color: '#555',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const phaseBtnNormal: React.CSSProperties = {
  padding: '6px 16px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'var(--font-family-sans)',
  fontSize: 13,
  fontWeight: 500,
  color: '#666',
  borderRadius: 4,
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
};

const phaseBtnActive: React.CSSProperties = {
  padding: '6px 16px',
  border: '2px solid #222',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'var(--font-family-sans)',
  fontSize: 13,
  fontWeight: 700,
  color: '#222',
  borderRadius: 20,
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
};

const phaseLabelNormal: React.CSSProperties = {};
const phaseLabelActive: React.CSSProperties = { fontWeight: 700 };

const searchBarSt: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  border: '1px solid var(--color-neutral-200, #E5E7EB)',
  borderRadius: 'var(--radius-lg, 12px)',
  background: 'var(--color-neutral-0, #ffffff)',
};

const searchInputSt: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  fontSize: 'var(--text-sm, 0.875rem)',
  color: 'var(--color-neutral-800, #1e293b)',
  background: 'transparent',
  width: 140,
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  minHeight: 0,
};
