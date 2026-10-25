import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, RefreshCw, UserRoundCog, Truck, UsersRound } from 'lucide-react';
import { apiFetch } from '../../api/client';
import './EmployeeWasteSupervisor.css';

const statusText = (status) => status === 'on_leave' ? 'On leave' : status === 'off_duty' ? 'Off duty' : 'Available';

export default function EmployeeWasteSupervisor() {
  const [overview, setOverview] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOverview = useCallback(async () => {
    setError('');
    try {
      const data = await apiFetch('/employee/waste-collection/supervisor/overview');
      setOverview(data);
      setAssignments(Object.fromEntries(data.vehicles.map((vehicle) => [vehicle.id, vehicle.driver_id ? String(vehicle.driver_id) : ''])));
    } catch (requestError) {
      setError(requestError.message || 'Could not load your area collection team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const timer = window.setInterval(loadOverview, 30000);
    return () => window.clearInterval(timer);
  }, [loadOverview]);

  const saveAssignment = async (vehicle) => {
    setBusy(`vehicle-${vehicle.id}`); setError(''); setNotice('');
    try {
      await apiFetch(`/employee/waste-collection/supervisor/vehicles/${vehicle.id}/assignment`, {
        method: 'PATCH',
        body: JSON.stringify({ driver_id: assignments[vehicle.id] ? Number(assignments[vehicle.id]) : null }),
      });
      setNotice(`Assignment updated for ${vehicle.registration_number}.`);
      await loadOverview();
    } catch (requestError) {
      setError(requestError.message || 'Could not update this vehicle assignment.');
    } finally { setBusy(''); }
  };

  const updateAvailability = async (driver, status) => {
    setBusy(`driver-${driver.id}`); setError(''); setNotice('');
    try {
      const result = await apiFetch(`/employee/waste-collection/supervisor/drivers/${driver.id}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note: status === 'on_leave' ? 'Marked on leave by area supervisor' : null }),
      });
      setNotice(result.replacement_driver
        ? `${driver.name} marked ${statusText(status).toLowerCase()}; ${result.replacement_driver.name} was assigned to the released vehicle.`
        : `${driver.name} is now ${statusText(status).toLowerCase()}.`);
      await loadOverview();
    } catch (requestError) {
      setError(requestError.message || 'Could not update driver availability.');
    } finally { setBusy(''); }
  };

  const autoAssign = async () => {
    setBusy('auto'); setError(''); setNotice('');
    try {
      const result = await apiFetch('/employee/waste-collection/supervisor/auto-assign', { method: 'POST' });
      setNotice(result.count ? `${result.count} vehicle${result.count === 1 ? '' : 's'} assigned to available drivers in your area.` : 'No unassigned vehicle and available driver pair needs assignment.');
      await loadOverview();
    } catch (requestError) {
      setError(requestError.message || 'Could not auto-assign drivers.');
    } finally { setBusy(''); }
  };

  return <div className="employee-waste-supervisor-page">
    <header className="employee-waste-supervisor-hero">
      <div><p className="civic-eyebrow">Area supervisor</p><h2>{overview?.area?.name || 'Collection team'}</h2><p>Manage availability and vehicle assignments for drivers in your area. You cannot change another area’s roster.</p></div>
      <button type="button" onClick={autoAssign} disabled={Boolean(busy) || loading}><UserRoundCog size={16} />{busy === 'auto' ? 'Assigning…' : 'Auto-assign free drivers'}</button>
    </header>

    {error && <div className="employee-waste-supervisor-message is-error" role="alert"><AlertCircle size={17} />{error}</div>}
    {notice && !error && <div className="employee-waste-supervisor-message" role="status"><Check size={17} />{notice}</div>}
    {loading ? <div className="employee-waste-supervisor-loading"><RefreshCw size={18} />Loading your area…</div> : overview && <>
      <section className="employee-waste-supervisor-stats">
        <article><span><Truck size={19} /></span><div><small>Area vehicles</small><strong>{overview.vehicles.length}</strong></div></article>
        <article><span><UsersRound size={19} /></span><div><small>Drivers</small><strong>{overview.drivers.length}</strong></div></article>
        <article><span><Check size={19} /></span><div><small>Available now</small><strong>{overview.drivers.filter((driver) => driver.availability_status === 'available').length}</strong></div></article>
      </section>

      <section className="employee-waste-supervisor-card">
        <div className="employee-waste-supervisor-heading"><div><p className="civic-eyebrow">Fleet</p><h3>Vehicles and assignments</h3><p>Drivers must be available and belong to this area. A vehicle on an active trip cannot be reassigned.</p></div></div>
        <div className="employee-waste-supervisor-vehicles">
          {overview.vehicles.map((vehicle) => {
            const options = overview.drivers.filter((driver) => driver.availability_status === 'available' && (driver.assigned_vehicle_id == null || driver.id === vehicle.driver_id));
            return <article key={vehicle.id}>
              <div className="employee-waste-supervisor-vehicle-title"><span><Truck size={18} /></span><div><strong>{vehicle.registration_number}</strong><small>{overview.area.name} · {vehicle.trip_id ? 'Trip in progress' : 'Not travelling'}</small></div></div>
              <label>Driver assignment<select value={assignments[vehicle.id] || ''} onChange={(event) => setAssignments((current) => ({ ...current, [vehicle.id]: event.target.value }))} disabled={Boolean(vehicle.trip_id) || Boolean(busy)}>
                <option value="">Leave unassigned</option>{options.map((driver) => <option value={driver.id} key={driver.id}>{driver.name} · available</option>)}
              </select></label>
              <button type="button" onClick={() => saveAssignment(vehicle)} disabled={Boolean(vehicle.trip_id) || Boolean(busy) || String(assignments[vehicle.id] || '') === String(vehicle.driver_id || '')}>{busy === `vehicle-${vehicle.id}` ? 'Saving…' : 'Save assignment'}</button>
            </article>;
          })}
        </div>
      </section>

      <section className="employee-waste-supervisor-card">
        <div className="employee-waste-supervisor-heading"><div><p className="civic-eyebrow">Driver roster</p><h3>Availability and leave</h3><p>Mark a driver on leave or off duty. If their vehicle is idle, an available area driver is assigned automatically.</p></div></div>
        <div className="employee-waste-supervisor-table-wrap"><table><thead><tr><th>Driver</th><th>Vehicle</th><th>Status</th><th>Availability</th></tr></thead><tbody>
          {overview.drivers.map((driver) => <tr key={driver.id}>
            <td><strong>{driver.name}</strong><small>{driver.employee_id} · {driver.email}</small></td>
            <td>{driver.assigned_vehicle || 'Free'}<small>{driver.active_trip_id && driver.last_updated && (Date.now() - new Date(driver.last_updated).getTime()) < 120000 ? 'GPS online' : 'Offline / not travelling'}</small></td>
            <td><span className={`employee-waste-supervisor-status ${driver.availability_status}`}>{statusText(driver.availability_status)}</span>{driver.availability_note && <small>{driver.availability_note}</small>}</td>
            <td><select value={driver.availability_status} disabled={Boolean(busy) || Boolean(driver.active_trip_id)} onChange={(event) => updateAvailability(driver, event.target.value)} aria-label={`Availability for ${driver.name}`}>
              <option value="available">Available</option><option value="on_leave">On leave</option><option value="off_duty">Off duty</option>
            </select></td>
          </tr>)}
        </tbody></table></div>
      </section>
    </>}
  </div>;
}
