import { useState, useEffect, useRef, useMemo } from 'react';
import { Skeleton } from '@/components/atoms';
import { CheckCircle, Pencil, Check } from 'lucide-react';
import type { Inspection } from '@/types';

// OpenLayers imports
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Icon, Style } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';
import ScaleLine from 'ol/control/ScaleLine';
import Zoom from 'ol/control/Zoom';
import 'ol/ol.css';

export interface InspectStepProps {
  inspection: Inspection | undefined;
  isLoading: boolean;
}

const TURBINE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="14" fill="#4CAF50" stroke="white" stroke-width="2"/>
  <path d="M16 6 L17 14 L16 16 L15 14 Z" fill="white"/>
  <path d="M16 16 L22 22 L20 23 L16 17 Z" fill="white"/>
  <path d="M16 16 L10 22 L12 23 L16 17 Z" fill="white"/>
  <circle cx="16" cy="16" r="2" fill="white"/>
</svg>`;

export function InspectStep({ inspection, isLoading }: InspectStepProps) {
  const [notes, setNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('satellite');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const tileLayerRef = useRef<TileLayer<OSM> | null>(null);

  // Derive data from the real inspection (supports both blade-based and turbine-based)
  const turbine = inspection?.blade?.turbine ?? inspection?.turbine;
  const windFarm = turbine?.wind_farm ?? inspection?.turbine?.wind_farm;

  const turbineName = turbine?.name ?? '—';
  const turbineModel = (turbine as Record<string, unknown> | undefined)?.model as string ?? '—';
  const farmName = windFarm?.name ?? '—';
  const scheduledDate = inspection?.scheduled_date
    ? new Date(inspection.scheduled_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    : '—';
  const inspectionType = inspection?.inspection_type ?? 'blades';
  const photosCount = inspection?.photos_count ?? 0;
  const viewedPercent = inspection?.viewed_percent ?? 0;

  // Coordinates from turbine
  const lon = (turbine as Record<string, unknown> | undefined)?.longitude as number ?? -0.889;
  const lat = (turbine as Record<string, unknown> | undefined)?.latitude as number ?? 41.649;

  // Acquisition data derived from inspection
  const acquisitionData = useMemo(() => {
    const dateStr = inspection?.scheduled_date
      ? new Date(inspection.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
      : '—';
    return {
      dateTime: `${dateStr} 19:22`,
      photos: photosCount,
      tagged: Math.round(photosCount * (viewedPercent / 100)),
      duration: photosCount > 0 ? `${Math.round(photosCount / 35)} minutes` : '—',
      rtk: 'Fixed (100%)',
    };
  }, [inspection?.scheduled_date, photosCount, viewedPercent]);

  // Upload data
  const uploadData = useMemo(() => ({
    uploaded: photosCount,
    pending: 0,
  }), [photosCount]);

  // Update notes from inspection
  useEffect(() => {
    setNotes(inspection?.notes ?? '');
    setIsEditingNotes(false);
  }, [inspection?.notes]);

  // Update map marker when coordinates change
  useEffect(() => {
    if (!vectorSourceRef.current || !mapInstanceRef.current) return;

    vectorSourceRef.current.clear();
    const feature = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
    feature.setStyle(new Style({
      image: new Icon({
        src: 'data:image/svg+xml,' + encodeURIComponent(TURBINE_ICON_SVG),
        anchor: [0.5, 0.5],
        scale: 1,
      }),
    }));
    vectorSourceRef.current.addFeature(feature);
    mapInstanceRef.current.getView().animate({ center: fromLonLat([lon, lat]), duration: 500 });
  }, [lon, lat]);

  // Toggle map type
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const source = mapType === 'satellite'
      ? new OSM({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attributions: '' })
      : new OSM();
    tileLayerRef.current.setSource(source);
  }, [mapType]);

  // Initialize OpenLayers map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const turbineFeature = new Feature({ geometry: new Point(fromLonLat([lon, lat])) });
    turbineFeature.setStyle(new Style({
      image: new Icon({
        src: 'data:image/svg+xml,' + encodeURIComponent(TURBINE_ICON_SVG),
        anchor: [0.5, 0.5],
        scale: 1,
      }),
    }));

    const vectorSource = new VectorSource({ features: [turbineFeature] });
    vectorSourceRef.current = vectorSource;
    const vectorLayer = new VectorLayer({ source: vectorSource });

    const tileLayer = new TileLayer({
      source: new OSM({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attributions: '' }),
    });
    tileLayerRef.current = tileLayer;

    const map = new Map({
      target: mapRef.current,
      layers: [tileLayer, vectorLayer],
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }).extend([
        new Zoom({ className: 'ol-zoom ol-zoom-bottom-right' }),
        new ScaleLine(),
      ]),
      view: new View({ center: fromLonLat([lon, lat]), zoom: 15 }),
    });

    mapInstanceRef.current = map;
    return () => { map.setTarget(undefined); mapInstanceRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveNotes = () => {
    setIsEditingNotes(false);
    // TODO: persist notes to backend via inspectionsService.updateInspection
  };

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={leftCol}><Skeleton variant="rect" height="400px" /></div>
        <div style={rightCol}><Skeleton variant="rect" height="400px" /></div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Left Column */}
      <div style={leftCol}>
        <div style={card}>
          <h5 style={cardHeader}>Inspection Details</h5>
          <div style={divider} />
          <table style={tableStyle}>
            <tbody>
              <tr><td style={cellLabel}>Asset Name</td><td style={cellValue}>{farmName}</td></tr>
              <tr><td style={cellLabel}>Inspection type</td><td style={cellValue}>{inspectionType}</td></tr>
              <tr><td style={cellLabel}>Turbine</td><td style={cellValue}>{turbineName}</td></tr>
              <tr><td style={cellLabel}>Model</td><td style={cellValue}>{turbineModel}</td></tr>
              <tr><td style={cellLabel}>Date</td><td style={cellValue}>{scheduledDate}</td></tr>
              <tr>
                <td style={cellLabel}>Notes</td>
                <td style={{ ...cellValue, borderLeft: '1px solid #ddd' }}>
                  {isEditingNotes ? (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        autoFocus
                        rows={2}
                        style={notesTextarea}
                      />
                      <button type="button" onClick={handleSaveNotes} style={okBtn} title="Save">
                        <Check size={14} color="#fff" />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      <span style={{ textAlign: 'right' }}>{notes || '—'}</span>
                      <button type="button" onClick={() => setIsEditingNotes(true)} style={editBtn} title="Edit notes">
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              <tr><td style={cellLabel}>Legislation</td><td style={{ ...cellValue, color: '#d32f2f' }}>Please check local legislation before your flight</td></tr>
              <tr><td style={cellLabel}>Status</td><td style={{ ...cellValue, color: '#4CAF50' }}>{inspection?.stage ?? '—'}</td></tr>
            </tbody>
          </table>
        </div>

        <div style={card}>
          <div style={docHeaderRow}>
            <h6 style={docTitle}>Documents dropbox</h6>
            <button style={addDocBtn}>Add document</button>
          </div>
          <div style={docBody}>
            <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 4px' }}>Have all your key documents at your disposal here.</p>
            <p style={{ fontSize: 12, color: '#888', margin: 0, fontStyle: 'italic' }}>Master service agreement, asset initial audit, insurance contracts, …</p>
          </div>
        </div>

        <div style={mapContainer}>
          <style>{`
            .ol-zoom.ol-zoom-bottom-right { top: auto !important; left: auto !important; bottom: 12px !important; right: 12px !important; }
            .ol-scale-line { bottom: 12px !important; left: 12px !important; }
          `}</style>
          <div ref={mapRef} style={mapEl} />
          <button
            type="button"
            onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')}
            style={mapTypeBtn}
            title={mapType === 'street' ? 'Switch to satellite' : 'Switch to street map'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m20.5 3-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5M15 19l-6-2.11V5l6 2.11z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Right Column */}
      <div style={rightCol}>
        <div style={stepperContainer}>
          <div style={stepperBar}>
            <div style={stepItem}><CheckCircle size={24} color={photosCount > 0 ? '#4caf50' : '#ccc'} /><span style={stepLabelSt}>{photosCount > 0 ? 'Complete' : 'Pending'}</span></div>
            <div style={{ ...stepLine, background: photosCount > 0 ? '#4caf50' : '#ddd' }} />
            <div style={stepItem}><CheckCircle size={24} color={uploadData.pending === 0 && photosCount > 0 ? '#4caf50' : '#ccc'} /><span style={stepLabelSt}>{uploadData.pending === 0 && photosCount > 0 ? 'Complete' : 'Pending'}</span></div>
          </div>
        </div>

        <div style={cardsRow}>
          <div style={{ ...card, flex: 1 }}>
            <h5 style={cardHeaderCenter}>Acquisition</h5>
            <div style={divider} />
            <table style={tableStyle}>
              <tbody>
                <tr><td style={cellLabel}>Date and time</td><td style={cellValue}>{acquisitionData.dateTime}</td></tr>
                <tr><td style={cellLabel}>Photos</td><td style={cellValue}>{acquisitionData.photos}</td></tr>
                <tr><td style={cellLabel}>Tagged photos</td><td style={cellValue}>{acquisitionData.tagged}</td></tr>
                <tr><td style={cellLabel}>Inspection duration</td><td style={cellValue}>{acquisitionData.duration}</td></tr>
                <tr><td style={cellLabel}>RTK Status</td><td style={cellValue}>{acquisitionData.rtk}</td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ ...card, flex: 1 }}>
            <h5 style={cardHeaderCenter}>Photo upload</h5>
            <div style={divider} />
            <table style={tableStyle}>
              <tbody>
                <tr><td style={cellLabel}>Uploaded photos</td><td style={cellValue}>{uploadData.uploaded} ({uploadData.pending === 0 && photosCount > 0 ? '100%' : '0%'})</td></tr>
                <tr><td style={cellLabel}>Pending photos</td><td style={cellValue}>{uploadData.pending}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = { display: 'flex', gap: 16, padding: 16, height: '100%', overflow: 'hidden', fontFamily: 'Calibri, "Gill Sans", Arial, sans-serif' };
const leftCol: React.CSSProperties = { flex: '0 0 33%', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', minWidth: 0 };
const rightCol: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', minWidth: 0 };

const card: React.CSSProperties = { background: '#fff', borderRadius: 8, boxShadow: '0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)', padding: 16 };
const cardHeader: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#333' };
const cardHeaderCenter: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: '#333', textAlign: 'center' };
const divider: React.CSSProperties = { height: 1, background: '#e0e0e0', margin: '0 -16px 12px' };

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const cellLabel: React.CSSProperties = { padding: '6px 8px 6px 0', color: '#555', fontWeight: 400, verticalAlign: 'top' };
const cellValue: React.CSSProperties = { padding: '6px 0', color: '#222', fontWeight: 500, textAlign: 'right', verticalAlign: 'top' };

const docHeaderRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 };
const docTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#333', margin: 0 };
const addDocBtn: React.CSSProperties = { background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const docBody: React.CSSProperties = { textAlign: 'center', padding: '16px 0' };

const mapContainer: React.CSSProperties = { flex: 1, minHeight: 260, position: 'relative' };
const mapEl: React.CSSProperties = { width: '100%', height: '100%', minHeight: 260, borderRadius: 8, overflow: 'hidden' };
const mapTypeBtn: React.CSSProperties = { position: 'absolute', top: 12, left: 12, zIndex: 10, background: '#fff', border: '1px solid #ccc', borderRadius: 4, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', color: '#555' };

const stepperContainer: React.CSSProperties = { background: '#F4F6F8', borderRadius: 8, padding: '20px 32px' };
const stepperBar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
const stepItem: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 };
const stepLine: React.CSSProperties = { flex: 1, height: 4, background: '#4caf50', margin: '0 12px', borderRadius: 2, minWidth: 80, maxWidth: 300, alignSelf: 'flex-start', marginTop: 10 };
const stepLabelSt: React.CSSProperties = { fontSize: 12, color: '#555', fontWeight: 500 };

const cardsRow: React.CSSProperties = { display: 'flex', gap: 16 };

const notesTextarea: React.CSSProperties = { flex: 1, border: '1px solid #ccc', borderRadius: 4, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', textAlign: 'right' };
const editBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#555', flexShrink: 0, display: 'flex', alignItems: 'center' };
const okBtn: React.CSSProperties = { background: '#4caf50', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '4px 8px', flexShrink: 0, display: 'flex', alignItems: 'center' };
