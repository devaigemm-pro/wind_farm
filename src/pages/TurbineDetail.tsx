import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Info, CheckCircle, BarChart3, ListFilter, Pencil, Plus, FileDown, Share2, ArrowLeft, Check } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from 'recharts';
import { useLanguage } from '@/components/design-system';
import { BladesDiagram } from '@/components/organisms/BladesDiagram';
import { ExportPanel } from '@/components/organisms/ExportPanel';
import { SharePopover } from '@/components/molecules/SharePopover';
import { useTurbineInspection, type TurbineDefect } from '@/hooks/useTurbineInspection';
import { useMultiAnnotations, useCampaignInspectionIds, usePhotoBladeMap } from '@/hooks/useAnnotations';
import { useAnnotationComments, useAddAnnotationComment } from '@/hooks/useAnnotationComments';
import { useAuth } from '@/hooks/useAuth';
import { useInspectionPhotos, getPhotoPublicUrl } from '@/hooks/useInspectionPhotos';
import { useDefects } from '@/hooks/useDefects';
import type { ResultsDefect } from '@/types';

// ─── Palette (matches reference) ─────────────────────────────────────────────
const C = {
  cat5: '#FF0000',
  cat4: '#FF5500',
  cat3: '#F29D00',
  cat2: '#006C7A',
  cat1: '#008F98',
  amber: '#F29D00',
  orange: '#FF5500',
  blue: '#4CAF50',
  ring: '#EDEFF1',
  text: '#535353',
  muted: '#8A9099',
  border: '#E5E7EB',
};

// ─── Thumbnail → blade/face mapping (same as AnalyzeStep) ────────────────────
function deriveBladeFace(thumbnailId: string): { blade: string; face: string } {
  // Legacy t1-t18 format
  if (thumbnailId.startsWith('t')) {
    const num = parseInt(thumbnailId.replace('t', ''), 10);
    if (num >= 1 && num <= 4) return { blade: 'A', face: 'LE' };
    if (num >= 5 && num <= 6) return { blade: 'A', face: 'SS' };
    if (num >= 7 && num <= 9) return { blade: 'B', face: 'LE' };
    if (num >= 10 && num <= 12) return { blade: 'B', face: 'SS' };
    if (num >= 13 && num <= 15) return { blade: 'C', face: 'LE' };
    if (num >= 16 && num <= 18) return { blade: 'C', face: 'SS' };
  }
  // UUID-based IDs from real photos — derive from annotation data not available here
  return { blade: '?', face: '?' };
}

function imageForType(_type: string): string {
  return '';
}

export interface TurbineDetailProps {
  shared?: boolean;
  embedded?: boolean;
  embeddedTurbineId?: string;
  embeddedInspectionId?: string;
  embeddedCampaignId?: string | null;
}

export function TurbineDetail({ shared = false, embedded = false, embeddedTurbineId, embeddedInspectionId, embeddedCampaignId }: TurbineDetailProps) {
  const { windFarmId, turbineId: urlTurbineId } = useParams<{ windFarmId: string; turbineId: string }>();
  const [searchParams] = useSearchParams();
  const turbineId = embeddedTurbineId || urlTurbineId;
  const filterInspectionId = embeddedInspectionId || searchParams.get('inspectionId');
  const filterCampaignId = embeddedCampaignId !== undefined ? embeddedCampaignId : searchParams.get('campaignId');
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();
  const isSharedView = shared;
  const { data: inspectionData, isLoading } = useTurbineInspection(turbineId ?? '');

  // Get inspection IDs for the specific campaign (when coming from workflow)
  const { data: campaignInspIds = [] } = useCampaignInspectionIds(filterCampaignId);

  // Determine which inspections to load annotations for:
  // - If campaignId is provided, load ALL inspections from that campaign (all blades)
  // - If only inspectionId, use that as fallback
  // - Otherwise, load all of the turbine
  const annotationInspectionIds = useMemo(() => {
    if (filterCampaignId && campaignInspIds.length > 0) {
      return campaignInspIds;
    }
    if (filterInspectionId) {
      return [filterInspectionId];
    }
    return inspectionData?.inspectionIds ?? [];
  }, [filterCampaignId, campaignInspIds, filterInspectionId, inspectionData]);

  const { data: dbAnnotations = [] } = useMultiAnnotations(annotationInspectionIds);

  // Load photo → blade_id (fast, no signed URLs — unblocks blade diagram)
  const { data: photoBladeRawMap = {}, isLoading: photoMapsLoading } = usePhotoBladeMap(filterCampaignId);

  // Load inspection photos for viewer-quality URLs (same source as ANNOTATE step)
  const { data: inspectionPhotos = [] } = useInspectionPhotos(filterCampaignId, null);

  // Build photo.id → full resolution URL map from loaded inspection photos
  const photoPathMap = useMemo<Record<string, string>>(() => {
    if (inspectionPhotos.length === 0) return {};
    const map: Record<string, string> = {};
    for (const photo of inspectionPhotos) {
      // Use full resolution (no transform) for RESULTS - maximum quality
      map[photo.id] = getPhotoPublicUrl(photo.storagePath, 'full');
    }
    return map;
  }, [inspectionPhotos]);

  // Map DB annotations to TurbineDefect format
  // Wait for photoBladeMap when campaignId is present to avoid flash of all defects on blade A
  const annotationDefects = useMemo<TurbineDefect[]>(() => {
    if (!dbAnnotations || dbAnnotations.length === 0) return [];
    if (filterCampaignId && photoMapsLoading) return [];
    const inspToBladeMap = inspectionData?.inspectionToBladePosition ?? {};

    // Build blade_id (UUID) → position letter lookup from inspectionData.blades
    const bladeIdToLetter: Record<string, string> = {};
    if (inspectionData?.blades) {
      for (const b of inspectionData.blades) {
        bladeIdToLetter[b.id] = b.position; // position is already 'A', 'B', 'C'
      }
    }

    // Fallback: if inspectionData is null but we have photoBladeRawMap with blade_ids,
    // try to derive position from the order of unique blade_ids (1=A, 2=B, 3=C)
    if (Object.keys(bladeIdToLetter).length === 0 && Object.keys(photoBladeRawMap).length > 0) {
      const uniqueBladeIds = [...new Set(Object.values(photoBladeRawMap))];
      const posLetters = ['A', 'B', 'C'];
      uniqueBladeIds.forEach((bid, idx) => {
        if (idx < 3) bladeIdToLetter[bid] = posLetters[idx]!;
      });
    }

    const counters: Record<string, number> = {};
    return dbAnnotations.map((a) => {
      // Derive blade: photo blade_id → letter (most reliable for multi-blade inspections)
      const photoBladeId = photoBladeRawMap[a.thumbnailId];
      const bladeFromPhoto = photoBladeId ? bladeIdToLetter[photoBladeId] : undefined;
      const rawBlade = bladeFromPhoto || inspToBladeMap[a.inspectionId] || deriveBladeFace(a.thumbnailId).blade;
      const blade = rawBlade === '?' ? 'A' : rawBlade;
      // Use saved side field (from annotation), with fallback
      const face = a.side || (deriveBladeFace(a.thumbnailId).face !== '?' ? deriveBladeFace(a.thumbnailId).face : 'LE');
      counters[blade] = (counters[blade] || 0) + 1;
      const displayId = `${blade}${counters[blade]}`;
      return {
        id: a.id,
        displayId,
        type: a.type,
        cat: a.category,
        blade,
        side: face,
        root: Math.round(a.y * 0.43 * 10) / 10,
        size: `${Math.round(a.w)} x ${Math.round(a.h)}`,
        description: a.note,
        resolved: false,
        images: photoPathMap[a.thumbnailId] ? [photoPathMap[a.thumbnailId]!] : [],
        notes: a.note,
        rootCause: a.rootCause,
        nextStep: a.nextStep,
        comments: [],
      };
    });
  }, [dbAnnotations, inspectionData, photoBladeRawMap, photoPathMap, filterCampaignId, photoMapsLoading]);

  const [tab, setTab] = useState<'statistics' | 'details'>(() => {
    return searchParams.get('tab') === 'details' ? 'details' : 'statistics';
  });
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(() => {
    return searchParams.get('defectId') || null;
  });
  const [resolvedMap, setResolvedMap] = useState<Record<string, boolean>>({});
  const [filterType, setFilterType] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterBlade, setFilterBlade] = useState<string>('');
  const [filterSide, setFilterSide] = useState<string>('');
  const [exportAnchorEl, setExportAnchorEl] = useState<HTMLElement | null>(null);
  const exportOpen = Boolean(exportAnchorEl);
  const [shareAnchor, setShareAnchor] = useState<HTMLElement | null>(null);

  // Use defects source:
  // - When coming from workflow (campaignId present), use ONLY annotations that are confirmed as defects
  //   (have a matching record in the defect table with description = annotationId)
  // - Otherwise, use defects table (for general turbine view)
  const { data: confirmedDefectRecords = [] } = useDefects(filterInspectionId ?? '');
  const confirmedAnnotationIds = useMemo<Set<string>>(() => {
    const ids = new Set<string>();
    for (const d of confirmedDefectRecords) {
      if (d.description) ids.add(d.description);
    }
    return ids;
  }, [confirmedDefectRecords]);

  const defects: TurbineDefect[] = useMemo(() => {
    if (filterCampaignId || filterInspectionId) {
      return annotationDefects.filter(d => confirmedAnnotationIds.size === 0 ? true : confirmedAnnotationIds.has(d.id));
    }
    return (inspectionData?.defects && inspectionData.defects.length > 0)
      ? inspectionData.defects
      : annotationDefects;
  }, [filterCampaignId, filterInspectionId, annotationDefects, confirmedAnnotationIds, inspectionData]);
  const windFarmName = inspectionData?.windFarmName ?? '';
  const turbineName = inspectionData?.turbineName ?? '';
  const inspectionDate = inspectionData?.inspectionDate
    ? new Date(inspectionData.inspectionDate).toLocaleDateString('en-US')
    : '';
  const bladeLength = inspectionData?.bladeLength ?? 43;
  const bladeSerials: Record<string, string> = useMemo(() => {
    if (inspectionData?.blades) {
      const map: Record<string, string> = {};
      for (const b of inspectionData.blades) {
        map[b.position] = b.serialNumber;
      }
      return map;
    }
    return { A: '—', B: '—', C: '—' };
  }, [inspectionData]);

  // Initialize resolved map when defects change
  useEffect(() => {
    const map: Record<string, boolean> = {};
    defects.forEach((d) => { map[d.displayId] = d.resolved ?? false; });
    setResolvedMap(map);
  }, [defects]);

  // Computed stats from real data
  const catCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    defects.forEach((d) => { if (d.cat >= 1 && d.cat <= 5) counts[d.cat] = (counts[d.cat] ?? 0) + 1; });
    return counts;
  }, [defects]);

  const typeBreakdown = useMemo(() => {
    const map: Record<string, { total: number; cats: Record<number, number> }> = {};
    defects.forEach((d) => {
      if (!map[d.type]) map[d.type] = { total: 0, cats: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
      map[d.type]!.total++;
      map[d.type]!.cats[d.cat] = (map[d.type]!.cats[d.cat] ?? 0) + 1;
    });
    return Object.entries(map)
      .map(([type, data]) => ({
        type,
        short: type.length > 14 ? type.substring(0, 12) + '...' : type,
        total: data.total,
        cat5: data.cats[5] ?? 0,
        cat4: data.cats[4] ?? 0,
        cat3: data.cats[3] ?? 0,
        cat2: data.cats[2] ?? 0,
        cat1: data.cats[1] ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [defects]);

  const donutData = useMemo(() => {
    const bladeLetters = ['A', 'B', 'C'];
    return bladeLetters.map((bl) => {
      const bladeDefects = defects.filter((d) => d.blade === bl);
      const highSev = bladeDefects.filter((d) => d.cat >= 4).length;
      const total = bladeDefects.length;
      return { label: `Blade ${bl}`, orange: total > 0 ? Math.round((highSev / total) * 100) : 0 };
    });
  }, [defects]);

  // Filtered defects for Details tab
  const filteredDefects = useMemo(() => {
    return defects.filter((d) => {
      if (filterType && d.type !== filterType) return false;
      if (filterCategory && d.cat !== Number(filterCategory)) return false;
      if (filterBlade && d.blade !== filterBlade) return false;
      if (filterSide && d.side !== filterSide) return false;
      return true;
    });
  }, [defects, filterType, filterCategory, filterBlade, filterSide]);

  const handleDefectClick = (defectId: string) => {
    setSelectedDefectId(defectId);
    setTab('details');
  };

  const handleResolvedToggle = (defectId: string) => {
    setResolvedMap((prev) => ({ ...prev, [defectId]: !prev[defectId] }));
  };

  const resolvedCount = Object.values(resolvedMap).filter(Boolean).length;

  // Unique values for filters
  const uniqueTypes = useMemo(() => [...new Set(defects.map((d) => d.type))], [defects]);
  const uniqueBlades = useMemo(() => [...new Set(defects.map((d) => d.blade))].sort(), [defects]);
  const uniqueSides = useMemo(() => [...new Set(defects.map((d) => d.side))].sort(), [defects]);

  // Map defectId (from URL) to displayId when defects load
  const urlDefectId = searchParams.get('defectId');
  const urlTab = searchParams.get('tab');
  useEffect(() => {
    if (defects.length === 0) return;
    if (urlDefectId) {
      const match = defects.find((d) => d.id === urlDefectId);
      if (match && selectedDefectId !== match.displayId) {
        setSelectedDefectId(match.displayId);
        setTab('details');
      }
    } else if (urlTab === 'details') {
      setSelectedDefectId(defects[0]!.displayId);
    }
  }, [defects, urlDefectId, urlTab]);

  // Scroll to selected defect row when switching to details
  useEffect(() => {
    if (tab === 'details' && selectedDefectId) {
      setTimeout(() => {
        const el = document.getElementById(`defect-row-${selectedDefectId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [tab, selectedDefectId]);

  // Map defects for BladesDiagram (needs id as the display id)
  const diagramDefects = useMemo(() => defects.map((d) => ({
    id: d.displayId,
    type: d.type,
    cat: d.cat,
    blade: d.blade,
    side: d.side,
    root: d.root,
  })), [defects]);

  if (isLoading) {
    return <div style={page}><div style={{ padding: 40, textAlign: 'center', color: C.muted }}>{t('turbineDetail.loadingData')}</div></div>;
  }

  if (!inspectionData) {
    return (
      <div style={page}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, padding: 48 }}>
          <Info size={48} color="#ccc" />
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#555', margin: 0 }}>{t('turbineDetail.noInspections')}</h3>
          <p style={{ fontSize: 14, color: '#888', margin: 0, textAlign: 'center', maxWidth: 400 }}>
            {t('turbineDetail.noInspectionsDesc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      {/* Toolbar: breadcrumb + phases + actions (hidden in shared/embedded view) */}
      {!isSharedView && !embedded && (
        <div style={toolbarRow}>
          <div style={{ ...toolbarLeftSt, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              aria-label={t('general.back')}
              onClick={() => navigate(-1)}
              style={{ width: 32, height: 32, border: '1px solid #E5E7EB', borderRadius: 6, background: 'var(--color-neutral-0)', cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
            >
              <ArrowLeft size={16} />
            </button>
            <div style={breadcrumbSt}>
              <Link to={`/assets-wind/${windFarmId}`} style={bcLinkSt}>{windFarmName}</Link>
              <span style={bcSepSt}>&gt;</span>
              <a onClick={() => { if (windFarmId && turbineId) navigate(`/assets-wind/${windFarmId}/subasset/${turbineId}`); }} style={bcLinkSt}>{turbineName}</a>
              <span style={bcSepSt}>&gt;</span>
              <span style={{ ...bcLinkSt, color: '#555', cursor: 'default' }}>{inspectionDate}</span>
            </div>
          </div>
          <div style={toolbarCenterSt}>
            {[
              { num: 1, label: t('turbineDetail.phase1') },
              { num: 2, label: t('turbineDetail.phase2') },
              { num: 3, label: t('turbineDetail.phase3') },
              { num: 4, label: t('turbineDetail.phase4') },
            ].map((step) => (
              <button
                key={step.num}
                type="button"
                style={step.num === 4 ? phaseBtnActive : phaseBtnNormal}
                onClick={() => {
                  if (step.num === 4) return; // Already on results
                  const targetInspId = filterInspectionId || inspectionData?.inspectionId;
                  if (targetInspId) {
                    navigate(`/inspections/${targetInspId}/workflow?step=${step.num}`);
                  }
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, ...(step.num === 4 ? phaseLabelActive : phaseLabelNormal) }}>
                  {step.num < 4 && <Check size={14} strokeWidth={2.5} />}
                  {step.label}
                </span>
              </button>
            ))}
          </div>
          <div style={toolbarRightSt} />
        </div>
      )}

      {/* Top bar */}
      <div style={topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ color: C.blue, fontSize: 20, fontWeight: 700, margin: 0 }}>{t('turbineDetail.blades')}</h2>
          <span style={infoDot}><Info size={16} color="#fff" /></span>
        </div>
        <div style={tabRow}>
          <button style={{ ...tabBtn, ...(tab === 'statistics' ? tabActive : {}) }} onClick={() => setTab('statistics')}>
            <BarChart3 size={15} /> {t('turbineDetail.statistics')}
          </button>
          <button style={{ ...tabBtn, ...(tab === 'details' ? tabActive : {}) }} onClick={() => setTab('details')}>
            <ListFilter size={15} /> {t('turbineDetail.details')}
          </button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: '1.5px solid #4CAF50', background: 'transparent', color: '#4CAF50', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={(e) => setExportAnchorEl(e.currentTarget)}
          >
            <FileDown size={14} />
            {t('button.export')}
          </button>
          {!isSharedView && (
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#4CAF50', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
              onClick={(e) => setShareAnchor(e.currentTarget)}
            >
              <Share2 size={14} />
              {t('button.share')}
            </button>
          )}
        </div>
      </div>

      <SharePopover
        anchorEl={shareAnchor}
        open={Boolean(shareAnchor)}
        onClose={() => setShareAnchor(null)}
        shareKey={`turbine-${turbineId}`}
        windFarmId={windFarmId}
        turbineId={turbineId}
      />

      <ExportPanel
        inspectionId={filterInspectionId || inspectionData?.inspectionId || ''}
        defects={defects.map((d): ResultsDefect => ({
          id: d.id,
          displayId: d.displayId,
          type: d.type,
          severity: d.cat,
          blade: d.blade,
          side: d.side,
          distanceFromRoot: d.root,
          widthCm: d.size ? parseFloat(d.size.split(' x ')[0] ?? '0') : null,
          heightCm: d.size ? parseFloat(d.size.split(' x ')[1] ?? '0') : null,
          description: d.description,
          resolved: resolvedMap[d.displayId] ?? d.resolved ?? false,
          images: d.images,
          notes: d.notes,
          rootCause: d.rootCause,
          nextStep: d.nextStep,
        }))}
        turbineName={turbineName}
        windFarmName={windFarmName}
        anchorEl={exportAnchorEl}
        open={exportOpen}
        onClose={() => setExportAnchorEl(null)}
        existingReport={null}
        blades={inspectionData?.blades}
        bladeLength={inspectionData?.bladeLength}
        inspectionDate={inspectionData?.inspectionDate}
        windFarmCoords={inspectionData?.windFarmCoords}
        windFarmId={windFarmId}
        turbineId={turbineId}
        campaignId={filterCampaignId ?? undefined}
      />

      <div style={body}>
        {/* ── Column 1: Blades ── */}
        <div style={col1}>
          <BladesDiagram
            defects={diagramDefects}
            bladeSerials={bladeSerials}
            bladeLength={bladeLength}
            selectedDefectId={selectedDefectId}
            onDefectClick={handleDefectClick}
          />
          <div style={counters}>
            <span style={counterItem}><Info size={15} color={C.blue} /> <b>{defects.length}</b> {t('turbineDetail.defects')}</span>
            <span style={counterItem}><CheckCircle size={15} color={C.cat1} /> <b>{resolvedCount}</b> {t('turbineDetail.resolved')}</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            <h3 style={{ color: C.blue, fontSize: 17, margin: '0 0 10px' }}>{t('turbineDetail.conclusion')}</h3>
            <p style={conclText}><b>Turbine ({turbineName}):</b><br /><i>{t('turbineDetail.noConclusion')}</i></p>
            {Object.entries(bladeSerials).map(([pos, serial]) => (
              <p key={pos} style={conclText}><b>Blade {pos} ({serial}):</b><br /><i>No conclusion for this blade.</i></p>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isSharedView && role !== 'supervisor' && (
              <button style={planBtn} onClick={() => navigate(`/inspections/new?windFarm=${windFarmId}`)}>
                {t('button.planNextInspection')}
              </button>
            )}
          </div>
        </div>

        {tab === 'statistics' ? (
          <>
            {/* ── Column 2: Breakdown by blade ── */}
            <div style={col2}>
              <h3 style={cardTitle}>{t('turbineDetail.breakdownByBlade')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
                {donutData.map((d) => (
                  <Donut key={d.label} label={d.label} orange={d.orange} />
                ))}
              </div>
            </div>

            {/* ── Column 3: Category + Type + Table ── */}
            <div style={col3}>
              <div style={card}>
                <h3 style={cardTitle}>{t('turbineDetail.breakdownByCategory')}</h3>
                <div style={catRow}>
                  {[
                    { n: 5, v: catCounts[5], c: C.cat5 },
                    { n: 4, v: catCounts[4], c: C.cat4 },
                    { n: 3, v: catCounts[3], c: C.cat3 },
                    { n: 2, v: catCounts[2], c: C.cat2 },
                    { n: 1, v: catCounts[1], c: C.cat1 },
                  ].map((c) => (
                    <div key={c.n} style={catCell}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: C.text }}>{c.v}</span>
                      <div style={{ height: 3, width: '100%', background: c.c, borderRadius: 2, margin: '6px 0' }} />
                      <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{`${t('turbineDetail.cat')} ${c.n}`}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={card}>
                <h3 style={cardTitle}>{t('turbineDetail.breakdownByType')}</h3>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
                      <CartesianGrid vertical={false} stroke={C.border} />
                      <XAxis dataKey="short" tick={{ fontSize: 9, fill: C.muted }} interval={0} angle={0} />
                      <YAxis tick={{ fontSize: 10, fill: C.muted }} />
                      <RTooltip
                        formatter={(val: number, name: string) => [val, name === 'cat4' ? `${t('turbineDetail.cat')} 4` : name === 'cat5' ? `${t('turbineDetail.cat')} 5` : `${t('turbineDetail.cat')} 3`]}
                        contentStyle={{ fontSize: 11, borderRadius: 6 }}
                      />
                      <Bar dataKey="cat3" stackId="a" fill={C.cat3} />
                      <Bar dataKey="cat4" stackId="a" fill={C.cat4} />
                      <Bar dataKey="cat5" stackId="a" fill={C.cat5} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={card}>
                <h3 style={cardTitle}>{t('turbineDetail.defectOverview')}</h3>
                <OverviewTable typeBreakdown={typeBreakdown} catCounts={catCounts} totalDefects={defects.length} />
              </div>
            </div>
          </>
        ) : (
          /* ── Details tab ── */
          <div style={{ display: 'flex', flex: 1, gap: 16, minWidth: 0 }}>
            <div style={{ flex: '1 1 60%', minWidth: 0 }}>
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={cardTitle}>{t('turbineDetail.defectsDetail')}</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select style={filterSelect} value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Filter by type">
                      <option value="">{t('turbineDetail.filterType')}</option>
                      {uniqueTypes.map((t2) => <option key={t2} value={t2}>{t2}</option>)}
                    </select>
                    <select style={filterSelect} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} aria-label="Filter by category">
                      <option value="">{t('turbineDetail.filterCategory')}</option>
                      {[5, 4, 3, 2, 1].map((c) => <option key={c} value={c}>{`${t('turbineDetail.cat')} ${c}`}</option>)}
                    </select>
                    <select style={filterSelect} value={filterBlade} onChange={(e) => setFilterBlade(e.target.value)} aria-label="Filter by blade">
                      <option value="">{t('turbineDetail.filterBlade')}</option>
                      {uniqueBlades.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select style={filterSelect} value={filterSide} onChange={(e) => setFilterSide(e.target.value)} aria-label="Filter by side">
                      <option value="">{t('turbineDetail.filterSide')}</option>
                      {uniqueSides.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <DetailsTable defects={filteredDefects} selectedId={selectedDefectId} onSelect={setSelectedDefectId} onEdit={(id) => navigate(`/inspections/${inspectionData?.inspectionId ?? id}/workflow?step=3`)} resolvedMap={resolvedMap} onResolvedToggle={handleResolvedToggle} readonly={isSharedView || role === 'supervisor'} />
              </div>
            </div>
            {selectedDefectId && (
              <div style={{ flex: '0 0 38%', minWidth: 0 }}>
                <DefectDetailPanel defect={defects.find((d) => d.displayId === selectedDefectId) ?? null} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Defect Detail Panel (Note/Root Cause/Next Step, Comments, Images) ───────
function DefectDetailPanel({ defect }: { defect: TurbineDefect | null }) {
  const { role } = useAuth();
  const { t } = useLanguage();
  const isSupervisor = role === 'supervisor';
  const [zoomLevels, setZoomLevels] = useState<Record<number, number>>({});
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [showCommentPopover, setShowCommentPopover] = useState(false);
  const [commentText, setCommentText] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  const { data: dbComments = [] } = useAnnotationComments(defect?.id);
  const addComment = useAddAnnotationComment(defect?.id);

  if (!defect) return null;

  const handleZoom = (idx: number, direction: 'in' | 'out') => {
    setZoomLevels((prev) => {
      const current = prev[idx] ?? 1;
      const next = direction === 'in' ? Math.min(current + 0.25, 4) : Math.max(current - 0.25, 0.5);
      return { ...prev, [idx]: next };
    });
  };

  const handleDownloadJpeg = async (imgSrc: string, idx: number) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imgSrc;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `defect-${defect.displayId}-image-${idx + 1}.jpeg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        'image/jpeg',
        0.92
      );
    } catch {
      window.open(imgSrc, '_blank');
    }
  };

  const openLightbox = (img: string) => {
    setLightboxZoom(1);
    setLightboxImg(img);
  };

  const panelCard: React.CSSProperties = {
    background: 'var(--color-neutral-0)',
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  };
  const labelSt: React.CSSProperties = { fontWeight: 700, fontSize: 12.5, color: '#333' };
  const valueSt: React.CSSProperties = { fontSize: 12.5, color: '#555', marginLeft: 4 };

  const comments = defect.comments ?? [];

  const handleSaveComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate(commentText.trim(), {
      onSuccess: () => {
        setCommentText('');
        setShowCommentPopover(false);
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Note / Root Cause / Next Step */}
      <div style={panelCard}>
        {defect.notes && (
          <p style={{ margin: '0 0 8px', fontSize: 12.5 }}>
            <span style={labelSt}>Note:</span>
            <span style={valueSt}>{defect.notes}</span>
          </p>
        )}
        {defect.rootCause && (
          <p style={{ margin: '0 0 8px', fontSize: 12.5 }}>
            <span style={labelSt}>Root cause:</span>
            <span style={valueSt}>{defect.rootCause}</span>
          </p>
        )}
        {defect.nextStep && (
          <p style={{ margin: 0, fontSize: 12.5 }}>
            <span style={labelSt}>Next step:</span>
            <span style={valueSt}>{defect.nextStep}</span>
          </p>
        )}
        {!defect.notes && !defect.rootCause && !defect.nextStep && defect.description && (
          <p style={{ margin: 0, fontSize: 12.5 }}>
            <span style={labelSt}>Description:</span>
            <span style={valueSt}>{defect.description}</span>
          </p>
        )}
      </div>

      {/* Comments */}
      <div style={{ ...panelCard, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#333' }}>{t('comments.title')}:</span>
          {!isSupervisor && (
          <div
            onClick={() => setShowCommentPopover(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: C.blue, fontSize: 12 }}
          >
            <Plus size={14} />
            <span>{t('button.add')}</span>
          </div>
          )}
        </div>
        {dbComments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dbComments.map((c) => (
              <div key={c.id} style={{ fontSize: 12, color: '#555', borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
                <span style={{ fontWeight: 600, color: '#333' }}>{c.authorName}</span>
                <span style={{ color: '#999', marginLeft: 6 }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                <p style={{ margin: '4px 0 0', lineHeight: 1.4 }}>{c.text}</p>
              </div>
            ))}
          </div>
        ) : comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {comments.map((c, i) => (
              <div key={i} style={{ fontSize: 12, color: '#555', borderBottom: i < comments.length - 1 ? '1px solid #f0f0f0' : 'none', paddingBottom: 6 }}>
                <span style={{ fontWeight: 600, color: '#333' }}>{c.author}</span>
                <span style={{ color: '#999', marginLeft: 6 }}>{c.date}</span>
                <p style={{ margin: '4px 0 0', lineHeight: 1.4 }}>{c.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: C.muted }}>{t('general.noData')}</span>
        )}

        {/* Add Comment Popover */}
        {showCommentPopover && (
          <div
            ref={popoverRef}
            style={{
              position: 'absolute',
              top: 40,
              right: 0,
              zIndex: 100,
              background: 'var(--color-neutral-0)',
              borderRadius: 8,
              boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
              padding: 16,
              minWidth: 300,
            }}
          >
            <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 13, color: '#333' }}>{t('comments.new')}</p>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={400}
              placeholder={t('comments.placeholder')}
              style={{
                width: '100%',
                minHeight: 80,
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: 8,
                fontSize: 12,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => { setShowCommentPopover(false); setCommentText(''); }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#E0E0E0',
                  color: '#333B46',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('general.close')}
              </button>
              <button
                onClick={handleSaveComment}
                disabled={addComment.isPending || !commentText.trim()}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#4CAF50',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                  opacity: addComment.isPending ? 0.6 : 1,
                }}
              >
                {addComment.isPending ? t('general.loading') : t('button.save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Images */}
      {defect.images && defect.images.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 700 }}>
          {defect.images.map((img, idx) => (
            <div key={idx} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
              {/* Top-left: Fullscreen + Download */}
              <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, display: 'flex', gap: 6 }}>
                <button
                  title={t('turbineDetail.fullscreen')}
                  onClick={() => openLightbox(img)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.5">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  </svg>
                </button>
                <button
                  title={t('button.download')}
                  onClick={() => handleDownloadJpeg(img, idx)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              </div>
              {/* Image */}
              <div style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={img}
                  alt={`Defect ${defect.displayId} image ${idx + 1}`}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    transform: `scale(${zoomLevels[idx] ?? 1})`,
                    transition: 'transform 0.2s',
                  }}
                />
              </div>
              {/* Zoom controls */}
              <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', zIndex: 2 }}>
                <button
                  onClick={() => handleZoom(idx, 'out')}
                  style={{ width: 28, height: 24, background: 'var(--color-neutral-0)', border: `1px solid ${C.blue}`, borderRadius: '4px 0 0 4px', borderRight: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >-</button>
                <button
                  onClick={() => handleZoom(idx, 'in')}
                  style={{ width: 28, height: 24, background: 'var(--color-neutral-0)', border: `1px solid ${C.blue}`, borderRadius: '0 4px 4px 0', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >+</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '90vw', height: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={lightboxImg}
              alt="Defect fullscreen"
              style={{ width: '100%', height: '100%', objectFit: 'contain', transform: `scale(${lightboxZoom})`, transition: 'transform 0.2s' }}
            />
            <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', gap: 8 }}>
              <button onClick={() => setLightboxZoom((z) => Math.max(z - 0.25, 0.5))} style={{ width: 32, height: 32, borderRadius: 4, border: '1px solid #fff', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>-</button>
              <button onClick={() => setLightboxZoom((z) => Math.min(z + 0.25, 4))} style={{ width: 32, height: 32, borderRadius: 4, border: '1px solid #fff', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>+</button>
            </div>
            <button onClick={() => setLightboxImg(null)} style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Donut (Pure SVG – click to highlight segment) ──────────────────────────
function Donut({ label, orange }: { label: string; orange: number }) {
  const [active, setActive] = useState<number | null>(null);
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 82;
  const innerR = 58;

  // Build arc path for a donut segment (clockwise from top)
  function arcPath(startAngle: number, endAngle: number, outer: number, inner: number) {
    const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
    const x1 = cx + outer * Math.cos(toRad(startAngle));
    const y1 = cy + outer * Math.sin(toRad(startAngle));
    const x2 = cx + outer * Math.cos(toRad(endAngle));
    const y2 = cy + outer * Math.sin(toRad(endAngle));
    const x3 = cx + inner * Math.cos(toRad(endAngle));
    const y3 = cy + inner * Math.sin(toRad(endAngle));
    const x4 = cx + inner * Math.cos(toRad(startAngle));
    const y4 = cy + inner * Math.sin(toRad(startAngle));
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${x1} ${y1}`,
      `A ${outer} ${outer} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');
  }

  const segments: { d: string; fill: string; pct: number; color: string }[] = [];
  if (orange > 0) {
    const orangeAngle = (orange / 100) * 360;
    segments.push({ d: arcPath(0, orangeAngle, outerR, innerR), fill: C.orange, pct: orange, color: C.orange });
    if (orangeAngle < 360) {
      segments.push({ d: arcPath(orangeAngle, 360, outerR, innerR), fill: C.amber, pct: 100 - orange, color: C.amber });
    }
  } else {
    segments.push({ d: arcPath(0, 359.99, outerR, innerR), fill: C.amber, pct: 100, color: C.amber });
  }

  const handleClick = (idx: number) => {
    setActive(prev => prev === idx ? null : idx);
  };

  return (
    <div style={{ position: 'relative', width: size, height: size, outline: 'none', userSelect: 'none' }}>
      <svg width={size} height={size} style={{ display: 'block', outline: 'none' }} focusable="false">
        <defs>
          <filter id={`brightness-${label}`}>
            <feComponentTransfer>
              <feFuncR type="linear" slope="1.4" />
              <feFuncG type="linear" slope="1.4" />
              <feFuncB type="linear" slope="1.4" />
            </feComponentTransfer>
          </filter>
        </defs>
        {segments.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill={s.fill}
            stroke="none"
            style={{
              cursor: 'pointer',
              filter: active === i ? `url(#brightness-${label})` : 'none',
              opacity: active !== null && active !== i ? 0.5 : 1,
              transition: 'opacity 0.2s, filter 0.2s',
            }}
            onClick={() => handleClick(i)}
          />
        ))}
      </svg>
      <div style={{ ...donutCenter, pointerEvents: 'none' }}>
        {orange > 0 && (
          <span
            onClick={() => handleClick(0)}
            style={{
              fontSize: active === 0 ? 16 : 13,
              color: C.orange,
              fontWeight: 700,
              cursor: 'pointer',
              opacity: active !== null && active !== 0 ? 0.4 : 1,
              transition: 'font-size 0.2s, opacity 0.2s',
              pointerEvents: 'auto',
            }}
          >
            {orange}%
          </span>
        )}
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{label}</span>
        <span
          onClick={() => handleClick(segments.length - 1)}
          style={{
            fontSize: active === segments.length - 1 ? 16 : 13,
            color: C.amber,
            fontWeight: 700,
            cursor: 'pointer',
            opacity: active !== null && active !== segments.length - 1 ? 0.4 : 1,
            transition: 'font-size 0.2s, opacity 0.2s',
            pointerEvents: 'auto',
          }}
        >
          {100 - orange}%
        </span>
      </div>
    </div>
  );
}

// ─── Overview table ──────────────────────────────────────────────────────────
function OverviewTable({ typeBreakdown, catCounts, totalDefects }: { typeBreakdown: { type: string; total: number; cat5: number; cat4: number; cat3: number; cat2: number; cat1: number }[]; catCounts: Record<number, number>; totalDefects: number }) {
  const { t } = useLanguage();
  const hdr = [
    { l: `${t('turbineDetail.cat')} 5`, c: C.cat5 }, { l: `${t('turbineDetail.cat')} 4`, c: C.cat4 },
    { l: `${t('turbineDetail.cat')} 3`, c: C.cat3 }, { l: `${t('turbineDetail.cat')} 2`, c: C.cat2 }, { l: `${t('turbineDetail.cat')} 1`, c: C.cat1 },
  ];
  const tint = ['#FDECEC', '#FDF0E6', '#FEF6E6', '#E9F6F5', '#E6F5F3'];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={table}>
        <thead>
          <tr>
            <th style={{ ...th, background: C.muted, color: '#fff' }}>{t('page.defects')}</th>
            <th style={{ ...th, background: C.muted, color: '#fff' }}>Total/{t('table.type')}</th>
            {hdr.map((h) => <th key={h.l} style={{ ...th, background: h.c, color: '#fff' }}>{h.l}</th>)}
          </tr>
        </thead>
        <tbody>
          {typeBreakdown.map((r) => (
            <tr key={r.type}>
              <td style={td}>{r.type}</td>
              <td style={{ ...td, fontWeight: 700 }}>{r.total}</td>
              <td style={{ ...td, background: tint[0], textAlign: 'center' }}>{r.cat5}</td>
              <td style={{ ...td, background: tint[1], textAlign: 'center' }}>{r.cat4}</td>
              <td style={{ ...td, background: tint[2], textAlign: 'center' }}>{r.cat3}</td>
              <td style={{ ...td, background: tint[3], textAlign: 'center' }}>{r.cat2}</td>
              <td style={{ ...td, background: tint[4], textAlign: 'center' }}>{r.cat1}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, fontWeight: 700, color: C.blue, background: '#F0FBFA' }}>Total/{t('table.category')}</td>
            <td style={{ ...td, fontWeight: 700, color: C.blue, background: '#F0FBFA' }}>{totalDefects}</td>
            <td style={{ ...td, fontWeight: 700, textAlign: 'center', background: C.cat5, color: '#fff' }}>{catCounts[5]}</td>
            <td style={{ ...td, fontWeight: 700, textAlign: 'center', background: C.cat4, color: '#fff' }}>{catCounts[4]}</td>
            <td style={{ ...td, fontWeight: 700, textAlign: 'center', background: C.cat3, color: '#fff' }}>{catCounts[3]}</td>
            <td style={{ ...td, fontWeight: 700, textAlign: 'center', background: C.cat2, color: '#fff' }}>{catCounts[2]}</td>
            <td style={{ ...td, fontWeight: 700, textAlign: 'center', background: C.cat1, color: '#fff' }}>{catCounts[1]}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Details table ───────────────────────────────────────────────────────────
function DetailsTable({ defects, selectedId, onSelect, onEdit, resolvedMap, onResolvedToggle, readonly = false }: { defects: TurbineDefect[]; selectedId: string | null; onSelect: (id: string) => void; onEdit: (id: string) => void; resolvedMap: Record<string, boolean>; onResolvedToggle: (id: string) => void; readonly?: boolean }) {
  const { t } = useLanguage();
  const catColor = (c: number) => c === 5 ? C.cat5 : c === 4 ? C.cat4 : c === 3 ? C.cat3 : c === 2 ? C.cat2 : C.cat1;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={table}>
        <thead>
          <tr>
            {[t('table.id'), t('table.type'), t('table.category'), t('table.blade'), t('table.side'), 'Root (m)', 'Size (cm)', t('table.resolved'), ...(readonly ? [] : [t('button.edit')])].map((h) => (
              <th key={h} style={{ ...th, background: '#F3F4F6', color: C.muted }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {defects.map((d) => (
            <tr
              key={d.displayId}
              id={`defect-row-${d.displayId}`}
              onClick={() => onSelect(d.displayId)}
              style={{
                cursor: 'pointer',
                backgroundColor: selectedId === d.displayId ? 'rgba(76, 175, 80, 0.12)' : undefined,
                transition: 'background-color 0.15s',
              }}
            >
              <td style={td}>{d.displayId}</td>
              <td style={td}>{d.type}</td>
              <td style={{ ...td, textAlign: 'center' }}>
                <span style={{ ...badge, background: catColor(d.cat) }}>{d.cat}</span>
              </td>
              <td style={td}>{d.blade}</td>
              <td style={td}>{d.side}</td>
              <td style={td}>{d.root}</td>
              <td style={td}>{d.size}</td>
              <td style={{ ...td, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (!readonly) onResolvedToggle(d.displayId); }}
                  aria-label={resolvedMap[d.displayId] ? 'Mark as unresolved' : 'Mark as resolved'}
                  aria-pressed={resolvedMap[d.displayId] ?? false}
                  disabled={readonly}
                  style={{
                    position: 'relative',
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: resolvedMap[d.displayId] ? '#27AE60' : '#BDBDBD',
                    cursor: readonly ? 'default' : 'pointer',
                    transition: 'background-color 0.2s',
                    border: 'none',
                    padding: 0,
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    opacity: readonly ? 0.7 : 1,
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    left: resolvedMap[d.displayId] ? '18px' : '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-neutral-0)',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </button>
              </td>
              {!readonly && (
                <td style={td}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(d.id); }}
                    style={editBtnStyle}
                    title={t('button.edit')}
                  >
                    <Pencil size={14} color={C.blue} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Styles (forced light theme) ─────────────────────────────────────────────
const page: React.CSSProperties = { minHeight: '100%', background: 'var(--color-neutral-0)', color: C.text, fontFamily: 'var(--font-family-sans)' };
const toolbarRow: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: 'var(--color-neutral-0)', gap: 12, minHeight: 48 };
const toolbarLeftSt: React.CSSProperties = { flex: '0 0 25%', minWidth: 0 };
const toolbarCenterSt: React.CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 };
const toolbarRightSt: React.CSSProperties = { flex: '0 0 25%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' };
const breadcrumbSt: React.CSSProperties = { fontSize: 13, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const bcLinkSt: React.CSSProperties = { color: '#00A6FF', textDecoration: 'none', fontWeight: 500 };
const bcSepSt: React.CSSProperties = { margin: '0 6px', color: '#999' };
const phaseBtnNormal: React.CSSProperties = { padding: '6px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-family-sans)', fontSize: 13, fontWeight: 500, color: '#666', borderRadius: 4, transition: 'all 0.2s ease' };
const phaseBtnActive: React.CSSProperties = { padding: '6px 16px', border: '2px solid #222', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-family-sans)', fontSize: 13, fontWeight: 700, color: '#222', borderRadius: 20, transition: 'all 0.2s ease' };
const phaseLabelNormal: React.CSSProperties = {};
const phaseLabelActive: React.CSSProperties = { fontWeight: 700 };
const topBar: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${C.border}`, gap: 20 };
const infoDot: React.CSSProperties = { width: 28, height: 28, borderRadius: '50%', background: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const tabRow: React.CSSProperties = { display: 'flex', gap: 24, borderBottom: 'none' };
const tabBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.muted, padding: '4px 2px' };
const tabActive: React.CSSProperties = { color: C.blue, borderBottom: `2px solid ${C.blue}` };
const body: React.CSSProperties = { display: 'flex', gap: 16, padding: 16, alignItems: 'flex-start' };
const col1: React.CSSProperties = { width: 480, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 };
const col2: React.CSSProperties = { width: 220, flexShrink: 0, background: 'var(--color-neutral-0)', border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, outline: 'none', overflow: 'hidden' };
const col3: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 };
const card: React.CSSProperties = { background: 'var(--color-neutral-0)', border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 };
const cardTitle: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: C.text, margin: '0 0 14px' };
const counters: React.CSSProperties = { display: 'flex', gap: 20, padding: '12px 0', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` };
const counterItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.text };
const conclText: React.CSSProperties = { fontSize: 12.5, color: '#555', margin: '0 0 8px', lineHeight: 1.45 };
const planBtn: React.CSSProperties = { flex: 1, padding: '12px', background: C.blue, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, letterSpacing: 0.5, cursor: 'pointer' };

const filterSelect: React.CSSProperties = { padding: '4px 8px', fontSize: 11, border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: 'inherit', backgroundColor: 'var(--color-neutral-0)', color: C.text, cursor: 'pointer' };
const donutCenter: React.CSSProperties = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2, pointerEvents: 'none' };
const catRow: React.CSSProperties = { display: 'flex', gap: 12, justifyContent: 'space-between' };
const catCell: React.CSSProperties = { flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 11.5 };
const th: React.CSSProperties = { padding: '7px 8px', fontWeight: 700, textAlign: 'left', fontSize: 10.5, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '7px 8px', borderBottom: `1px solid #F0F1F3`, color: C.text };
const badge: React.CSSProperties = { display: 'inline-block', color: '#fff', fontWeight: 700, fontSize: 10.5, padding: '2px 7px', borderRadius: 4, minWidth: 18, textAlign: 'center' };
const editBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 };
