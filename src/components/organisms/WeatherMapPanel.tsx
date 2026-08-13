import type { CSSProperties } from 'react';
import { Skeleton } from '@/components/atoms';
import { useLanguage } from '@/components/design-system';

export interface WeatherMapPanelProps {
  latitude: number | null;
  longitude: number | null;
  isLoading?: boolean;
}

function buildWindyUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    type: 'map',
    location: 'coordinates',
    metricRain: 'mm',
    metricTemp: '°C',
    metricWind: 'm/s',
    lat: lat.toString(),
    lon: lon.toString(),
    zoom: '10',
    level: 'surface',
    overlay: 'wind',
    product: 'ecmwf',
    message: 'true',
    calendar: 'now',
    detail: 'true',
    detailLat: lat.toString(),
    detailLon: lon.toString(),
  });
  return `https://embed.windy.com/embed.html?${params.toString()}`;
}

export function WeatherMapPanel({ latitude, longitude, isLoading }: WeatherMapPanelProps) {
  const { t } = useLanguage();
  const containerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    minHeight: '500px',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    backgroundColor: 'var(--color-neutral-100)',
  };

  const placeholderStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    minHeight: '500px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-neutral-100)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-4)',
  };

  const placeholderTextStyle: CSSProperties = {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-neutral-500)',
    fontFamily: 'var(--font-family-sans)',
    textAlign: 'center',
  };

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <Skeleton variant="rect" width="100%" height="500px" />
      </div>
    );
  }

  if (latitude === null || longitude === null) {
    return (
      <div style={placeholderStyle}>
        <span style={placeholderTextStyle}>
          Seleccione un parque para ver el pronóstico meteorológico
        </span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <iframe
        src={buildWindyUrl(latitude, longitude)}
        width="100%"
        height="100%"
        style={{ border: 'none', minHeight: '500px' }}
        frameBorder="0"
        allow="geolocation"
        title={t('misc.weatherForecast')}
        loading="lazy"
      />
    </div>
  );
}
