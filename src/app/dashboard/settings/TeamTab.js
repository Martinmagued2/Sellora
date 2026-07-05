"use client";

import { useState } from "react";
import { Plus, Trash2, Lock, Crown, Loader2, MoreVertical, Mail, Shield, User } from "lucide-react";
import { useToast } from "../components/ToastProvider";

export default function TeamTab({
  account, supabase,
  teamMembers, setTeamMembers,
  inviteEmail, setInviteEmail,
  teamSaving, setTeamSaving,
}) {
  const toast = useToast();
  const [inviteRole, setInviteRole] = useState("agent");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [busy, setBusy] = useState(null);

  const handleInvite = async () => {
    setTeamSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          accountId: user.id,
          businessName: account.business_name,
          role: inviteRole,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send invite");
      } else if (data.member) {
        setTeamMembers([...teamMembers, data.member]);
        setInviteEmail("");
        toast.success(`Invitation sent as ${inviteRole === "admin" ? "Admin" : "Agent"}!`);
      }
    } catch (err) {
      toast.error("An error occurred while sending the invite.");
    } finally {
      setTeamSaving(false);
    }
  };

  const changeRole = async (memberId, newRole) => {
    setBusy(memberId);
    setOpenMenuId(null);
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTeamMembers(teamMembers.map((tm) => tm.id === memberId ? { ...tm, role: newRole } : tm));
        toast.success(`Role changed to ${newRole === "admin" ? "Admin" : "Agent"}`);
      } else {
        toast.error(data.error || "Failed to change role");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setBusy(null);
    }
  };

  const toggleStatus = async (memberId, currentStatus) => {
    setBusy(memberId);
    setOpenMenuId(null);
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTeamMembers(teamMembers.map((tm) => tm.id === memberId ? { ...tm, status: newStatus, invite_status: data.member?.invite_status || tm.invite_status } : tm));
        toast.success(newStatus === "active" ? "Member reactivated" : "Member disabled");
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setBusy(null);
    }
  };

  const resendInvite = async (memberId) => {
    setBusy(memberId);
    setOpenMenuId(null);
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resendInvite: true, businessName: account.business_name }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Invite email resent");
      } else {
        toast.error(data.error || "Failed to resend");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setBusy(null);
    }
  };

  const removeMember = async (memberId) => {
    if (!confirm("Remove this team member? They will lose access immediately.")) return;
    setBusy(memberId);
    setOpenMenuId(null);
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: "DELETE" });
      if (res.ok) {
        setTeamMembers(teamMembers.filter((t) => t.id !== memberId));
        toast.success("Member removed");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header"><h3>Team Members</h3></div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
        {account.plan === "starter" ? (
          <div style={{ textAlign: "center", padding: "var(--space-3xl) var(--space-xl)" }}>
            <Lock size={40} style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-md)" }} />
            <h3 style={{ marginBottom: "var(--space-sm)" }}>Team access is a Pro feature</h3>
            <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-lg)", fontSize: "var(--font-size-sm)" }}>
              Invite your staff to handle customer chats by upgrading to Professional.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => window.location.href = '/dashboard/billing'}>Upgrade Plan</button>
          </div>
        ) : (
          <>
            <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-lg)", fontSize: "var(--font-size-sm)" }}>
              Invite team members to help manage conversations.
              <strong style={{ color: "var(--text-secondary)" }}> Admins</strong> can manage settings, billing, and other members.
              <strong style={{ color: "var(--text-secondary)" }}> Agents</strong> see conversations + customers only.
            </p>

            {/* Owner card */}
            <div style={{ padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", marginBottom: "var(--space-lg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff" }}>
                  {account.email?.charAt(0)?.toUpperCase() || "O"}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{account.email}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Account Owner</div>
                </div>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-primary-light)", fontWeight: 600 }}><Crown size={14} /> Owner</span>
            </div>

            {/* Invite form */}
            <div style={{ marginBottom: "var(--space-xl)" }}>
              <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                <input type="email" className="form-input" placeholder="agent@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} style={{ flex: 1 }} />
                <select
                  className="form-input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{ width: 130 }}
                >
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="btn btn-primary btn-sm" disabled={teamSaving || !inviteEmail} onClick={handleInvite}>
                  {teamSaving ? <Loader2 size={14} className="spin" /> : <><Plus size={14} /> Invite</>}
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {inviteRole === "admin"
                  ? "Admins can manage team members, billing, and settings."
                  : "Agents can handle conversations, customers, and orders. No access to settings or billing."}
              </p>
            </div>

            {/* Team list */}
            {teamMembers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "var(--space-2xl)", color: "var(--text-tertiary)", border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-md)" }}>
                No team members yet. Invite someone above.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {teamMembers.map((tm) => {
                  const isActive = tm.status === "active" || tm.invite_status === "accepted";
                  const isPending = tm.invite_status === "pending";
                  return (
                    <div key={tm.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "var(--space-md)", background: "var(--bg-glass)",
                      borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)",
                      opacity: isActive ? 1 : 0.6,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: tm.role === "admin" ? "linear-gradient(135deg,#f59e0b,#ef4444)" : "var(--accent-gradient)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 700, fontSize: 14, color: "#fff",
                        }}>
                          {tm.invited_email?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: "var(--font-size-sm)" }}>{tm.invited_email}</div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
                            {tm.role === "admin" ? <><Shield size={10} /> Admin</> : <><User size={10} /> Agent</>}
                            <span>·</span>
                            {isPending ? (
                              <span style={{ color: "var(--accent-orange)" }}>Pending invite</span>
                            ) : isActive ? (
                              <span style={{ color: "var(--accent-green)" }}>Active</span>
                            ) : (
                              <span style={{ color: "var(--accent-red)" }}>Disabled</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions menu */}
                      <div style={{ position: "relative" }}>
                        <button
                          className="btn btn-sm"
                          style={{ background: "transparent", border: "1px solid var(--border-subtle)", padding: 6 }}
                          onClick={() => setOpenMenuId(openMenuId === tm.id ? null : tm.id)}
                          disabled={busy === tm.id}
                        >
                          {busy === tm.id ? <Loader2 size={14} className="spin" /> : <MoreVertical size={14} />}
                        </button>
                        {openMenuId === tm.id && (
                          <div style={{
                            position: "absolute", right: 0, top: "100%", marginTop: 4,
                            background: "var(--bg-secondary)", border: "1px solid var(--border-medium)",
                            borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                            zIndex: 50, minWidth: 200, overflow: "hidden",
                          }}>
                            {tm.role === "agent" && (
                              <button onClick={() => changeRole(tm.id, "admin")} style={menuItemStyle}>
                                <Shield size={12} /> Promote to Admin
                              </button>
                            )}
                            {tm.role === "admin" && (
                              <button onClick={() => changeRole(tm.id, "agent")} style={menuItemStyle}>
                                <User size={12} /> Demote to Agent
                              </button>
                            )}
                            {isPending && (
                              <button onClick={() => resendInvite(tm.id)} style={menuItemStyle}>
                                <Mail size={12} /> Resend invite
                              </button>
                            )}
                            {!isPending && (
                              <button onClick={() => toggleStatus(tm.id, tm.status || (isActive ? "active" : "disabled"))} style={menuItemStyle}>
                                {isActive ? "Disable" : "Reactivate"}
                              </button>
                            )}
                            <button onClick={() => removeMember(tm.id)} style={{ ...menuItemStyle, color: "var(--accent-red)" }}>
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const menuItemStyle = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "10px 12px", background: "transparent", border: "none",
  cursor: "pointer", width: "100%", textAlign: "left",
  fontSize: 13, color: "var(--text-primary)",
};
