import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { apiFetch } from '../../api/client';
import './WasteCollectionTracking.css';

const WasteCollectionMap = lazy(() => import('./WasteCollectionMap'));
const WasteLocationPicker = lazy(() => import('./WasteLocationPicker'));

function formatAge(seconds) {
  if (seconds == null) return 'No GPS update';
  if (seconds < 60) return `${Math.max(0, Math.floor(seconds))} sec ago`;
  return `${Math.floor(seconds / 60)} min ago`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

export default function WasteCollectionTracking() {
  const [wards, setWards] = useState([]);
  const [overview, setOverview] = useState(null);
  const [selectedWardId, setSelectedWardId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [vehiclePage, setVehiclePage] = useState(0);
  const [citizenLocation, setCitizenLocation] = useState(null);
  const [manualLocation, setManualLocation] = useState(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [loadingWards, setLoadingWards] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const notifiedVehicles = useRef(new Set());

  useEffect(() => {
    let mounted = true;
    apiFetch('/citizen/waste-collection/wards')
      .then((data) => {
        if (!mounted) return;
        setWards(data.wards || []);
        if (!data.wards?.length) setError('No active ward boundaries are available yet.');
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.message || 'Could not load ward boundaries.');
      })
      .finally(() => mounted && setLoadingWards(false));
    return () => { mounted = false; };
  }, []);

  const loadOverview = useCallback(async ({ wardId, location } = {}) => {
    if (!wardId && !location) return;
    const query = new URLSearchParams();
    if (wardId) query.set('ward_id', wardId);
    if (location) {
      query.set('latitude', location.latitude);
      query.set('longitude', location.longitude);
    }
    setLoadingOverview(true);
    setError('');
    try {
      const result = await apiFetch(`/citizen/waste-collection/overview?${query.toString()}`);
      setOverview(result);
      if (String(result.ward.id) !== String(selectedWardId)) setVehiclePage(0);
      setSelectedWardId(String(result.ward.id));
      setSelectedVehicleId((current) => result.vehicles.some((vehicle) => vehicle.id === current)
        ? current
        : result.vehicles[0]?.id ?? null);
      setLocationMessage(location ? 'Showing your ward based on your current location.' : '');
      return true;
    } catch (requestError) {
      if (requestError.status === 404 && wards.length === 0) {
        setError('Your point is selected, but no ward boundaries are loaded in the database yet. Add ward boundary data and vehicle records to enable tracking.');
      } else {
        setError(requestError.message || 'Could not load collection tracking for this ward.');
      }
      return false;
    } finally {
      setLoadingOverview(false);
    }
  }, [selectedWardId, wards]);

  useEffect(() => {
    if (!overview) return undefined;
    const timer = window.setInterval(() => {
      loadOverview({ wardId: selectedWardId, location: citizenLocation || undefined });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [overview, selectedWardId, citizenLocation, loadOverview]);

  useEffect(() => {
    if (!alertsEnabled || !overview || !('Notification' in window) || Notification.permission !== 'granted') return;
    overview.vehicles.forEach((vehicle) => {
      if (vehicle.is_live && vehicle.eta_minutes != null && vehicle.eta_minutes <= 3 && !notifiedVehicles.current.has(vehicle.id)) {
        notifiedVehicles.current.add(vehicle.id);
        new Notification('Waste collection is nearby', {
          body: `${vehicle.registration_number} is about ${vehicle.eta_minutes} minutes away from your location.`,
        });
      }
    });
  }, [alertsEnabled, overview]);

  const chooseLocation = () => {
    setLocationMessage('');
    if (!navigator.geolocation) {
      setLocationMessage('Location sharing is not supported by this browser. Select your ward instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { latitude: coords.latitude, longitude: coords.longitude };
        setCitizenLocation(location);
        loadOverview({ location });
      },
      (geoError) => {
        setLocationMessage(geoError.code === geoError.PERMISSION_DENIED
          ? 'Location permission was not granted. You can choose your ward from the list.'
          : 'Could not determine your location. Choose your ward from the list.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const chooseWard = (event) => {
    const wardId = event.target.value;
    setVehiclePage(0);
    setSelectedWardId(wardId);
    setCitizenLocation(null);
    if (wardId) loadOverview({ wardId });
    else setOverview(null);
  };

  const selectedVehicle = overview?.vehicles.find((vehicle) => vehicle.id === selectedVehicleId)
    || overview?.vehicles[0]
    || null;
  const vehiclePageCount = Math.max(1, Math.ceil((overview?.vehicles.length || 0) / 4));
  const visibleVehicles = overview?.vehicles.slice(vehiclePage * 4, vehiclePage * 4 + 4) || [];
  const firstVisibleVehicle = overview?.vehicles.length ? vehiclePage * 4 + 1 : 0;
  const lastVisibleVehicle = Math.min((vehiclePage + 1) * 4, overview?.vehicles.length || 0);

  useEffect(() => {
    setVehiclePage((currentPage) => Math.min(currentPage, vehiclePageCount - 1));
  }, [vehiclePageCount]);
  const enableAlerts = async () => {
    if (!('Notification' in window)) {
      setAlertMessage('This browser does not support desktop notifications.');
      return;
    }
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission === 'granted') {
      setAlertsEnabled(true);
      setAlertMessage('Arrival alerts are active while this page stays open.');
    } else {
      setAlertsEnabled(false);
      setAlertMessage('Allow browser notifications to receive arrival alerts.');
    }
  };

  return (
    <div className="waste-tracking-page">
      <header className="waste-page-heading">
        <div>
          <p className="civic-eyebrow">Waste collection</p>
          <h2>Track a collection vehicle</h2>
          <p>See vehicles reporting GPS in your ward, check their latest route, and view geofence activity.</p>
        </div>
        <div className="waste-location-actions">
          <label className="waste-ward-picker">
            <MapPin size={17} aria-hidden="true" />
            <span className="sr-only">Choose ward</span>
            <select value={selectedWardId} onChange={chooseWard} disabled={loadingWards}>
              <option value="">Select a ward</option>
              {wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}
            </select>
          </label>
          <button className="waste-location-button" type="button" onClick={chooseLocation} disabled={loadingOverview}>
            <LocateFixed size={16} /> Use my location
          </button>
          <button className="waste-manual-location-button" type="button" onClick={() => setLocationPickerOpen((open) => !open)} aria-expanded={locationPickerOpen}>
            <MapPin size={16} /> {locationPickerOpen ? 'Close map picker' : 'Choose on map'}
          </button>
        </div>
      </header>

      {locationPickerOpen && <section className="waste-location-picker-panel">
        <div className="waste-picker-heading"><div><p className="civic-eyebrow">Manual location</p><h3>Click the map to choose a point</h3><p>The pin is used to find the ward and estimate distance. It does not change your device location.</p></div>
          {manualLocation && <div className="waste-picked-coordinates"><MapPin size={15} /><span>{manualLocation.latitude.toFixed(5)}, {manualLocation.longitude.toFixed(5)}</span><button type="button" onClick={async () => { const hasWard = await loadOverview({ location: manualLocation }); if (hasWard) { setCitizenLocation(manualLocation); setLocationPickerOpen(false); } }} disabled={loadingOverview}>Use this point</button></div>}
        </div>
        <Suspense fallback={<div className="waste-location-picker-loading">Loading location map…</div>}>
          <WasteLocationPicker
            selectedLocation={manualLocation}
            startLocation={citizenLocation ? [citizenLocation.longitude, citizenLocation.latitude] : undefined}
            onSelect={setManualLocation}
          />
        </Suspense>
      </section>}

      {(error || locationMessage) && <div className={`waste-message ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || locationMessage}</div>}

      {loadingWards && <div className="waste-loading"><RefreshCw size={18} className="waste-spin" /> Loading ward boundaries…</div>}

      {!loadingWards && !overview && !error && (
        <section className="waste-empty-state">
          <span><MapPin size={23} /></span>
          <h3>Choose your ward to get started</h3>
          <p>Select a ward or share your location. We’ll show collection vehicles that have reported a GPS location for that area.</p>
        </section>
      )}

      {overview && <>
        <section className="waste-summary-grid" aria-label="Collection summary">
          <article className="waste-summary-card"><span className="waste-summary-icon"><Truck size={19} /></span><div><small>Vehicles assigned or inside ward</small><strong>{overview.vehicles.length}</strong></div><span className="waste-live-dot">{overview.vehicles.filter((vehicle) => vehicle.is_live).length} live</span></article>
          <article className="waste-summary-card"><span className="waste-summary-icon waste-summary-icon-green"><Check size={19} /></span><div><small>GPS route points · last 24 hours</small><strong>{overview.vehicles.reduce((total, vehicle) => total + vehicle.route_logs.length, 0)}</strong></div></article>
          <article className="waste-summary-card"><span className="waste-summary-icon waste-summary-icon-amber"><Clock3 size={19} /></span><div><small>Nearest live vehicle estimate</small><strong>{(() => { const nearest = overview.vehicles.filter((vehicle) => vehicle.is_live && vehicle.eta_minutes != null).sort((a, b) => a.eta_minutes - b.eta_minutes)[0]; return nearest ? `${nearest.eta_minutes} min` : 'Unavailable'; })()}</strong></div></article>
        </section>

        <section className="waste-tracking-grid">
          <article className="waste-map-card">
            <div className="waste-card-heading"><div><p className="civic-eyebrow">PostGIS ward boundary and GPS points</p><h3>{overview.ward.name}</h3></div><span className="waste-live-label"><i /> Updated {formatTime(overview.as_of)}</span></div>
            <div className="waste-map">
              <Suspense fallback={<div className="waste-map-loading">Loading interactive map…</div>}>
                <WasteCollectionMap overview={overview} selectedVehicleId={selectedVehicle?.id} citizenLocation={citizenLocation} onSelectVehicle={setSelectedVehicleId} />
              </Suspense>
              <div className="waste-map-legend"><span><i className="legend-vehicle" /> Vehicle GPS</span><span><i className="legend-ward" /> Ward geofence</span><span><i className="legend-cluster">#</i> Cluster - click to zoom</span>{citizenLocation && <span><i className="legend-you" /> Your location</span>}</div>
            </div>
            <div className="waste-map-caption"><Navigation size={15} /><span>Boundary comes from the ward polygon stored in PostGIS.</span><button type="button" onClick={() => loadOverview({ wardId: selectedWardId, location: citizenLocation || undefined })} disabled={loadingOverview}><RefreshCw size={14} /> Refresh</button></div>
          </article>

          <aside className="waste-side-column">
            <article className="waste-fleet-card">
              <div className="waste-card-heading"><div><p className="civic-eyebrow">Current vehicle feed</p><h3>Ward vehicles</h3></div><span className="waste-fleet-count">{overview.vehicles.length}</span></div>
              {overview.vehicles.length ? <>
                <div className="waste-vehicle-list">
                  {visibleVehicles.map((vehicle) => <button key={vehicle.id} className={`waste-vehicle-row ${vehicle.id === selectedVehicle?.id ? 'is-active' : ''}`} onClick={() => setSelectedVehicleId(vehicle.id)}><span className="waste-truck-avatar"><Truck size={18} /></span><span className="waste-vehicle-copy"><strong>{vehicle.registration_number}</strong><small>{vehicle.driver_name || 'Driver not listed'} · {formatAge(vehicle.gps_age_seconds)}</small><small>{vehicle.inside_geofence == null ? 'No current GPS point' : vehicle.inside_geofence ? 'Inside ward boundary' : 'Outside ward boundary'}</small></span><span className="waste-vehicle-eta"><strong>{vehicle.is_live ? 'Live' : 'Stale'}</strong><ChevronRight size={15} /></span></button>)}
                </div>
                {vehiclePageCount > 1 && <nav className="waste-vehicle-pagination" aria-label="Ward vehicle pages">
                  <span aria-live="polite">{firstVisibleVehicle}-{lastVisibleVehicle} of {overview.vehicles.length}</span>
                  <div>
                    <button type="button" aria-label="Previous vehicle page" onClick={() => setVehiclePage((page) => Math.max(0, page - 1))} disabled={vehiclePage === 0}><ChevronLeft size={16} /></button>
                    <small>Page {vehiclePage + 1} of {vehiclePageCount}</small>
                    <button type="button" aria-label="Next vehicle page" onClick={() => setVehiclePage((page) => Math.min(vehiclePageCount - 1, page + 1))} disabled={vehiclePage >= vehiclePageCount - 1}><ChevronRight size={16} /></button>
                  </div>
                </nav>}
              </> : <p className="waste-no-data">No active vehicle is assigned to or currently inside this ward.</p>}
            </article>

            <article className="waste-arrival-card">
              <div className="waste-arrival-icon"><Bell size={18} /></div>
              <div className="waste-arrival-copy"><p className="civic-eyebrow">Arrival estimate</p><h3>{selectedVehicle?.eta_minutes != null ? `~${selectedVehicle.eta_minutes} min` : 'Unavailable'}</h3><p>{selectedVehicle && citizenLocation ? `${selectedVehicle.registration_number} · ${selectedVehicle.distance_meters < 1000 ? `${selectedVehicle.distance_meters} m away` : `${(selectedVehicle.distance_meters / 1000).toFixed(1)} km away`}` : 'Share your location to estimate distance to a vehicle.'}</p></div>
              <button className={`waste-notification-toggle ${alertsEnabled ? 'is-on' : ''}`} type="button" onClick={alertsEnabled ? () => { setAlertsEnabled(false); setAlertMessage('Arrival alerts paused.'); } : enableAlerts}>{alertsEnabled ? <Bell size={13} /> : <BellOff size={13} />}{alertsEnabled ? 'Alerts on' : 'Enable alerts'}</button>
              {alertMessage && <span className="waste-notice" role="status">{alertMessage}</span>}
            </article>
          </aside>
        </section>

        <section className="waste-lower-grid">
          <article className="waste-route-card"><div className="waste-card-heading"><div><p className="civic-eyebrow">Recorded GPS trail</p><h3>{selectedVehicle?.registration_number || 'Select a vehicle'}</h3></div><span className="waste-route-status">Last 24 hours</span></div>{selectedVehicle?.route_logs.length ? <><p className="waste-route-help">{selectedVehicle.route_logs.length} recorded position{selectedVehicle.route_logs.length === 1 ? '' : 's'}, shown oldest to newest.</p><ol className="waste-route-stops">{[...selectedVehicle.route_logs].reverse().slice(0, 4).map((point) => <li key={point.id} className={point.inside_geofence ? 'is-complete' : 'is-next'}><span>{point.inside_geofence ? <Check size={12} /> : <MapPin size={12} />}</span><div><strong>{point.inside_geofence ? 'Inside ward boundary' : 'Outside ward boundary'}</strong><small>{formatTime(point.recorded_at)}</small></div></li>)}</ol></> : <p className="waste-no-data">No route points have been recorded for this vehicle in the last 24 hours.</p>}</article>
          <article className="waste-events-card"><div className="waste-card-heading"><div><p className="civic-eyebrow">Geofence events</p><h3>Ward boundary activity</h3></div><span className="waste-audit-badge">From route log</span></div>{overview.geofence_events.length ? <ul className="waste-event-list">{overview.geofence_events.map((event) => <li key={`${event.vehicle_id}-${event.recorded_at}-${event.type}`}><span className={`waste-event-icon ${event.type === 'entered' ? 'inside' : 'done'}`}><MapPin size={15} /></span><div><strong>{event.vehicle_registration} {event.type} {event.type === 'entered' ? 'the ward' : 'the ward'}</strong><small>GPS geofence event · {formatTime(event.recorded_at)}</small></div><time>{event.type === 'entered' ? 'Entered' : 'Left'}</time></li>)}</ul> : <p className="waste-no-data">No ward entry or exit has been recorded in the last 24 hours.</p>}</article>
        </section>
        <p className="waste-demo-note">Arrival time is an approximate straight-line estimate from the last GPS fix, not a road-route ETA. Browser alerts check for nearby live vehicles while this page is open.</p>
      </>}

      {loadingOverview && <div className="waste-loading waste-loading-overlay"><RefreshCw size={17} className="waste-spin" /> Updating vehicle feed…</div>}
    </div>
  );
}
