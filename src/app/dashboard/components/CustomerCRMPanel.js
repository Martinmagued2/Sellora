"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Edit, Save, Phone, Mail, MapPin, Plus, Trash2, Clock,
  CheckCircle2, Circle, Star, Activity, StickyNote, Heart,
  TrendingUp, Calendar, MessageCircle, ShoppingBag, Award, Zap
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

  const [timeline, setTimeline] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [healthScore, setHealthScore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [newTask, setNewTask] = useState({ title: "", description: "", due_date: "", priority: "normal" });
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    loadAll();
  }, [customer.id]);

  // Animate score when it loads
  useEffect(() => {
    if (healthScore?.score !== undefined) {
      const target = healthScore.score;
      const duration = 1200;
      const steps = 40;
      const stepValue = target / steps;
      let current = 0;
      const interval = setInterval(() => {
        current += stepValue;
        if (current >= target) {
          setAnimatedScore(target);
          clearInterval(interval);
        } else {
          setAnimatedScore(Math.round(current));
        }
      }, duration / steps);
      return () => clearInterval(interval);
    }
  }, [healthScore]);

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNotes(prev => [data.note, ...prev]);
      setNewNote("");
      toast.success('Note added');
    } catch (e) { toast.error(e.message); }
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      const res = await fetch(`/api/customers/${customer.id}/tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTasks(prev => [...prev, data.task]);
      setNewTask({ title: "", description: "", due_date: "", priority: "normal" });
      toast.success('Task created');
    } catch (e) { toast.error(e.message); }
  };

  const toggleTask = async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      const res = await fetch(`/api/customers/${customer.id}/tasks`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (e) { toast.error('Failed to update task'); }
  };

  const deleteNote = async (noteId) => {
    try {
      await fetch(`/api/customers/${customer.id}/notes?note_id=${noteId}`, { method: 'DELETE' });
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast.success('Note deleted');
    } catch (e) { toast.error('Failed to delete'); }
  };

  const togglePin = async (noteId, currentPinned) => {
    try {
      await fetch(`/api/customers/${customer.id}/notes`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
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
  const scoreValue = healthScore?.score ?? 0;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={{
        position: 'fixed', top: 0, right: 0, width: 'min(480px, 100vw)', height: '100vh',
        background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-medium)',
        zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header with gradient */}
      <div style={{
        padding: '20px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(108,92,231,0.08), rgba(0,210,255,0.04))',
        borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        {/* Decorative blur orbs */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(108,92,231,0.15)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: 20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(0,210,255,0.1)', filter: 'blur(30px)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              style={{
                width: 52, height: 52, borderRadius: 16,
                background: 'var(--accent-gradient)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 20, boxShadow: '0 8px 24px rgba(108,92,231,0.3)',
              }}
            >
              {(customer.name || customer.email || '?')[0].toUpperCase()}
            </motion.div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{customer.name || 'Unnamed'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShoppingBag size={11} /> {customer.total_orders || 0} orders · {(customer.total_spent || 0).toLocaleString()} EGP
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
            cursor: 'pointer', color: 'var(--text-tertiary)', width: 36, height: 36,
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-glass-hover)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-glass)'; }}>
            <X size={18} />
          </button>
        </div>

        {/* Tags */}
        {customer.tags && customer.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', position: 'relative' }}>
            {customer.tags.map(tag => (
              <span key={tag} style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                background: tag === 'vip' ? 'linear-gradient(135deg, rgba(253,121,168,0.2), rgba(253,121,168,0.08))' : 'var(--bg-glass)',
                color: tag === 'vip' ? '#fd79a8' : 'var(--text-secondary)',
                border: tag === 'vip' ? '1px solid rgba(253,121,168,0.3)' : '1px solid var(--border-subtle)',
                textTransform: 'capitalize',
              }}>
                {tag === 'vip' && '👑 '}{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Health Score Ring + Stats */}
      <div style={{
        padding: '20px', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {/* Circular Progress Ring */}
        <HealthRing score={animatedScore} targetScore={scoreValue} color={healthColor} label={healthLabel} />

        {/* Quick stats */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MiniStat icon={ShoppingBag} label="Orders" value={customer.total_orders || 0} color="#F8A532" />
          <MiniStat icon={TrendingUp} label="Spent" value={`${(customer.total_spent || 0).toLocaleString()}`} color="#3BA55C" suffix=" EGP" />
          <MiniStat icon={MessageCircle} label="Channel" value={customer.channel || '—'} color="#00D2FF" />
          <MiniStat icon={Award} label="Stage" value={(customer.lifecycle_stage || 'lead')} color="#6c5ce7" />
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 12px', borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0, overflowX: 'auto',
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
              whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}>
              <Icon size={14} /> {tab.label}
              {tab.id === 'tasks' && tasks.filter(t => t.status === 'pending').length > 0 && (
                <span style={{
                  background: 'var(--accent-red)', color: 'white', fontSize: 10,
                  fontWeight: 700, padding: '1px 6px', borderRadius: 8, minWidth: 16, textAlign: 'center',
                }}>{tasks.filter(t => t.status === 'pending').length}</span>
              )}
              {tab.id === 'notes' && notes.length > 0 && (
                <span style={{
                  background: 'var(--bg-glass)', color: 'var(--text-tertiary)', fontSize: 10,
                  fontWeight: 700, padding: '1px 6px', borderRadius: 8, minWidth: 16, textAlign: 'center',
                }}>{notes.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Profile */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: 1 }}>Profile</h4>
                    <button onClick={() => setEditMode(!editMode)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)',
                      fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600,
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
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {editForm.tags.map(tag => (
                          <span key={tag} style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 11,
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {customer.phone && <InfoRow icon={Phone} label="Phone" value={customer.phone} />}
                      {customer.email && <InfoRow icon={Mail} label="Email" value={customer.email} />}
                      {customer.address && <InfoRow icon={MapPin} label="Address" value={customer.address} />}
                      {!customer.phone && !customer.email && !customer.address && (
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '8px 0' }}>
                          No contact info yet. Click Edit to add.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Recent Orders */}
                {orders.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: 1, marginBottom: 10 }}>Recent Orders</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {orders.slice(0, 5).map((o, i) => (
                        <motion.div
                          key={o.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 14px', borderRadius: 10, background: 'var(--bg-glass)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>#{o.order_number}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(o.created_at).toLocaleDateString()}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-green)' }}>{o.total} EGP</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{o.status}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upcoming Tasks */}
                {tasks.filter(t => t.status === 'pending').length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: 1, marginBottom: 10 }}>Upcoming Tasks</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {tasks.filter(t => t.status === 'pending').slice(0, 3).map((t, i) => (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderRadius: 10, background: 'var(--bg-glass)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <Circle size={14} color="var(--text-tertiary)" />
                          <div style={{ flex: 1, fontSize: 13 }}>{t.title}</div>
                          {t.due_date && <div style={{ fontSize: 11, color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Calendar size={10} /> {new Date(t.due_date).toLocaleDateString()}
                          </div>}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TIMELINE */}
            {activeTab === 'timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {timeline.length === 0 ? (
                  <EmptyState icon={Clock} title="No activity yet" />
                ) : (
                  timeline.map((event, i) => <TimelineEvent key={i} event={event} delay={i * 0.03} />)
                )}
              </div>
            )}

            {/* NOTES */}
            {activeTab === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea className="form-input" placeholder="Add a note..." value={newNote}
                    onChange={(e) => setNewNote(e.target.value)} rows={2}
                    style={{ flex: 1, fontSize: 13, resize: 'none' }} />
                  <button className="btn btn-primary btn-sm" onClick={addNote} style={{ alignSelf: 'flex-end' }}>
                    <Plus size={14} />
                  </button>
                </div>

                {notes.length === 0 ? (
                  <EmptyState icon={StickyNote} title="No notes yet" />
                ) : (
                  notes.map((note, i) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      style={{
                        padding: '12px 14px', borderRadius: 12, background: 'var(--bg-glass)',
                        border: note.pinned ? '1px solid rgba(248,165,50,0.3)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--accent-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                            {(note.author_name || 'Y')[0]}
                          </div>
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
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {/* TASKS */}
            {activeTab === 'tasks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  padding: 12, borderRadius: 12, background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
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

                {tasks.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="No tasks yet" />
                ) : (
                  tasks.map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '12px 14px', borderRadius: 12, background: 'var(--bg-glass)',
                        border: '1px solid var(--border-subtle)',
                        opacity: task.status === 'completed' ? 0.5 : 1,
                      }}
                    >
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
                          <span style={{
                            textTransform: 'capitalize',
                            color: task.priority === 'urgent' ? 'var(--accent-red)' : task.priority === 'high' ? 'var(--accent-orange)' : 'inherit',
                            fontWeight: 600,
                          }}>{task.priority}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Circular Health Score Ring ───
function HealthRing({ score, targetScore, color, label }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
      <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
        {/* Background ring */}
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--bg-glass)" strokeWidth="6" />
        {/* Progress ring */}
        <motion.circle
          cx="48" cy="48" r={radius} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>
          {score}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ─── Mini Stat Card ───
function MiniStat({ icon: Icon, label, value, color, suffix }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      style={{
        padding: '8px 10px', borderRadius: 10, background: 'var(--bg-glass)',
        border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: `${color}15`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={14} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}{suffix}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Info Row ───
function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexShrink: 0 }}>
        <Icon size={14} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

// ─── Empty State ───
function EmptyState({ icon: Icon, title }) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
      <Icon size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
    </div>
  );
}

// ─── Timeline Event ───
function TimelineEvent({ event, delay = 0 }) {
  const iconMap = {
    order: { icon: '🛒', color: '#F8A532', bg: 'rgba(248,165,50,0.12)' },
    message: { icon: '💬', color: '#00D2FF', bg: 'rgba(0,210,255,0.12)' },
    review: { icon: '⭐', color: '#F8A532', bg: 'rgba(248,165,50,0.12)' },
    note: { icon: '📝', color: '#5865F2', bg: 'rgba(88,101,242,0.12)' },
    task: { icon: '✅', color: '#3BA55C', bg: 'rgba(59,165,92,0.12)' },
    tag_added: { icon: '🏷️', color: '#EB459E', bg: 'rgba(235,69,158,0.12)' },
    stage_change: { icon: '🔄', color: '#6c5ce7', bg: 'rgba(108,92,231,0.12)' },
    manual: { icon: '•', color: '#8E9297', bg: 'rgba(142,146,151,0.12)' },
  };
  const config = iconMap[event.type] || iconMap.manual;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, border: `1px solid ${config.color}25`,
      }}>{config.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{event.title}</div>
        {event.description && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{event.description}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} /> {new Date(event.created_at).toLocaleString()}
          {event.actor && <span>· {event.actor}</span>}
        </div>
      </div>
    </motion.div>
  );
}
