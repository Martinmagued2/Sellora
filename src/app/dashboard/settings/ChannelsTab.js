"use client";

import { useState } from "react";
import { MessageCircle, Globe, Check, Plus, X, Link as LinkIcon, Loader2, Send, Mail, Copy } from "lucide-react";
import { getPlanLimits } from "@/lib/plan-limits";
import { useToast } from "../components/ToastProvider";
import { useConfirm } from "../components/ConfirmProvider";

export default function ChannelsTab({
  account, setAccount, supabase, router,
  metaStatus, setMetaStatus,
  showManualIG, setShowManualIG, manualIG, setManualIG, manualIGSaving, setManualIGSaving,
  showManualFB, setShowManualFB, manualFB, setManualFB, manualFBSaving, setManualFBSaving,
  showManualWA, setShowManualWA, manualWA, setManualWA, manualWASaving, setManualWASaving,
  shopifyDomain, setShopifyDomain, shopifyConnecting, setShopifyConnecting,
  shopifySyncing, setShopifySyncing, shopifyDisconnecting, setShopifyDisconnecting,
}) {
  const toast = useToast();
  const confirmAction = useConfirm();
  const planLimits = getPlanLimits(account.plan || "starter");
  const connectedChannels = (account.instagram_connected ? 1 : 0) + (account.facebook_connected ? 1 : 0) + (account.whatsapp_connected ? 1 : 0) + (account.telegram_connected ? 1 : 0) + (account.email_channel_enabled ? 1 : 0);
  const limitReached = planLimits.channels !== -1 && connectedChannels >= planLimits.channels;

  // Telegram state
  const [tgToken, setTgToken] = useState("");
  const [tgSaving, setTgSaving] = useState(false);
  const [tgDisconnecting, setTgDisconnecting] = useState(false);

  // Email state
  const [emailAddress, setEmailAddress] = useState(account.email_inbound_address || "");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailDisconnecting, setEmailDisconnecting] = useState(false);
  const [showEmailSetup, setShowEmailSetup] = useState(false);

  // IG/FB/WA disconnect loading states
  const [igDisconnecting, setIgDisconnecting] = useState(false);
  const [fbDisconnecting, setFbDisconnecting] = useState(false);
  const [waDisconnecting, setWaDisconnecting] = useState(false);

  // Generic disconnect handler for IG/FB/WA — calls server-side API endpoint
  // (client-side supabase update fails on access_token columns due to RLS)
  const disconnectChannel = async ({ channel, endpoint, setLoading, fields }) => {
    if (!(await confirmAction(`Disconnect ${channel}? You will stop receiving ${channel} messages.`))) return;
    setLoading(true);
    try {
      console.log(`[ChannelsTab] Disconnecting ${channel} → ${endpoint}`);
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      console.log(`[ChannelsTab] ${channel} disconnect response:`, res.status, data);
      if (!res.ok || data.error) throw new Error(data.error || `Failed (HTTP ${res.status})`);
      setAccount((prev) => ({ ...prev, ...fields }));
      toast.success(`${channel} disconnected`);
    } catch (e) {
      console.error(`[ChannelsTab] ${channel} disconnect failed:`, e);
      toast.error(e.message || `Failed to disconnect ${channel}`);
    } finally {
      setLoading(false);
    }
  };

  const handleIgDisconnect = () => disconnectChannel({
    channel: "Instagram",
    endpoint: "/api/instagram/disconnect",
    setLoading: setIgDisconnecting,
    fields: { instagram_connected: false, instagram_page_id: null, instagram_access_token: null },
  });
  const handleFbDisconnect = () => disconnectChannel({
    channel: "Facebook",
    endpoint: "/api/facebook/disconnect",
    setLoading: setFbDisconnecting,
    fields: { facebook_connected: false, facebook_page_id: null, facebook_access_token: null },
  });
  const handleWaDisconnect = () => disconnectChannel({
    channel: "WhatsApp",
    endpoint: "/api/whatsapp/disconnect",
    setLoading: setWaDisconnecting,
    fields: { whatsapp_connected: false, whatsapp_phone_number_id: null, whatsapp_access_token: null },
  });

  const handleTelegramConnect = async () => {
    if (!tgToken || !tgToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
      toast.error("Invalid bot token format. Get it from @BotFather on Telegram.");
      return;
    }
    setTgSaving(true);
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: tgToken }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Telegram bot @${data.botUsername} connected!`);
        setAccount((prev) => ({ ...prev, telegram_connected: true, telegram_bot_token: tgToken, telegram_bot_username: data.botUsername }));
        setTgToken("");
      } else {
        toast.error(data.error || "Failed to connect Telegram");
      }
    } catch (e) {
      toast.error("Network error: " + e.message);
    } finally {
      setTgSaving(false);
    }
  };

  const handleTelegramDisconnect = async () => {
    if (!(await confirmAction('Disconnect Telegram bot? Customers won\'t be able to message you on Telegram.'))) return;
    setTgDisconnecting(true);
    try {
      const res = await fetch("/api/telegram/disconnect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast.success("Telegram disconnected");
        setAccount((prev) => ({ ...prev, telegram_connected: false, telegram_bot_token: null, telegram_bot_username: null }));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to disconnect");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setTgDisconnecting(false);
    }
  };

  const handleEmailConnect = async () => {
    if (!emailAddress || !emailAddress.includes("@")) {
      toast.error("Valid email address required");
      return;
    }
    setEmailSaving(true);
    try {
      const res = await fetch("/api/email/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboundAddress: emailAddress }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Email channel enabled");
        setAccount((prev) => ({ ...prev, email_channel_enabled: true, email_inbound_address: emailAddress.toLowerCase().trim() }));
        setShowEmailSetup(false);
      } else {
        toast.error(data.error || "Failed to enable email");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setEmailSaving(false);
    }
  };

  const handleEmailDisconnect = async () => {
    if (!(await confirmAction('Disable email channel? Inbound emails will no longer create conversations.'))) return;
    setEmailDisconnecting(true);
    try {
      const res = await fetch("/api/email/connect", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast.success("Email channel disabled");
        setAccount((prev) => ({ ...prev, email_channel_enabled: false, email_inbound_address: null }));
        setEmailAddress("");
      } else {
        toast.error("Failed to disable");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setEmailDisconnecting(false);
    }
  };

  const copyToClipboard = (text) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    }
  };

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/email` : "/api/webhooks/email";

  return (
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
              <Globe size={28} />
            </div>
            <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Connect Instagram</h3>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>Get messages from DMs</p>

            {account.instagram_connected ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-secondary" style={{ width: "100%", color: "var(--accent-green)", borderColor: "rgba(0,230,118,0.2)" }} disabled>
                  <Check size={16} /> Connected
                </button>
                <button className="btn btn-secondary btn-sm" style={{ width: "100%", color: "var(--accent-red)", fontSize: 11 }} disabled={igDisconnecting} onClick={handleIgDisconnect}>
                  {igDisconnecting ? <><Loader2 size={12} className="spin" /> Disconnecting…</> : 'Disconnect'}
                </button>
              </div>
            ) : limitReached ? (
              <button className="btn btn-secondary" style={{ width: "100%", opacity: 0.7 }} onClick={() => router.push('/dashboard/billing')}>
                Upgrade to Connect
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {process.env.NEXT_PUBLIC_META_APP_ID && (
                  <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => {
                    // Use the production URL (not window.location.origin) to ensure
                    // the redirect URI always matches what's whitelisted in Meta dashboard.
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.sellorachat.com';
                    const redirectUri = `${baseUrl}/api/auth/meta-callback`;
                    window.location.href = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_messaging,pages_read_engagement,pages_show_list,pages_manage_metadata&response_type=code&auth_type=rerequest&state=instagram_${account.id}`;
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
                      } catch (err) { toast.error('Failed: ' + err.message); }
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
                <button className="btn btn-secondary btn-sm" style={{ width: "100%", color: "var(--accent-red)", fontSize: 11 }} disabled={fbDisconnecting} onClick={handleFbDisconnect}>
                  {fbDisconnecting ? <><Loader2 size={12} className="spin" /> Disconnecting…</> : 'Disconnect'}
                </button>
              </div>
            ) : limitReached ? (
              <button className="btn btn-secondary" style={{ width: "100%", opacity: 0.7 }} onClick={() => router.push('/dashboard/billing')}>
                Upgrade to Connect
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {process.env.NEXT_PUBLIC_META_APP_ID && (
                  <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => {
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.sellorachat.com';
                    const redirectUri = `${baseUrl}/api/auth/meta-callback`;
                    window.location.href = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.NEXT_PUBLIC_META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_messaging,pages_read_engagement,pages_show_list,pages_manage_metadata&response_type=code&auth_type=rerequest&state=facebook_${account.id}`;
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
                      } catch (err) { toast.error('Failed: ' + err.message); }
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
                      toast.success(`Synced ${data.syncedProducts} products and ${data.syncedOrders} orders`);
                    } catch(e) { toast.error(e.message); }
                    finally { setShopifySyncing(false); }
                  }}>
                    {shopifySyncing ? 'Syncing...' : 'Sync Data'}
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1, color: "var(--accent-red)" }} disabled={shopifyDisconnecting} onClick={async () => {
                    if (!(await confirmAction('Are you sure you want to disconnect Shopify?'))) return;
                    setShopifyDisconnecting(true);
                    try {
                      const res = await fetch('/api/integrations/shopify/disconnect', {
                        method: 'POST',
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                      });
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

        {/* WhatsApp Connect Card */}
        <div style={{ marginTop: "var(--space-xl)", paddingTop: "var(--space-xl)", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{
            padding: "var(--space-xl)", background: "var(--bg-card)",
            border: account.whatsapp_connected ? "1px solid var(--accent-green)" : "1px solid var(--border-medium)",
            borderRadius: "var(--radius-xl)", textAlign: "center", position: "relative",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto var(--space-md)",
              background: "#25D366", color: "white", display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <MessageCircle size={28} />
            </div>
            <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Connect WhatsApp</h3>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>WhatsApp Business API integration</p>

            {account.whatsapp_connected ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-secondary" style={{ width: "100%", color: "var(--accent-green)", borderColor: "rgba(0,230,118,0.2)" }} disabled>
                  <Check size={16} /> Connected
                </button>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "8px 12px", background: "var(--bg-glass)", borderRadius: 8, textAlign: "left" }}>
                  <div style={{ marginBottom: 4 }}><strong>Phone Number ID:</strong> {account.whatsapp_phone_number_id || "Not set"}</div>
                  <div style={{ marginBottom: 4 }}><strong>Webhook URL:</strong> <code style={{ fontSize: 10, background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4 }}>{typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp` : '/api/webhooks/whatsapp'}</code></div>
                  <div><strong>Verify Token:</strong> Set via WHATSAPP_WEBHOOK_VERIFY_TOKEN env var</div>
                </div>
                <button className="btn btn-secondary btn-sm" style={{ width: "100%", color: "var(--accent-red)", fontSize: 11 }} disabled={waDisconnecting} onClick={handleWaDisconnect}>
                  {waDisconnecting ? <><Loader2 size={12} className="spin" /> Disconnecting…</> : 'Disconnect'}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-secondary" style={{ width: "100%", fontSize: 12 }} onClick={() => setShowManualWA(!showManualWA)}>
                  <LinkIcon size={14} /> Enter WhatsApp Credentials
                </button>
                {showManualWA && (
                  <div style={{ textAlign: "left", padding: "8px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                    <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
                      Get these from Meta Dashboard → WhatsApp → Phone Numbers → Settings
                    </p>
                    <input type="text" className="form-input" placeholder="Phone Number ID" value={manualWA.phoneNumberId} onChange={(e) => setManualWA({ ...manualWA, phoneNumberId: e.target.value })} style={{ fontSize: 12 }} />
                    <input type="text" className="form-input" placeholder="Access Token" value={manualWA.accessToken} onChange={(e) => setManualWA({ ...manualWA, accessToken: e.target.value })} style={{ fontSize: 12 }} />
                    <button className="btn btn-primary btn-sm" disabled={manualWASaving || !manualWA.phoneNumberId || !manualWA.accessToken} onClick={async () => {
                      setManualWASaving(true);
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        const { error } = await supabase.from('accounts').update({
                          whatsapp_connected: true,
                          whatsapp_phone_number_id: manualWA.phoneNumberId,
                          whatsapp_access_token: manualWA.accessToken,
                        }).eq('id', user.id);

                        if (error) throw new Error(error.message);
                        setAccount(prev => ({ ...prev, whatsapp_connected: true, whatsapp_phone_number_id: manualWA.phoneNumberId, whatsapp_access_token: manualWA.accessToken }));
                        setShowManualWA(false);
                        setMetaStatus({ type: 'success', platform: 'whatsapp', message: 'WhatsApp connected successfully!' });
                      } catch (err) { toast.error('Failed: ' + err.message); }
                      finally { setManualWASaving(false); }
                    }}>
                      {manualWASaving ? 'Saving...' : 'Save & Connect'}
                    </button>
                  </div>
                )}
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", padding: "8px 12px", background: "var(--bg-glass)", borderRadius: 8, textAlign: "left" }}>
                  <div style={{ marginBottom: 4 }}><strong>Webhook URL:</strong> <code style={{ fontSize: 9, background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4 }}>{typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp` : '/api/webhooks/whatsapp'}</code></div>
                  <div><strong>Note:</strong> Configure webhook in Meta Dashboard with this URL</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════ TELEGRAM CHANNEL CARD ═══════════ */}
        <div style={{
          padding: "var(--space-lg)", borderRadius: "var(--radius-md)",
          background: "var(--bg-secondary)",
          border: account.telegram_connected ? "1px solid var(--accent-green)" : "1px solid var(--border-medium)",
          display: "flex", flexDirection: "column", gap: "var(--space-md)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #0088cc, #00a8e8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                <Send size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>Telegram</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {account.telegram_connected ? `@${account.telegram_bot_username || "bot"} connected` : "Not connected"}
                </div>
              </div>
            </div>
            {account.telegram_connected ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-green)", fontWeight: 600 }}>
                <Check size={14} /> Active
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Inactive</span>
            )}
          </div>

          {account.telegram_connected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: "8px 12px", background: "var(--bg-glass)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                ✅ Bot <strong>@{account.telegram_bot_username}</strong> is live and receiving messages.
                Customers can DM your bot and the AI will auto-reply.
              </div>
              <button
                className="btn btn-sm"
                disabled={tgDisconnecting}
                onClick={handleTelegramDisconnect}
                style={{ background: "rgba(255,82,82,0.1)", color: "var(--accent-red)", border: "1px solid rgba(255,82,82,0.3)", justifyContent: "center" }}
              >
                {tgDisconnecting ? <Loader2 size={14} className="spin" /> : <X size={14} />}
                Disconnect Telegram
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                Connect a Telegram bot to let customers message you on Telegram. The AI will auto-reply 24/7.
              </p>
              <details style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--accent-primary-light)" }}>How to get a bot token →</summary>
                <ol style={{ marginTop: 8, paddingLeft: 16, lineHeight: 1.6 }}>
                  <li>Open Telegram and search for <strong>@BotFather</strong></li>
                  <li>Send <code style={{ background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>/newbot</code></li>
                  <li>Choose a name and username (must end with "bot")</li>
                  <li>Copy the bot token (looks like <code style={{ fontSize: 10 }}>123456:ABC-DEF...</code>)</li>
                  <li>Paste it below</li>
                </ol>
              </details>
              <input
                type="text"
                className="form-input"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={tgToken}
                onChange={(e) => setTgToken(e.target.value)}
                style={{ fontSize: 13, fontFamily: "monospace" }}
              />
              <button
                className="btn btn-primary btn-sm"
                disabled={tgSaving || !tgToken}
                onClick={handleTelegramConnect}
                style={{ justifyContent: "center" }}
              >
                {tgSaving ? <><Loader2 size={14} className="spin" /> Connecting...</> : <><Plus size={14} /> Connect Telegram Bot</>}
              </button>
            </div>
          )}
        </div>

        {/* ═══════════ EMAIL CHANNEL CARD ═══════════ */}
        <div style={{
          padding: "var(--space-lg)", borderRadius: "var(--radius-md)",
          background: "var(--bg-secondary)",
          border: account.email_channel_enabled ? "1px solid var(--accent-green)" : "1px solid var(--border-medium)",
          display: "flex", flexDirection: "column", gap: "var(--space-md)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #6C5CE7, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                <Mail size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>Email</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {account.email_channel_enabled ? `${account.email_inbound_address}` : "Not connected"}
                </div>
              </div>
            </div>
            {account.email_channel_enabled ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--accent-green)", fontWeight: 600 }}>
                <Check size={14} /> Active
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Inactive</span>
            )}
          </div>

          {account.email_channel_enabled ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: "8px 12px", background: "var(--bg-glass)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                ✅ Inbound emails to <strong>{account.email_inbound_address}</strong> create conversations.
                The AI auto-replies, and you can reply manually from the dashboard.
              </div>
              <div style={{ padding: "8px 12px", background: "var(--bg-glass)", borderRadius: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                <div style={{ marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong>Webhook URL (for email forwarding):</strong>
                  <button onClick={() => copyToClipboard(webhookUrl)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-primary-light)", padding: 2 }}>
                    <Copy size={12} />
                  </button>
                </div>
                <code style={{ fontSize: 9, background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: 4, wordBreak: "break-all" }}>{webhookUrl}</code>
              </div>
              <button
                className="btn btn-sm"
                disabled={emailDisconnecting}
                onClick={handleEmailDisconnect}
                style={{ background: "rgba(255,82,82,0.1)", color: "var(--accent-red)", border: "1px solid rgba(255,82,82,0.3)", justifyContent: "center" }}
              >
                {emailDisconnecting ? <Loader2 size={14} className="spin" /> : <X size={14} />}
                Disable Email Channel
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                Enable email as a channel. Inbound emails become conversations — the AI auto-replies,
                and you can reply manually. Outbound replies use your branded email template.
              </p>
              {!showEmailSetup ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowEmailSetup(true)}
                  style={{ justifyContent: "center" }}
                >
                  <Plus size={14} /> Set Up Email Channel
                </button>
              ) : (
                <>
                  <details style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--accent-primary-light)" }}>How email channel works →</summary>
                    <ol style={{ marginTop: 8, paddingLeft: 16, lineHeight: 1.6 }}>
                      <li>Enter your support email (e.g. <code style={{ fontSize: 10 }}>support@yourstore.com</code>)</li>
                      <li>Set up email forwarding from that address to the webhook URL below</li>
                      <li>Use Resend/SendGrid/Mailgun inbound parse, or your email provider's forwarding rules</li>
                      <li>Inbound emails create conversations in Sellora</li>
                      <li>AI auto-replies + you can reply manually from the dashboard</li>
                    </ol>
                  </details>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="support@yourstore.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={emailSaving || !emailAddress}
                      onClick={handleEmailConnect}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      {emailSaving ? <><Loader2 size={14} className="spin" /> Enabling...</> : <><Check size={14} /> Enable Email</>}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => setShowEmailSetup(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
