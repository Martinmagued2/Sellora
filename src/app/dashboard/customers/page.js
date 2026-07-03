"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Search, X, Edit, Phone, Mail, MapPin, Target,
  MessageCircle, ShoppingBag, Clock, Loader2, Save,
  Plus
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentStore } from "@/lib/store-context";
import { useEffectiveAccount } from "@/lib/account-context";
import CustomerCRMPanel from "../components/CustomerCRMPanel";
import { useToast } from "../components/ToastProvider";
import { PageSkeleton } from "@/components/SkeletonLoader";

export default function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Enrichment Panel
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerConvs, setCustomerConvs] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit Form Fields
  const [editForm, setEditForm] = useState({
    name: "", phone: "", email: "", address: "", tags: []
  });
  const [newTag, setNewTag] = useState("");

  const { currentStoreId } = useCurrentStore();
  const { effectiveAccountId, role } = useEffectiveAccount();

  const supabase = createClient();
  const [userId, setUserId] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
    fetch("/api/team-members")
      .then((r) => r.json())
      .then((d) => setTeamMembers(d.assignees || []))
      .catch(() => {});
  }, [supabase]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const accId = effectiveAccountId || user.id;
    let query = supabase.from("customers").select("*").eq("account_id", accId).order("total_spent", { ascending: false });

    // Team members (agent role) only see customers assigned to them.
    // Owner + admin see all customers.
    if (role === "agent") {
      query = query.eq("assigned_to", user.id);
    }

    if (filter === "vip") query = query.contains("tags", ["VIP"]);
    if (filter === "new") query = query.contains("tags", ["New"]);
    if (filter === "whatsapp") query = query.eq("channel", "whatsapp");
    if (filter === "instagram") query = query.eq("channel", "instagram");
    if (filter === "facebook") query = query.eq("channel", "facebook");
    if (search) query = query.ilike("name", `%${search}%`);
    if (currentStoreId) query = query.or(`store_id.eq.${currentStoreId},store_id.is.null`);

    const { data, error } = await query;
    if (!error) setCustomers(data || []);
    setLoading(false);
  }, [filter, search, currentStoreId, effectiveAccountId, role]);

  // Assign a customer to a team member (or owner)
  const assignCustomer = async (customerId, assigneeId) => {
    try {
      const res = await fetch(`/api/customers/${customerId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: assigneeId || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === customerId ? { ...c, assigned_to: assigneeId || null, assigned_at: data.customer?.assigned_at } : c))
        );
        toast.success(assigneeId ? "Customer assigned" : "Customer unassigned");
      } else {
        toast.error(data.error || "Failed to assign");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const loadCustomerDetails = async (customer) => {
    setActiveCustomer(customer);
    setEditForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      tags: customer.tags || [],
    });
    setEditMode(false);
    
    // Fetch recent orders
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setCustomerOrders(orders || []);

    // Fetch recent conversations
    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setCustomerConvs(convs || []);
  };

  const handleSaveEnrichment = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("customers")
      .update({
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        address: editForm.address,
        tags: editForm.tags,
      })
      .eq("id", activeCustomer.id)
      .eq("account_id", user?.id);
      
    if (!error) {
      setActiveCustomer({ ...activeCustomer, ...editForm });
      setEditMode(false);
      fetchCustomers();
    } else {
      toast.error("Error saving: " + error.message);
    }
    setSaving(false);
  };

  const addTag = () => {
    if (newTag.trim() && !editForm.tags.includes(newTag.trim())) {
      setEditForm({ ...editForm, tags: [...editForm.tags, newTag.trim()] });
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove) => {
    setEditForm({ ...editForm, tags: editForm.tags.filter(t => t !== tagToRemove) });
  };

  const formatDate = (d) => {
    if (!d) return "Unknown";
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case "whatsapp": return "📱";
      case "instagram": return "📸";
      case "facebook": return "💬";
      default: return "✉️";
    }
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 64px)", margin: "calc(var(--space-xl) * -1)" }}>
      {/* ═══ Main Customer List ═══ */}
      <div style={{ flex: 1, padding: "var(--space-xl)", overflowY: "auto", borderRight: activeCustomer ? "1px solid var(--border-subtle)" : "none" }}>
        <div className="page-header" style={{ marginBottom: "var(--space-md)" }}>
          <h1>Customers</h1>
          <div className="page-header-actions">
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
              {customers.length} total customers
            </span>
          </div>
        </div>

        <div className="filter-bar" style={{ marginBottom: "var(--space-lg)" }}>
          <div className="filter-tabs">
            {[
              { key: "all", label: "All" },
              { key: "vip", label: "VIP" },
              { key: "new", label: "New" },
              { key: "whatsapp", label: "WhatsApp" },
              { key: "instagram", label: "Instagram" },
              { key: "facebook", label: "Facebook" },
            ].map((f) => (
              <button key={f.key} className={`filter-tab ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="filter-search">
            <Search size={14} />
            <input type="text" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-body" style={{ padding: 0 }}>
            {loading ? (
              <PageSkeleton showStats={false} showTable={false} />
            ) : (
              <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Platform</th>
                    <th>Tags</th>
                    <th>Orders</th>
                    <th>Revenue</th>
                    <th>Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr 
                      key={c.id} 
                      onClick={() => loadCustomerDetails(c)}
                      style={{ cursor: "pointer", background: activeCustomer?.id === c.id ? "rgba(108, 92, 231, 0.05)" : "" }}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: c.profile_pic_url ? "transparent" : "var(--accent-gradient)", display: "flex",
                            alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, flexShrink: 0,
                          }}>
                            {c.profile_pic_url ? (
                              <img src={c.profile_pic_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                            ) : (
                              c.name?.split(" ").map(n => n[0]).join("") || "?"
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                              {c.name}
                              {c.is_returning && <span title="Returning Customer" style={{ fontSize: 10, background: "rgba(59,165,92,0.1)", color: "var(--accent-green)", padding: "0 4px", borderRadius: 4 }}>↩</span>}
                            </div>
                            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>{c.email || c.platform_id?.slice(0, 10)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: "var(--font-size-sm)" }}>{c.phone || "—"}</td>
                      <td>
                        <span className={`channel-badge ${c.channel || c.platform}`}>
                          {getChannelIcon(c.channel || c.platform)} {c.channel || c.platform}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 150 }}>
                          {(c.tags || []).slice(0, 2).map((tag, i) => (
                            <span key={i} style={{
                              padding: "2px 6px", borderRadius: 12,
                              fontSize: 9, fontWeight: 600,
                              background: "rgba(255,255,255,0.05)",
                              color: "var(--text-secondary)",
                              border: "1px solid var(--border-subtle)"
                            }}>
                              {tag}
                            </span>
                          ))}
                          {(c.tags || []).length > 2 && <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>+{c.tags.length - 2}</span>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.total_orders || 0}</td>
                      <td style={{ fontWeight: 700, color: "var(--accent-green)" }}>{c.total_spent?.toLocaleString() || 0} EGP</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {/* Assignee dropdown (only owner/admin can change) */}
                        {role === "owner" || role === "admin" ? (
                          <select
                            value={c.assigned_to || ""}
                            onChange={(e) => assignCustomer(c.id, e.target.value)}
                            style={{
                              fontSize: 11, padding: "3px 8px", borderRadius: 12,
                              background: c.assigned_to ? (c.assigned_to === userId ? "rgba(108,92,231,0.15)" : "rgba(255,255,255,0.06)") : "transparent",
                              color: c.assigned_to ? (c.assigned_to === userId ? "var(--accent-primary-light)" : "var(--text-secondary)") : "var(--text-tertiary)",
                              border: "1px solid var(--border-subtle)", cursor: "pointer",
                              fontFamily: "inherit", fontWeight: 600,
                            }}
                            title="Assign customer to team member"
                          >
                            <option value="">Unassigned</option>
                            {teamMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.display_name || m.name || m.email}
                              </option>
                            ))}
                          </select>
                        ) : (
                          /* Agent: read-only badge */
                          (() => {
                            const a = teamMembers.find((m) => m.id === c.assigned_to);
                            return a ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                                background: c.assigned_to === userId ? "rgba(108,92,231,0.15)" : "rgba(255,255,255,0.06)",
                                color: c.assigned_to === userId ? "var(--accent-primary-light)" : "var(--text-secondary)",
                              }}>
                                {a.display_name || a.name || a.email}
                              </span>
                            ) : <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>—</span>;
                          })()
                        )}
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr><td colSpan="7" style={{ textAlign: "center", padding: "var(--space-2xl)", color: "var(--text-tertiary)" }}>No customers found</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Customer Enrichment Slide-over Panel ═══ */}
      {activeCustomer && (
        <div style={{ width: 400, background: "var(--bg-secondary)", display: "flex", flexDirection: "column", animation: "slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
          
          {/* Header */}
          <div style={{ padding: "var(--space-lg)", borderBottom: "1px solid var(--border-subtle)", position: "relative" }}>
            <button onClick={() => setActiveCustomer(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}>
              <X size={18} />
            </button>
            
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginTop: "var(--space-sm)" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: activeCustomer.profile_pic_url ? "transparent" : "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700 }}>
                {activeCustomer.profile_pic_url ? (
                  <img src={activeCustomer.profile_pic_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  activeCustomer.name?.split(" ").map(n => n[0]).join("") || "?"
                )}
              </div>
              <div>
                <h2 style={{ fontSize: "var(--font-size-xl)", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  {activeCustomer.name}
                </h2>
                <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  {getChannelIcon(activeCustomer.platform)} Via {activeCustomer.platform}
                  {activeCustomer.is_returning && <span style={{ marginLeft: 4, padding: "2px 6px", background: "rgba(59,165,92,0.1)", color: "var(--accent-green)", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>Returning</span>}
                </div>
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", marginTop: "var(--space-lg)" }}>
              <div style={{ background: "var(--bg-card)", padding: "var(--space-sm)", borderRadius: 12, textAlign: "center", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: "var(--accent-primary-light)" }}>{activeCustomer.total_orders || 0}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Orders</div>
              </div>
              <div style={{ background: "var(--bg-card)", padding: "var(--space-sm)", borderRadius: 12, textAlign: "center", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, color: "var(--accent-green)" }}>{activeCustomer.total_spent?.toLocaleString() || 0}</div>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase" }}>EGP Spent</div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-lg)" }}>
            
            {/* Action Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-md)" }}>
              <h3 style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1 }}>Profile Details</h3>
              <button 
                onClick={() => setEditMode(!editMode)} 
                className={`btn btn-sm ${editMode ? "btn-secondary" : ""}`}
                style={{ background: editMode ? "" : "rgba(108, 92, 231, 0.1)", color: editMode ? "" : "var(--accent-primary-light)", border: "none" }}
              >
                {editMode ? "Cancel" : <><Edit size={14} /> Enrich Profile</>}
              </button>
            </div>

            {/* View/Edit Mode */}
            {editMode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", background: "var(--bg-card)", padding: "var(--space-md)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Phone Number</label>
                  <input type="text" className="form-input" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} placeholder="+20 1..." />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} placeholder="customer@email.com" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Shipping Address</label>
                  <textarea className="form-input" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} rows={2} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tags</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {editForm.tags.map(tag => (
                      <span key={tag} style={{ padding: "4px 8px", background: "var(--bg-tertiary)", borderRadius: 8, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                        {tag} <X size={10} style={{ cursor: "pointer" }} onClick={() => removeTag(tag)} />
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input type="text" className="form-input" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Add tag..." style={{ padding: "6px 10px", fontSize: 12 }} />
                    <button type="button" onClick={addTag} className="btn btn-secondary" style={{ padding: "6px 10px" }}><Plus size={14} /></button>
                  </div>
                </div>
                <button onClick={handleSaveEnrichment} disabled={saving} className="btn btn-primary" style={{ width: "100%", marginTop: "var(--space-sm)" }}>
                  {saving ? <><Loader2 size={14} className="spin"/> Saving...</> : <><Save size={14}/> Save Profile</>}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-md)" }}>
                  <Phone size={16} style={{ color: "var(--text-tertiary)", marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Phone</div>
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>{activeCustomer.phone || <em style={{ color: "var(--text-tertiary)" }}>Not provided</em>}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-md)" }}>
                  <Mail size={16} style={{ color: "var(--text-tertiary)", marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Email</div>
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>{activeCustomer.email || <em style={{ color: "var(--text-tertiary)" }}>Not provided</em>}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-md)" }}>
                  <MapPin size={16} style={{ color: "var(--text-tertiary)", marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Address</div>
                    <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>{activeCustomer.address || <em style={{ color: "var(--text-tertiary)" }}>Not provided</em>}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-md)" }}>
                  <Target size={16} style={{ color: "var(--text-tertiary)", marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Tags</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {(activeCustomer.tags || []).length > 0 ? activeCustomer.tags.map(tag => (
                        <span key={tag} style={{ padding: "2px 8px", background: "var(--bg-glass)", border: "1px solid var(--border-medium)", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>{tag}</span>
                      )) : <em style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>No tags</em>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Conversation History */}
            <h3 style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginTop: "var(--space-2xl)", marginBottom: "var(--space-md)" }}>Conversations</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {customerConvs.length === 0 ? <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No conversations found</p> : null}
              {customerConvs.map(conv => (
                <div key={conv.id} style={{ background: "var(--bg-card)", padding: "var(--space-md)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      <MessageCircle size={12}/> {conv.status}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{formatDate(conv.created_at)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(conv.tags || []).map(t => (
                      <span key={t} style={{ fontSize: 9, padding: "1px 6px", background: "var(--bg-glass)", borderRadius: 8, color: "var(--text-secondary)" }}>{t.replace('intent:', '')}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Order History */}
            <h3 style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 1, marginTop: "var(--space-2xl)", marginBottom: "var(--space-md)" }}>Recent Orders</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", paddingBottom: "var(--space-xl)" }}>
               {customerOrders.length === 0 ? <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No orders found</p> : null}
              {customerOrders.map(order => (
                <div key={order.id} style={{ background: "var(--bg-card)", padding: "var(--space-md)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-primary-light)" }}>{order.order_number}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-green)" }}>{order.total} EGP</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{order.status}</span>
                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Customer CRM Panel (full CRM view with timeline, notes, tasks) ═══ */}
      {activeCustomer && (
        <CustomerCRMPanel
          customer={activeCustomer}
          onClose={() => setActiveCustomer(null)}
        />
      )}
    </div>
  );
}
