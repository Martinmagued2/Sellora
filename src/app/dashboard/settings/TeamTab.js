"use client";

import { Plus, Trash2, Lock, Crown, Loader2 } from "lucide-react";
import { useToast } from "../components/ToastProvider";

export default function TeamTab({
  account, supabase,
  teamMembers, setTeamMembers,
  inviteEmail, setInviteEmail,
  teamSaving, setTeamSaving,
}) {
  const toast = useToast();
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
              Invite team members to help manage conversations. Admins see everything. Agents only see the inbox.
            </p>

            {/* Owner card */}
            <div style={{ padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", marginBottom: "var(--space-lg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
                  {account.email?.charAt(0)?.toUpperCase() || "O"}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{account.email}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Account Owner</div>
                </div>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-primary-light)", fontWeight: 600 }}><Crown size={14} /> Owner</span>
            </div>

            <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-xl)" }}>
              <input type="email" className="form-input" placeholder="agent@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" disabled={teamSaving || !inviteEmail} onClick={async () => {
                setTeamSaving(true);
                const { data: { user } } = await supabase.auth.getUser();

                try {
                  const res = await fetch("/api/team/invite", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: inviteEmail,
                      accountId: user.id,
                      businessName: account.business_name
                    })
                  });

                  const data = await res.json();

                  if (!res.ok) {
                    toast.error(data.error || "Failed to send invite");
                  } else if (data.member) {
                    setTeamMembers([...teamMembers, data.member]);
                    setInviteEmail("");
                    toast.success("Invitation sent successfully!");
                  }
                } catch (err) {
                  toast.error("An error occurred while sending the invite.");
                } finally {
                  setTeamSaving(false);
                }
              }}>
                {teamSaving ? <Loader2 size={14} className="spin" /> : <><Plus size={14} /> Invite</>}
              </button>
            </div>

            {/* Team list */}
            {teamMembers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "var(--space-2xl)", color: "var(--text-tertiary)", border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-md)" }}>
                No team members yet. Invite someone above.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                {teamMembers.map((tm) => (
                  <div key={tm.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: "var(--font-size-sm)" }}>{tm.invited_email}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Role: {tm.role} • Status: {tm.invite_status}</div>
                    </div>
                    <button className="btn btn-sm" style={{ background: "rgba(255,82,82,0.1)", color: "var(--accent-red)", border: "none" }} onClick={async () => {
                      await supabase.from("team_members").delete().eq("id", tm.id);
                      setTeamMembers(teamMembers.filter(t => t.id !== tm.id));
                    }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
