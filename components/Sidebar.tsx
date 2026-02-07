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

interface SidebarProps {
  user: any;
  onLogout: () => void;
}

export default function Sidebar({ user, onLogout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

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
      roles: ["owner", "manager", "sales", "designer", "supervisor", "accountant", "admin"],
    },
    {
      title: "Supervisor",
      href: "/dashboard/supervisor",
      icon: "🛠️",
      roles: ["supervisor", "owner", "manager", "admin"],
    },
    {
      title: "Accountant",
      href: "/dashboard/accountant",
      icon: "💼",
      roles: ["accountant", "owner", "manager", "admin"],
    },
    {
      title: "Hoardings",
      href: "/hoardings",
      icon: "🏢",
      roles: ["owner", "manager", "sales", "admin"], // Sales can view only
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
      roles: ["owner", "manager", "accountant", "admin"], // Sales cannot access
    },
    {
      title: "Vendors & Rent",
      href: "/vendors",
      icon: "💰",
      roles: ["owner", "manager", "admin"], // Only Owner/Manager can view rent
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
      roles: ["owner", "manager", "accountant", "admin"], // Sales cannot access reports
    },
    {
      title: "Tasks",
      href: "/tasks",
      icon: "✅",
      roles: ["owner", "manager", "sales", "designer", "supervisor", "admin"], // All roles see tasks (filtered by role)
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
      roles: ["owner", "manager", "sales", "designer", "supervisor", "accountant", "admin"],
      badge: unreadCount > 0 ? unreadCount : null,
    },
    {
      title: "Location",
      href: "/location",
      icon: "📍",
      roles: ["owner", "sales", "supervisor", "admin"], // Only Owner, Sales, Supervisor
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
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          {!isCollapsed && (
            <div className="sidebar-logo">
              <h2>Shubham Advertise</h2>
              <p>Hoarding Management</p>
            </div>
          )}
          <button
            className="sidebar-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? "→" : "←"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive(item.href) ? "active" : ""}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {!isCollapsed && (
                <>
                  <span className="sidebar-text">{item.title}</span>
                  {item.badge && item.badge > 0 && (
                    <span
                      style={{
                        background: "#ef4444",
                        color: "white",
                        borderRadius: "12px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontWeight: "600",
                        marginLeft: "auto",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            {!isCollapsed && (
              <>
                <div className="sidebar-user-avatar">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{user?.name}</div>
                  <div className="sidebar-user-role">{user?.role}</div>
                </div>
              </>
            )}
            {isCollapsed && (
              <div className="sidebar-user-avatar-collapsed">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <button onClick={onLogout} className="sidebar-logout">
            {!isCollapsed && <span>Logout</span>}
            <span className="sidebar-icon">🚪</span>
          </button>
        </div>
      </aside>
      <div
        className={`sidebar-overlay ${isCollapsed ? "" : "mobile-hidden"}`}
      />
    </>
  );
}
