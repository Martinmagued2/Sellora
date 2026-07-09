"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageCircle,
  ShoppingBag,
  Package,
  MoreHorizontal,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  Megaphone,
  Bot,
  Bell,
  Tag,
  ShoppingCart,
  Target,
  Webhook,
  Sparkles,
  Gift,
  FlaskConical,
  Smartphone,
  Store,
  Truck,
  X,
  LogOut,
  Shield,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAdminAuth } from "@/lib/use-admin-auth";

/* Bottom nav shows 5 items: 4 main + "More" */
const mainNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/dashboard/conversations", icon: MessageCircle, label: "Chats", badgeKey: "conversations" },
  { href: "/dashboard/orders", icon: ShoppingBag, label: "Orders", badgeKey: "orders" },
  { href: "/dashboard/products", icon: Package, label: "Products" },
];

const moreNavItems = [
  { section: "Main", items: [
    { href: "/dashboard/abandoned-carts", icon: ShoppingCart, label: "Abandoned Carts" },
    { href: "/dashboard/notifications", icon: Bell, label: "Notifications" },
    { href: "/dashboard/referrals", icon: Gift, label: "Referrals" },
  ]},
  { section: "Manage", items: [
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
  ]},
  { section: "Settings", items: [
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
    { href: "/dashboard/billing", icon: CreditCard, label: "Billing" },
  ]},
];

export default function BottomNav({ sidebarBadges }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { isAdmin: isAdminUser } = useAdminAuth();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="bottom-nav">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const badge = item.badgeKey && sidebarBadges?.[item.badgeKey] > 0
            ? sidebarBadges[item.badgeKey]
            : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`bottom-nav-item ${isActive ? "active" : ""}`}
            >
              <span className="bottom-nav-icon-wrapper">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {badge > 0 && (
                  <span className="bottom-nav-badge">{badge > 99 ? "99+" : badge}</span>
                )}
              </span>
              <span className="bottom-nav-label">{item.label}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          className={`bottom-nav-item ${moreOpen ? "active" : ""}`}
          onClick={() => setMoreOpen(true)}
        >
          <span className="bottom-nav-icon-wrapper">
            <MoreHorizontal size={22} strokeWidth={moreOpen ? 2.5 : 1.8} />
          </span>
          <span className="bottom-nav-label">More</span>
        </button>
      </nav>

      {/* More Menu Overlay */}
      {moreOpen && (
        <div className="more-menu-overlay" onClick={() => setMoreOpen(false)}>
          <div className="more-menu-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="more-menu-header">
              <h3>Menu</h3>
              <button className="more-menu-close" onClick={() => setMoreOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="more-menu-scroll">
              {moreNavItems.map((section, i) => (
                <div key={i} className="more-menu-section">
                  <div className="more-menu-section-title">{section.section}</div>
                  <div className="more-menu-grid">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`more-menu-item ${isActive ? "active" : ""}`}
                          onClick={() => setMoreOpen(false)}
                        >
                          <span className="more-menu-item-icon">
                            <Icon size={20} />
                          </span>
                          <span className="more-menu-item-label">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Admin link */}
              {isAdminUser && (
                <div className="more-menu-section">
                  <div className="more-menu-section-title">Admin</div>
                  <div className="more-menu-grid">
                    <Link
                      href="/admin"
                      className="more-menu-item"
                      onClick={() => setMoreOpen(false)}
                      style={{ color: "var(--accent-orange)" }}
                    >
                      <span className="more-menu-item-icon">
                        <Shield size={20} />
                      </span>
                      <span className="more-menu-item-label">Admin Panel</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="more-menu-footer">
              <button className="more-menu-logout" onClick={handleLogout}>
                <LogOut size={18} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
