"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Settings, User, MessageCircle, Bot, Bell, Globe, Shield, Smartphone,
  Save, Check, Loader2, Webhook, UsersRound, Lock, HelpCircle, Clock, Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SAFE_ACCOUNT_FIELDS } from "@/lib/safe-fields";

import ProfileTab from "./ProfileTab";
import ChannelsTab from "./ChannelsTab";
import AutoRepliesTab from "./AutoRepliesTab";
import PoliciesTab from "./PoliciesTab";
import FAQsTab from "./FAQsTab";
import QuickRepliesTab from "./QuickRepliesTab";
import AutomationTab from "./AutomationTab";
import WebhooksTab from "./WebhooksTab";
import TeamTab from "./TeamTab";
import NotificationsTab from "./NotificationsTab";
import SecurityTab from "./SecurityTab";

const tabs = [
  { key: "profile", label: "Business Profile", icon: User },
  { key: "channels", label: "Connected Channels", icon: Smartphone },
  { key: "autoreplies", label: "Keyword Rules", icon: Bot },
  { key: "policies", label: "Business Policies", icon: Shield },
  { key: "faqs", label: "FAQ Knowledge Base", icon: HelpCircle },
  { key: "quickreplies", label: "Saved Templates", icon: Zap },
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
  const [metaStatus, setMetaStatus] = useState(null);
  const [account, setAccount] = useState({
    business_name: "", business_description: "", industry: "",
    email: "", phone: "", country: "", currency: "",
    ai_enabled: true, ai_personality: "", notify_escalations: true,
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

  // FAQs state
  const [faqs, setFaqs] = useState([]);
  const [showAddFaq, setShowAddFaq] = useState(false);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "", category: "General" });
  const [faqSaving, setFaqSaving] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);

  // Policies state
  const [policies, setPolicies] = useState([]);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [newPolicy, setNewPolicy] = useState({ title: "", content: "", category: "General" });
  const [policySaving, setPolicySaving] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);

  // Automation state
  const [autoFollowUp, setAutoFollowUp] = useState(false);
  const [autoGreeting, setAutoGreeting] = useState(false);
  const [autoGreetingMessage, setAutoGreetingMessage] = useState("");
  const [greetingPerChannel, setGreetingPerChannel] = useState(false);
  const [instagramGreeting, setInstagramGreeting] = useState("");
  const [facebookGreeting, setFacebookGreeting] = useState("");
  const [whatsappGreeting, setWhatsappGreeting] = useState("");
  const [greetingDelaySeconds, setGreetingDelaySeconds] = useState(0);

  // Quick Replies state
  const [quickReplies, setQuickReplies] = useState([]);
  const [showAddQuickReply, setShowAddQuickReply] = useState(false);
  const [newQuickReply, setNewQuickReply] = useState({ title: "", content: "", category: "General", shortcut: "" });
  const [quickReplySaving, setQuickReplySaving] = useState(false);
  const [editingQuickReply, setEditingQuickReply] = useState(null);

  // WhatsApp manual connect state
  const [showManualWA, setShowManualWA] = useState(false);
  const [manualWA, setManualWA] = useState({ phoneNumberId: "", accessToken: "" });
  const [manualWASaving, setManualWASaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("accounts").select(SAFE_ACCOUNT_FIELDS).eq("id", user.id).single();
      if (data) setAccount(data);

      // Check for Meta OAuth callback feedback
      const connected = searchParams.get('connected');
      const errorParam = searchParams.get('error');
      if (connected) {
        const platformName = connected === 'instagram' ? 'Instagram' : 'Facebook';
        setMetaStatus({ type: 'success', platform: connected, message: `${platformName} connected successfully!` });
        window.history.replaceState({}, '', '/dashboard/settings?tab=channels');
      } else if (errorParam) {
        const debugParam = searchParams.get('debug') || '';
        const errorMessages = {
          no_pages: `No Facebook Pages found. Debug info: ${debugParam || 'none'}. This means either: (1) You don't have a Facebook Business Page — create one at facebook.com/pages/create, or (2) You didn't select your Page in the Facebook dialog — remove Sellora from facebook.com/settings?tab=apps and try again, this time checking the box next to your Page.`,
          pages_perm_declined: `Page permissions were declined. Debug: ${debugParam || 'none'}. Remove Sellora from facebook.com/settings?tab=apps and reconnect, making sure to allow ALL permissions and SELECT your Page.`,
          no_instagram_account: 'No Instagram Business Account linked to your Facebook Page. Make sure your Instagram is a Business/Creator account linked to your Facebook Page.',
          token_exchange_failed: 'Failed to exchange authorization code. Please try again.',
          server_config: 'Server is not configured for Meta integration. Make sure META_APP_ID and META_APP_SECRET are set in Vercel.',
          invalid_state: 'Invalid OAuth state. Please try connecting again.',
          missing_params: 'Facebook authorization incomplete — no code was received. Remove Sellora from facebook.com/settings?tab=apps and try again. Click "Edit settings" if you see "Continue with previous settings".',
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

      // Fetch FAQs
      const { data: faqData } = await supabase.from("faqs").select("*").eq("account_id", user.id).order("created_at", { ascending: false });
      if (faqData) setFaqs(faqData);

      // Fetch business policies
      const { data: policyData } = await supabase.from("business_policies").select("*").eq("account_id", user.id).order("sort_order", { ascending: true });
      if (policyData) setPolicies(policyData);

      // Load auto follow-up setting
      if (data?.auto_follow_up_enabled !== undefined) setAutoFollowUp(data.auto_follow_up_enabled);

      // Load auto-greeting settings
      if (data?.auto_greeting !== undefined) setAutoGreeting(data.auto_greeting);
      if (data?.auto_greeting_message) setAutoGreetingMessage(data.auto_greeting_message);
      if (data?.greeting_per_channel !== undefined) setGreetingPerChannel(data.greeting_per_channel);
      if (data?.instagram_greeting) setInstagramGreeting(data.instagram_greeting);
      if (data?.facebook_greeting) setFacebookGreeting(data.facebook_greeting);
      if (data?.whatsapp_greeting) setWhatsappGreeting(data.whatsapp_greeting);
      if (data?.greeting_delay_seconds !== undefined) setGreetingDelaySeconds(data.greeting_delay_seconds);

      // Fetch quick replies
      const { data: qrData } = await supabase.from("quick_replies").select("*").eq("account_id", user.id).order("created_at");
      if (qrData) setQuickReplies(qrData);

      // Load notification prefs from account
      if (data?.notification_prefs) setNotifPrefs(data.notification_prefs);

      setLoading(false);
    };
    load();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);

    // Fields to save
    const fields = {
      business_name: account.business_name,
      business_description: account.business_description,
      industry: account.industry,
      phone: account.phone,
      country: account.country,
      currency: account.currency,
      ai_enabled: account.ai_enabled,
      ai_personality: account.ai_personality,
      notify_escalations: account.notify_escalations !== false,
      instagram_url: account.instagram_url,
      facebook_url: account.facebook_url,
      website_url: account.website_url,
      auto_greeting: account.auto_greeting,
      auto_greeting_message: account.auto_greeting_message,
      greeting_per_channel: account.greeting_per_channel,
      instagram_greeting: account.instagram_greeting,
      facebook_greeting: account.facebook_greeting,
      whatsapp_greeting: account.whatsapp_greeting,
      greeting_delay_seconds: account.greeting_delay_seconds,
      auto_follow_up_enabled: account.auto_follow_up_enabled,
      notification_prefs: account.notification_prefs,
      logo_url: account.logo_url,
    };

    try {
      // ── Method 1: Direct client-side update (original method, works with RLS policies) ──
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: clientError } = await supabase
          .from("accounts")
          .update(fields)
          .eq("id", user.id);

        if (!clientError) {
          // Client-side update succeeded
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          setSaving(false);
          return;
        }

        // Client-side failed (likely RLS blocking) — fall through to server API
        console.warn("[Settings] Client-side save failed, falling back to server API:", clientError.message);
      }

      // ── Method 2: Server-side API route (bypasses RLS with service role key) ──
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/account", {
        method: "PATCH",
        headers,
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Save failed: " + (data.error || "Unknown error"));
        setSaving(false);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("[Settings] Save error:", err);
      alert("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  const updateField = (field, value) => setAccount((prev) => ({ ...prev, [field]: value }));

  const tabProps = {
    account, setAccount, updateField, supabase, router,
    metaStatus, setMetaStatus,
    showManualIG, setShowManualIG, manualIG, setManualIG, manualIGSaving, setManualIGSaving,
    showManualFB, setShowManualFB, manualFB, setManualFB, manualFBSaving, setManualFBSaving,
    showManualWA, setShowManualWA, manualWA, setManualWA, manualWASaving, setManualWASaving,
    shopifyDomain, setShopifyDomain, shopifyConnecting, setShopifyConnecting,
    shopifySyncing, setShopifySyncing, shopifyDisconnecting, setShopifyDisconnecting,
    webhooks, setWebhooks, newWebhookUrl, setNewWebhookUrl, webhookSaving, setWebhookSaving,
    teamMembers, setTeamMembers, inviteEmail, setInviteEmail, teamSaving, setTeamSaving,
    passwords, setPasswords, passwordError, setPasswordError, passwordSuccess, setPasswordSuccess,
    updatingPassword, setUpdatingPassword,
    notifPrefs, setNotifPrefs, notifSaving, setNotifSaving,
    uploadingLogo, setUploadingLogo,
    autoReplies, setAutoReplies, showAddReply, setShowAddReply, newReply, setNewReply, replySaving, setReplySaving,
    showDeleteConfirm, setShowDeleteConfirm, deleteConfirmText, setDeleteConfirmText,
    faqs, setFaqs, showAddFaq, setShowAddFaq, newFaq, setNewFaq, faqSaving, setFaqSaving, editingFaq, setEditingFaq,
    policies, setPolicies, showAddPolicy, setShowAddPolicy, newPolicy, setNewPolicy, policySaving, setPolicySaving, editingPolicy, setEditingPolicy,
    autoFollowUp, setAutoFollowUp, autoGreeting, setAutoGreeting, autoGreetingMessage, setAutoGreetingMessage,
    greetingPerChannel, setGreetingPerChannel, instagramGreeting, setInstagramGreeting,
    facebookGreeting, setFacebookGreeting, whatsappGreeting, setWhatsappGreeting,
    greetingDelaySeconds, setGreetingDelaySeconds,
    quickReplies, setQuickReplies, showAddQuickReply, setShowAddQuickReply,
    newQuickReply, setNewQuickReply, quickReplySaving, setQuickReplySaving,
    editingQuickReply, setEditingQuickReply,
  };

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
          {activeTab === "profile" && <ProfileTab {...tabProps} />}
          {activeTab === "channels" && <ChannelsTab {...tabProps} />}
          {activeTab === "autoreplies" && <AutoRepliesTab {...tabProps} />}
          {activeTab === "policies" && <PoliciesTab {...tabProps} />}
          {activeTab === "faqs" && <FAQsTab {...tabProps} />}
          {activeTab === "quickreplies" && <QuickRepliesTab {...tabProps} />}
          {/* Removed: Automation tab → consolidated into /dashboard/automation */}
          {/* Removed: Webhooks tab → consolidated into /dashboard/webhooks */}
          {(activeTab === "automation" || activeTab === "webhooks") && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
                This setting has moved to its own page for better organization.
              </p>
              <a
                href={activeTab === "automation" ? "/dashboard/automation" : "/dashboard/webhooks"}
                className="btn btn-primary"
              >
                Go to {activeTab === "automation" ? "Automation" : "Webhooks"} page
              </a>
            </div>
          )}
          {activeTab === "team" && <TeamTab {...tabProps} />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "security" && <SecurityTab {...tabProps} />}
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
