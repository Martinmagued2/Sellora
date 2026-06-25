"use client";

import { useState, useEffect } from "react";
import {
  X, Edit, Save, Phone, Mail, MapPin, Plus, Trash2, Clock,
  CheckCircle2, Circle, AlertCircle, Star, Activity, StickyNote,
  ChevronRight, Heart, TrendingUp, Calendar
} from "lucide-react";
import { useToast } from "../components/ToastProvider";

export default function CustomerCRMPanel({ customer, onClose }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: customer.name || "",
    phone: customer.phone || "",
    email: customer.email || "",
    address: customer.address || "",
    tags: customer.tags || [],
  });
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  // CRM data
  const [timeline, setTimeline] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [healthScore, setHealthScore] = useState(customer.health_score || null);
  const [orders, setOrders] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [newTask, setNewTask] = useState({ title: "", description: "", due_date: "", priority: "normal" });

  useEffect(() => {
    loadAll();
  }, [customer.id]);

  const loadAll = async () => {
    const [timelineRes, notesRes, tasksRes, healthRes, ordersRes] = await Promise.all([
      fetch(`/api/customers/${customer.id}/timeline`).then(r => r.json()).catch(() => ({ events: [] })),
      fetch(`/api/customers/${customer.id}/notes`).then(r => r.json()).catch(() => ({ notes: [] })),
      fetch(`/api/customers/${customer.id}/tasks`).then(r => r.json()).catch(() => ({ tasks: [] })),
      fetch(`/api/customers/${customer.id}/health-score`, { method: 'POST' }).then(r => r.json()).catch(() => ({})),
      fetch(`/api/customers/${customer.id}/orders`).then(r => r.json()).catch(() => ({ orders: [] })),
    ]);
    setTimeline(timelineRes.events || []);
    setNotes(notesRes.notes || []);
    setTasks(tasksRes.tasks || []);
    if (healthRes.score !== undefined) setHealthScore(healthRes);
    setOrders(ordersRes.orders || []);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Profile updated');
      setEditMode(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await fetch(`/api/customers/${customer.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotes(prev => [data.note, ...prev]);
      setNewNote("");
      toast.success('Note added');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      const res = await fetch(`/api/customers/${customer.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTasks(prev => [...prev, data.task]);
      setNewTask({ title: "", description: "", due_date: "", priority: "normal" });
      toast.success('Task created');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleTask = async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      const res = await fetch(`/api/customers/${customer.id}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (e) {
      toast.error('Failed to update task');
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await fetch(`/api/customers/${customer.id}/notes?note_id=${noteId}`, { method: 'DELETE' });
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast.success('Note deleted');
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const togglePin = async (noteId, currentPinned) => {
    try {
      await fetch(`/api/customers/${customer.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: noteId, pinned: !currentPinned }),
      });
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, pinned: !currentPinned } : n));
    } catch (e) {}
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    if (!editForm.tags.includes(newTag.trim())) {
      setEditForm(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
    }
    setNewTag("");
  };

  const removeTag = (tag) => {
    setEditForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
  ];

  const healthColor = healthScore?.color || '#8E9297';
  const healthLabel = healthScore?.label || 'Not scored';

  return (
    <div className="customer-crm-panel" style={{
      position: 'fixed', top: 0, right: 0, width: 'min(480px, 100vw)', height: '100vh',
      background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-medium)',
      zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--accent-gradient)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 16,
          }}>
            {(customer.name || customer.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{customer.name || 'Unnamed'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {customer.total_orders || 0} orders · {(customer.total_spent || 0).toLocaleString()} EGP
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
          <X size={20} />
        </button>
      </div>

      {/* Health Score Badge */}
      <div style={{ padding: '12px 20px', display: 'flex', gap: 8, flexShrink: 0 }}>
        <div style={{
          flex: 1, padding: '10px 14px', borderRadius: 12,
          background: `${healthColor}15`, border: `1px solid ${healthColor}30`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Heart size={18} color={healthColor} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Health Score</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: healthColor }}>
              {healthScore?.score ?? '—'} <span style={{ fontSize: 12, fontWeight: 600 }}>{healthLabel}</span>
            </div>
          </div>
        </div>
        <div style={{
          padding: '10px 14px', borderRadius: 12,
          background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <TrendingUp size={16} color="var(--accent-primary)" />
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
            {customer.lifecycle_stage || 'lead'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 12px', borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0, overflowX: 'auto',
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
              whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}>
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Profile */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Profile</h4>
                <button onClick={() => setEditMode(!editMode)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)',
                  fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Edit size={12} /> {editMode ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {editMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input className="form-input" placeholder="Name" value={editForm.name}
                    onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))} style={{ fontSize: 13 }} />
                  <input className="form-input" placeholder="Phone" value={editForm.phone}
                    onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))} style={{ fontSize: 13 }} />
                  <input className="form-input" placeholder="Email" value={editForm.email}
                    onChange={(e) => setEditForm(p => ({ ...p, email: e.target.value }))} style={{ fontSize: 13 }} />
                  <input className="form-input" placeholder="Address" value={editForm.address}
                    onChange={(e) => setEditForm(p => ({ ...p, address: e.target.value }))} style={{ fontSize: 13 }} />
                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {editForm.tags.map(tag => (
                      <span key={tag} style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 11,
                        background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {tag} <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-red)', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input className="form-input" placeholder="Add tag..." value={newTag}
                      onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()}
                      style={{ fontSize: 12, flex: 1 }} />
                    <button className="btn btn-secondary btn-sm" onClick={addTag}><Plus size={12} /></button>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving} style={{ alignSelf: 'flex-start' }}>
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {customer.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><Phone size={14} color="var(--text-tertiary)" /> {customer.phone}</div>}
                  {customer.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><Mail size={14} color="var(--text-tertiary)" /> {customer.email}</div>}
                  {customer.address && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><MapPin size={14} color="var(--text-tertiary)" /> {customer.address}</div>}
                  {customer.tags && customer.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {customer.tags.map(tag => (
                        <span key={tag} style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: tag === 'vip' ? 'rgba(253,121,168,0.15)' : 'var(--bg-glass)',
                          color: tag === 'vip' ? '#fd79a8' : 'var(--text-secondary)',
                        }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <StatBox label="Orders" value={customer.total_orders || 0} />
              <StatBox label="Spent" value={`${(customer.total_spent || 0).toLocaleString()} EGP`} />
              <StatBox label="Channel" value={customer.channel || '—'} />
            </div>

            {/* Recent Orders */}
            {orders.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Recent Orders</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {orders.slice(0, 5).map(o => (
                    <div key={o.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 8, background: 'var(--bg-glass)',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>#{o.order_number}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(o.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{o.total} EGP</div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{o.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Tasks */}
            {tasks.filter(t => t.status === 'pending').length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Upcoming Tasks</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tasks.filter(t => t.status === 'pending').slice(0, 3).map(t => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 8, background: 'var(--bg-glass)',
                    }}>
                      <Circle size={14} color="var(--text-tertiary)" />
                      <div style={{ flex: 1, fontSize: 13 }}>{t.title}</div>
                      {t.due_date && <div style={{ fontSize: 11, color: 'var(--accent-orange)' }}>
                        <Calendar size={10} /> {new Date(t.due_date).toLocaleDateString()}
                      </div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {timeline.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                <Clock size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No activity yet</div>
              </div>
            ) : (
              timeline.map((event, i) => <TimelineEvent key={i} event={event} />)
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Add note */}
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea className="form-input" placeholder="Add a note..." value={newNote}
                onChange={(e) => setNewNote(e.target.value)} rows={2}
                style={{ flex: 1, fontSize: 13, resize: 'none' }} />
              <button className="btn btn-primary btn-sm" onClick={addNote} style={{ alignSelf: 'flex-end' }}>
                <Plus size={14} />
              </button>
            </div>

            {/* Notes list */}
            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                <StickyNote size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No notes yet</div>
              </div>
            ) : (
              notes.map(note => (
                <div key={note.id} style={{
                  padding: '12px 14px', borderRadius: 10, background: 'var(--bg-glass)',
                  border: note.pinned ? '1px solid rgba(248,165,50,0.3)' : '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                      {note.author_name || 'You'} · {new Date(note.created_at).toLocaleDateString()}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => togglePin(note.id, note.pinned)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: note.pinned ? '#F8A532' : 'var(--text-tertiary)', fontSize: 14, padding: 2,
                      }}>📌</button>
                      <button onClick={() => deleteNote(note.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--accent-red)', fontSize: 14, padding: 2,
                      }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {note.body}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Add task */}
            <div style={{
              padding: 12, borderRadius: 10, background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <input className="form-input" placeholder="Task title..." value={newTask.title}
                onChange={(e) => setNewTask(p => ({ ...p, title: e.target.value }))} style={{ fontSize: 13 }} />
              <textarea className="form-input" placeholder="Description (optional)..." value={newTask.description}
                onChange={(e) => setNewTask(p => ({ ...p, description: e.target.value }))} rows={2}
                style={{ fontSize: 13, resize: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" className="form-input" value={newTask.due_date?.split('T')[0] || ''}
                  onChange={(e) => setNewTask(p => ({ ...p, due_date: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                  style={{ flex: 1, fontSize: 12 }} />
                <select className="form-input" value={newTask.priority}
                  onChange={(e) => setNewTask(p => ({ ...p, priority: e.target.value }))}
                  style={{ width: 120, fontSize: 12 }}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={addTask}><Plus size={14} /></button>
              </div>
            </div>

            {/* Tasks list */}
            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                <CheckCircle2 size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No tasks yet</div>
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px', borderRadius: 10, background: 'var(--bg-glass)',
                  opacity: task.status === 'completed' ? 0.5 : 1,
                }}>
                  <button onClick={() => toggleTask(task.id, task.status)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2,
                    color: task.status === 'completed' ? 'var(--accent-green)' : 'var(--text-tertiary)',
                  }}>
                    {task.status === 'completed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                    }}>{task.title}</div>
                    {task.description && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{task.description}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {task.due_date && <span style={{ color: new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'var(--accent-red)' : 'inherit' }}>
                        <Calendar size={10} /> {new Date(task.due_date).toLocaleDateString()}
                      </span>}
                      <span style={{ textTransform: 'capitalize', color: task.priority === 'urgent' ? 'var(--accent-red)' : task.priority === 'high' ? 'var(--accent-orange)' : 'inherit' }}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10, background: 'var(--bg-glass)',
      border: '1px solid var(--border-subtle)', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function TimelineEvent({ event }) {
  const iconMap = {
    order: { icon: '🛒', color: '#F8A532' },
    message: { icon: '💬', color: '#00D2FF' },
    review: { icon: '⭐', color: '#F8A532' },
    note: { icon: '📝', color: '#5865F2' },
    task: { icon: '✅', color: '#3BA55C' },
    tag_added: { icon: '🏷️', color: '#EB459E' },
    stage_change: { icon: '🔄', color: '#6c5ce7' },
    manual: { icon: '•', color: '#8E9297' },
  };
  const config = iconMap[event.type] || iconMap.manual;

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '8px 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: `${config.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>{config.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{event.title}</div>
        {event.description && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{event.description}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {new Date(event.created_at).toLocaleString()} {event.actor && `· ${event.actor}`}
        </div>
      </div>
    </div>
  );
}
