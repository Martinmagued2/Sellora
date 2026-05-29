"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Settings, User, MessageCircle, Bot, Bell, Globe, Shield, Smartphone,
  Save, Check, Plus, X, Upload, Link as LinkIcon, Zap, ToggleLeft, ToggleRight, Loader2,
  Webhook, UsersRound, Trash2, Crown, Lock
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPlanLimits } from "@/lib/plan-limits";

const tabs = [
  { key: "profile", label: "Business Profile", icon: User },
  { key: "channels", label: "Connected Channels", icon: Smartphone },
  { key: "autoreplies", label: "Auto-Replies", icon: Bot },
  { key: "webhooks", label: "Webhooks", icon: Webhook },
  { key: "team", label: "Team", icon: UsersRound },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security", icon: Shield },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "profile";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Meta connection feedback
  const [metaStatus, setMetaStatus] = useState(null); // { type: 'success'|'error', platform: 'instagram'|'facebook', message: string }
  const [account, setAccount] = useState({
    business_name: "", business_description: "", industry: "",
    email: "", phone: "", country: "", currency: "",
    ai_enabled: true, ai_personality: "",
  });

  // Webhooks state
  const [webhooks, setWebhooks] = useState([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [webhookSaving, setWebhookSaving] = useState(false);

  // Shopify connect state
  const [shopifyDomain, setShopifyDomain] = useState("");
  const [shopifyConnecting, setShopifyConnecting] = useState(false);
  const [shopifySyncing, setShopifySyncing] = useState(false);
  const [shopifyDisconnecting, setShopifyDisconnecting] = useState(false);

  // Team state
  const [teamMembers, setTeamMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [teamSaving, setTeamSaving] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({ new: "", confirm: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Notification prefs state
  const [notifPrefs, setNotifPrefs] = useState({
    new_message: true, new_order: true, order_status: true, daily_summary: false
  });
  const [notifSaving, setNotifSaving] = useState(false);

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Manual Meta connect state
  const [showManualIG, setShowManualIG] = useState(false);
  const [manualIG, setManualIG] = useState({ pageId: "", accessToken: "" });
  const [manualIGSaving, setManualIGSaving] = useState(false);

  const [showManualFB, setShowManualFB] = useState(false);
  const [manualFB, setManualFB] = useState({ pageId: "", accessToken: "" });
  const [manualFBSaving, setManualFBSaving] = useState(false);

  // Auto-replies state
  const [autoReplies, setAutoReplies] = useState([]);
  const [showAddReply, setShowAddReply] = useState(false);
  const [newReply, setNewReply] = useState({ keyword: "", response: "", match_type: "contains" });
  const [replySaving, setReplySaving] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("accounts").select("*").eq("id", user.id).single();
      if (data) setAccount(data);

      // Check for Meta OAuth callback feedback
      const connected = searchParams.get('connected');
      const errorParam = searchParams.get('error');
      if (connected) {
        const platformName = connected === 'instagram' ? 'Instagram' : 'Facebook';
        setMetaStatus({ type: 'success', platform: connected, message: `${platformName} connected successfully!` });
        // Clean URL
        window.history.replaceState({}, '', '/dashboard/settings?tab=channels');
      } else if (errorParam) {
        const errorMessages = {
          no_pages: 'No Facebook Pages found. Make sure you SELECT your Facebook Page in the authorization dialog — look for a step that asks which Pages to share, and check the box next to your Page.',
          pages_perm_declined: 'You declined Page permissions. When the Facebook dialog appears, make sure to allow all Page permissions and SELECT your Facebook Page.',
          no_instagram_account: 'No Instagram Business Account linked to your Facebook Page. Make sure your Instagram is a Business/Creator account linked to your Facebook Page.',
          token_exchange_failed: 'Failed to exchange authorization code. Please try again.',
          server_config: 'Server is not configured for Meta integration. Make sure META_APP_ID and META_APP_SECRET are set in Vercel.',
          invalid_state: 'Invalid OAuth state. Please try connecting again.',
          missing_params: 'Missing authorization parameters. Please try again.',
          user_denied: 'You denied the permission request.',
          db_update_failed: 'Failed to save connection. Please try again.',
        };
        setMetaStatus({ type: 'error', platform: null, message: errorMessages[errorParam] || `Connection failed: ${errorParam}` });
        window.history.replaceState({}, '', '/dashboard/settings?tab=channels');
      }

      // Fetch webhooks
      const { data: wh } = await supabase.from("account_webhooks").select("*").eq("account_id", user.id).order("created_at");
      if (wh) setWebhooks(wh);

      // Fetch team
      const { data: tm } = await supabase.from("team_members").select("*").eq("account_id", user.id).order("created_at");
      if (tm) setTeamMembers(tm);

      // Fetch auto-replies
      const { data: ar } = await supabase.from("auto_replies").select("*").eq("account_id", user.id).eq("is_active", true).order("created_at");
      if (ar) setAutoReplies(ar);

      // Load notification prefs from account
      if (data?.notification_prefs) setNotifPrefs(data.notification_prefs);

      setLoading(false);
    };
    load();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("accounts").update({
      business_name: account.business_name,
      business_description: account.business_description,
      industry: account.industry,
      phone: account.phone,
      country: account.country,
      currency: account.currency,
      ai_enabled: account.ai_enabled,
      ai_personality: account.ai_personality,
      instagram_url: account.instagram_url,
      facebook_url: account.facebook_url,
      website_url: account.website_url,
    }).eq("id", user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUpdatePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!passwords.new || passwords.new.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwords.new });
    setUpdatingPassword(false);

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess("Password updated successfully!");
      setPasswords({ new: "", confirm: "" });
      setTimeout(() => setPasswordSuccess(""), 3000);
    }
  };

  const updateField = (field, value) => setAccount((prev) => ({ ...prev, [field]: value }));

  return (
    <>
      <div className="page-header">
        <h1>Settings</h1>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="save-settings">
            {saved ? <><Check size={16} /> Saved!</> : saving ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Save size={16} /> Save Changes</>}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "var(--space-xl)" }}>
        {/* Settings Tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                className={`sidebar-link ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
                style={{ border: "none", background: activeTab === tab.key ? "rgba(108, 92, 231, 0.1)" : "none" }}
              >
                <span className="sidebar-link-icon"><Icon size={18} /></span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Settings Content */}
        <div>
          {activeTab === "profile" && (
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3>Business Profile</h3>
              </div>
              <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
                {/* Logo Upload */}
                <div className="form-group">
                  <label className="form-label">Business Logo</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: "var(--radius-lg)",
                      background: account.logo_url ? "transparent" : "var(--accent-gradient)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "28px", fontWeight: 800, overflow: "hidden",
                    }}>
                      {account.logo_url ? (
                        <img src={account.logo_url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--radius-lg)" }} />
                      ) : (
                        account.business_name?.charAt(0) || "S"
                      )}
                    </div>
                    <div>
                      <button className="btn btn-secondary btn-sm" disabled={uploadingLogo} onClick={async () => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/png,image/jpeg';
                        input.onchange = async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { alert('File must be under 2MB'); return; }
                          setUploadingLogo(true);
                          try {
                            const ext = file.name.split('.').pop();
                            const { data: { user } } = await supabase.auth.getUser();
                            const path = `${user.id}/logo.${ext}`;

                            // Ensure the logos bucket exists before uploading
                            try {
                              await fetch("/api/storage/ensure-buckets", { method: "POST" });
                            } catch (e) {}

                            // Try client-side upload first
                            const { error: uploadErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true });

                            let logoUrl;
                            if (uploadErr) {
                              // Fallback: upload via admin API (bypasses RLS, auto-creates bucket)
                              console.warn('[Settings] Client logo upload failed, trying admin:', uploadErr.message);
                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('path', path);
                              formData.append('bucket', 'logos');
                              const adminRes = await fetch('/api/storage/upload', { method: 'POST', body: formData });
                              if (!adminRes.ok) {
                                const errData = await adminRes.json();
                                throw new Error(errData.error || 'Upload failed');
                              }
                              const adminData = await adminRes.json();
                              logoUrl = adminData.url;
                            } else {
                              const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
                              logoUrl = urlData.publicUrl;
                            }

                            if (logoUrl) {
                              await supabase.from('accounts').update({ logo_url: logoUrl }).eq('id', user.id);
                              setAccount(prev => ({ ...prev, logo_url: logoUrl }));
                            }
                          } catch (err) { alert('Upload failed: ' + err.message); }
                          finally { setUploadingLogo(false); }
                        };
                        input.click();
                      }}>
                        <Upload size={14} /> {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </button>
                      <p style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", marginTop: 6 }}>
                        PNG, JPG up to 2MB. Recommended: 200x200px
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                  <div className="form-group">
                    <label className="form-label">Business Name</label>
                    <input type="text" className="form-input" value={account.business_name || ""} onChange={(e) => updateField("business_name", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Industry</label>
                    <input type="text" className="form-input" value={account.industry || ""} onChange={(e) => updateField("industry", e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Business Description</label>
                  <textarea className="form-input form-textarea" value={account.business_description || ""} onChange={(e) => updateField("business_description", e.target.value)} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={account.email || ""} readOnly style={{ opacity: 0.6 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input type="tel" className="form-input" value={account.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <input type="text" className="form-input" value={account.country || ""} onChange={(e) => updateField("country", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Currency</label>
                    <input type="text" className="form-input" value={account.currency || ""} onChange={(e) => updateField("currency", e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Website / Social Links</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                    <input type="text" className="form-input" value={account.instagram_url || ""} onChange={(e) => updateField("instagram_url", e.target.value)} placeholder="instagram.com/mystore" />
                    <input type="text" className="form-input" value={account.facebook_url || ""} onChange={(e) => updateField("facebook_url", e.target.value)} placeholder="Facebook page URL" />
                    <input type="text" className="form-input" value={account.website_url || ""} onChange={(e) => updateField("website_url", e.target.value)} placeholder="Website URL" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "channels" && (
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3>Connected Channels</h3>
              </div>
              <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
                <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-xl)" }}>Receive messages from Instagram and Facebook in one place.</p>

                {/* Meta connection status banner */}
                {metaStatus && (
                  <div style={{
                    padding: "var(--space-md) var(--space-lg)",
                    marginBottom: "var(--space-lg)",
                    borderRadius: "var(--radius-md)",
                    background: metaStatus.type === 'success' ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 82, 82, 0.1)',
                    border: `1px solid ${metaStatus.type === 'success' ? 'rgba(0, 200, 83, 0.3)' : 'rgba(255, 82, 82, 0.3)'}`,
                    color: metaStatus.type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    fontWeight: 500, fontSize: "var(--font-size-sm)",
                  }}>
                    <span>{metaStatus.message}</span>
                    <button onClick={() => setMetaStatus(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 4 }}>
                      <X size={16} />
                    </button>
                  </div>
                )}
                
                {(() => {
                  const planLimits = getPlanLimits(account.plan || "starter");
                  const connectedChannels = (account.instagram_connected ? 1 : 0) + (account.facebook_connected ? 1 : 0) + (account.whatsapp_connected ? 1 : 0);
                  const limitReached = planLimits.channels !== -1 && connectedChannels >= planLimits.channels;

                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                      {/* Instagram Connect Card */}
                      <div style={{
                        padding: "var(--space-xl)", background: "var(--bg-card)",
                        border: account.instagram_connected ? "1px solid var(--accent-green)" : "1px solid var(--border-medium)",
                        borderRadius: "var(--radius-xl)", textAlign: "center", position: "relative",
                      }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: 16, margin: "0 auto var(--space-md)",
                          background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                          color: "white", display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                          <Globe size={28} /> {/* Using Globe as fallback for Camera/IG icon */}
                        </div>
                        <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Connect Instagram</h3>
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>Get messages from DMs</p>
                        
                        {account.instagram_connected ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <button className="btn btn-secondary" style={{ width: "100%", color: "var(--accent-green)", borderColor: "rgba(0,230,118,0.2)" }} disabled>
                              <Check size={16} /> Connected
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ width: "100%", color: "var(--accent-red)", fontSize: 11 }} onClick={async () => {
                              if (!confirm('Disconnect Instagram? You will stop receiving Instagram messages.')) return;
                              await supabase.from('accounts').update({ instagram_connected: false, instagram_page_id: null, instagram_access_token: null }).eq('id', account.id);
                              setAccount(prev => ({ ...prev, instagram_connected: false, instagram_page_id: null, instagram_access_token: null }));
                            }}>Disconnect</button>
                          </div>
                        ) : limitReached ? (
                          <button className="btn btn-secondary" style={{ width: "100%", opacity: 0.7 }} onClick={() => router.push('/dashboard/billing')}>
                            Upgrade to Connect
                          </button>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {process.env.NEXT_PUBLIC_META_APP_ID && (
                              <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => {
                                window.location.href = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/meta-callback')}&scope=pages_messaging,pages_read_engagement,pages_show_list,pages_manage_metadata&response_type=code&auth_type=rerequest&state=instagram_${account.id}`;
                              }}>
                                Connect with Meta
                              </button>
                            )}
                            <button className="btn btn-secondary" style={{ width: "100%", fontSize: 12 }} onClick={() => setShowManualIG(!showManualIG)}>
                              <LinkIcon size={14} /> Enter Credentials Manually
                            </button>
                            {showManualIG && (
                              <div style={{ textAlign: "left", padding: "8px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                                <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                                  Get these from Meta Dashboard → Instagram → Settings → Generate Token
                                </p>
                                <input type="text" className="form-input" placeholder="Facebook Page ID (not Instagram ID)" value={manualIG.pageId} onChange={(e) => setManualIG({ ...manualIG, pageId: e.target.value })} style={{ fontSize: 12 }} />
                                <input type="text" className="form-input" placeholder="Page Access Token" value={manualIG.accessToken} onChange={(e) => setManualIG({ ...manualIG, accessToken: e.target.value })} style={{ fontSize: 12 }} />
                                <button className="btn btn-primary btn-sm" disabled={manualIGSaving || !manualIG.pageId || !manualIG.accessToken} onClick={async () => {
                                  setManualIGSaving(true);
                                  try {
                                    const res = await fetch('/api/meta/connect', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        accountId: account.id,
                                        platform: 'instagram',
                                        pageId: manualIG.pageId,
                                        accessToken: manualIG.accessToken,
                                      }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error || 'Connection failed');
                                    setAccount(prev => ({ ...prev, instagram_connected: true, instagram_page_id: manualIG.pageId, instagram_access_token: manualIG.accessToken }));
                                    setMetaStatus({ type: 'success', platform: 'instagram', message: data.message || 'Instagram connected successfully!' });
                                    setShowManualIG(false);
                                  } catch (err) { alert('Failed: ' + err.message); }
                                  finally { setManualIGSaving(false); }
                                }}>
                                  {manualIGSaving ? 'Saving...' : 'Save & Connect'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Facebook Connect Card */}
                      <div style={{
                        padding: "var(--space-xl)", background: "var(--bg-card)",
                        border: account.facebook_connected ? "1px solid var(--accent-green)" : "1px solid var(--border-medium)",
                        borderRadius: "var(--radius-xl)", textAlign: "center", position: "relative",
                      }}>
                        <div style={{
                          width: 56, height: 56, borderRadius: 16, margin: "0 auto var(--space-md)",
                          background: "#1877F2", color: "white", display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                          <Globe size={28} />
                        </div>
                        <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Connect Facebook</h3>
                        <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>Messenger integration</p>
                        
                        {account.facebook_connected ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <button className="btn btn-secondary" style={{ width: "100%", color: "var(--accent-green)", borderColor: "rgba(0,230,118,0.2)" }} disabled>
                              <Check size={16} /> Connected
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ width: "100%", color: "var(--accent-red)", fontSize: 11 }} onClick={async () => {
                              if (!confirm('Disconnect Facebook? You will stop receiving Facebook messages.')) return;
                              await supabase.from('accounts').update({ facebook_connected: false, facebook_page_id: null, facebook_access_token: null }).eq('id', account.id);
                              setAccount(prev => ({ ...prev, facebook_connected: false, facebook_page_id: null, facebook_access_token: null }));
                            }}>Disconnect</button>
                          </div>
                        ) : limitReached ? (
                          <button className="btn btn-secondary" style={{ width: "100%", opacity: 0.7 }} onClick={() => router.push('/dashboard/billing')}>
                            Upgrade to Connect
                          </button>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {process.env.NEXT_PUBLIC_META_APP_ID && (
                              <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => {
                                window.location.href = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=${encodeURIComponent(window.location.origin + '/api/auth/meta-callback')}&scope=pages_messaging,pages_read_engagement,pages_show_list,pages_manage_metadata&response_type=code&auth_type=rerequest&state=facebook_${account.id}`;
                              }}>
                                Connect with Meta
                              </button>
                            )}
                            <button className="btn btn-secondary" style={{ width: "100%", fontSize: 12 }} onClick={() => setShowManualFB(!showManualFB)}>
                              <LinkIcon size={14} /> Enter Credentials Manually
                            </button>
                            {showManualFB && (
                              <div style={{ textAlign: "left", padding: "8px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                                <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                                  Get these from Meta Dashboard → Messenger → Settings → Generate Token
                                </p>
                                <input type="text" className="form-input" placeholder="Facebook Page ID" value={manualFB.pageId} onChange={(e) => setManualFB({ ...manualFB, pageId: e.target.value })} style={{ fontSize: 12 }} />
                                <input type="text" className="form-input" placeholder="Page Access Token" value={manualFB.accessToken} onChange={(e) => setManualFB({ ...manualFB, accessToken: e.target.value })} style={{ fontSize: 12 }} />
                                <button className="btn btn-primary btn-sm" disabled={manualFBSaving || !manualFB.pageId || !manualFB.accessToken} onClick={async () => {
                                  setManualFBSaving(true);
                                  try {
                                    const res = await fetch('/api/meta/connect', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        accountId: account.id,
                                        platform: 'facebook',
                                        pageId: manualFB.pageId,
                                        accessToken: manualFB.accessToken,
                                      }),
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error || 'Connection failed');
                                    setAccount(prev => ({ ...prev, facebook_connected: true, facebook_page_id: manualFB.pageId, facebook_access_token: manualFB.accessToken }));
                                    setMetaStatus({ type: 'success', platform: 'facebook', message: data.message || 'Facebook connected successfully!' });
                                    setShowManualFB(false);
                                  } catch (err) { alert('Failed: ' + err.message); }
                                  finally { setManualFBSaving(false); }
                                }}>
                                  {manualFBSaving ? 'Saving...' : 'Save & Connect'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                        {/* Shopify Connect Card */}
                        <div style={{
                          padding: "var(--space-xl)", background: "var(--bg-card)",
                          border: account.shopify_installed ? "1px solid var(--accent-green)" : "1px solid var(--border-medium)",
                          borderRadius: "var(--radius-xl)", textAlign: "center", position: "relative",
                        }}>
                          <div style={{
                            width: 56, height: 56, borderRadius: 16, margin: "0 auto var(--space-md)",
                            background: "#95bf47", color: "white", display: "flex", alignItems: "center", justifyContent: "center"
                          }}>
                            <Globe size={28} />
                          </div>
                          <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Connect Shopify</h3>
                          <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>Sync products and orders from your Shopify store</p>

                          {account.shopify_installed ? (
                            <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                              <button className="btn btn-secondary" style={{ width: "100%", color: "var(--accent-green)", borderColor: "rgba(0,230,118,0.2)" }} disabled>
                                <Check size={16} /> Connected
                              </button>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={shopifySyncing} onClick={async () => {
                                  setShopifySyncing(true);
                                  try {
                                    const res = await fetch('/api/integrations/shopify/sync', { method: 'POST' });
                                    const data = await res.json();
                                    if (data.error) throw new Error(data.error);
                                    alert(`Synced ${data.syncedProducts} products and ${data.syncedOrders} orders`);
                                  } catch(e) { alert(e.message); }
                                  finally { setShopifySyncing(false); }
                                }}>
                                  {shopifySyncing ? 'Syncing...' : 'Sync Data'}
                                </button>
                                <button className="btn btn-secondary btn-sm" style={{ flex: 1, color: "var(--accent-red)" }} disabled={shopifyDisconnecting} onClick={async () => {
                                  if (!confirm('Are you sure you want to disconnect Shopify?')) return;
                                  setShopifyDisconnecting(true);
                                  try {
                                    const res = await fetch('/api/integrations/shopify/disconnect', { method: 'POST' });
                                    if (res.ok) window.location.reload();
                                  } catch(e) {}
                                  finally { setShopifyDisconnecting(false); }
                                }}>
                                  Disconnect
                                </button>
                              </div>
                            </div>
                          ) : limitReached ? (
                            <button className="btn btn-secondary" style={{ width: "100%", opacity: 0.7 }} onClick={() => router.push('/dashboard/billing')}>
                              Upgrade to Connect
                            </button>
                          ) : (
                            <div>
                              <input type="text" className="form-input" placeholder="your-shop.myshopify.com" value={shopifyDomain} onChange={(e) => setShopifyDomain(e.target.value)} style={{ marginBottom: 8 }} />
                              <button className="btn btn-secondary" style={{ width: "100%" }} disabled={shopifyConnecting || !shopifyDomain} onClick={() => {
                                setShopifyConnecting(true);
                                window.location.href = `/api/integrations/shopify/connect?shop=${encodeURIComponent(shopifyDomain)}`;
                              }}>
                                {shopifyConnecting ? 'Connecting...' : 'Connect'}
                              </button>
                            </div>
                          )}
                        </div>
                    </div>
                  );
                })()}

                {/* WhatsApp Coming Soon Info */}
                <div style={{ marginTop: "var(--space-xl)", paddingTop: "var(--space-xl)", borderTop: "1px solid var(--border-subtle)" }}>
                  <div style={{
                    background: "rgba(255, 255, 255, 0.03)", border: "1px dashed var(--border-medium)",
                    borderRadius: "var(--radius-lg)", padding: "var(--space-xl)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: "50%",
                        background: "rgba(255, 255, 255, 0.05)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--text-tertiary)",
                      }}>
                        <MessageCircle size={22} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 2, color: "var(--text-secondary)" }}>WhatsApp Integration</div>
                        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                          WhatsApp API integration is coming soon.
                        </div>
                      </div>
                    </div>
                    <span className="status-badge pending" style={{ opacity: 0.7 }}>Coming Later</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "autoreplies" && (
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3>AI Auto-Reply Settings</h3>
              </div>
              <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
                {/* Toggle */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "var(--space-lg)", background: "var(--bg-glass)",
                  borderRadius: "var(--radius-md)", marginBottom: "var(--space-xl)",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Enable AI Auto-Replies</div>
                    <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-tertiary)" }}>
                      AI will automatically respond to common customer questions
                    </div>
                  </div>
                  <div style={{ color: account.ai_enabled ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }} onClick={() => updateField('ai_enabled', !account.ai_enabled)}>
                    {account.ai_enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">AI Personality / Brand Voice</label>
                  <textarea className="form-input form-textarea" value={account.ai_personality || ""} onChange={(e) => updateField('ai_personality', e.target.value)} placeholder="e.g. Friendly, professional, and helpful. Use emojis sparingly." />
                </div>

                <div style={{ marginTop: "var(--space-lg)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Quick Reply Templates</label>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowAddReply(!showAddReply)}>
                      <Plus size={14} /> Add Quick Reply
                    </button>
                  </div>

                  {showAddReply && (
                    <div style={{ padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", marginBottom: "var(--space-md)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                        <input type="text" className="form-input" placeholder="Trigger keyword (e.g. 'hours')" value={newReply.keyword} onChange={(e) => setNewReply({ ...newReply, keyword: e.target.value })} />
                        <select className="form-input" value={newReply.match_type} onChange={(e) => setNewReply({ ...newReply, match_type: e.target.value })} style={{ padding: "8px 12px" }}>
                          <option value="contains">Contains</option>
                          <option value="exact">Exact match</option>
                          <option value="starts_with">Starts with</option>
                        </select>
                      </div>
                      <textarea className="form-input form-textarea" placeholder="Auto-reply message..." value={newReply.response} onChange={(e) => setNewReply({ ...newReply, response: e.target.value })} style={{ marginBottom: "var(--space-sm)" }} />
                      <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <button className="btn btn-primary btn-sm" disabled={replySaving || !newReply.keyword || !newReply.response} onClick={async () => {
                          setReplySaving(true);
                          try {
                            const { data: { user } } = await supabase.auth.getUser();
                            const { data: inserted } = await supabase.from('auto_replies').insert({
                              account_id: user.id, trigger_keyword: newReply.keyword,
                              response: newReply.response, match_type: newReply.match_type, is_active: true
                            }).select().single();
                            if (inserted) { setAutoReplies([...autoReplies, inserted]); setNewReply({ keyword: "", response: "", match_type: "contains" }); setShowAddReply(false); }
                          } catch (err) { alert('Failed to save: ' + err.message); }
                          finally { setReplySaving(false); }
                        }}>{replySaving ? 'Saving...' : 'Save Reply'}</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowAddReply(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {autoReplies.length === 0 ? (
                    <div style={{ padding: "var(--space-xl)", textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-md)", fontSize: "var(--font-size-sm)" }}>
                      No quick reply templates yet. Add one to auto-respond to common keywords.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                      {autoReplies.map((ar) => (
                        <div key={ar.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                          <div style={{ flex: 1, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>"{ar.trigger_keyword}"</span>
                              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(108,92,231,0.1)", color: "var(--accent-primary)" }}>{ar.match_type}</span>
                            </div>
                            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ar.response}</div>
                          </div>
                          <button className="btn btn-sm" style={{ background: "rgba(255,82,82,0.1)", color: "var(--accent-red)", border: "none" }} onClick={async () => {
                            await supabase.from('auto_replies').delete().eq('id', ar.id);
                            setAutoReplies(autoReplies.filter(r => r.id !== ar.id));
                          }}><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="dashboard-panel">
              <div className="dashboard-panel-header"><h3>Notification Preferences</h3></div>
              <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
                {[
                  { key: "new_message", label: "New message received", desc: "Get notified when a customer sends a new message" },
                  { key: "new_order", label: "New order placed", desc: "Get notified when a new order is created" },
                  { key: "order_status", label: "Order status changed", desc: "Get notified when an order status changes" },
                  { key: "daily_summary", label: "Daily summary email", desc: "Receive a daily summary of conversations and orders" },
                ].map((n, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "var(--space-lg) 0",
                    borderBottom: i < 3 ? "1px solid var(--border-subtle)" : "none",
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 2 }}>{n.label}</div>
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>{n.desc}</div>
                    </div>
                    <div style={{ color: notifPrefs[n.key] ? "var(--accent-green)" : "var(--text-tertiary)", cursor: "pointer" }} onClick={async () => {
                      const newPrefs = { ...notifPrefs, [n.key]: !notifPrefs[n.key] };
                      setNotifPrefs(newPrefs);
                      // Save to DB
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        await supabase.from('accounts').update({ notification_prefs: newPrefs }).eq('id', user.id);
                      } catch (e) {}
                    }}>
                      {notifPrefs[n.key] ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="dashboard-panel">
              <div className="dashboard-panel-header"><h3>Security</h3></div>
              <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
                <div className="form-group" style={{ maxWidth: 400 }}>
                  <label className="form-label">Change Password</label>
                  <input type="password" placeholder="New password (min 6 chars)" className="form-input" style={{ marginBottom: "var(--space-sm)" }}
                    value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} />
                  <input type="password" placeholder="Confirm new password" className="form-input" style={{ marginBottom: "var(--space-md)" }}
                    value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
                  
                  {passwordError && <div style={{ color: "var(--accent-red)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-md)" }}>{passwordError}</div>}
                  {passwordSuccess && <div style={{ color: "var(--accent-green)", fontSize: "var(--font-size-sm)", marginBottom: "var(--space-md)" }}>{passwordSuccess}</div>}
                  
                  <button className="btn btn-secondary" onClick={handleUpdatePassword} disabled={updatingPassword}>
                    {updatingPassword ? <Loader2 size={16} className="spin" /> : "Update Password"}
                  </button>
                </div>

                <div style={{ paddingTop: "var(--space-xl)", borderTop: "1px solid var(--border-subtle)", marginTop: "var(--space-2xl)" }}>
                  <h4 style={{ marginBottom: "var(--space-md)" }}>Two-Factor Authentication</h4>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "var(--space-lg)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)",
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 2 }}>2FA is currently disabled</div>
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                        Add an extra layer of security to your account
                      </div>
                    </div>
                    <button className="btn btn-primary btn-sm" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>Enable 2FA (Coming Soon)</button>
                  </div>
                </div>

                <div style={{ paddingTop: "var(--space-xl)", marginTop: "var(--space-xl)", borderTop: "1px solid var(--border-subtle)" }}>
                  <h4 style={{ marginBottom: "var(--space-md)", color: "var(--accent-red)" }}>Danger Zone</h4>
                  <div style={{
                    padding: "var(--space-lg)", background: "rgba(255, 82, 82, 0.05)",
                    border: "1px solid rgba(255, 82, 82, 0.15)", borderRadius: "var(--radius-md)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 2 }}>Delete Account</div>
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
                        Permanently delete your account and all data
                      </div>
                    </div>
                    <button className="btn btn-sm" style={{ background: "rgba(255, 82, 82, 0.15)", color: "var(--accent-red)" }} onClick={() => setShowDeleteConfirm(true)}>
                      Delete Account
                    </button>
                  </div>
                  {showDeleteConfirm && (
                    <div style={{ marginTop: "var(--space-md)", padding: "var(--space-lg)", background: "rgba(255, 82, 82, 0.05)", border: "1px solid rgba(255, 82, 82, 0.2)", borderRadius: "var(--radius-md)" }}>
                      <p style={{ fontSize: "var(--font-size-sm)", color: "var(--accent-red)", marginBottom: "var(--space-md)" }}>
                        This action is permanent and cannot be undone. Type <strong>DELETE</strong> to confirm.
                      </p>
                      <input type="text" className="form-input" placeholder='Type "DELETE" to confirm' value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} style={{ marginBottom: "var(--space-md)" }} />
                      <div style={{ display: "flex", gap: "var(--space-sm)" }}>
                        <button className="btn btn-sm" style={{ background: "rgba(255, 82, 82, 0.2)", color: "var(--accent-red)" }} disabled={deleteConfirmText !== "DELETE"} onClick={async () => {
                          try {
                            const { data: { user } } = await supabase.auth.getUser();
                            // Delete all account data
                            await supabase.from('account_webhooks').delete().eq('account_id', user.id);
                            await supabase.from('team_members').delete().eq('account_id', user.id);
                            await supabase.from('auto_replies').delete().eq('account_id', user.id);
                            await supabase.from('accounts').delete().eq('id', user.id);
                            await supabase.auth.signOut();
                            window.location.href = '/';
                          } catch (err) { alert('Failed to delete account: ' + err.message); }
                        }}>Permanently Delete</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "webhooks" && (
            <div className="dashboard-panel">
              <div className="dashboard-panel-header"><h3>Webhook Integrations</h3></div>
              <div className="dashboard-panel-body" style={{ padding: "var(--space-xl)" }}>
                {account.plan === "starter" ? (
                  <div style={{ textAlign: "center", padding: "var(--space-3xl) var(--space-xl)" }}>
                    <Lock size={40} style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-md)" }} />
                    <h3 style={{ marginBottom: "var(--space-sm)" }}>Webhooks are a Pro feature</h3>
                    <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-lg)", fontSize: "var(--font-size-sm)" }}>
                      Connect Sellora to Shopify, Zapier, and other tools by upgrading to Professional.
                    </p>
                    <button className="btn btn-primary btn-sm" onClick={() => window.location.href = '/dashboard/billing'}>Upgrade Plan</button>
                  </div>
                ) : (
                  <>
                    <p style={{ color: "var(--text-tertiary)", marginBottom: "var(--space-lg)", fontSize: "var(--font-size-sm)" }}>
                      Receive real-time notifications when events happen (e.g., new order, new message). Sellora will POST a JSON payload to your URL.
                    </p>

                    {/* Add webhook */}
                    <div style={{ display: "flex", gap: "var(--space-sm)", marginBottom: "var(--space-xl)" }}>
                      <input type="url" className="form-input" placeholder="https://your-server.com/webhook" value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} style={{ flex: 1 }} />
                      <button className="btn btn-primary btn-sm" disabled={webhookSaving || !newWebhookUrl} onClick={async () => {
                        setWebhookSaving(true);
                        const { data: { user } } = await supabase.auth.getUser();
                        const { data: newWh } = await supabase.from("account_webhooks").insert({
                          account_id: user.id,
                          url: newWebhookUrl,
                          events: ["order.created", "message.received"],
                        }).select().single();
                        if (newWh) setWebhooks([...webhooks, newWh]);
                        setNewWebhookUrl("");
                        setWebhookSaving(false);
                      }}>
                        {webhookSaving ? <Loader2 size={14} className="spin" /> : <><Plus size={14} /> Add</>}
                      </button>
                    </div>

                    {/* List webhooks */}
                    {webhooks.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "var(--space-2xl)", color: "var(--text-tertiary)", border: "1px dashed var(--border-medium)", borderRadius: "var(--radius-md)" }}>
                        No webhooks configured yet.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
                        {webhooks.map((wh) => (
                          <div key={wh.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-md)", background: "var(--bg-glass)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                            <div style={{ flex: 1, overflow: "hidden" }}>
                              <div style={{ fontWeight: 500, fontSize: "var(--font-size-sm)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{wh.url}</div>
                              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                                Events: {wh.events?.join(", ")} • {wh.is_active ? <span style={{ color: "var(--accent-green)" }}>Active</span> : <span style={{ color: "var(--accent-red)" }}>Disabled</span>}
                                {wh.last_status_code ? ` • Last: ${wh.last_status_code}` : ""}
                              </div>
                            </div>
                            <button className="btn btn-sm" style={{ background: "rgba(255,82,82,0.1)", color: "var(--accent-red)", border: "none" }} onClick={async () => {
                              await supabase.from("account_webhooks").delete().eq("id", wh.id);
                              setWebhooks(webhooks.filter(w => w.id !== wh.id));
                            }}><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === "team" && (
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
                            alert(data.error || "Failed to send invite");
                          } else if (data.member) {
                            setTeamMembers([...teamMembers, data.member]);
                            setInviteEmail("");
                            alert("Invitation sent successfully!");
                          }
                        } catch (err) {
                          alert("An error occurred while sending the invite.");
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
          )}
        </div>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
