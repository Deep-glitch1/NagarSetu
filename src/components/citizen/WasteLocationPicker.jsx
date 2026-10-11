import { useEffect, useRef } from 'react';
import { LngLat, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);

export default function WasteLocationPicker({ selectedLocation, startLocation, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selectedLocation);
  const startLongitude = startLocation?.[0];
  const startLatitude = startLocation?.[1];

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { selectedRef.current = selectedLocation; }, [selectedLocation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const startingPoint = startLongitude != null && startLatitude != null
      ? [startLongitude, startLatitude]
      : [77.0266, 28.4595];
    const map = new MapLibreMap({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: startingPoint,
      zoom: startLongitude != null && startLatitude != null ? 14 : 11,
      attributionControl: true,
    });
    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');

    const placeMarker = (point) => {
      if (!point) return;
      if (!markerRef.current) {
        const element = document.createElement('div');
        element.className = 'waste-picked-location-marker';
        element.setAttribute('aria-label', 'Selected location');
        markerRef.current = new Marker({ element, anchor: 'bottom' }).setLngLat(point).addTo(map);
      } else {
        markerRef.current.setLngLat(point);
      }
    };

    map.on('click', (event) => {
      const point = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };
      placeMarker([point.longitude, point.latitude]);
      onSelectRef.current(point);
    });
    mapRef.current = map;
    map.once('load', () => {
      if (selectedRef.current) {
        placeMarker([selectedRef.current.longitude, selectedRef.current.latitude]);
      }
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [startLongitude, startLatitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;
    const point = [selectedLocation.longitude, selectedLocation.latitude];
    if (markerRef.current) markerRef.current.setLngLat(point);
    else if (map.isStyleLoaded()) {
      const element = document.createElement('div');
      element.className = 'waste-picked-location-marker';
      markerRef.current = new Marker({ element, anchor: 'bottom' }).setLngLat(point).addTo(map);
    }
    map.easeTo({ center: new LngLat(point[0], point[1]), zoom: Math.max(map.getZoom(), 14), duration: 350 });
  }, [selectedLocation]);

  return <div ref={containerRef} className="waste-location-picker-map" aria-label="Click the map to select a collection location" />;
}
