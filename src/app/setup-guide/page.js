"use client";

import { useState } from "react";
import {
  MessageCircle, Camera, Globe, Check, ChevronDown, ChevronRight,
  ExternalLink, AlertCircle, ArrowRight,
} from "lucide-react";

const STEPS = {
  whatsapp: [
    {
      title: "Create a Meta Developer Account",
      desc: "Go to developers.facebook.com and sign up with your personal Facebook account.",
      link: "https://developers.facebook.com/",
      linkText: "Open Meta Developers",
      details: [
        "Click 'Get Started' in the top right",
        "Verify your phone number and email",
        "Click 'Create App' when prompted",
      ],
    },
    {
      title: "Create Your App",
      desc: "Create a Business-type app for Sellora.",
      details: [
        "App type: select 'Business'",
        "App name: type 'Sellora'",
        "App contact email: your email",
        "Select your Meta Business Account (or create one)",
        "Click 'Create App' and complete the CAPTCHA",
      ],
    },
    {
      title: "Add WhatsApp to Your App",
      desc: "Add the WhatsApp product to start using the API.",
      details: [
        "On the dashboard, scroll to 'Add Product to Your App'",
        "Find 'WhatsApp' (green icon) and click 'Set Up'",
        "Select your Meta Business Account → click Continue",
        "A test phone number is auto-created — note it down",
      ],
    },
    {
      title: "Get Your Credentials",
      desc: "Copy your Phone Number ID and Access Token.",
      details: [
        "Go to WhatsApp → API Setup (left sidebar)",
        "Copy the 'Phone Number ID' (a long number like 106211539820474)",
        "Copy the 'Temporary Access Token' (starts with EAAG...)",
        "Save both — you'll paste them in Sellora",
      ],
    },
    {
      title: "Connect in Sellora",
      desc: "Enter your credentials in Sellora's Settings.",
      details: [
        "Go to Sellora Dashboard → Settings → Connected Channels",
        "Find the WhatsApp card → click 'Enter WhatsApp Credentials'",
        "Paste your Phone Number ID",
        "Paste your Access Token",
        "Click 'Save'",
      ],
    },
    {
      title: "Set Up the Webhook (Critical)",
      desc: "This is how Sellora receives messages from WhatsApp.",
      details: [
        "In Meta Developer → WhatsApp → Configuration (left sidebar)",
        "Scroll to 'Webhook' → click 'Edit'",
        "Callback URL: https://sellora-ruby.vercel.app/api/webhooks/whatsapp",
        "Verify Token: sellora_verify_2024",
        "Click 'Verify and Save'",
        "After verification, scroll to 'Webhook Fields'",
        "Find 'messages' → click 'Subscribe' (must turn to 'Unsubscribe')",
      ],
      warning: "If you skip the 'Subscribe' step, messages will NOT arrive even if the webhook is verified.",
    },
    {
      title: "Add a Real WhatsApp Number (Optional)",
      desc: "The test number has limitations. Add your real business number.",
      details: [
        "Go to business.facebook.com → WhatsApp → Phone Numbers",
        "Click 'Add Phone Number'",
        "Enter your business number (must NOT already have WhatsApp)",
        "Verify via SMS or call",
        "Go back to Meta Developer → WhatsApp → API Setup",
        "Select your new number from the dropdown",
        "Copy the NEW Phone Number ID and update it in Sellora",
      ],
    },
    {
      title: "Make the Token Permanent (Important)",
      desc: "The temporary token expires in 24 hours. Get a permanent one.",
      details: [
        "In Meta Developer → Settings → Basic (left sidebar)",
        "Fill in Privacy Policy URL: https://sellora-ruby.vercel.app/privacy",
        "Fill in Terms of Service URL: https://sellora-ruby.vercel.app/terms",
        "Click 'Save Changes'",
        "Go to 'System Users' (left sidebar) → click 'Add'",
        "Name: Sellora Production → Role: Admin",
        "Click 'Add Assets' → select your App → check 'Manage app'",
        "Click 'Generate New Token' → select your App → expiration: 'Never'",
        "Select permissions: whatsapp_business_messaging + whatsapp_business_management",
        "Click 'Generate' → copy the permanent token",
        "Update it in Sellora → Settings → Channels → WhatsApp (replace temporary token)",
      ],
    },
  ],
  instagram: [
    {
      title: "Prerequisites",
      desc: "You need an Instagram Business or Creator account linked to a Facebook Page.",
      details: [
        "Open Instagram → Settings → Account → Switch to Professional Account",
        "Choose 'Business' or 'Creator'",
        "Go to Meta Business Suite (business.facebook.com)",
        "Link your Instagram account to your Facebook Page",
        "Your Instagram must be a Business/Creator account (not personal)",
      ],
      warning: "If your Instagram is a personal account, automation will NOT work. Switch to Business first.",
    },
    {
      title: "Configure Your Meta App",
      desc: "Add Instagram permissions to your existing Meta App.",
      details: [
        "Go to developers.facebook.com → your Sellora app",
        "Left sidebar → 'Products' → find 'Instagram Graph API'",
        "If not added, click 'Set Up'",
        "Go to App Review → Permissions and Features",
        "Request: instagram_manage_messages, pages_show_list, pages_messaging",
        "For development: these are auto-approved for test users",
      ],
    },
    {
      title: "Get Your Page ID + Access Token",
      desc: "You need your Instagram-linked Facebook Page ID and a Page Access Token.",
      details: [
        "Go to Meta Graph API Explorer: developers.facebook.com/tools/explorer/",
        "Select your app from the dropdown",
        "Add permissions: pages_show_list, pages_messaging, instagram_basic, instagram_manage_messages",
        "Click 'Generate Access Token'",
        "Call: GET /me/accounts → returns your Page ID + access token",
        "Copy the Page ID and the access token",
      ],
    },
    {
      title: "Connect in Sellora",
      desc: "Enter your credentials in Sellora.",
      details: [
        "Go to Sellora Dashboard → Settings → Connected Channels",
        "Find the Instagram card → click 'Connect with Meta'",
        "OR click 'Enter Manually'",
        "Paste your Instagram Page ID",
        "Paste your Page Access Token",
        "Click 'Save'",
      ],
    },
    {
      title: "Set Up Instagram Webhook",
      desc: "So Sellora receives Instagram DMs.",
      details: [
        "In Meta Developer → your app → Products → Webhooks",
        "Click 'Edit' under Webhooks",
        "Callback URL: https://sellora-ruby.vercel.app/api/webhooks/instagram",
        "Verify Token: sellora_verify_2024",
        "Click 'Verify and Save'",
        "Subscribe to: messages, messaging_postbacks, messaging_deliveries",
      ],
    },
    {
      title: "Test It",
      desc: "Send a DM to your Instagram Business account from another account.",
      details: [
        "Open Instagram from a different account (or ask a friend)",
        "Send a DM to your business account: 'Hi! Do you have any products?'",
        "Check Sellora Dashboard → Conversations",
        "The message should appear within 5-10 seconds",
        "If AI is enabled, it should auto-reply on Instagram",
      ],
    },
  ],
  facebook: [
    {
      title: "Prerequisites",
      desc: "You need a Facebook Page (not a personal profile).",
      details: [
        "Go to facebook.com/pages/create",
        "Choose 'Business or Brand'",
        "Fill in your Page name, category, and description",
        "Click 'Create Page'",
        "You must be an Admin of the Page",
      ],
    },
    {
      title: "Configure Your Meta App",
      desc: "Add Facebook Messenger permissions.",
      details: [
        "Go to developers.facebook.com → your Sellora app",
        "Left sidebar → 'Products' → 'Messenger' (or 'Messenger Platform')",
        "If not added, click 'Set Up'",
        "Go to App Review → Permissions and Features",
        "Ensure: pages_messaging, pages_show_list are enabled",
        "For development mode: add yourself as a test user",
      ],
    },
    {
      title: "Get Your Page ID + Access Token",
      desc: "Same process as Instagram — they share the Meta ecosystem.",
      details: [
        "Go to Meta Graph API Explorer: developers.facebook.com/tools/explorer/",
        "Select your app",
        "Add permissions: pages_show_list, pages_messaging",
        "Click 'Generate Access Token'",
        "Call: GET /me/accounts → returns your Page ID + access token",
        "Copy the Page ID (for Facebook, not Instagram)",
        "Copy the Page Access Token",
      ],
    },
    {
      title: "Connect in Sellora",
      desc: "Enter your Facebook credentials.",
      details: [
        "Go to Sellora Dashboard → Settings → Connected Channels",
        "Find the Facebook card → click 'Connect with Meta'",
        "OR click 'Enter Manually'",
        "Paste your Facebook Page ID",
        "Paste your Page Access Token",
        "Click 'Save'",
      ],
    },
    {
      title: "Set Up Facebook Webhook",
      desc: "So Sellora receives Facebook Messenger messages.",
      details: [
        "In Meta Developer → your app → Products → Webhooks",
        "Click 'Edit' under Webhooks",
        "Callback URL: https://sellora-ruby.vercel.app/api/webhooks/facebook",
        "Verify Token: sellora_verify_2024",
        "Click 'Verify and Save'",
        "Subscribe to: messages, messaging_postbacks, messaging_deliveries",
      ],
    },
    {
      title: "Test It",
      desc: "Send a message to your Facebook Page.",
      details: [
        "Open Facebook from a different account (or ask a friend)",
        "Go to your Facebook Page → click 'Send Message'",
        "Type: 'Hi! What products do you have?'",
        "Check Sellora Dashboard → Conversations",
        "The message should appear within 5-10 seconds",
        "If AI is enabled, it should auto-reply on Messenger",
      ],
    },
  ],
};

export default function SetupGuidePage() {
  const [activeChannel, setActiveChannel] = useState("whatsapp");
  const [openSteps, setOpenSteps] = useState({});

  const channels = [
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "#25D366", time: "~15 min" },
    { key: "instagram", label: "Instagram", icon: Camera, color: "#E1306C", time: "~10 min" },
    { key: "facebook", label: "Facebook", icon: Globe, color: "#1877F2", time: "~10 min" },
  ];

  const toggleStep = (idx) => setOpenSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
  const currentSteps = STEPS[activeChannel] || [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary, #191A23)", color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img src="/logo.png" alt="Sellora" style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 16 }} />
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Connect Your Channels</h1>
          <p style={{ color: "var(--text-tertiary, rgba(255,255,255,0.4))", fontSize: 15, marginTop: 8 }}>
            Step-by-step guide to connect WhatsApp, Instagram, and Facebook to your Sellora dashboard.
          </p>
        </div>

        {/* Channel selector */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32, justifyContent: "center", flexWrap: "wrap" }}>
          {channels.map(ch => {
            const Icon = ch.icon;
            const isActive = activeChannel === ch.key;
            return (
              <button
                key={ch.key}
                onClick={() => { setActiveChannel(ch.key); setOpenSteps({}); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "14px 24px", borderRadius: 12,
                  background: isActive ? ch.color + "15" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? ch.color + "40" : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer", transition: "all 0.2s ease",
                  color: isActive ? ch.color : "var(--text-secondary, rgba(255,255,255,0.6))",
                }}
              >
                <Icon size={20} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{ch.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{ch.time}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {currentSteps.map((step, idx) => {
            const isOpen = openSteps[idx];
            return (
              <div key={idx} style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${isOpen ? "rgba(88,101,242,0.2)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s ease",
              }}>
                <button onClick={() => toggleStep(idx)} style={{
                  display: "flex", alignItems: "center", gap: 14, width: "100%",
                  padding: "16px 20px", background: "transparent", border: "none",
                  cursor: "pointer", textAlign: "left", color: "#fff",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "linear-gradient(135deg, #5865F2, #00D2FF)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 800, flexShrink: 0,
                  }}>{idx + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{step.title}</div>
                    {!isOpen && <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{step.desc}</div>}
                  </div>
                  {isOpen ? <ChevronDown size={18} color="var(--text-tertiary)" /> : <ChevronRight size={18} color="var(--text-tertiary)" />}
                </button>
                {isOpen && (
                  <div style={{ padding: "0 20px 20px 66px" }}>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 12px 0" }}>{step.desc}</p>
                    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px 0" }}>
                      {step.details.map((detail, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", fontSize: 13, color: "var(--text-secondary)" }}>
                          <Check size={14} color="#3BA55C" style={{ marginTop: 2, flexShrink: 0 }} />
                          <span style={{ lineHeight: 1.5 }}>{detail}</span>
                        </li>
                      ))}
                    </ul>
                    {step.warning && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", marginBottom: 12, background: "rgba(248,165,50,0.08)", border: "1px solid rgba(248,165,50,0.2)", borderRadius: 10 }}>
                        <AlertCircle size={16} color="#F8A532" style={{ marginTop: 1, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#F8A532", lineHeight: 1.5 }}>{step.warning}</span>
                      </div>
                    )}
                    {step.link && (
                      <a href={step.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #5865F2, #00D2FF)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                        {step.linkText || "Open Link"} <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick links */}
        <div style={{ marginTop: 40, padding: 20, background: "rgba(88,101,242,0.05)", border: "1px solid rgba(88,101,242,0.15)", borderRadius: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Quick Links</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { href: "https://developers.facebook.com/", text: "Meta Developer Dashboard" },
              { href: "https://business.facebook.com/", text: "Meta Business Suite" },
              { href: "https://developers.facebook.com/tools/explorer/", text: "Graph API Explorer" },
              { href: "/dashboard/settings?tab=channels", text: "Sellora Channel Settings" },
            ].map(link => (
              <a key={link.href} href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none", color: "var(--text-secondary)", fontSize: 13 }}>
                <span>{link.text}</span>
                <ArrowRight size={13} color="var(--text-tertiary)" />
              </a>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: "center", paddingBottom: 40 }}>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
            Need help? <a href="/help" style={{ color: "#7E88F5" }}>Visit Help Center</a> or <a href="mailto:support@sellora.app" style={{ color: "#7E88F5" }}>email support</a>
          </p>
        </div>
      </div>
    </div>
  );
}
