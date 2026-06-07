"use client";

import { MessageCircle, Globe, Check, Plus, X, Link as LinkIcon, Loader2 } from "lucide-react";
import { getPlanLimits } from "@/lib/plan-limits";
import { useToast } from "../components/ToastProvider";

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
  const planLimits = getPlanLimits(account.plan || "starter");
  const connectedChannels = (account.instagram_connected ? 1 : 0) + (account.facebook_connected ? 1 : 0) + (account.whatsapp_connected ? 1 : 0);
  const limitReached = planLimits.channels !== -1 && connectedChannels >= planLimits.channels;

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
                <button className="btn btn-secondary btn-sm" style={{ width: "100%", color: "var(--accent-red)", fontSize: 11 }} onClick={async () => {
                  if (!confirm('Disconnect WhatsApp? You will stop receiving WhatsApp messages.')) return;
                  await supabase.from('accounts').update({ whatsapp_connected: false, whatsapp_phone_number_id: null, whatsapp_access_token: null }).eq('id', account.id);
                  setAccount(prev => ({ ...prev, whatsapp_connected: false, whatsapp_phone_number_id: null, whatsapp_access_token: null }));
                }}>Disconnect</button>
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
      </div>
    </div>
  );
}
