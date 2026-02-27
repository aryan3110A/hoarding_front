"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { notificationsAPI } from "@/lib/api";
import {
  canViewRent,
  canAccessLocationTracking,
  canAccessAdminSettings,
} from "@/lib/rbac";
import * as LucideIcons from "lucide-react";

interface NavbarProps {
  user: any;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const profileRef = useRef<HTMLDivElement | null>(null);

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

  const dashboardHref =
    userRole === "supervisor" ? "/dashboard/supervisor" : "/dashboard";

  const menuItems = [
    {
      title: "Dashboard",
      href: dashboardHref,
      iconName: "BarChart2",
      roles: [
        "owner",
        "manager",
        "sales",
        "designer",
        "supervisor",
        "accountant",
        "admin",
      ],
    },
    {
      title: "Supervisor",
      href: "/dashboard/supervisor",
      iconName: "Wrench",
      roles: ["owner", "manager", "admin"],
    },
    {
      title: "Accountant",
      href: "/dashboard/accountant",
      iconName: "Briefcase",
      roles: ["accountant", "owner", "manager", "admin"],
    },
    {
      title: "Hoardings",
      href: "/hoardings",
      iconName: "Box",
      roles: ["owner", "manager", "sales", "admin"],
    },
    {
      title: "Bookings",
      href: "/bookings",
      iconName: "Calendar",
      roles: ["owner", "manager", "admin"],
    },
    {
      title: "Enquiries",
      href: "/enquiries",
      iconName: "Clipboard",
      roles: ["owner", "manager", "sales", "admin"],
    },
    {
      title: "Enquiry Reminders",
      href: "/sales/enquiry-reminders",
      iconName: "AlarmClock",
      roles: ["owner", "manager", "sales", "admin"],
    },
    {
      title: "Blocked Hoardings",
      href: "/blocked-hoardings",
      iconName: "ShieldAlert",
      roles: ["owner", "manager", "sales", "supervisor", "admin"],
    },
    {
      title: "Contracts",
      href: "/contracts",
      iconName: "FileText",
      roles: ["owner", "manager", "accountant", "admin"],
    },
    {
      title: "Status",
      href: "/sales/renewals-due",
      iconName: "MessageCircleWarning",
      roles: ["owner", "manager", "sales", "accountant", "admin"],
    },
    {
      title: "Remount / Renew",
      href: "/sales/remount-renew",
      iconName: "RefreshCcw",
      roles: ["owner", "manager", "sales", "supervisor", "admin"],
    },
    {
      title: "Vendors & Rent",
      href: "/vendors",
      iconName: "DollarSign",
      roles: ["owner", "manager", "admin"],
    },
    {
      title: "Users & Roles",
      href: "/users",
      iconName: "Users",
      roles: ["owner", "admin"],
    },
    {
      title: "Design",
      href: "/design",
      iconName: "Brush",
      roles: ["owner", "manager", "designer", "admin"],
    },
    {
      title: "Reports",
      href: "/reports",
      iconName: "BarChart2",
      roles: ["owner", "manager", "accountant", "admin"],
    },
    {
      title: "Tasks",
      href: "/tasks",
      iconName: "CheckSquare",
      roles: ["owner", "manager", "designer", "supervisor", "admin"],
    },
    {
      title: "Admin Settings",
      href: "/admin",
      iconName: "Settings",
      roles: ["owner", "admin"],
    },
    {
      title: "Notifications",
      href: "/notifications",
      iconName: "Bell",
      roles: [
        "owner",
        "manager",
        "sales",
        "designer",
        "supervisor",
        "accountant",
        "admin",
      ],
      badge: unreadCount > 0 ? unreadCount : null,
    },
    // {
    //   title: "Location",
    //   href: "/location",
    //   iconName: "MapPin",
    //   roles: ["owner", "supervisor", "admin"],
    // },
  ];

  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(userRole),
  );

  const isActive = (href: string) => {
    return pathname === href;
  };

  const renderIcon = (iconName?: string, size = 18) => {
    if (!iconName) return null;
    const Comp = (LucideIcons as any)[iconName];
    if (Comp) return <Comp size={size} />;
    return (
      <span
        style={{ display: "inline-block", width: size, textAlign: "center" }}
      >
        •
      </span>
    );
  };

  const capitalize = (s?: string | null) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const displayTitle = user?.role ? capitalize(user.role) : user?.name || "";

  // close profile dropdown on outside click or Escape
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!profileRef.current) return;
      if (e.target instanceof Node && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          {/* Logo and Brand */}
          <div className="navbar-brand">
            <img
              src="/LOGO_SHUBHAM_ADVERTISE_FINAL_PNG.png"
              alt="Shubham Advertise"
              className="brand-logo-img"
            />
          </div>

          {/* Desktop Menu */}
          <div className="navbar-menu-desktop">
            {filteredMenuItems.map((item) => (
              <div
                key={item.href}
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                <Link
                  href={item.href}
                  className={`navbar-link ${
                    isActive(item.href) ? "active" : ""
                  }`}
                >
                  <span className="navbar-icon">
                    {renderIcon((item as any).iconName)}
                  </span>
                  <span className="navbar-text">{item.title}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="navbar-badge">{item.badge}</span>
                  )}
                </Link>

                {item.href === "/hoardings" && user?.role === "sales" && (
                  <Link
                    href="/proposals/pdf"
                    className={`navbar-link ${
                      isActive("/proposals/pdf") ? "active" : ""
                    }`}
                    style={{ marginLeft: 10 }}
                  >
                    <span className="navbar-icon">
                      {renderIcon("FileText")}
                    </span>
                    <span className="navbar-text">Generate Proposal PDF</span>
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* User / Profile Section */}
          <div className="navbar-user-section" ref={profileRef}>
            <button
              className="profile-button"
              aria-haspopup="true"
              aria-expanded={isProfileOpen}
              onClick={() => setIsProfileOpen((s) => !s)}
            >
              <div className="navbar-user-avatar">
                {displayTitle?.charAt(0)?.toUpperCase()}
              </div>
            </button>

            {isProfileOpen && (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-header">
                  <div className="profile-menu-avatar">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="profile-menu-info">
                    <div className="profile-menu-name">{displayTitle}</div>
                    <div className="profile-menu-role">
                      {capitalize(user?.role)}
                    </div>
                    <div className="profile-menu-email">{user?.email}</div>
                  </div>
                </div>
                <div className="profile-menu-actions">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout();
                    }}
                    className="profile-logout-btn"
                    role="menuitem"
                  >
                    {renderIcon("LogOut", 14)}
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="navbar-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? renderIcon("X", 20) : renderIcon("Menu", 20)}
          </button>
        </div>

        {/* Mobile Menu */}
        <div className={`navbar-menu-mobile ${isMobileMenuOpen ? "open" : ""}`}>
          {filteredMenuItems.map((item) => (
            <div key={item.href} style={{ display: "block" }}>
              <Link
                href={item.href}
                className={`navbar-link ${isActive(item.href) ? "active" : ""}`}
              >
                <span className="navbar-icon">
                  {renderIcon((item as any).iconName)}
                </span>
                <span className="navbar-text">{item.title}</span>
                {item.badge && item.badge > 0 && (
                  <span className="navbar-badge">{item.badge}</span>
                )}
              </Link>

              {item.href === "/hoardings" && user?.role === "sales" && (
                <Link
                  href="/proposals/pdf"
                  className={`navbar-link ${
                    isActive("/proposals/pdf") ? "active" : ""
                  }`}
                >
                  <span className="navbar-icon">{renderIcon("FileText")}</span>
                  <span className="navbar-text">Generate Proposal PDF</span>
                </Link>
              )}
            </div>
          ))}
          <div className="navbar-mobile-user">
            <div className="navbar-user">
              <div className="navbar-user-avatar">
                {displayTitle?.charAt(0)?.toUpperCase()}
              </div>
              <div className="navbar-user-info">
                <div className="navbar-user-name">{displayTitle}</div>
                <div className="navbar-user-role">{capitalize(user?.role)}</div>
              </div>
            </div>
            <button onClick={onLogout} className="navbar-logout">
              {renderIcon("LogOut", 16)}
              <span className="logout-text">Logout</span>
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
