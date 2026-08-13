import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/design-system';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Icon } from 'ol/style';
import { ScaleLine, Zoom } from 'ol/control';
import { defaults as defaultControls } from 'ol/control/defaults';
import type { WindFarm } from '@/types';
import 'ol/ol.css';

interface GlobalMapProps {
  windFarms: WindFarm[];
  isLoading?: boolean;
  onWindFarmClick?: (id: string) => void;
}

/** Inline SVG turbine icon as data URI */
const TURBINE_ICON_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1976d2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2C12 2 7 7.5 7 12"/>
  <path d="M12 2C12 2 17 7.5 17 12"/>
  <path d="M12 2v20"/>
  <path d="M8 22h8"/>
  <path d="M12 12l-7-4"/>
  <path d="M12 12l7-4"/>
  <path d="M12 12v-8"/>
  <circle cx="12" cy="12" r="1.5" fill="#1976d2"/>
</svg>
`)}`;



export function GlobalMap({ windFarms, isLoading, onWindFarmClick }: GlobalMapProps) {
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource>(new VectorSource());
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new Map({
      target: mapContainerRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        new VectorLayer({
          source: vectorSourceRef.current,
          style: new Style({
            image: new Icon({
              src: TURBINE_ICON_SVG,
              scale: 1,
              anchor: [0.5, 0.5],
            }),
          }),
        }),
      ],
      view: new View({
        center: fromLonLat([-64.0, -38.0]), // Default center (Argentina)
        zoom: 6,
      }),
      controls: defaultControls({ zoom: false, attribution: false }).extend([
        new Zoom(),
        new ScaleLine({ units: 'metric' }),
      ]),
    });

    // Pointer cursor on features
    map.on('pointermove', (evt) => {
      const pixel = map.getEventPixel(evt.originalEvent);
      const hit = map.hasFeatureAtPixel(pixel);
      map.getTargetElement().style.cursor = hit ? 'pointer' : '';

      if (hit) {
        let foundFeature: Feature | null = null;
        map.forEachFeatureAtPixel(pixel, (f) => {
          foundFeature = f as Feature;
          return true; // stop iteration
        });
        if (foundFeature) {
          const name = (foundFeature as Feature).get('name') as string;
          setTooltip({ name, x: pixel[0]!, y: pixel[1]! });
        }
      } else {
        setTooltip(null);
      }
    });

    // Click on feature
    map.on('click', (evt) => {
      let foundFeature: Feature | null = null;
      map.forEachFeatureAtPixel(evt.pixel, (f) => {
        foundFeature = f as Feature;
        return true; // stop iteration
      });
      if (foundFeature && onWindFarmClick) {
        const id = (foundFeature as Feature).get('windFarmId') as string;
        if (id) onWindFarmClick(id);
      }
    });

    mapRef.current = map;

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when wind farms data changes
  useEffect(() => {
    const source = vectorSourceRef.current;
    source.clear();

    const features: Feature[] = [];

    for (const farm of windFarms) {
      if (farm.latitude != null && farm.longitude != null) {
        const feature = new Feature({
          geometry: new Point(fromLonLat([farm.longitude, farm.latitude])),
          name: farm.name,
          windFarmId: farm.id,
        });
        features.push(feature);
      }
    }

    source.addFeatures(features);

    // Fit view to features extent
    if (features.length > 0 && mapRef.current) {
      const extent = source.getExtent();
      if (extent) {
        mapRef.current.getView().fit(extent, {
          padding: [60, 60, 60, 60],
          maxZoom: 14,
          duration: 500,
        });
      }
    }
  }, [windFarms]);

  return (
    <div style={rootStyle}>
      <div id="map-container" style={mapContainerStyle}>
        <div ref={mapContainerRef} style={olViewportStyle} />
        {tooltip && (
          <div
            style={{
              ...tooltipStyle,
              left: tooltip.x + 12,
              top: tooltip.y - 28,
            }}
          >
            {tooltip.name}
          </div>
        )}
        {isLoading && (
          <div style={loadingOverlayStyle}>
            <span>{t('map.loading')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const rootStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  position: 'relative',
  overflow: 'hidden',
};

const mapContainerStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
};

const olViewportStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'absolute',
  inset: 0,
};

const tooltipStyle: React.CSSProperties = {
  position: 'absolute',
  backgroundColor: 'rgba(0,0,0,0.75)',
  color: '#fff',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  zIndex: 10,
};

const loadingOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.6)',
  zIndex: 20,
  fontSize: '14px',
  color: '#666',
};
