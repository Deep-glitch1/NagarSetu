import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Clock3, LocateFixed, MapPin, RefreshCw, Truck } from 'lucide-react';
import { apiFetch } from '../../api/client';
import './EmployeeWasteCollection.css';

const WasteCollectionMap = lazy(() => import('../citizen/WasteCollectionMap'));

function ageLabel(seconds) {
  if (seconds == null) return 'No GPS point recorded';
  if (seconds < 60) return `${Math.floor(seconds)} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  return `${Math.floor(seconds / 3600)} hours ago`;
}

export default function EmployeeWasteCollection() {
  const [assignment, setAssignment] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastPosition, setLastPosition] = useState(null);
  const watchIdRef = useRef(null);
  const lastPostAtRef = useRef(0);
  const mountedRef = useRef(true);
  const selectedVehicleRef = useRef(null);

  const loadAssignment = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/employee/waste-collection/my-assignment');
      if (!mountedRef.current) return data;
      setAssignment(data);
      setSelectedId((current) => data.vehicles.some((vehicle) => vehicle.id === current)
        ? current
        : data.vehicles[0]?.id ?? null);
      return data;
    } catch (requestError) {
      if (mountedRef.current) setError(requestError.message || 'Could not load your collection assignment.');
      return null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadAssignment();
    const timer = window.setInterval(() => loadAssignment(true), 45000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      if (watchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [loadAssignment]);

  const selectedVehicle = assignment?.vehicles.find((vehicle) => vehicle.id === selectedId) || null;
  selectedVehicleRef.current = selectedVehicle;

  const stopGpsWatch = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setSharing(false);
  }, []);

  const startGpsWatch = useCallback((vehicleId) => {
    if (!navigator.geolocation || watchIdRef.current != null) return;
    setSharing(true);
    setError('');
    setNotice('Trip active. Sharing GPS while this page remains open.');
    watchIdRef.current = navigator.geolocation.watchPosition(async ({ coords }) => {
      const point = { latitude: coords.latitude, longitude: coords.longitude };
      setLastPosition(point);
      if (Date.now() - lastPostAtRef.current < 15000) return;
      lastPostAtRef.current = Date.now();
      try {
        await apiFetch('/employee/waste-collection/location', {
          method: 'POST',
          body: JSON.stringify({ vehicle_id: vehicleId, ...point }),
        });
      } catch (requestError) {
        setError(requestError.message || 'GPS update failed. The active trip remains open.');
        stopGpsWatch();
      }
    }, async (geoError) => {
      setError(geoError.code === geoError.PERMISSION_DENIED
        ? 'Location permission was denied. The active trip was ended because GPS is required.'
        : 'Could not get a GPS position. The active trip was ended.');
      const tripId = selectedVehicleRef.current?.trip_id;
      stopGpsWatch();
      if (tripId) {
        try { await apiFetch(`/employee/waste-collection/trips/${tripId}/finish`, { method: 'POST' }); } catch { /* refresh reflects server trip state */ }
        loadAssignment(true);
      }
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  }, [loadAssignment, stopGpsWatch]);

  useEffect(() => {
    if (selectedVehicle?.trip_id && watchIdRef.current == null) startGpsWatch(selectedVehicle.id);
    if (!selectedVehicle?.trip_id && watchIdRef.current != null) stopGpsWatch();
  }, [selectedVehicle?.id, selectedVehicle?.trip_id, startGpsWatch, stopGpsWatch]);

  const startTrip = async () => {
    if (!selectedVehicle || !navigator.geolocation) {
      setError('A vehicle and browser location access are required to start a trip.');
      return;
    }
    setError('');
    setNotice('Starting trip…');
    try {
      await apiFetch('/employee/waste-collection/trips/start', {
        method: 'POST',
        body: JSON.stringify({ vehicle_id: selectedVehicle.id }),
      });
      await loadAssignment(true);
      setNotice('Trip started. GPS sharing will begin after location permission is granted.');
    } catch (requestError) {
      setError(requestError.message || 'Could not start this trip.');
      setNotice('');
    }
  };

  const finishTrip = async () => {
    if (!selectedVehicle?.trip_id) return;
    setError('');
    try {
      await apiFetch(`/employee/waste-collection/trips/${selectedVehicle.trip_id}/finish`, { method: 'POST' });
      stopGpsWatch();
      setNotice('Trip finished. Your live location is no longer shared with citizens.');
      await loadAssignment(true);
    } catch (requestError) {
      setError(requestError.message || 'Could not finish this trip.');
    }
  };

  const mapOverview = useMemo(() => selectedVehicle ? ({
    ward: {
      id: selectedVehicle.area.id,
      name: selectedVehicle.area.name,
      code: selectedVehicle.area.code,
      boundary: selectedVehicle.area.boundary,
    },
    vehicles: [{
      ...selectedVehicle,
      longitude: lastPosition?.longitude ?? selectedVehicle.longitude,
      latitude: lastPosition?.latitude ?? selectedVehicle.latitude,
      eta_minutes: null,
      distance_meters: null,
      driver_name: assignment?.employee?.name,
    }],
    geofence_events: [],
    as_of: new Date().toISOString(),
  }) : null, [selectedVehicle, assignment?.employee?.name, lastPosition]);

  const availability = assignment?.availability || 'available';

  return (
    <div className="employee-waste-page">
      <header className="employee-waste-hero">
        <div><p className="civic-eyebrow">Field work</p><h2>My collection route</h2><p>Your location becomes visible to citizens in your assigned area only after you start a trip.</p></div>
        {selectedVehicle && <button className={`employee-waste-share ${selectedVehicle.trip_id ? 'is-sharing' : ''}`} type="button" onClick={selectedVehicle.trip_id ? finishTrip : startTrip} disabled={loading || refreshing || availability !== 'available'}>
          {selectedVehicle.trip_id ? <Check size={17} /> : <LocateFixed size={17} />}
          {selectedVehicle.trip_id ? 'Finish trip' : 'Start trip'}
        </button>}
      </header>

      {error && <div className="employee-waste-message is-error" role="alert"><AlertCircle size={17} />{error}</div>}
      {notice && !error && <div className="employee-waste-message" role="status"><Check size={17} />{notice}</div>}

      {loading ? <div className="employee-waste-loading"><RefreshCw className="employee-waste-spin" size={18} />Loading your assignment…</div> : selectedVehicle ? <>
        <section className="employee-waste-summary" aria-label="Current assignment">
          <article><span className="employee-waste-summary-icon"><Truck size={20} /></span><div><small>Assigned vehicle</small><strong>{selectedVehicle.registration_number}</strong></div></article>
          <article><span className="employee-waste-summary-icon area"><MapPin size={20} /></span><div><small>Collection area</small><strong>{selectedVehicle.area.name}</strong><em>{selectedVehicle.area.unit_type?.replace('_', ' ') || 'Service area'}</em></div></article>
          <article><span className="employee-waste-summary-icon gps"><Clock3 size={20} /></span><div><small>Driver availability</small><strong>{availability === 'on_leave' ? 'On leave' : availability === 'off_duty' ? 'Off duty' : 'Available'}</strong><em>{selectedVehicle.trip_id ? 'Trip in progress · GPS ' + ageLabel(selectedVehicle.gps_age_seconds) : 'No trip active'}</em></div></article>
        </section>
        <section className="employee-waste-map-card">
          <div className="employee-waste-card-heading"><div><p className="civic-eyebrow">Assigned area</p><h3>{selectedVehicle.area.name}</h3><p>{selectedVehicle.trip_id ? 'Your route is being shared with citizens in this area.' : 'Start a trip to share your live position.'}</p></div><button type="button" onClick={() => loadAssignment(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'employee-waste-spin' : ''} size={15} />Refresh</button></div>
          <div className="employee-waste-map-frame">
            {selectedVehicle.area.boundary || selectedVehicle.longitude != null || lastPosition
              ? <Suspense fallback={<div className="employee-waste-map-hint">Loading map…</div>}><WasteCollectionMap overview={mapOverview} selectedVehicleId={selectedVehicle.id} citizenLocation={lastPosition} onSelectVehicle={() => {}} autoCenterVehicle /></Suspense>
              : <div className="employee-waste-map-hint"><MapPin size={17} />No GPS position yet. Start a trip and allow location access to show your route.</div>}
          </div>
          <p className="employee-waste-privacy"><LocateFixed size={15} />GPS sharing stops when the trip ends or this page is closed. A refreshed page resumes sharing for an active trip.</p>
        </section>
      </> : <section className="employee-waste-empty"><span><Truck size={24} /></span><h3>No vehicle is assigned to you</h3><p>Your area supervisor can assign an available vehicle for your service area.</p></section>}
    </div>
  );
}
