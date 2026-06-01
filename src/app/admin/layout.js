"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  Mail,
  ShoppingBag,
  Package,
  Bot,
  Server,
  Megaphone,
  Menu,
  X,
  ArrowLeft,
  Shield,
  Activity,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import "../dashboard/dashboard.css";
import "./admin.css";

const ADMIN_ACCOUNT_ID = "0643bcc3-d5ef-43e1-a1be-0b36de04ef92";

const sidebarLinks = [
  {
    section: "Admin",
    links: [
      { href: "/admin", icon: LayoutDashboard, label: "Overview" },
      { href: "/admin/accounts", icon: Users, label: "Accounts" },
      { href: "/admin/conversations", icon: MessageCircle, label: "Conversations" },
      { href: "/admin/messages", icon: Mail, label: "Messages" },
    ],
  },
  {
    section: "Commerce",
    links: [
      { href: "/admin/orders", icon: ShoppingBag, label: "Orders" },
      { href: "/admin/products", icon: Package, label: "Products" },
    ],
  },
  {
    section: "Platform",
    links: [
      { href: "/admin/ai-performance", icon: Bot, label: "AI Performance" },
      { href: "/admin/system", icon: Server, label: "System Health" },
      { href: "/admin/broadcast", icon: Megaphone, label: "Broadcast" },
    ],
  },
];

const pageTitles = {
  "/admin": "Admin Overview",
  "/admin/accounts": "Accounts",
  "/admin/conversations": "Conversations",
  "/admin/messages": "Messages",
  "/admin/orders": "Orders & Revenue",
  "/admin/products": "Products",
  "/admin/ai-performance": "AI Performance",
  "/admin/system": "System Health",
  "/admin/broadcast": "Broadcast",
};

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentTitle = pageTitles[pathname] || "Admin";

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user && user.id === ADMIN_ACCOUNT_ID) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          router.push("/dashboard");
        }
      } catch (e) {
        setIsAdmin(false);
        router.push("/dashboard");
      }
      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-tertiary)",
        fontSize: "var(--font-size-lg)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <Shield size={24} className="spin" />
          Verifying admin access...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--accent-red)",
        fontSize: "var(--font-size-lg)",
        flexDirection: "column",
        gap: "var(--space-md)",
      }}>
        <Shield size={48} />
        <h2>Access Denied</h2>
        <p style={{ color: "var(--text-tertiary)" }}>You do not have admin privileges.</p>
        <Link href="/dashboard" className="btn btn-secondary">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="dashboard-layout admin-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <Link href="/admin" className="admin-sidebar-brand">
            <span className="admin-sidebar-brand-icon">
              <Shield size={16} />
            </span>
            <span>
              Sell<span className="text-gradient-static">ora</span>
            </span>
            <span className="admin-badge">ADMIN</span>
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
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link
            href="/dashboard"
            className="sidebar-link"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span className="sidebar-link-icon">
              <ArrowLeft size={18} />
            </span>
            Back to Dashboard
          </Link>
          <div style={{ 
            display: "flex", alignItems: "center", gap: "var(--space-sm)", 
            padding: "var(--space-sm) var(--space-md)", marginTop: "var(--space-sm)",
            background: "rgba(232, 67, 39, 0.06)", borderRadius: "var(--radius-md)",
            border: "1px solid rgba(232, 67, 39, 0.1)",
          }}>
            <Shield size={14} style={{ color: "#E84327" }} />
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>
              Admin Mode Active
            </span>
            <Activity size={10} style={{ color: "var(--accent-green)", marginLeft: "auto" }} />
          </div>
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
            <span className="admin-badge" style={{ fontSize: 9, padding: "2px 8px" }}>ADMIN</span>
          </div>

          <div className="topbar-right">
            <Link
              href="/dashboard"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-xs)",
                padding: "6px 14px",
                borderRadius: "var(--radius-full)",
                background: "var(--bg-glass)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                fontSize: "var(--font-size-xs)",
                fontWeight: 500,
                textDecoration: "none",
                transition: "all var(--transition-fast)",
              }}
            >
              <ArrowLeft size={14} />
              Dashboard
            </Link>
          </div>
        </header>

        {/* Page content */}
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
