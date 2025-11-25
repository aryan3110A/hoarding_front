"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { notificationsAPI } from "@/lib/api";
import {
  canViewRent,
  canAccessLocationTracking,
  canAccessAdminSettings,
} from "@/lib/rbac";

interface NavbarProps {
  user: any;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Close mobile menu when route changes
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      if (response.success && response.data) {
        setUnreadCount(response.data.count || 0);
      }
    } catch (error) {
      // Silently fail
    }
  };

  const userRole = user?.role?.toLowerCase() || "";

  const menuItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: "📊",
      roles: ["owner", "manager", "sales", "designer", "fitter", "admin"],
    },
    {
      title: "Hoardings",
      href: "/hoardings",
      icon: "🏢",
      roles: ["owner", "manager", "sales", "admin"], // Fitter sees jobs via Tasks, not hoardings list
    },
    {
      title: "Bookings",
      href: "/bookings",
      icon: "📅",
      roles: ["owner", "manager", "sales", "admin"],
    },
    {
      title: "Enquiries",
      href: "/enquiries",
      icon: "📋",
      roles: ["owner", "manager", "sales", "admin"],
    },
    {
      title: "Contracts",
      href: "/contracts",
      icon: "📄",
      roles: ["owner", "manager", "admin"],
    },
    {
      title: "Vendors & Rent",
      href: "/vendors",
      icon: "💰",
      roles: ["owner", "manager", "admin"], // Sales cannot access rent
    },
    {
      title: "Users & Roles",
      href: "/users",
      icon: "👥",
      roles: ["owner", "admin"], // Only Owner can manage users/roles
    },
    {
      title: "Design",
      href: "/design",
      icon: "🎨",
      roles: ["owner", "manager", "designer", "admin"], // Designer only sees this
    },
    {
      title: "Reports",
      href: "/reports",
      icon: "📈",
      roles: ["owner", "manager", "admin"], // Sales cannot access reports
    },
    {
      title: "Tasks",
      href: "/tasks",
      icon: "✅",
      roles: ["owner", "manager", "sales", "designer", "fitter", "admin"], // Fitter sees assigned jobs here
    },
    {
      title: "Admin Settings",
      href: "/admin",
      icon: "⚙️",
      roles: ["owner", "admin"], // Only Owner
    },
    {
      title: "Notifications",
      href: "/notifications",
      icon: "🔔",
      roles: ["owner", "manager", "sales", "designer", "fitter", "admin"],
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      title: "Location",
      href: "/location",
      icon: "📍",
      roles: ["owner", "sales", "fitter", "admin"],
    },
  ];

  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const isActive = (href: string) => {
    return pathname === href;
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          {/* Logo and Brand */}
          <div className="navbar-brand">
            <h2>Shubham Advertise</h2>
            <p>Hoarding Management</p>
          </div>

          {/* Desktop Menu */}
          <div className="navbar-menu-desktop">
            {filteredMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`navbar-link ${isActive(item.href) ? "active" : ""}`}
              >
                <span className="navbar-icon">{item.icon}</span>
                <span className="navbar-text">{item.title}</span>
                {item.badge && item.badge > 0 && (
                  <span className="navbar-badge">{item.badge}</span>
                )}
              </Link>
            ))}
          </div>

          {/* User Section */}
          <div className="navbar-user-section">
            <div className="navbar-user">
              <div className="navbar-user-avatar">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="navbar-user-info">
                <div className="navbar-user-name">{user?.name}</div>
                <div className="navbar-user-role">{user?.role}</div>
              </div>
            </div>
            <button onClick={onLogout} className="navbar-logout">
              <span>Logout</span>
              <span>🚪</span>
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="navbar-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className={isMobileMenuOpen ? "open" : ""}></span>
            <span className={isMobileMenuOpen ? "open" : ""}></span>
            <span className={isMobileMenuOpen ? "open" : ""}></span>
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`navbar-menu-mobile ${isMobileMenuOpen ? "open" : ""}`}>
          {filteredMenuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`navbar-link ${isActive(item.href) ? "active" : ""}`}
            >
              <span className="navbar-icon">{item.icon}</span>
              <span className="navbar-text">{item.title}</span>
              {item.badge && item.badge > 0 && (
                <span className="navbar-badge">{item.badge}</span>
              )}
            </Link>
          ))}
          <div className="navbar-mobile-user">
            <div className="navbar-user">
              <div className="navbar-user-avatar">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="navbar-user-info">
                <div className="navbar-user-name">{user?.name}</div>
                <div className="navbar-user-role">{user?.role}</div>
              </div>
            </div>
            <button onClick={onLogout} className="navbar-logout">
              <span>Logout</span>
              <span>🚪</span>
            </button>
          </div>
        </div>
      </nav>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="navbar-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
