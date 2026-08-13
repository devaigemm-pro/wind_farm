import { useMemo } from 'react';
import { useDefects } from '@/hooks/useDefects';
import { useMultiAnnotations, useCampaignInspectionIds } from '@/hooks/useAnnotations';
import { useInspectionPhotos, getFaceShort } from '@/hooks/useInspectionPhotos';
import { BladesDiagram } from '@/components/organisms/BladesDiagram';
import type { Inspection } from '@/types';

export interface ResultsStepProps {
  inspectionId: string;
  inspection?: Inspection;
  campaignId?: string | null;
}

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  text: '#333B46',
  muted: '#8A9099',
  border: '#E0E0E0',
  bg: '#FFFFFF',
};

function deriveBladeFaceLegacy(thumbnailId: string): { blade: string; face: string } {
  const num = parseInt(thumbnailId.replace('t', ''), 10);
  if (num >= 1 && num <= 4) return { blade: 'A', face: 'LE' };
  if (num >= 5 && num <= 6) return { blade: 'A', face: 'SS' };
  if (num >= 7 && num <= 9) return { blade: 'B', face: 'LE' };
  if (num >= 10 && num <= 12) return { blade: 'B', face: 'SS' };
  if (num >= 13 && num <= 15) return { blade: 'C', face: 'LE' };
  if (num >= 16 && num <= 18) return { blade: 'C', face: 'SS' };
  return { blade: '?', face: '?' };
}

export function ResultsStep({ inspectionId, inspection, campaignId: propCampaignId }: ResultsStepProps) {
  const campaignId = propCampaignId ?? inspection?.campaign_id ?? null;
  const { data: campaignInspIds = [] } = useCampaignInspectionIds(campaignId);

  // Load confirmed defects from DB
  const { data: savedDefects = [], isLoading: defectsLoading } = useDefects(inspectionId);

  // Load annotations to get blade/face/root info for each confirmed defect
  const { data: dbAnnotations = [] } = useMultiAnnotations(
    campaignInspIds.length > 0 ? campaignInspIds : (inspectionId ? [inspectionId] : [])
  );

  // Load photos for blade mapping
  const { data: photos = [] } = useInspectionPhotos(campaignId, null);

  const bladePositionMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    const posLetters: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C' };
    for (const photo of photos) {
      if (!map[photo.bladeId]) {
        map[photo.bladeId] = posLetters[photo.bladePosition] ?? String(photo.bladePosition);
      }
    }
    return map;
  }, [photos]);

  const photoLookup = useMemo(() => {
    const map: Record<string, { blade: string; face: string }> = {};
    for (const photo of photos) {
      map[photo.id] = { blade: bladePositionMap[photo.bladeId] ?? 'A', face: getFaceShort(photo.face) };
    }
    return map;
  }, [photos, bladePositionMap]);

  function deriveBladeFace(thumbnailId: string): { blade: string; face: string } {
    if (photoLookup[thumbnailId]) return photoLookup[thumbnailId];
    return deriveBladeFaceLegacy(thumbnailId);
  }

  // Build annotation lookup by ID
  const annotationMap = useMemo(() => {
    const map: Record<string, typeof dbAnnotations[0]> = {};
    for (const a of dbAnnotations) {
      map[a.id] = a;
    }
    return map;
  }, [dbAnnotations]);

  // Map confirmed defects to BladesDiagram format
  // defect.description stores the annotationId
  const diagramDefects = useMemo(() => {
    const results: { id: string; type: string; cat: number; blade: string; side: string; root: number }[] = [];
    let counter = 0;

    for (const defect of savedDefects) {
      const annotationId = defect.description;
      if (!annotationId) continue;

      const annotation = annotationMap[annotationId];
      if (!annotation) continue;

      counter++;
      const derived = deriveBladeFace(annotation.thumbnailId);
      const blade = derived.blade;
      const face = annotation.side || derived.face;
      const root = Math.round(annotation.y * 0.43 * 10) / 10;

      results.push({
        id: `D${counter}`,
        type: annotation.type,
        cat: annotation.category,
        blade,
        side: face,
        root,
      });
    }

    return results;
  }, [savedDefects, annotationMap, photoLookup]);

  // Loading
  if (defectsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #eee', borderTopColor: '#4CAF50', animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: 13, color: '#888' }}>Loading results...</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (diagramDefects.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, padding: 48 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: '#555', margin: 0 }}>No confirmed defects</h3>
        <p style={{ fontSize: 14, color: '#888', margin: 0, textAlign: 'center', maxWidth: 400 }}>
          Go to step 3 (Analyze) and confirm annotations as defects to see them here.
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h5 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>
          Inspection Results — {diagramDefects.length} defect{diagramDefects.length !== 1 ? 's' : ''} confirmed
        </h5>
      </div>
      <div style={diagramContainerStyle}>
        <BladesDiagram
          defects={diagramDefects}
          bladeSerials={{ A: 'Blade A', B: 'Blade B', C: 'Blade C' }}
        />
      </div>
      {/* Summary table */}
      <div style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Blade</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Face</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Root (m)</th>
            </tr>
          </thead>
          <tbody>
            {diagramDefects.map((d) => (
              <tr key={d.id}>
                <td style={tdStyle}>{d.id}</td>
                <td style={tdStyle}>{d.blade}</td>
                <td style={tdStyle}>{d.type}</td>
                <td style={tdStyle}>{d.side}</td>
                <td style={tdStyle}>{d.cat}</td>
                <td style={tdStyle}>{d.root}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  background: '#F5F5F5',
  padding: 16,
  gap: 16,
};

const headerStyle: React.CSSProperties = {
  background: C.bg,
  padding: '12px 16px',
  borderRadius: 8,
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
};

const diagramContainerStyle: React.CSSProperties = {
  flex: 1,
  background: C.bg,
  borderRadius: 8,
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  overflow: 'hidden',
  minHeight: 300,
};

const tableContainerStyle: React.CSSProperties = {
  background: C.bg,
  borderRadius: 8,
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  padding: 16,
  maxHeight: 200,
  overflowY: 'auto',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  padding: '6px 8px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 11,
  color: C.muted,
  borderBottom: `1px solid ${C.border}`,
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: `1px solid #F0F1F3`,
  fontSize: 12,
  color: C.text,
};
