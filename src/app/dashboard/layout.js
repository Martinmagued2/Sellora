"use client";

import { useState, useEffect } from "react";
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
  Bell,
  Search,
  Menu,
  X,
  Megaphone,
  Bot,
  HelpCircle,
  LogOut,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CopilotPanel from "./components/CopilotPanel";
import "./dashboard.css";

const sidebarLinks = [
  {
    section: "Main",
    links: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/dashboard/conversations", icon: MessageCircle, label: "Conversations", badge: 12 },
      { href: "/dashboard/orders", icon: ShoppingBag, label: "Orders", badge: 3 },
    ],
  },
  {
    section: "Manage",
    links: [
      { href: "/dashboard/products", icon: Package, label: "Products" },
      { href: "/dashboard/customers", icon: Users, label: "Customers" },
      { href: "/dashboard/campaigns", icon: Megaphone, label: "Campaigns" },
      { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
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

const pageTitles = {
  "/dashboard": "Dashboard",
  "/dashboard/conversations": "Conversations",
  "/dashboard/orders": "Orders",
  "/dashboard/products": "Products",
  "/dashboard/customers": "Customers",
  "/dashboard/campaigns": "Campaigns",
  "/dashboard/analytics": "Analytics",
  "/dashboard/settings": "Settings",
  "/dashboard/billing": "Billing",
};

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [accountStatus, setAccountStatus] = useState(null);

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
    <div className="dashboard-layout">
      {/* Sidebar */}
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
                    {link.badge && (
                      <span className="sidebar-link-badge">{link.badge}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
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

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 99,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="dashboard-main">
        {/* Trial Banner */}
        {accountStatus?.plan === "starter" && (trialDaysLeft !== null || isTrialExpired) && (
          <div style={{
            background: isTrialExpired ? "var(--accent-orange)" : "var(--accent-primary-light)",
            color: "white", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "center",
            gap: "var(--space-md)", fontSize: "var(--font-size-sm)", fontWeight: 600, zIndex: 10
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

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="topbar-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 className="topbar-title">{currentTitle}</h1>
          </div>

          <div className="topbar-search">
            <Search size={16} className="topbar-search-icon" />
            <input
              type="text"
              className="topbar-search-input"
              placeholder="Search conversations, orders, products..."
              id="dashboard-search"
            />
          </div>

          <div className="topbar-right">
            <button className="topbar-btn" id="topbar-ai" title="Sellora Agent" onClick={() => document.getElementById("copilot-toggle")?.click()}>
              <Bot size={18} />
            </button>
            <button className="topbar-btn" id="topbar-notifications" title="Notifications" onClick={() => alert("Notification center coming soon!")}>
              <Bell size={18} />
              <span className="topbar-btn-dot" />
            </button>
            <button className="topbar-btn" id="topbar-help" title="Help" onClick={() => alert("Help Center & Documentation coming soon!")}>
              <HelpCircle size={18} />
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
          <div style={{ 
            pointerEvents: isLockedOut ? "none" : "auto", 
            userSelect: isLockedOut ? "none" : "auto", 
            filter: isLockedOut ? "blur(3px) grayscale(50%)" : "none",
            opacity: isLockedOut ? 0.7 : 1,
            transition: "all 0.3s ease" 
          }}>
            {children}
          </div>
        </div>
      </main>

      {/* Copilot Assistant Panel */}
      <CopilotPanel />
    </div>
  );
}
