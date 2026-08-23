import { useState, useEffect, useRef, useMemo } from 'react';
import { Skeleton } from '@/components/atoms';
import { CheckCircle, MapPin, FileText, Pencil, Check, Calendar, Camera, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';
import type { Inspection } from '@/types';

// OpenLayers imports
import OlMap from 'ol/Map';
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

export interface InspectStepV2Props {
  inspection: Inspection | undefined;
  isLoading: boolean;
}

const TURBINE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="14" fill="#5A8F5A" stroke="white" stroke-width="2"/>
  <path d="M16 6 L17 14 L16 16 L15 14 Z" fill="white"/>
  <path d="M16 16 L22 22 L20 23 L16 17 Z" fill="white"/>
  <path d="M16 16 L10 22 L12 23 L16 17 Z" fill="white"/>
  <circle cx="16" cy="16" r="2" fill="white"/>
</svg>`;

export function InspectStepV2({ inspection, isLoading }: InspectStepV2Props) {
  const { role } = useAuth();
  const { t, locale } = useLanguage();
  const [notes, setNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('satellite');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<OlMap | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const tileLayerRef = useRef<TileLayer<OSM> | null>(null);

  const turbine = inspection?.blade?.turbine ?? inspection?.turbine;
  const windFarm = turbine?.wind_farm ?? inspection?.turbine?.wind_farm;

  const turbineName = turbine?.name ?? '—';
  const turbineModel = (turbine as Record<string, unknown> | undefined)?.model as string ?? '—';
  const farmName = windFarm?.name ?? '—';
  const scheduledDate = inspection?.scheduled_date
    ? new Date(inspection.scheduled_date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';
  const inspectionType = inspection?.inspection_type ?? 'blades';
  const photosCount = inspection?.photos_count ?? 0;
  const viewedPercent = inspection?.viewed_percent ?? 0;

  const lon = (turbine as Record<string, unknown> | undefined)?.longitude as number ?? -0.889;
  const lat = (turbine as Record<string, unknown> | undefined)?.latitude as number ?? 41.649;

  const acquisitionData = useMemo(() => {
    const dateStr = inspection?.scheduled_date
      ? new Date(inspection.scheduled_date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
      : '—';
    return {
      dateTime: `${dateStr} 19:22`,
      photos: photosCount,
      tagged: Math.round(photosCount * (viewedPercent / 100)),
      duration: photosCount > 0 ? `${Math.round(photosCount / 35)} ${t('inspect.minutes')}` : '—',
      rtk: t('inspect.rtkFixed'),
    };
  }, [inspection?.scheduled_date, photosCount, viewedPercent, locale, t]);

  useEffect(() => {
    setNotes(inspection?.notes ?? '');
    setIsEditingNotes(false);
  }, [inspection?.notes]);

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

  useEffect(() => {
    if (!tileLayerRef.current) return;
    const source = mapType === 'satellite'
      ? new OSM({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attributions: '' })
      : new OSM();
    tileLayerRef.current.setSource(source);
  }, [mapType]);

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
    const map = new OlMap({
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
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4 p-6 h-full bg-[#F7F8FA]">
        <Skeleton variant="rect" height="100%" />
        <Skeleton variant="rect" height="100%" />
        <Skeleton variant="rect" height="100%" />
      </div>
    );
  }

  const isAcquisitionComplete = photosCount > 0;
  const isUploadComplete = photosCount > 0;

  return (
    <div className="h-full overflow-auto bg-[#F7F8FA] p-5 font-['Inter',sans-serif]">
      {/* ─── KPI ROW ─── */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard icon={<Camera size={18} />} label={t('inspect.photos')} value={String(photosCount)} />
        <KpiCard icon={<CheckCircle size={18} />} label={t('inspect.taggedPhotos')} value={String(acquisitionData.tagged)} />
        <KpiCard icon={<Clock size={18} />} label={t('inspect.inspectionDuration')} value={acquisitionData.duration} />
        <KpiCard icon={<Calendar size={18} />} label={t('inspect.date')} value={scheduledDate} />
      </div>

      {/* ─── MAIN GRID: 3 columns ─── */}
      <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-4 h-[calc(100%-120px)]">
        
        {/* COL 1: Map + Status */}
        <div className="flex flex-col gap-4">
          {/* Map Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex-1 min-h-[280px] relative">
            <style>{`
              .ol-zoom.ol-zoom-bottom-right { top: auto !important; left: auto !important; bottom: 12px !important; right: 12px !important; }
              .ol-scale-line { bottom: 12px !important; left: 12px !important; }
            `}</style>
            <div ref={mapRef} className="w-full h-full" />
            <button
              type="button"
              onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')}
              className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg w-8 h-8 flex items-center justify-center cursor-pointer shadow-sm hover:bg-white transition-colors"
            >
              <MapPin size={14} className="text-gray-600" />
            </button>
            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white text-[11px] px-2 py-1 rounded">
              {lat.toFixed(3)}, {lon.toFixed(3)}
            </div>
          </div>

          {/* Progress Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h6 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Status</h6>
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                isAcquisitionComplete ? 'bg-[#5A8F5A]/10' : 'bg-gray-100'
              )}>
                <CheckCircle size={20} className={isAcquisitionComplete ? 'text-[#5A8F5A]' : 'text-gray-300'} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{t('inspect.acquisition')}</p>
                <p className="text-xs text-gray-400">{isAcquisitionComplete ? t('inspect.complete') : t('inspect.pending')}</p>
              </div>
            </div>
            <div className="w-full h-px bg-gray-100 my-3" />
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                isUploadComplete ? 'bg-[#5A8F5A]/10' : 'bg-gray-100'
              )}>
                <CheckCircle size={20} className={isUploadComplete ? 'text-[#5A8F5A]' : 'text-gray-300'} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{t('inspect.photoUpload')}</p>
                <p className="text-xs text-gray-400">{isUploadComplete ? t('inspect.complete') : t('inspect.pending')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* COL 2: Inspection Details (big card) */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-base font-semibold text-gray-800">{t('inspect.detailsTitle')}</h5>
            <span className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full capitalize',
              inspection?.stage === 'planned' ? 'bg-blue-50 text-blue-600' :
              inspection?.stage === 'inspect' ? 'bg-amber-50 text-amber-600' :
              'bg-[#5A8F5A]/10 text-[#5A8F5A]'
            )}>
              {inspection?.stage ?? '—'}
            </span>
          </div>

          <div className="space-y-3">
            <DetailField label={t('inspect.assetName')} value={farmName} />
            <DetailField label={t('inspect.inspectionType')} value={inspectionType} />
            <DetailField label={t('inspect.turbine')} value={turbineName} />
            <DetailField label={t('inspect.model')} value={turbineModel} />
            <DetailField label={t('inspect.dateAndTime')} value={acquisitionData.dateTime} />
            <DetailField label={t('inspect.rtkStatus')} value={acquisitionData.rtk} />
            
            {/* Notes — editable */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 font-medium">{t('inspect.notes')}</span>
                {role !== 'supervisor' && !isEditingNotes && (
                  <button
                    onClick={() => setIsEditingNotes(true)}
                    className="text-[#5A8F5A] hover:text-[#4A7A4A] transition-colors cursor-pointer"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
              {isEditingNotes ? (
                <div className="flex gap-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    autoFocus
                    rows={2}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y outline-none focus:border-[#5A8F5A] focus:ring-1 focus:ring-[#5A8F5A]/20"
                  />
                  <button
                    onClick={handleSaveNotes}
                    className="self-start bg-[#5A8F5A] rounded-lg p-2 cursor-pointer hover:bg-[#4A7A4A] transition-colors"
                  >
                    <Check size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-700">{notes || '—'}</p>
              )}
            </div>

            {/* Legislation */}
            <div className="pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400 font-medium block mb-1">{t('inspect.legislation')}</span>
              <p className="text-sm text-red-500 font-medium">{t('inspect.legislationText')}</p>
            </div>
          </div>
        </div>

        {/* COL 3: Documents + Acquisition Data */}
        <div className="flex flex-col gap-4">
          {/* Acquisition Data Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h6 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{t('inspect.acquisition')}</h6>
            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">{t('inspect.photos')}</span>
                <span className="text-sm font-semibold text-gray-800">{acquisitionData.photos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">{t('inspect.taggedPhotos')}</span>
                <span className="text-sm font-semibold text-gray-800">{acquisitionData.tagged}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">{t('inspect.inspectionDuration')}</span>
                <span className="text-sm font-semibold text-gray-800">{acquisitionData.duration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">{t('inspect.rtkStatus')}</span>
                <span className="text-sm font-semibold text-[#5A8F5A]">{acquisitionData.rtk}</span>
              </div>
            </div>
          </div>

          {/* Documents Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <h6 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('inspect.documentsTitle')}</h6>
              {role !== 'supervisor' && (
                <button className="bg-[#5A8F5A] text-white text-[11px] font-semibold rounded-lg px-3 py-1.5 hover:bg-[#4A7A4A] transition-colors cursor-pointer">
                  + {t('inspect.addDocument')}
                </button>
              )}
            </div>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText size={32} className="text-gray-200 mb-2" />
              <p className="text-sm text-gray-500 mb-1">{t('inspect.documentsPlaceholder')}</p>
              <p className="text-xs text-gray-300 italic">{t('inspect.documentsExamples')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-[#5A8F5A]/10 flex items-center justify-center text-[#5A8F5A]">
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-gray-800 leading-tight">{value}</p>
        <p className="text-[11px] text-gray-400 font-medium">{label}</p>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}
