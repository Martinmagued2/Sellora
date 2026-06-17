"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MessageCircle,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  Search,
  Menu,
  X,
  Megaphone,
  Bot,
  HelpCircle,
  LogOut,
  Clock,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Info,
  Shield,
  Bell,
  Star,
  Tag,
  ShoppingCart,
  Target,
  Webhook,
  Sparkles,
  Gift,
  Download,
  FlaskConical,
  Smartphone,
  Store,
  Truck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAdminAuth } from "@/lib/use-admin-auth";
import { StoreProvider } from "@/lib/store-context";
import { useDevice } from "@/lib/use-device";
import PageTransition from "@/components/PageTransition";
import DashboardAnimations from "@/components/DashboardAnimations";

import CopilotPanel from "./components/CopilotPanel";
import NotificationBell from "./components/NotificationBell";
import ToastProvider, { useToast } from "./components/ToastProvider";
import ConfirmProvider from "./components/ConfirmProvider";
import InstallPrompt from "./components/InstallPrompt";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import StoreSwitcher from "./components/StoreSwitcher";
import BottomNav from "./components/BottomNav";
import "./dashboard.css";

const sidebarLinks = [
  {
    section: "Main",
    links: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/dashboard/conversations", icon: MessageCircle, label: "Conversations", badgeKey: "conversations" },
      { href: "/dashboard/orders", icon: ShoppingBag, label: "Orders", badgeKey: "orders" },
      { href: "/dashboard/abandoned-carts", icon: ShoppingCart, label: "Abandoned Carts" },
      { href: "/dashboard/notifications", icon: Bell, label: "Notifications" },
      { href: "/dashboard/referrals", icon: Gift, label: "Referrals" },
    ],
  },
  {
    section: "Manage",
    links: [
      { href: "/dashboard/products", icon: Package, label: "Products" },
      { href: "/dashboard/customers", icon: Users, label: "Customers" },
      { href: "/dashboard/campaigns", icon: Megaphone, label: "Campaigns" },
      { href: "/dashboard/segments", icon: Target, label: "Segments" },
      { href: "/dashboard/coupons", icon: Tag, label: "Coupons" },
      { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
      { href: "/dashboard/webhooks", icon: Webhook, label: "Webhooks" },
      { href: "/dashboard/automation", icon: Bot, label: "Automation" },
      { href: "/dashboard/ai-personality", icon: Sparkles, label: "AI Personality" },
      { href: "/dashboard/ab-tests", icon: FlaskConical, label: "A/B Tests" },
      { href: "/dashboard/reviews", icon: Star, label: "Reviews" },
      { href: "/dashboard/whatsapp-catalog", icon: Smartphone, label: "WA Catalog" },
      { href: "/dashboard/stores", icon: Store, label: "Stores" },
      { href: "/dashboard/shipping", icon: Truck, label: "Shipping" },
    ],
  },
  {
    section: "Settings",
    links: [
      { href: "/dashboard/settings", icon: Settings, label: "Settings" },
      { href: "/dashboard/billing", icon: CreditCard, label: "Billing" },
    ],
  },
];

const adminLink = { href: "/admin", icon: Shield, label: "Admin Panel" };

const pageTitles = {
  "/dashboard": "Dashboard",
  "/dashboard/conversations": "Conversations",
  "/dashboard/orders": "Orders",
  "/dashboard/notifications": "Notifications",
  "/dashboard/products": "Products",
  "/dashboard/customers": "Customers",
  "/dashboard/campaigns": "Campaigns",
  "/dashboard/segments": "Segments",
  "/dashboard/coupons": "Coupons",
  "/dashboard/analytics": "Analytics",
  "/dashboard/settings": "Settings",
  "/dashboard/billing": "Billing",
  "/dashboard/automation": "Automation",
  "/dashboard/abandoned-carts": "Abandoned Carts",
  "/dashboard/webhooks": "Webhooks",
  "/dashboard/ai-personality": "AI Personality",
  "/dashboard/ab-tests": "A/B Tests",
  "/dashboard/whatsapp-catalog": "WA Catalog",
  "/dashboard/referrals": "Referrals",
  "/dashboard/stores": "Stores",
  "/dashboard/shipping": "Shipping",
};

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { isMobile } = useDevice();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [accountStatus, setAccountStatus] = useState(null);
  const { isAdmin: isAdminUser } = useAdminAuth();
  const [sidebarBadges, setSidebarBadges] = useState({ conversations: 0, orders: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchRef = useRef(null);

  const currentTitle = pageTitles[pathname] || "Dashboard";

  useEffect(() => {
    const supabase = createClient();

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data } = await supabase.from("accounts").select("plan, plan_status, subscription_ends_at, trial_ends_at").eq("id", user.id).single();
        if (data) setAccountStatus(data);
      }
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch sidebar badges (unread conversations + pending orders)
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    const fetchBadges = async () => {
      try {
        const [convRes, orderRes] = await Promise.all([
          supabase.from("conversations").select("id", { count: "exact", head: true }).eq("account_id", user.id).in("status", ["new", "open"]),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("account_id", user.id).in("status", ["pending", "confirmed"]),
        ]);
        setSidebarBadges({
          conversations: convRes.count || 0,
          orders: orderRes.count || 0,
        });
      } catch (e) {
        // Silently fail — badges are nice-to-have
      }
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [user]);

  // Global search handler
  useEffect(() => {
    if (!user || !searchQuery.trim()) { setSearchResults([]); return; }
    const supabase = createClient();
    const q = searchQuery.trim();

    const doSearch = async () => {
      try {
        const [convRes, orderRes, prodRes, custRes] = await Promise.all([
          supabase.from("conversations").select("id, status, channel, customer:customers(name)").eq("account_id", user.id).ilike("customer.name", `%${q}%`).limit(3),
          supabase.from("orders").select("id, order_number, status, total").eq("account_id", user.id).ilike("order_number", `%${q}%`).limit(3),
          supabase.from("products").select("id, name, price, category").eq("account_id", user.id).ilike("name", `%${q}%`).limit(3),
          supabase.from("customers").select("id, name, email, channel").eq("account_id", user.id).ilike("name", `%${q}%`).limit(3),
        ]);

        const results = [];
        if (convRes.data?.length) results.push(...convRes.data.map(c => ({ type: "Conversation", label: c.customer?.name || c.id, sub: c.channel, href: "/dashboard/conversations" })));
        if (orderRes.data?.length) results.push(...orderRes.data.map(o => ({ type: "Order", label: o.order_number || o.id, sub: `${o.status} · EGP ${o.total}`, href: "/dashboard/orders" })));
        if (prodRes.data?.length) results.push(...prodRes.data.map(p => ({ type: "Product", label: p.name, sub: `${p.category} · EGP ${p.price}`, href: "/dashboard/products" })));
        if (custRes.data?.length) results.push(...custRes.data.map(c => ({ type: "Customer", label: c.name, sub: c.email || c.channel, href: "/dashboard/customers" })));
        setSearchResults(results.slice(0, 8));
      } catch (e) {
        setSearchResults([]);
      }
    };

    const debounce = setTimeout(doSearch, 300);
    return () => clearTimeout(debounce);
  }, [user, searchQuery]);

  // Close search panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Get initials for avatar
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.business_name || user?.email || "User";
  const initials = userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const isExpired = accountStatus?.plan_status === "expired" || (accountStatus?.subscription_ends_at && new Date(accountStatus.subscription_ends_at) < new Date());
  const isLockedOut = isExpired && pathname !== "/dashboard/billing";

  // Trial Logic
  let trialDaysLeft = null;
  let isTrialExpired = false;
  if (accountStatus?.plan === "starter" && accountStatus?.trial_ends_at) {
    const trialEnd = new Date(accountStatus.trial_ends_at);
    const now = new Date();
    if (trialEnd > now) {
      trialDaysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    } else {
      isTrialExpired = true;
    }
  }

  return (
    <StoreProvider>
    <ToastProvider>
    <ConfirmProvider>
    <ServiceWorkerRegistration />
    <DashboardAnimations />
    <div className={`dashboard-layout${isMobile ? " mobile-layout" : ""}`}>
      {/* Sidebar — only on desktop / tablet */}
      {!isMobile && (
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <Link href="/" className="sidebar-logo">
              <img src="/logo.png" alt="Sellora" style={{ width: 28, height: 28, borderRadius: 6 }} />
              <span>
                Sell<span className="text-gradient-static">ora</span>
              </span>
            </Link>
            <button
              className="sidebar-close"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <nav className="sidebar-nav">
            {sidebarLinks.map((section, i) => (
              <div className="sidebar-section" key={i}>
                <div className="sidebar-section-title">{section.section}</div>
                {section.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`sidebar-link ${isActive ? "active" : ""}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sidebar-link-icon">
                        <Icon size={18} />
                      </span>
                      {link.label}
                      {link.badgeKey && sidebarBadges[link.badgeKey] > 0 && (
                        <span className="sidebar-link-badge">{sidebarBadges[link.badgeKey]}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
            {/* Admin Panel Link - only visible to admin users */}
            {isAdminUser && (
              <div className="sidebar-section">
                <div className="sidebar-section-title">Admin</div>
                <Link
                  href={adminLink.href}
                  className={`sidebar-link ${pathname?.startsWith("/admin") ? "active" : ""}`}
                  style={{ color: "var(--accent-orange)" }}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sidebar-link-icon">
                    <Shield size={18} />
                  </span>
                  {adminLink.label}
                </Link>
              </div>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">{initials}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">
                  {user?.user_metadata?.business_name || user?.user_metadata?.full_name || "My Store"}
                </div>
                <div className="sidebar-user-plan">
                  {user?.email || "Free Trial"}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="sidebar-link"
              style={{ marginTop: "var(--space-sm)", color: "var(--text-tertiary)" }}
              title="Log out"
            >
              <span className="sidebar-link-icon"><LogOut size={18} /></span>
              Log Out
            </button>
          </div>
        </aside>
      )}

      {/* Mobile overlay for sidebar — only needed on tablet */}
      {!isMobile && (
        <div
          className={`sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="dashboard-main">
        {/* Trial Banner */}
        {accountStatus?.plan === "starter" && (trialDaysLeft !== null || isTrialExpired) && (
          <div className="trial-banner" style={{
            background: isTrialExpired ? "var(--accent-orange)" : "var(--accent-primary-light)",
            color: "white", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "center",
            gap: "var(--space-md)", fontSize: "var(--font-size-sm)", fontWeight: 600, zIndex: 10,
            flexWrap: "wrap"
          }}>
            {isTrialExpired ? (
              <>
                <Megaphone size={16} />
                Your 14-day free trial has expired. You are currently on the restricted Starter plan.
                <button className="btn btn-secondary btn-sm" style={{ background: "white", color: "var(--accent-orange)", marginLeft: "var(--space-sm)", border: "none" }} onClick={() => router.push("/dashboard/billing")}>Upgrade Now</button>
              </>
            ) : (
              <>
                <Clock size={16} />
                You have {trialDaysLeft} days left in your Pro trial.
                <button className="btn btn-secondary btn-sm" style={{ background: "white", color: "var(--accent-primary)", marginLeft: "var(--space-sm)", border: "none" }} onClick={() => router.push("/dashboard/billing")}>View Plans</button>
              </>
            )}
          </div>
        )}

        {/* Topbar — mobile vs desktop */}
        <header className={`topbar${isMobile ? " mobile-topbar" : ""}`}>
          <div className="topbar-left">
            {isMobile ? (
              /* Mobile: show logo + title */
              <>
                <Link href="/dashboard" className="topbar-logo-mobile">
                  <img src="/logo.png" alt="Sellora" style={{ width: 28, height: 28, borderRadius: 6 }} />
                </Link>
                <h1 className="topbar-title">{currentTitle}</h1>
              </>
            ) : (
              /* Desktop: show hamburger + title */
              <>
                <button
                  className="topbar-mobile-toggle"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu size={20} />
                </button>
                <h1 className="topbar-title">{currentTitle}</h1>
              </>
            )}
          </div>

          {/* Desktop search */}
          {!isMobile && (
            <div className="topbar-search" ref={searchRef} style={{ position: "relative" }}>
              <Search size={16} className="topbar-search-icon" />
              <input
                type="text"
                className="topbar-search-input"
                placeholder="Search conversations, orders, products..."
                id="dashboard-search"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
              />
              {showSearch && searchQuery.trim() && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                  background: "var(--bg-elevated)", borderRadius: "0 0 12px 12px",
                  boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)",
                  borderTop: "none", maxHeight: 320, overflowY: "auto"
                }}>
                  {searchResults.length === 0 ? (
                    <div style={{ padding: "16px", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>No results found</div>
                  ) : searchResults.map((r, i) => (
                    <button key={i} onClick={() => { router.push(r.href); setShowSearch(false); setSearchQuery(""); }} style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 16px",
                      background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)",
                      textAlign: "left", fontSize: "var(--font-size-sm)"
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-primary)", minWidth: 80 }}>{r.type}</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{r.sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="topbar-right">
            {!isMobile && <StoreSwitcher />}
            <button className="topbar-btn" id="topbar-ai" title="Sellora Agent" onClick={() => document.getElementById("copilot-toggle")?.click()}>
              <Bot size={18} />
            </button>
            <div style={{ position: "relative" }}>
              <NotificationBell />
            </div>
            {!isMobile && (
              <div style={{ position: "relative" }}>
                <button className="topbar-btn topbar-help-btn" id="topbar-help" title="Help & Support" onClick={() => setHelpOpen(!helpOpen)}>
                  <HelpCircle size={18} />
                </button>
                {helpOpen && (
                  <div style={{
                    position: "absolute", right: 0, top: "100%", marginTop: 8, width: 280,
                    background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                    padding: "var(--space-lg)", zIndex: 1000,
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: "var(--space-md)" }}>Help & Support</div>
                    <a href="mailto:support@sellora.com" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "var(--text-secondary)", fontSize: "var(--font-size-sm)", textDecoration: "none" }}>
                      <MessageCircle size={14} /> support@sellora.com
                    </a>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "var(--text-secondary)", fontSize: "var(--font-size-sm)" }}>
                      <Bot size={14} /> Use the AI Copilot (purple button)
                    </div>
                    <Link href="/dashboard/settings?tab=webhooks" onClick={() => setHelpOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: "var(--text-secondary)", fontSize: "var(--font-size-sm)", textDecoration: "none" }}>
                      <Settings size={14} /> Webhook Integrations
                    </Link>
                  </div>
                )}
              </div>
            )}
            <button className="topbar-btn topbar-search-toggle" title="Search" onClick={() => setShowMobileSearch(true)}>
              <Search size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="page-content" style={{ position: "relative" }}>
          {isLockedOut && (
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(4px)",
              zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10vh"
            }}>
              <div className="glass-card" style={{ padding: "var(--space-2xl)", maxWidth: 400, textAlign: "center", boxShadow: "var(--shadow-glow)" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255, 82, 82, 0.1)", color: "var(--accent-red)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto var(--space-lg)" }}>
                  <CreditCard size={32} />
                </div>
                <h2 style={{ marginBottom: "var(--space-md)" }}>Subscription Expired</h2>
                <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-xl)" }}>
                  Your platform access has been temporarily paused. Please upgrade your plan to unlock your dashboard and continue processing messages.
                </p>
                <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => router.push('/dashboard/billing')}>
                  Upgrade Now
                </button>
              </div>
            </div>
          )}
          <PageTransition>
          <div style={{ 
            pointerEvents: isLockedOut ? "none" : "auto", 
            userSelect: isLockedOut ? "none" : "auto", 
            filter: isLockedOut ? "blur(3px) grayscale(50%)" : "none",
            opacity: isLockedOut ? 0.7 : 1,
            transition: "all 0.3s ease" 
          }}>
            {children}
          </div>
          </PageTransition>
        </div>
      </main>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div className="topbar-search-mobile open">
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px", borderBottom: "1px solid var(--border)" }}>
            <Search size={18} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search conversations, orders, products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: "var(--font-size-md)", color: "var(--text-primary)" }}
            />
            <button
              onClick={() => { setShowMobileSearch(false); setSearchQuery(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>
          {searchQuery.trim() && (
            <div style={{ padding: "8px 0", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
              {searchResults.length === 0 ? (
                <div style={{ padding: "16px", color: "var(--text-tertiary)", fontSize: "var(--font-size-sm)" }}>No results found</div>
              ) : searchResults.map((r, i) => (
                <button key={i} onClick={() => { router.push(r.href); setShowMobileSearch(false); setSearchQuery(""); }} style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 16px",
                  background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)",
                  textAlign: "left", fontSize: "var(--font-size-sm)"
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-primary)", minWidth: 80 }}>{r.type}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{r.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Copilot Assistant Panel */}
      <CopilotPanel />

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNav sidebarBadges={sidebarBadges} />}
    </div>
    </ConfirmProvider>
    </ToastProvider>
    </StoreProvider>
  );
}
