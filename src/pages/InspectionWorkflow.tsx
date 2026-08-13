import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/atoms';
import { InspectStep } from '@/components/organisms/InspectStep';
import { AnnotateStep } from '@/components/organisms/AnnotateStep';
import { AnalyzeStep } from '@/components/organisms/AnalyzeStep';
import { TurbineDetail } from '@/pages/TurbineDetail';
import { useInspection } from '@/hooks/useInspection';

const STEPS = [
  { num: 1, label: '1. inspect', value: 'inspected' },
  { num: 2, label: '2. annotate', value: 'uploaded' },
  { num: 3, label: '3. analyze', value: 'annotated' },
  { num: 4, label: '4. results', value: 'analyzed' },
];

export function InspectionWorkflow() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialStep = Number(searchParams.get('step')) || 0; // 0 means "auto-detect from stage"
  const [currentStep, setCurrentStep] = useState(initialStep || 1);
  const [hasAutoDetected, setHasAutoDetected] = useState(initialStep > 0);

  // Annotate state preserved across step changes (resets when leaving workflow)
  // Restore from sessionStorage when returning from TurbineDetail (step 4 navigation)
  const [annotateThumbId, setAnnotateThumbId] = useState<string | null>(() => {
    return sessionStorage.getItem(`wf-thumb-${id}`) || null;
  });
  const [annotateBlade, setAnnotateBlade] = useState<string | null>(() => {
    return sessionStorage.getItem(`wf-blade-${id}`) || null;
  });

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
  }, [inspection, hasAutoDetected, setSearchParams, navigate, id]);

  // Sync step from URL
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

  // Derive title from inspection (support both blade-based and turbine-based inspections)
  const turbine = inspection?.blade?.turbine ?? inspection?.turbine;
  const turbineId = turbine?.id ?? (inspection as any)?.turbine_id ?? '';
  const windFarm = turbine?.wind_farm ?? inspection?.turbine?.wind_farm;
  const turbineName = turbine?.name ?? '—';
  const farmName = windFarm?.name ?? '—';

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
        return <AnalyzeStep inspectionId={id ?? ''} inspection={inspection} campaignId={campaignId} onOpenPhoto={(photoId, blade) => {
          setAnnotateThumbId(photoId);
          setAnnotateBlade(blade);
          setCurrentStep(2);
          setSearchParams({ step: '2' });
        }} />;
      case 4:
        return turbineId ? (
          <TurbineDetail 
            embedded 
            embeddedTurbineId={turbineId} 
            embeddedInspectionId={id} 
            embeddedCampaignId={campaignId} 
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Skeleton variant="rect" height="300px" />
          </div>
        );
      default:
        return <InspectStep inspection={inspection} isLoading={isLoading} />;
    }
  };

  return (
    <div style={pageStyle}>
      {/* Toolbar matching Skyvisor original */}
      <div style={toolbarRow}>
        <div style={gridContainer}>
          {/* Left: breadcrumb (3/12) */}
          <div style={gridLeft}>
            <div style={pageTitleSt}>
              <a onClick={() => windFarm?.id && navigate(`/assets-wind/${windFarm.id}`)} style={linkStyle}>
                {farmName}
              </a>
              <span> &gt; </span>
              <a onClick={() => {
                if (windFarm?.id && turbineId) navigate(`/assets-wind/${windFarm.id}/subasset/${turbineId}`);
              }} style={linkStyle}>
                {turbineName}
              </a>
              <span> &gt; </span>
              <span style={linkStyle}>
                {inspection?.completed_at || inspection?.scheduled_date
                  ? new Date(inspection.completed_at || inspection.scheduled_date).toLocaleDateString()
                  : '—'}
              </span>
            </div>
          </div>

          {/* Center: step buttons (5/12) */}
          <div style={gridCenter}>
            <div style={stepButtonsContainer}>
              {STEPS.map((step) => (
                <button
                  key={step.num}
                  type="button"
                  style={step.num === currentStep ? stepBtnHighlight : stepBtnNormal}
                  onClick={() => handleStepClick(step.num)}
                  value={step.value}
                >
                  <span style={step.num === currentStep ? stepLabelHighlight : stepLabelNormal}>
                    {step.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: search button (4/12) */}
          <div style={gridRight}>
            <div style={rightContent}>
              <div />
              <div>
                <button style={searchBtn} type="button" title="Search all">
                  <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
              </div>
            </div>
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

// ─── Styles matching Skyvisor toolbar ──────────────────────────────────────────
const pageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  // Cancel Layout's padding and fill the entire available space
  margin: 'calc(-1 * var(--space-6))',
  height: 'calc(100vh - 64px)', // 64px = TopBar height
  fontFamily: 'var(--font-family-sans)',
  overflow: 'hidden',
  background: '#fff',
};

const toolbarRow: React.CSSProperties = {
  padding: '8px 16px',
  borderBottom: '1px solid #E5E7EB',
  background: '#fff',
  minHeight: 48,
};

const gridContainer: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '3fr 5fr 4fr',
  alignItems: 'center',
  width: '100%',
};

const gridLeft: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

const gridCenter: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const gridRight: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
};

const pageTitleSt: React.CSSProperties = {
  fontSize: 14,
  color: '#555',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const linkStyle: React.CSSProperties = {
  color: '#00A6FF',
  cursor: 'pointer',
  textDecoration: 'none',
  fontSize: 14,
};

const stepButtonsContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
};

const stepBtnNormal: React.CSSProperties = {
  padding: '6px 16px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'var(--font-family-sans)',
  fontSize: 14,
  fontWeight: 400,
  color: '#666',
  outline: 'none',
};

const stepBtnHighlight: React.CSSProperties = {
  padding: '6px 16px',
  border: '2px solid #222',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'var(--font-family-sans)',
  fontSize: 14,
  fontWeight: 700,
  color: '#222',
  borderRadius: 20,
  outline: 'none',
};

const stepLabelNormal: React.CSSProperties = {
  fontWeight: 400,
};

const stepLabelHighlight: React.CSSProperties = {
  fontWeight: 700,
};

const rightContent: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
};

const searchBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 12px',
  border: '1px solid #00A6FF',
  borderRadius: 4,
  background: 'transparent',
  color: '#00A6FF',
  cursor: 'pointer',
  fontSize: 16,
  outline: 'none',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  minHeight: 0,
};
