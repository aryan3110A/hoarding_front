"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { notificationsAPI } from "@/lib/api";
import { canAccess } from "@/lib/rbac";
import * as LucideIcons from "lucide-react";

interface NavbarProps {
  user: any;
  onLogout: () => void;
}

/** Always-visible desktop icons; everything else goes under "More". */
const PRIMARY_NAV_IDS = new Set([
  "dashboard",
  "supervisor-status",
  "accountant",
  "hoardings",
  "maintenance",
  "bookings",
  "enquiries",
  "tasks",
  "reports",
]);

export default function Navbar({ user, onLogout }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const profileRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsMoreOpen(false);
  }, [pathname]);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      if (response.success && response.data) {
        setUnreadCount(response.data.count || 0);
      }
    } catch {
      // Silently fail
    }
  };

  const userRole = String(user?.role || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  const dashboardHref =
    userRole === "accountant" ? "/dashboard/accountant" : "/dashboard";

  const menuItems: Array<{
    id: string;
    title: string;
    href: string;
    iconName: string;
    component?: string;
    roles?: string[];
  }> = [
    {
      id: "dashboard",
      title: "Dashboard",
      href: dashboardHref,
      iconName: "BarChart2",
      roles: [
        "owner",
        "manager",
        "sales",
        "sales_head",
        "designer",
        "supervisor",
        "fitter",
        "admin",
      ],
    },
    {
      id: "supervisor-status",
      title: "Status",
      href: "/dashboard/supervisor",
      iconName: "Wrench",
      component: "hoardings",
    },
    {
      id: "accountant",
      title: "Accountant",
      href: "/dashboard/accountant",
      iconName: "Briefcase",
      component: "accounting",
    },
    {
      id: "hoardings",
      title: "Hoardings",
      href: "/hoardings",
      iconName: "Box",
      component: "hoardings",
    },
    {
      id: "maintenance",
      title: "Maintenance",
      href: "/maintenance",
      iconName: "Hammer",
      component: "maintenance",
    },
    {
      id: "bookings",
      title: "Bookings",
      href: "/bookings",
      iconName: "Calendar",
      component: "bookings",
    },
    {
      id: "enquiries",
      title: "Enquiries",
      href: "/enquiries",
      iconName: "Clipboard",
      component: "enquiries",
    },
    {
      id: "client-history",
      title: "Client History",
      href: "/clients/history",
      iconName: "History",
      component: "bookings",
    },
    {
      id: "enquiry-reminders",
      title: "Enquiry Reminders",
      href: "/sales/enquiry-reminders",
      iconName: "AlarmClock",
      component: "enquiries",
    },
    {
      id: "blocked-hoardings",
      title: "Blocked Hoardings",
      href: "/blocked-hoardings",
      iconName: "ShieldAlert",
      component: "blockedHoardings",
    },
    {
      id: "contracts",
      title: "Contracts",
      href: "/contracts",
      iconName: "FileText",
      component: "contracts",
    },
    {
      id: "sales-status",
      title: "Status",
      href: "/sales/renewals-due",
      iconName: "MessageCircleWarning",
      component: "renewalsDue",
    },
    {
      id: "remount-renew",
      title: "Remount / Renew",
      href: "/sales/remount-renew",
      iconName: "RefreshCcw",
      component: "hoardings",
    },
    {
      id: "vendors",
      title: "Vendors & Landlord",
      href: "/vendors",
      iconName: "DollarSign",
      component: "vendors",
    },
    {
      id: "users",
      title: "Users & Roles",
      href: "/users",
      iconName: "Users",
      component: "users",
    },
    {
      id: "design",
      title: "Design",
      href: "/design",
      iconName: "Brush",
      component: "designAssignments",
    },
    {
      id: "reports",
      title: "Reports",
      href: "/reports",
      iconName: "BarChart2",
      component: "reports",
    },
    {
      id: "tasks",
      title: "Tasks",
      href: "/tasks",
      iconName: "CheckSquare",
      component: "tasks",
    },
    {
      id: "recycle-bin",
      title: "Recycle Bin",
      href: "/recycle-bin",
      iconName: "Trash2",
      component: "recycleBin",
    },
    {
      id: "location",
      title: "Location",
      href: "/location",
      iconName: "MapPin",
      component: "locationTracking",
    },
    {
      id: "admin-settings",
      title: "Admin Settings",
      href: "/admin",
      iconName: "Settings",
      component: "adminSettings",
    },
  ];

  const canSeeNavItem = (item: (typeof menuItems)[number]) => {
    if (item.component) {
      return canAccess(userRole, item.component);
    }
    if (item.roles) {
      return item.roles.includes(userRole);
    }
    return true;
  };

  const roleFilteredItems = menuItems.filter(canSeeNavItem);

  const filteredMenuItems =
    userRole === "supervisor"
      ? roleFilteredItems.filter(
          (item, index, arr) =>
            arr.findIndex((x) => x.title === item.title) === index,
        )
      : roleFilteredItems;

  const { primaryItems, moreItems } = useMemo(() => {
    const primary = filteredMenuItems.filter((item) =>
      PRIMARY_NAV_IDS.has(item.id),
    );
    const more = filteredMenuItems.filter(
      (item) => !PRIMARY_NAV_IDS.has(item.id),
    );
    return { primaryItems: primary, moreItems: more };
  }, [filteredMenuItems]);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (href === "/maintenance") {
      return pathname === "/maintenance" || pathname?.startsWith("/maintenance/");
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  const moreHasActive = moreItems.some((item) => isActive(item.href));

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

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        profileRef.current &&
        e.target instanceof Node &&
        !profileRef.current.contains(e.target)
      ) {
        setIsProfileOpen(false);
      }
      if (
        moreRef.current &&
        e.target instanceof Node &&
        !moreRef.current.contains(e.target)
      ) {
        setIsMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProfileOpen(false);
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const renderNavLink = (item: (typeof menuItems)[number]) => (
    <Link
      href={item.href}
      aria-label={item.title}
      data-tooltip={item.title}
      className={`navbar-link ${isActive(item.href) ? "active" : ""}`}
    >
      <span className="navbar-icon">{renderIcon(item.iconName)}</span>
      <span className="navbar-text">{item.title}</span>
    </Link>
  );

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <Link
            href={dashboardHref}
            className="navbar-brand"
            aria-label="Go to dashboard"
          >
            <img
              src="/LOGO_SHUBHAM_ADVERTISE_FINAL_PNG.png"
              alt="Shubham Advertise"
              className="brand-logo-img"
            />
          </Link>

          <div className="navbar-menu-desktop">
            {primaryItems.map((item) => (
              <div
                key={item.id}
                className="navbar-item-wrap"
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                {renderNavLink(item)}

                {item.href === "/hoardings" && user?.role === "sales" && (
                  <Link
                    href="/proposals/pdf"
                    aria-label="Generate Proposal PDF"
                    data-tooltip="Generate Proposal PDF"
                    className={`navbar-link ${
                      isActive("/proposals/pdf") ? "active" : ""
                    }`}
                    style={{ marginLeft: 6 }}
                  >
                    <span className="navbar-icon">
                      {renderIcon("FileText")}
                    </span>
                    <span className="navbar-text">Generate Proposal PDF</span>
                  </Link>
                )}
              </div>
            ))}

            {moreItems.length > 0 && (
              <div className="navbar-more" ref={moreRef}>
                <button
                  type="button"
                  className={`navbar-link navbar-more-btn ${
                    moreHasActive || isMoreOpen ? "active" : ""
                  }`}
                  data-tooltip="More"
                  aria-label="More navigation"
                  aria-expanded={isMoreOpen}
                  onClick={() => setIsMoreOpen((s) => !s)}
                >
                  <span className="navbar-icon">
                    {renderIcon("MoreHorizontal")}
                  </span>
                  <span className="navbar-text">More</span>
                </button>

                {isMoreOpen && (
                  <div className="navbar-more-menu" role="menu">
                    {moreItems.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        role="menuitem"
                        className={`navbar-more-item ${
                          isActive(item.href) ? "active" : ""
                        }`}
                        onClick={() => setIsMoreOpen(false)}
                      >
                        <span className="navbar-icon">
                          {renderIcon(item.iconName, 16)}
                        </span>
                        <span>{item.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="navbar-user-section" ref={profileRef}>
            <Link
              href="/notifications"
              className="navbar-notify-btn"
              data-tooltip="Notifications"
              aria-label="Notifications"
            >
              {renderIcon("Bell", 18)}
              {unreadCount > 0 && (
                <span className="navbar-badge">{unreadCount}</span>
              )}
            </Link>

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

          <button
            className="navbar-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? renderIcon("X", 20) : renderIcon("Menu", 20)}
          </button>
        </div>

        <div className={`navbar-menu-mobile ${isMobileMenuOpen ? "open" : ""}`}>
          {filteredMenuItems.map((item) => (
            <div key={item.id} style={{ display: "block" }}>
              <Link
                href={item.href}
                className={`navbar-link ${isActive(item.href) ? "active" : ""}`}
              >
                <span className="navbar-icon">
                  {renderIcon(item.iconName)}
                </span>
                <span className="navbar-text">{item.title}</span>
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
          <Link
            href="/notifications"
            className={`navbar-link ${
              isActive("/notifications") ? "active" : ""
            }`}
          >
            <span className="navbar-icon">{renderIcon("Bell")}</span>
            <span className="navbar-text">Notifications</span>
            {unreadCount > 0 && (
              <span className="navbar-badge">{unreadCount}</span>
            )}
          </Link>
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
      {isMobileMenuOpen && (
        <div
          className="navbar-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
