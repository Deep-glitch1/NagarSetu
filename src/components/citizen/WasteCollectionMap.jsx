import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(workerUrl);

const mapStyle = 'https://tiles.openfreemap.org/styles/liberty';

function asFeature(geometry, properties = {}) {
  return { type: 'Feature', geometry, properties };
}

function asCollection(features) {
  return { type: 'FeatureCollection', features };
}

function makeVehiclePopup(vehicle) {
  const content = document.createElement('div');
  content.className = 'waste-map-popup';
  const registration = document.createElement('strong');
  registration.textContent = vehicle.registration_number;
  const status = document.createElement('span');
  status.textContent = vehicle.is_live ? 'GPS live' : `Last update ${vehicle.gps_age_seconds == null ? 'unavailable' : `${Math.floor(vehicle.gps_age_seconds / 60)} min ago`}`;
  content.append(registration, status);
  return content;
}

export default function WasteCollectionMap({ overview, selectedVehicleId, citizenLocation, onSelectVehicle }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const fittedWardRef = useRef(null);
  const clusterInteractionsBoundRef = useRef(false);
  const vehiclesRef = useRef(overview.vehicles);
  const onSelectVehicleRef = useRef(onSelectVehicle);
  const [mapError, setMapError] = useState('');

  vehiclesRef.current = overview.vehicles;
  onSelectVehicleRef.current = onSelectVehicle;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const wardCoordinates = overview.ward.boundary?.coordinates?.[0] || [];
    const center = wardCoordinates.length
      ? [
          wardCoordinates.reduce((sum, point) => sum + point[0], 0) / wardCoordinates.length,
          wardCoordinates.reduce((sum, point) => sum + point[1], 0) / wardCoordinates.length,
        ]
      : [0, 0];
    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapStyle,
      center,
      zoom: 13,
      attributionControl: true,
    });
    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    map.on('error', (event) => {
      if (event?.error?.message) setMapError('Map tiles could not be loaded. Check your internet connection and the OpenFreeMap style URL.');
    });
    mapRef.current = map;
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const addOrUpdateLayers = () => {
      if (!map.getSource('ward-boundary')) {
        map.addSource('ward-boundary', {
          type: 'geojson',
          data: asCollection([asFeature(overview.ward.boundary)]),
        });
        map.addLayer({
          id: 'ward-boundary-fill',
          type: 'fill',
          source: 'ward-boundary',
          paint: { 'fill-color': '#4f8a66', 'fill-opacity': 0.12 },
        });
        map.addLayer({
          id: 'ward-boundary-line',
          type: 'line',
          source: 'ward-boundary',
          paint: { 'line-color': '#397255', 'line-width': 3, 'line-dasharray': [2, 1.5] },
        });
        map.addSource('vehicle-points', {
          type: 'geojson',
          data: asCollection([]),
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 14,
        });
        map.addLayer({
          id: 'vehicle-clusters',
          type: 'circle',
          source: 'vehicle-points',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#315f50',
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 30, 27],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2.5,
          },
        });
        map.addLayer({
          id: 'vehicle-cluster-count',
          type: 'symbol',
          source: 'vehicle-points',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Open Sans Bold'],
            'text-size': 12,
          },
          paint: { 'text-color': '#ffffff' },
        });
        map.addLayer({
          id: 'vehicle-unclustered',
          type: 'circle',
          source: 'vehicle-points',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 14, 11],
            'circle-color': ['case', ['get', 'selected'], '#bd5c43', ['get', 'is_live'], '#387557', '#87938e'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2.5,
          },
        });
        map.addSource('vehicle-route', {
          type: 'geojson',
          data: asCollection([]),
        });
        map.addLayer({
          id: 'vehicle-route-line',
          type: 'line',
          source: 'vehicle-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#bd5c43', 'line-width': 4, 'line-opacity': 0.86 },
        });
        map.addSource('citizen-location', {
          type: 'geojson',
          data: asCollection([]),
        });
        map.addLayer({
          id: 'citizen-location-dot',
          type: 'circle',
          source: 'citizen-location',
          paint: {
            'circle-radius': 8,
            'circle-color': '#bd5c43',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
          },
        });
      }

      if (!clusterInteractionsBoundRef.current) {
        map.on('click', 'vehicle-clusters', (event) => {
          const cluster = map.queryRenderedFeatures(event.point, { layers: ['vehicle-clusters'] })[0];
          if (!cluster) return;
          map.getSource('vehicle-points').getClusterExpansionZoom(cluster.properties.cluster_id)
            .then((zoom) => map.easeTo({ center: cluster.geometry.coordinates, zoom }))
            .catch(() => {});
        });
        map.on('click', 'vehicle-unclustered', (event) => {
          const feature = map.queryRenderedFeatures(event.point, { layers: ['vehicle-unclustered'] })[0];
          if (!feature) return;
          const vehicle = vehiclesRef.current.find((item) => String(item.id) === String(feature.properties.vehicle_id));
          if (!vehicle) return;
          onSelectVehicleRef.current(vehicle.id);
          new Popup({ offset: 14, closeButton: true })
            .setLngLat(feature.geometry.coordinates)
            .setDOMContent(makeVehiclePopup(vehicle))
            .addTo(map);
        });
        map.on('mouseenter', 'vehicle-clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'vehicle-clusters', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'vehicle-unclustered', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'vehicle-unclustered', () => { map.getCanvas().style.cursor = ''; });
        clusterInteractionsBoundRef.current = true;
      }

      const route = overview.vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
      const routeCoordinates = route?.route_logs
        .filter((point) => point.longitude != null && point.latitude != null)
        .slice()
        .sort((left, right) => new Date(left.recorded_at) - new Date(right.recorded_at))
        .map((point) => [point.longitude, point.latitude]) || [];
      map.getSource('vehicle-route').setData(routeCoordinates.length > 1
        ? asCollection([asFeature({ type: 'LineString', coordinates: routeCoordinates })])
        : asCollection([]));
      map.getSource('citizen-location').setData(citizenLocation
        ? asCollection([asFeature({ type: 'Point', coordinates: [citizenLocation.longitude, citizenLocation.latitude] })])
        : asCollection([]));
      map.getSource('vehicle-points').setData(asCollection(overview.vehicles
        .filter((vehicle) => vehicle.longitude != null && vehicle.latitude != null)
        .map((vehicle) => asFeature(
          { type: 'Point', coordinates: [vehicle.longitude, vehicle.latitude] },
          {
            vehicle_id: String(vehicle.id),
            registration_number: vehicle.registration_number,
            is_live: vehicle.is_live,
            selected: vehicle.id === selectedVehicleId,
          },
        ))));

      const bounds = wardCoordinatesForBounds(overview.ward.boundary);
      if (bounds.length && fittedWardRef.current !== overview.ward.id) {
        const mapBounds = new LngLatBounds();
        bounds.forEach((coordinate) => mapBounds.extend(coordinate));
        map.fitBounds(mapBounds, { padding: 48, maxZoom: 15, duration: 500 });
        fittedWardRef.current = overview.ward.id;
      }
    };

    if (map.isStyleLoaded()) addOrUpdateLayers();
    else map.once('load', addOrUpdateLayers);
    return () => map.off('load', addOrUpdateLayers);
  }, [overview, selectedVehicleId, citizenLocation]);

  return (
    <div className="waste-maplibre-wrap">
      <div ref={containerRef} className="waste-maplibre-canvas" aria-label={`Interactive map of ${overview.ward.name}`} />
      {mapError && <div className="waste-map-error" role="status">{mapError}</div>}
    </div>
  );
}

function wardCoordinatesForBounds(geometry) {
  if (geometry?.type === 'Polygon') return geometry.coordinates?.[0] || [];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates?.flatMap((polygon) => polygon[0] || []) || [];
  return [];
}
