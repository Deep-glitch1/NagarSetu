import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Clock3, MapPin, RefreshCw, Truck, UserRoundCog } from 'lucide-react';
import { apiFetch } from '../../api/client';
import './AdminWasteCollection.css';

const WasteCollectionMap = lazy(() => import('../citizen/WasteCollectionMap'));
const VEHICLES_PER_PAGE = 10;

function gpsStatus(seconds) {
  if (seconds == null) return { label: 'No GPS update', className: 'no-signal' };
  if (seconds <= 120) return { label: 'Live', className: 'is-live' };
  return { label: `Last seen ${Math.floor(seconds / 60)} min ago`, className: 'is-stale' };
}

function availabilityLabel(status) {
  if (status === 'on_leave') return 'On leave';
  if (status === 'off_duty') return 'Off duty';
  return status ? 'Available' : 'Not assigned';
}

export default function AdminWasteCollection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filterAreaId, setFilterAreaId] = useState('all');
  const [vehiclePage, setVehiclePage] = useState(0);

  const loadOverview = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setData(await apiFetch('/admin/waste-collection/overview'));
    } catch (requestError) {
      setError(requestError.message || 'Could not load fleet assignments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const filteredVehicles = useMemo(() => (data?.vehicles || []).filter((vehicle) => (
    filterAreaId === 'all' || String(vehicle.area_id || '') === filterAreaId
  )), [data, filterAreaId]);
  const pageCount = Math.max(1, Math.ceil(filteredVehicles.length / VEHICLES_PER_PAGE));
  const currentPage = Math.min(vehiclePage, pageCount - 1);
  const visibleVehicles = filteredVehicles.slice(currentPage * VEHICLES_PER_PAGE, (currentPage + 1) * VEHICLES_PER_PAGE);
  const mappedVehicles = visibleVehicles.filter((vehicle) => vehicle.longitude != null && vehicle.latitude != null).map((vehicle) => ({
    ...vehicle,
    route_logs: [],
    eta_minutes: null,
    distance_meters: null,
  }));
  const selectedArea = filterAreaId === 'all' ? null : data?.areas.find((area) => String(area.id) === filterAreaId);
  const mapOverview = data && mappedVehicles.length ? {
    ward: selectedArea
      ? { id: selectedArea.id, name: selectedArea.name, code: selectedArea.code, boundary: selectedArea.boundary }
      : { id: 'all-areas', name: 'Fleet locations', code: 'all', boundary: null },
    vehicles: mappedVehicles,
    geofence_events: [],
    as_of: data.as_of,
  } : null;

  const assignedCount = (data?.vehicles || []).filter((vehicle) => vehicle.driver_id != null && vehicle.area_id != null).length;
  const liveCount = (data?.vehicles || []).filter((vehicle) => vehicle.gps_age_seconds != null && vehicle.gps_age_seconds <= 120).length;
  const activeTrips = (data?.vehicles || []).filter((vehicle) => vehicle.active_trip_id != null).length;

  return (
    <div className="admin-waste-page">
      <header className="admin-waste-hero">
        <div><p className="civic-eyebrow">Fleet oversight</p><h2>Waste collection</h2><p>View area supervisors, vehicle assignments, active trips, and GPS reporting. Area supervisors manage staffing and vehicle assignments.</p></div>
        <button type="button" onClick={() => loadOverview(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'admin-waste-spin' : ''} size={16} />Refresh fleet</button>
      </header>

      {error && <div className="admin-waste-message is-error" role="alert"><AlertCircle size={17} />{error}</div>}

      {loading ? <div className="admin-waste-loading"><RefreshCw className="admin-waste-spin" size={18} />Loading fleet…</div> : data && <>
        <section className="admin-waste-stats" aria-label="Fleet summary">
          <article><span><Truck size={19} /></span><div><small>Vehicles</small><strong>{data.vehicles.length}</strong></div></article>
          <article><span className="assigned"><UserRoundCog size={19} /></span><div><small>With assigned driver</small><strong>{assignedCount}</strong></div></article>
          <article><span className="gps"><MapPin size={19} /></span><div><small>Live · trips active</small><strong>{liveCount} · {activeTrips}</strong></div></article>
        </section>

        <section className="admin-waste-fleet-card admin-waste-supervisors">
          <div className="admin-waste-section-heading"><div><p className="civic-eyebrow">Area leads</p><h3>Collection supervisors</h3><p>Each supervisor can manage only drivers and vehicles in their assigned area.</p></div><span className="admin-waste-total">{data.supervisors?.length || 0} supervisors</span></div>
          <div className="admin-waste-supervisor-grid">
            {(data.supervisors || []).map((supervisor) => <article key={supervisor.id}>
              <span><UserRoundCog size={17} /></span><div><strong>{supervisor.area_name || 'Area not assigned'}</strong><small>{supervisor.name} · {supervisor.email}</small></div>
            </article>)}
          </div>
        </section>

        <section className="admin-waste-map-card">
          <div className="admin-waste-section-heading"><div><p className="civic-eyebrow">Current trip feed</p><h3>Vehicle locations</h3><p>Only drivers on an active trip share their positions with citizens.</p></div>
            <label>Area<select value={filterAreaId} onChange={(event) => { setFilterAreaId(event.target.value); setVehiclePage(0); }}><option value="all">All areas</option>{data.areas.map((area) => <option key={area.id} value={area.id}>{area.name} · {area.unit_type.replace('_', ' ')}</option>)}</select></label>
          </div>
          <div className="admin-waste-map-frame">
            {mapOverview ? <Suspense fallback={<div className="admin-waste-map-empty">Loading map…</div>}><WasteCollectionMap overview={mapOverview} selectedVehicleId={null} citizenLocation={null} onSelectVehicle={() => {}} /></Suspense> : <div className="admin-waste-map-empty"><MapPin size={22} /><span>No active trip GPS positions are available for this page yet.</span></div>}
          </div>
        </section>

        <section className="admin-waste-fleet-card">
          <div className="admin-waste-section-heading"><div><p className="civic-eyebrow">Assignments</p><h3>Vehicles and drivers</h3><p>Read-only fleet view. The area supervisor handles driver availability and reassignments.</p></div><span className="admin-waste-total">{filteredVehicles.length} vehicles</span></div>
          {visibleVehicles.length ? <div className="admin-waste-table-wrap"><table className="admin-waste-table"><thead><tr><th>Vehicle</th><th>Area</th><th>Assigned driver</th><th>Availability</th><th>Trip / GPS</th></tr></thead><tbody>
            {visibleVehicles.map((vehicle) => {
              const status = gpsStatus(vehicle.gps_age_seconds);
              return <tr key={vehicle.id}>
                <td><strong>{vehicle.registration_number}</strong><small>{vehicle.is_active ? 'Active vehicle' : 'Inactive vehicle'}</small></td>
                <td>{vehicle.area_name || <span className="admin-waste-unassigned">No area</span>}<small>{vehicle.area_type?.replace('_', ' ') || 'Not assigned'}</small></td>
                <td>{vehicle.driver_name || <span className="admin-waste-unassigned">Unassigned</span>}<small>{vehicle.driver_employee_code || 'No driver linked'}</small></td>
                <td><span className={`admin-waste-availability ${vehicle.driver_availability || 'none'}`}>{availabilityLabel(vehicle.driver_availability)}</span></td>
                <td>{vehicle.active_trip_id ? <span className="admin-waste-trip is-active">On trip</span> : <span className="admin-waste-trip">Not travelling</span>}<small className={`admin-waste-gps ${status.className}`}><i />{status.label}</small></td>
              </tr>;
            })}
          </tbody></table></div> : <p className="admin-waste-no-vehicles">No vehicles were found for this view.</p>}
          {pageCount > 1 && <nav className="admin-waste-pagination" aria-label="Fleet vehicle pages">
            <span>Showing {currentPage * VEHICLES_PER_PAGE + 1}–{Math.min((currentPage + 1) * VEHICLES_PER_PAGE, filteredVehicles.length)} of {filteredVehicles.length} vehicles</span>
            <div><button type="button" onClick={() => setVehiclePage((page) => Math.max(0, page - 1))} disabled={currentPage === 0} aria-label="Previous 10 vehicles"><ChevronLeft size={16} />Previous</button>
              <span className="admin-waste-page-count">Page {currentPage + 1} of {pageCount}</span>
              <button type="button" onClick={() => setVehiclePage((page) => Math.min(pageCount - 1, page + 1))} disabled={currentPage >= pageCount - 1} aria-label="Next 10 vehicles">Next<ChevronRight size={16} /></button></div>
          </nav>}
          <p className="admin-waste-footnote"><Clock3 size={14} />An offline or stale driver remains visible here with their assigned area; supervisors can set leave and assign an available area driver.</p>
        </section>
      </>}
    </div>
  );
}
