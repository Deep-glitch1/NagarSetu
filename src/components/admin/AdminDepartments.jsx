import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Edit3, Plus, RefreshCw, Save, X } from 'lucide-react';
import { apiFetch } from '../../api/client';
import './AdminManagement.css';

const emptyForm = { id: null, code: '', name: '', description: '', is_active: true };

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [categoryState, setCategoryState] = useState({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [departmentData, categoryData] = await Promise.all([
        apiFetch('/admin/management/departments'),
        apiFetch('/admin/management/categories'),
      ]);
      setDepartments(departmentData.departments || []);
      setCategories(categoryData.categories || []);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return departments;
    return departments.filter((item) =>
      [item.code, item.name, item.description].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [departments, search]);

  const openCreate = () => {
    setNotice('');
    setError('');
    setForm(emptyForm);
    setCategoryState({});
  };

  const openEdit = (department) => {
    setNotice('');
    setError('');
    setForm({
      id: department.id,
      code: department.code || '',
      name: department.name || '',
      description: department.description || '',
      is_active: Boolean(department.is_active),
    });
    setCategoryState(Object.fromEntries((department.categories || []).map((item) => [
      String(item.id),
      { enabled: true, priority_weight: Number(item.priority_weight || 1) },
    ])));
  };

  const submitDepartment = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
      };
      if (form.id) {
        await apiFetch(`/admin/management/departments/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...payload, is_active: form.is_active }),
        });
      } else {
        await apiFetch('/admin/management/departments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setNotice(form.id ? 'Department updated successfully.' : 'Department created successfully.');
      setForm(null);
      setCategoryState({});
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Unable to save department.');
    } finally {
      setSaving(false);
    }
  };

  const saveCategories = async () => {
    if (!form.id) {
      setError('Save the department first, then configure categories.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const selected = Object.entries(categoryState)
        .filter(([, value]) => value.enabled)
        .map(([category_id, value]) => ({
          category_id: Number(category_id),
          priority_weight: Number(value.priority_weight || 1),
        }));

      await apiFetch(`/admin/management/departments/${form.id}/categories`, {
        method: 'PUT',
        body: JSON.stringify({ categories: selected }),
      });

      setNotice('Department category mapping updated.');
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Unable to update category mapping.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (categoryId) => {
    setCategoryState((current) => ({
      ...current,
      [categoryId]: {
        enabled: !current[String(categoryId)]?.enabled,
        priority_weight: current[String(categoryId)]?.priority_weight || 1,
      },
    }));
  };

  return (
    <div className="civic-dashboard">
      <section className="civic-welcome">
        <div>
          <p className="civic-eyebrow">Administration</p>
          <h2>Departments</h2>
          <p>Manage departments and the complaint categories routed to each one.</p>
        </div>
        <button type="button" onClick={openCreate}><Plus size={17} /> New department</button>
      </section>

      {error && <div className="admin-management-message is-error">{error}</div>}
      {notice && <div className="admin-management-message is-success">{notice}</div>}

      <section className="civic-panel">
        <div className="admin-management-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search departments" />
          <button type="button" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? 'admin-management-spin' : ''} />Refresh</button>
        </div>

        {loading ? (
          <div className="admin-management-loading"><RefreshCw size={18} className="admin-management-spin" />Loading departments…</div>
        ) : (
          <div className="admin-management-table-wrap">
            <table className="admin-management-table">
              <thead><tr><th>Department</th><th>Categories</th><th>Employees</th><th>Complaints</th><th>Status</th><th /></tr></thead>
              <tbody>
                {filteredDepartments.map((department) => (
                  <tr key={department.id}>
                    <td><strong>{department.name}</strong><small>{department.code}</small></td>
                    <td>{department.category_count}</td>
                    <td>{department.employee_count}</td>
                    <td>{department.complaint_count}</td>
                    <td><span className={`admin-management-badge ${department.is_active ? 'is-active' : 'is-inactive'}`}>{department.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><button type="button" className="admin-management-icon-button" onClick={() => openEdit(department)} title="Edit"><Edit3 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredDepartments.length && <p className="admin-management-muted">No departments match the search.</p>}
          </div>
        )}
      </section>

      {form && (
        <section className="civic-panel admin-management-editor">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">{form.id ? 'Edit' : 'Create'}</p>
              <h3>{form.id ? form.name || 'Department' : 'New department'}</h3>
            </div>
            <button type="button" onClick={() => { setForm(null); setCategoryState({}); }}><X size={17} /> Close</button>
          </div>

          <form className="admin-management-form" onSubmit={submitDepartment}>
            <label>Code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required /></label>
            <label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label className="span-2">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} /></label>
            {form.id && <label className="admin-management-checkbox"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Department is active</label>}
            <div className="admin-management-form-actions span-2">
              <button type="submit" disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save department'}</button>
            </div>
          </form>

          {form.id && (
            <div className="admin-management-mapping">
              <div className="civic-panel-title">
                <div><p className="civic-eyebrow">Routing</p><h3>Complaint categories</h3></div>
                <button type="button" onClick={saveCategories} disabled={saving}><Check size={16} /> Save mapping</button>
              </div>
              <div className="admin-management-category-grid">
                {categories.filter((category) => category.is_active).map((category) => {
                  const state = categoryState[String(category.id)] || { enabled: false, priority_weight: 1 };
                  return (
                    <div className={`admin-management-category ${state.enabled ? 'is-selected' : ''}`} key={category.id}>
                      <label className="admin-management-checkbox">
                        <input type="checkbox" checked={state.enabled} onChange={() => toggleCategory(category.id)} />
                        <span><strong>{category.name}</strong><small>{category.code}</small></span>
                      </label>
                      {state.enabled && (
                        <input
                          className="admin-management-weight"
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={state.priority_weight}
                          onChange={(event) => setCategoryState((current) => ({
                            ...current,
                            [category.id]: { ...state, priority_weight: event.target.value },
                          }))}
                          aria-label={`${category.name} priority weight`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
