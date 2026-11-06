import React, { useEffect, useMemo, useState } from 'react';
import {
  Edit3,
  Plus,
  RefreshCw,
  Save,
  Search,
  UserRound,
} from 'lucide-react';
import { apiFetch } from '../../api/client';
import './AdminManagement.css';

const emptyForm = {
  id: null,
  employee_id: '',
  name: '',
  email: '',
  phone: '',
  password: '',
  department_id: '',
  administrative_unit_id: '',
  role_id: '',
  is_active: true,
};

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [form, setForm] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [employeeData, roleData, areaData, departmentData] =
        await Promise.all([
          apiFetch('/admin/management/employees'),
          apiFetch('/admin/management/roles'),
          apiFetch('/admin/management/areas'),
          apiFetch('/admin/management/departments'),
        ]);

      setEmployees(employeeData.employees || []);
      setRoles(roleData.roles || []);
      setAreas(areaData.areas || []);
      setDepartments(departmentData.departments || []);
    } catch (err) {
      setError(err.message || 'Unable to load employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        !q ||
        [
          employee.employee_id,
          employee.name,
          employee.email,
          employee.department_name,
          employee.area_name,
        ].some((value) =>
          String(value || '').toLowerCase().includes(q)
        );

      const employeeRoles = (employee.roles || []).map(
        (role) => role.name
      );

      return (
        matchesSearch &&
        (roleFilter === 'all' ||
          employeeRoles.includes(roleFilter))
      );
    });
  }, [employees, search, roleFilter]);

  const openCreate = () => {
    setError('');
    setNotice('');
    setForm({
      ...emptyForm,
      role_id: roles[0]?.id ? String(roles[0].id) : '',
    });
  };

  const openEdit = (employee) => {
    setError('');
    setNotice('');
    setForm({
      id: employee.id,
      employee_id: employee.employee_id || '',
      name: employee.name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      password: '',
      department_id: employee.department_id
        ? String(employee.department_id)
        : '',
      administrative_unit_id: employee.administrative_unit_id
        ? String(employee.administrative_unit_id)
        : '',
      role_id: employee.roles?.[0]?.id
        ? String(employee.roles[0].id)
        : '',
      is_active: Boolean(employee.is_active),
    });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (form.id) {
        await apiFetch(
          `/admin/management/employees/${form.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              name: form.name.trim(),
              phone: form.phone.trim() || null,
              department_id: form.department_id
                ? Number(form.department_id)
                : null,
              administrative_unit_id:
                form.administrative_unit_id
                  ? Number(form.administrative_unit_id)
                  : null,
              role_id: Number(form.role_id),
              is_active: form.is_active,
            }),
          }
        );

        setNotice('Employee updated successfully.');
      } else {
        if (!form.password) {
          throw new Error(
            'Password is required for a new employee.'
          );
        }

        await apiFetch('/admin/management/employees', {
          method: 'POST',
          body: JSON.stringify({
            employee_id: form.employee_id.trim(),
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim() || null,
            password: form.password,
            department_id: form.department_id
              ? Number(form.department_id)
              : null,
            administrative_unit_id:
              form.administrative_unit_id
                ? Number(form.administrative_unit_id)
                : null,
            role_id: Number(form.role_id),
          }),
        });

        setNotice('Employee created successfully.');
      }

      setForm(null);
      await load();
    } catch (err) {
      setError(err.message || 'Unable to save employee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="civic-dashboard">
      <section className="civic-welcome">
        <div>
          <p className="civic-eyebrow">Administration</p>
          <h2>Employees</h2>
          <p>
            Manage employee accounts, roles, departments,
            jurisdictions, and account status.
          </p>
        </div>

        <button type="button" onClick={openCreate}>
          <Plus size={17} />
          New employee
        </button>
      </section>

      {error && (
        <div className="admin-management-message is-error">
          {error}
        </div>
      )}

      {notice && (
        <div className="admin-management-message is-success">
          {notice}
        </div>
      )}

      <section className="civic-panel">
        <div className="admin-management-toolbar">
          <label className="admin-management-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees"
            />
          </label>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name.replaceAll('_', ' ')}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={
                loading ? 'admin-management-spin' : ''
              }
            />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="admin-management-loading">
            <RefreshCw
              size={18}
              className="admin-management-spin"
            />
            Loading employees…
          </div>
        ) : (
          <div className="admin-management-table-wrap">
            <table className="admin-management-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Area</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <strong>{employee.name}</strong>
                      <small>
                        {employee.employee_id} · {employee.email}
                      </small>
                    </td>

                    <td>
                      {(employee.roles || [])
                        .map((role) =>
                          role.name.replaceAll('_', ' ')
                        )
                        .join(', ') || 'Unassigned'}
                    </td>

                    <td>{employee.department_name || '—'}</td>
                    <td>{employee.area_name || '—'}</td>

                    <td>
                      <span
                        className={`admin-management-badge ${
                          employee.is_active
                            ? 'is-active'
                            : 'is-inactive'
                        }`}
                      >
                        {employee.is_active
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="admin-management-icon-button"
                        onClick={() => openEdit(employee)}
                        title="Edit employee"
                      >
                        <Edit3 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filteredEmployees.length && (
              <p className="admin-management-muted">
                No employees match the current filters.
              </p>
            )}
          </div>
        )}
      </section>

      {form && (
        <section className="civic-panel admin-management-editor">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">
                {form.id ? 'Edit employee' : 'Create employee'}
              </p>
              <h3>{form.name || 'Employee account'}</h3>
            </div>
            <UserRound size={22} />
          </div>

          <form className="admin-management-form" onSubmit={save}>
            <label>
              Employee ID
              <input
                value={form.employee_id}
                disabled={Boolean(form.id)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    employee_id: e.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              Name
              <input
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                disabled={Boolean(form.id)}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                required
              />
            </label>

            <label>
              Phone
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
              />
            </label>

            {!form.id && (
              <label>
                Password
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      password: e.target.value,
                    })
                  }
                  minLength={6}
                  required
                />
              </label>
            )}

            <label>
              Role
              <select
                value={form.role_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role_id: e.target.value,
                  })
                }
                required
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Department
              <select
                value={form.department_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    department_id: e.target.value,
                  })
                }
              >
                <option value="">No department</option>
                {departments
                  .filter((item) => item.is_active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Administrative area
              <select
                value={form.administrative_unit_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    administrative_unit_id: e.target.value,
                  })
                }
              >
                <option value="">No area</option>
                {areas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ·{' '}
                    {item.unit_type.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>

            {form.id && (
              <label className="admin-management-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      is_active: e.target.checked,
                    })
                  }
                />
                Account is active
              </label>
            )}

            <div className="admin-management-form-actions span-2">
              <button type="submit" disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving…' : 'Save employee'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}