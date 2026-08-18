import { useSearchParams } from 'react-router-dom';
import { DefectCompareViewer } from '@/components/organisms/DefectCompareViewer';

/**
 * Standalone page for defect comparison — opened in a new browser tab.
 */
export function ComparePage() {
  const [params] = useSearchParams();

  const currentImage = params.get('image') ?? '';
  const currentDate = params.get('date') ?? new Date().toISOString();
  const defectType = params.get('type') ?? '';
  const defectSeverity = Number(params.get('severity') ?? 3);
  const distanceFromRoot = Number(params.get('distance') ?? 0);
  const side = params.get('side') ?? '';
  const blade = params.get('blade') ?? 'A';
  const bladeId = params.get('bladeId') ?? '';
  const inspectionId = params.get('inspectionId') ?? '';
  const annotX = params.get('ax') ? Number(params.get('ax')) : undefined;
  const annotY = params.get('ay') ? Number(params.get('ay')) : undefined;
  const annotW = params.get('aw') ? Number(params.get('aw')) : undefined;
  const annotH = params.get('ah') ? Number(params.get('ah')) : undefined;
  const annotAngle = params.get('aa') ? Number(params.get('aa')) : undefined;

  return (
    <DefectCompareViewer
      onClose={() => window.close()}
      currentImage={currentImage}
      currentDate={currentDate}
      defectType={defectType}
      defectSeverity={defectSeverity}
      distanceFromRoot={distanceFromRoot}
      side={side}
      blade={blade}
      bladeId={bladeId}
      inspectionId={inspectionId}
      annotX={annotX}
      annotY={annotY}
      annotW={annotW}
      annotH={annotH}
      annotAngle={annotAngle}
    />
  );
}
