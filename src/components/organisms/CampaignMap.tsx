import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/design-system';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Icon, Fill, Stroke, Text } from 'ol/style';
import ScaleLine from 'ol/control/ScaleLine';
import Zoom from 'ol/control/Zoom';
import 'ol/ol.css';

export interface TurbineMarker {
  id: string;
  name: string;
  lon: number;
  lat: number;
  selected?: boolean;
}

export interface CampaignMapProps {
  turbines?: TurbineMarker[];
  selectedTurbineIds?: Set<string>;
  onTurbineClick?: (id: string) => void;
}

// Mock turbine positions for Fila de Mogote (Costa Rica area)
const DEFAULT_TURBINES: TurbineMarker[] = [
  { id: 'wt01', name: 'WT01', lon: -85.023, lat: 10.423 },
  { id: 'wt02', name: 'WT02', lon: -85.021, lat: 10.421 },
  { id: 'wt03', name: 'WT03', lon: -85.019, lat: 10.419 },
  { id: 'wt04', name: 'WT04', lon: -85.017, lat: 10.417 },
  { id: 'wt05', name: 'WT05', lon: -85.015, lat: 10.414 },
  { id: 'wt06', name: 'WT06', lon: -85.013, lat: 10.411 },
  { id: 'wt07', name: 'WT07', lon: -85.012, lat: 10.407 },
];

type MapLayerType = 'satellite' | 'street' | 'hybrid';

const MAP_LAYERS: { id: MapLayerType; label: string }[] = [
  { id: 'satellite', label: 'Satellite' },
  { id: 'street', label: 'Street' },
  { id: 'hybrid', label: 'Hybrid' },
];

// Wind turbine SVG icon as data URL (matching reference style - turbine marker)
function turbineSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 2 L16 16 L26 12 L16 16 L20 26 L16 16 L14 2 Z" fill="${color}" stroke="white" stroke-width="1"/>
    <path d="M14 2 L12 16 L2 12 L12 16 L8 26 L12 16 L14 2 Z" fill="${color}" stroke="white" stroke-width="1"/>
    <circle cx="14" cy="16" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>
    <rect x="13" y="19" width="2" height="18" fill="${color}" stroke="white" stroke-width="0.5"/>
    <rect x="10" y="37" width="8" height="3" rx="1" fill="${color}" stroke="white" stroke-width="0.5"/>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function createTurbineStyle(name: string, isSelected: boolean) {
  const color = isSelected ? '#FF5500' : '#4CAF50';
  return new Style({
    image: new Icon({
      src: turbineSvg(color),
      scale: 0.9,
      anchor: [0.5, 1],
    }),
    text: new Text({
      text: name,
      offsetY: -44,
      font: 'bold 11px sans-serif',
      fill: new Fill({ color: '#222222' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
    }),
  });
}

function createTileLayer(type: MapLayerType): TileLayer<XYZ | OSM> {
  switch (type) {
    case 'satellite':
      return new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
        }),
      });
    case 'street':
      return new TileLayer({ source: new OSM() });
    case 'hybrid':
    default:
      return new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
        }),
      });
  }
}

export function CampaignMap({
  turbines = DEFAULT_TURBINES,
  selectedTurbineIds,
  onTurbineClick,
}: CampaignMapProps) {
  const { t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const tileLayerRef = useRef<TileLayer<XYZ | OSM> | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayerType>('satellite');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Create / destroy map
  useEffect(() => {
    if (!mapRef.current) return;

    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    turbines.forEach((t) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([t.lon, t.lat])),
        turbineId: t.id,
        turbineName: t.name,
      });
      feature.setStyle(createTurbineStyle(t.name, selectedTurbineIds?.has(t.id) ?? false));
      vectorSource.addFeature(feature);
    });

    const vectorLayer = new VectorLayer({ source: vectorSource });
    const tileLayer = createTileLayer(activeLayer);
    tileLayerRef.current = tileLayer;

    const avgLon = turbines.reduce((s, t) => s + t.lon, 0) / turbines.length;
    const avgLat = turbines.reduce((s, t) => s + t.lat, 0) / turbines.length;

    const map = new Map({
      target: mapRef.current,
      layers: [tileLayer, vectorLayer],
      view: new View({
        center: fromLonLat([avgLon, avgLat]),
        zoom: 15,
      }),
      controls: [
        new Zoom({ className: 'ol-zoom ol-zoom-bottom-right' }),
        new ScaleLine(),
      ],
    });

    map.on('click', (evt) => {
      map.forEachFeatureAtPixel(evt.pixel, (feature) => {
        const id = feature.get('turbineId');
        if (id && onTurbineClick) onTurbineClick(id);
      });
    });

    map.on('pointermove', (evt) => {
      const hit = map.hasFeatureAtPixel(evt.pixel);
      map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    mapInstance.current = map;

    return () => {
      map.setTarget(undefined);
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turbines, onTurbineClick]);

  // Update feature styles when selectedTurbineIds changes
  useEffect(() => {
    const source = vectorSourceRef.current;
    if (!source) return;
    source.getFeatures().forEach((feature) => {
      const id = feature.get('turbineId') as string;
      const name = feature.get('turbineName') as string;
      feature.setStyle(createTurbineStyle(name, selectedTurbineIds?.has(id) ?? false));
    });
  }, [selectedTurbineIds]);

  // Switch tile layer
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !tileLayerRef.current) return;
    const newTile = createTileLayer(activeLayer);
    map.getLayers().setAt(0, newTile);
    tileLayerRef.current = newTile;
  }, [activeLayer]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '260px' }}>
      <style>{`
        .ol-zoom-bottom-right {
          top: auto !important;
          left: auto !important;
          bottom: 2em !important;
          right: 0.5em !important;
        }
      `}</style>

      <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '260px' }} />

      {/* Layer selector */}
      <div style={layerBtnContainer}>
        <button
          style={layerBtn}
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          title={t('map.changeLayer')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="m20.5 3-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5M15 19l-6-2.11V5l6 2.11z" />
          </svg>
        </button>
        {showLayerMenu && (
          <div style={layerMenu}>
            {MAP_LAYERS.map((layer) => (
              <button
                key={layer.id}
                style={{
                  ...layerMenuItem,
                  backgroundColor: activeLayer === layer.id ? 'var(--color-primary-50)' : 'transparent',
                  fontWeight: activeLayer === layer.id ? 600 : 400,
                }}
                onClick={() => { setActiveLayer(layer.id); setShowLayerMenu(false); }}
              >
                {layer.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const layerBtnContainer: React.CSSProperties = {
  position: 'absolute', top: '8px', right: '8px', zIndex: 10,
};
const layerBtn: React.CSSProperties = {
  width: '32px', height: '32px', border: 'none', borderRadius: '4px',
  backgroundColor: 'rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555',
};
const layerMenu: React.CSSProperties = {
  position: 'absolute', top: '36px', right: 0, backgroundColor: 'white',
  borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', overflow: 'hidden', minWidth: '100px',
};
const layerMenuItem: React.CSSProperties = {
  display: 'block', width: '100%', padding: '8px 14px', border: 'none',
  textAlign: 'left', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-neutral-800)',
};
