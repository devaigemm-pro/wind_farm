import { Check } from 'lucide-react';

export interface WorkflowStepperProps {
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
}

const STEPS = [
  { num: 1, label: '1. INSPECT' },
  { num: 2, label: '2. ANNOTATE' },
  { num: 3, label: '3. ANALYZE' },
  { num: 4, label: '4. RESULTS' },
];

export function WorkflowStepper({ currentStep, completedSteps, onStepClick }: WorkflowStepperProps) {
  return (
    <div style={containerStyle}>
      {STEPS.map((step, idx) => {
        const isActive = step.num === currentStep;
        const isCompleted = completedSteps.has(step.num);
        const isClickable = true;

        return (
          <div key={step.num} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              style={{
                ...stepBtnStyle,
                ...(isActive ? activeStyle : isCompleted ? completedStyle : futureStyle),
                cursor: isClickable ? 'pointer' : 'default',
              }}
              onClick={() => isClickable && onStepClick(step.num)}
              disabled={!isClickable}
            >
              {isCompleted && !isActive ? <Check size={14} /> : null}
              <span>{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && <div style={lineStyle(isCompleted || step.num < currentStep)} />}
          </div>
        );
      })}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 0,
  padding: 'var(--space-4) 0',
};

const stepBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  padding: 'var(--space-2) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  border: '2px solid transparent',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  transition: 'all 0.2s ease',
};

const activeStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-primary-500)',
  color: 'white',
  border: '2px solid var(--color-primary-500)',
};

const completedStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-neutral-0)',
  color: 'var(--color-success-600)',
  border: '2px solid var(--color-success-400)',
};

const futureStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-neutral-100)',
  color: 'var(--color-neutral-400)',
  border: '2px solid var(--color-neutral-200)',
};

const lineStyle = (isActive: boolean): React.CSSProperties => ({
  width: '40px',
  height: '2px',
  backgroundColor: isActive ? 'var(--color-success-400)' : 'var(--color-neutral-200)',
  margin: '0 var(--space-1)',
});
