import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Avatar, Button, Input, Modal, message } from "antd";
import { BookOutlined } from "@ant-design/icons";
import companyLogo from "../assets/company-logo.jpg";
import useDeviceAlert from "../hooks/useDeviceAlert";
import { clearAuthSession, getAuthUser } from "../utils/auth";
import { canAccessRoute } from "../utils/permissions";
import getFileUrl from "../utils/fileUrl";
import { logout } from "../api/auth";

const EXPANDED_GROUPS_STORAGE_KEY = "devicemap.sidebar.expandedGroups";
const COMPANY_URL = "https://dngcorp.vn/";

const sidebarSections = [
  {
    type: "item",
    key: "home",
    label: "Trang chủ",
    to: "/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
      </svg>
    ),
    isActive: (pathname) => pathname === "/"
  },
  {
    type: "group",
    key: "monitor",
    label: "Bản đồ số",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 17h8" />
        <path d="M10 21h4" />
      </svg>
    ),
    items: [
      {
        label: "Maps",
        to: "/maps"
      },
      {
        label: "Bản đồ mặt phẳng",
        to: "/monitor"
      }
    ]
  },
  {
    type: "group",
    key: "device-plane",
    label: "Thiết bị & Mặt phẳng",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="8" height="6" rx="1.5" />
        <rect x="13" y="5" width="8" height="6" rx="1.5" />
        <rect x="3" y="13" width="8" height="6" rx="1.5" />
        <path d="M13 16h8" />
        <path d="M17 13v6" />
      </svg>
    ),
    items: [
      // { label: "Loại thiết bị", to: "/device-types" },
      { label: "Thiết bị", to: "/devices" },
      { label: "Mặt phẳng", to: "/planes" }
    ]
  },
  {
    type: "item",
    key: "reports",
    label: "Báo cáo & Thống kê",
    to: "/reports",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V4" />
        <path d="M4 20h16" />
        <rect x="7" y="11" width="3" height="6" rx="1" />
        <rect x="12" y="8" width="3" height="9" rx="1" />
        <rect x="17" y="6" width="3" height="11" rx="1" />
      </svg>
    )
  },
  {
    type: "group",
    key: "settings",
    label: "Cài đặt chung",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.2a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
      </svg>
    ),
    items: [
      { label: "Thiết lập cảnh báo", to: "/settings/alert-setup" },
      { label: "Thông số đường cảnh báo", to: "/settings/line-parameters" },
      { label: "Network Optix", to: "/settings/nx" },
      { label: "Người dùng", to: "/settings/users" }
    ]
  }
];

function matchesPath(pathname, to) {
  if (to === "/") {
    return pathname === "/";
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

function isSectionActive(section, pathname) {
  if (section.type === "item") {
    return section.isActive ? section.isActive(pathname) : matchesPath(pathname, section.to);
  }

  return section.items.some((item) =>
    item.isActive ? item.isActive(pathname) : matchesPath(pathname, item.to)
  );
}

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const authUser = useMemo(() => getAuthUser(), []);
  const [colorMode, setColorMode] = useState(() => {
    if (typeof window === "undefined") {
      return "night";
    }

    const stored = window.localStorage.getItem("devicemap.colorMode");
    return stored === "dark" ? "dark" : "night";
  });
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [resizing, setResizing] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [processDescription, setProcessDescription] = useState("");
  const [previousAlertCount, setPreviousAlertCount] = useState(null);
  const { alerts, processAlert, processAllAlerts } = useDeviceAlert();
  const [expandedGroups, setExpandedGroups] = useState(() => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const savedState = window.localStorage.getItem(EXPANDED_GROUPS_STORAGE_KEY);
      return savedState ? JSON.parse(savedState) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!resizing) return;

    const handleMove = (event) => {
      const nextWidth = Math.min(360, Math.max(220, event.clientX));
      setSidebarWidth(nextWidth);
    };

    const handleUp = () => setResizing(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizing]);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
  if (previousAlertCount !== null && alerts.length > previousAlertCount) {
    setNotificationsOpen(true);
  }

  setPreviousAlertCount(alerts.length);
  }, [alerts.length]);

  useEffect(() => {
    const activeGroupKeys = sidebarSections
      .filter((section) => section.type === "group" && isSectionActive(section, location.pathname))
      .map((section) => section.key);

    if (activeGroupKeys.length === 0) {
      return;
    }

    setExpandedGroups((prev) => {
      const nextState = { ...prev };
      let hasChanged = false;

      activeGroupKeys.forEach((key) => {
        if (!nextState[key]) {
          nextState[key] = true;
          hasChanged = true;
        }
      });

      return hasChanged ? nextState : prev;
    });
  }, [location.pathname]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EXPANDED_GROUPS_STORAGE_KEY, JSON.stringify(expandedGroups));
    } catch {
      // Ignore persistence errors from private mode or blocked storage.
    }
  }, [expandedGroups]);

  useEffect(() => {
    document.body.classList.toggle("theme-dark", colorMode === "dark");
    try {
      window.localStorage.setItem("devicemap.colorMode", colorMode);
    } catch {
      // Ignore storage write errors.
    }
  }, [colorMode]);

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const isCurrentlyExpanded = Boolean(prev[key]);

      if (isCurrentlyExpanded) {
        return {
          ...prev,
          [key]: false
        };
      }

      const nextState = {};
      sidebarSections.forEach((section) => {
        if (section.type === "group") {
          nextState[section.key] = section.key === key;
        }
      });

      return nextState;
    });
  };

  const visibleSections = useMemo(() => {
    return sidebarSections
      .map((section) => {
        if (section.type === "item") {
          return canAccessRoute(authUser, section.to) ? section : null;
        }

        const items = section.items.filter((item) => canAccessRoute(authUser, item.to));
        if (items.length === 0) {
          return null;
        }

        return {
          ...section,
          items
        };
      })
      .filter(Boolean);
  }, [authUser]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Always clear local state even if backend session is already expired.
    }

    clearAuthSession();
    navigate("/login", { replace: true });
  };

  const openAlertProcess = (alertItem) => {
    setSelectedAlert(alertItem);
    setProcessDescription("");
  };

  const closeAlertProcess = () => {
    setSelectedAlert(null);
    setProcessDescription("");
  };

  const handleNotificationClick = (alertItem) => {
    if (!alertItem?.plane_id) {
      return;
    }

    setNotificationsOpen(false);
    navigate(`/monitor/${alertItem.plane_id}`);
  };

  const submitProcess = async (state) => {
    if (!selectedAlert?.report_id) {
      return;
    }

    setProcessing(true);
    try {
      await processAlert(selectedAlert.report_id, state, processDescription);
      message.success(state === 1 ? "Đã xác nhận xử lý" : "Đã bỏ qua cảnh báo");
      closeAlertProcess();
    } catch (err) {
      console.error("Failed to process alert report:", err);
      message.error(err?.response?.data?.message || "Không thể xử lý cảnh báo");
    } finally {
      setProcessing(false);
    }
  };

  const submitProcessAll = async (state) => {
    if (alerts.length === 0) {
      return;
    }

    setProcessing(true);
    try {
      await processAllAlerts(state, "");
      message.success(state === 1 ? "Đã xác nhận tất cả cảnh báo" : "Đã bỏ qua tất cả cảnh báo");
      closeAlertProcess();
    } catch (err) {
      console.error("Failed to process all alerts:", err);
      message.error(err?.response?.data?.message || "Không thể xử lý tất cả cảnh báo");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${collapsed ? "hidden" : ""}`}
        style={{ width: collapsed ? 0 : sidebarWidth }}
      >
        <div className="sidebar-header">
          <div className="brand-mark">
            <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer">
              <img src={companyLogo} alt="company logo" />
            </a>
          </div>
        </div>

        <div className="sidebar-menu">
          {visibleSections.map((section) => {
            const sectionIsActive = isSectionActive(section, location.pathname);

            if (section.type === "item") {
              return (
                <NavLink
                  key={section.key}
                  to={section.to}
                  className={`menu-link ${sectionIsActive ? "active" : ""} ${collapsed ? "icon-only" : ""}`}
                >
                  <span className="menu-icon">{section.icon}</span>
                  {!collapsed && <span className="menu-label">{section.label}</span>}
                </NavLink>
              );
            }

            const isExpanded = Boolean(expandedGroups[section.key]);

            return (
              <div key={section.key} className={`menu-group ${sectionIsActive ? "active" : ""}`}>
                <button className="menu-group-toggle" onClick={() => toggleGroup(section.key)}>
                  <span className="menu-group-title">
                    <span className="menu-icon">{section.icon}</span>
                    {!collapsed && <span className="menu-label">{section.label}</span>}
                  </span>

                  {!collapsed && (
                    <span className={`chevron ${isExpanded ? "open" : ""}`}>
                      ▾
                    </span>
                  )}
                </button>

                {!collapsed && isExpanded && (
                  <div className="submenu">
                    {section.items.map((item) => {
                      const itemIsActive = item.isActive
                        ? item.isActive(location.pathname)
                        : matchesPath(location.pathname, item.to);

                      return (
                        <NavLink
                          key={item.to + item.label}
                          to={item.to}
                          className={`menu-item ${itemIsActive ? "active" : ""}`}
                        >
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <div className="status-pill">
            <span className="status-dot" />
            {!collapsed && <span>System Online</span>}
          </div>
        </div>
      </aside>

      {!collapsed && (
        <div
          className="sidebar-resizer"
          onMouseDown={() => setResizing(true)}
        />
      )}

      <div className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button" onClick={() => setCollapsed((value) => !value)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>

          <div className="topbar-center">
            DNG - Giải pháp bản đồ số
          </div>

          <div className="topbar-right" style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 100 }}>
            <Avatar src={authUser?.avatar_url ? getFileUrl(authUser.avatar_url) : undefined}>
              {String(authUser?.username || "U")[0]}
            </Avatar>
            <span className="user-name">{authUser?.full_name || authUser?.username || ""}</span>
            <Button size="small" onClick={handleLogout}>Logout</Button>
          </div>
        </header>

        <div className="notification-button-wrap">
          <button
            className="icon-button"
            onClick={() => setNotificationsOpen((value) => !value)}
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 17H5l1-2v-4a5 5 0 1 1 10 0v4l1 2Z" />
              <path d="M10 19a2 2 0 0 0 4 0" />
            </svg>
            
            {alerts.length > 0 && (
              <span className="badge">{alerts.length}</span>
            )}

          </button>
        </div>

        <div className="theme-mode-wrap">
          <button
            className="icon-button"
            onClick={() => setColorMode((prev) => (prev === "night" ? "dark" : "night"))}
            aria-label="Đổi giao diện"
            title={colorMode === "night" ? "Night Mode" : "Dark Mode"}
          >
            {colorMode === "night" ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v3" />
                <path d="M12 19v3" />
                <path d="M2 12h3" />
                <path d="M19 12h3" />
                <path d="m4.93 4.93 2.12 2.12" />
                <path d="m16.95 16.95 2.12 2.12" />
                <path d="m4.93 19.07 2.12-2.12" />
                <path d="m16.95 7.05 2.12-2.12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3c0 0-1.34 7.4 2.18 10.92C16.91 17.44 21 12.79 21 12.79Z" />
              </svg>
            )}
          </button>
        </div>

        {notificationsOpen && (
          <div className="notification-dropdown-wrap">
            <div className="notification-dropdown">
              <div className="dropdown-header">Notifications</div>

              <div className="notification-list">
                {alerts.length === 0 && (
                  <div className="dropdown-item">
                    <strong>Không có cảnh báo</strong>
                    <span>Danh sách cảnh báo đang trống.</span>
                  </div>
                )}

                {alerts.map((alertItem) => (
                  <div
                    key={alertItem.report_id}
                    className="dropdown-item notification-alert-item"
                    onClick={() => handleNotificationClick(alertItem)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleNotificationClick(alertItem);
                      }
                    }}
                  >
                    <div className="notification-alert-content">
                      <strong>{`${alertItem.device_id} | ${alertItem.device_name}`}</strong>
                      <span>{`${alertItem.plane_id} | ${alertItem.plane_name}`}</span>
                    </div>

                    <button
                      className="notification-book-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        openAlertProcess(alertItem);
                      }}
                      aria-label="Open process panel"
                    >
                      <BookOutlined />
                    </button>
                  </div>
                ))}
              </div>

              <div className="notification-actions">
                <Button
                  size="small"
                  disabled={alerts.length === 0 || processing}
                  loading={processing}
                  onClick={() => submitProcessAll(2)}
                >
                  Ignore all
                </Button>
                <Button
                  size="small"
                  type="primary"
                  disabled={alerts.length === 0 || processing}
                  loading={processing}
                  onClick={() => submitProcessAll(1)}
                >
                  Confirm all
                </Button>
              </div>
            </div>
          </div>
        )}

        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <Modal
        title="Xử lý cảnh báo"
        open={!!selectedAlert}
        onCancel={closeAlertProcess}
        footer={null}
        destroyOnClose
        zIndex={12000}
      >
        {selectedAlert && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontWeight: 600 }}>{`${selectedAlert.device_id} | ${selectedAlert.device_name}`}</div>
            <div style={{ color: "#6b7280" }}>{`${selectedAlert.plane_id} | ${selectedAlert.plane_name}`}</div>

            <Input.TextArea
              value={processDescription}
              onChange={(event) => setProcessDescription(event.target.value)}
              placeholder="Nhập mô tả xử lý"
              rows={4}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button loading={processing} onClick={() => submitProcess(2)}>
                Ignore
              </Button>
              <Button type="primary" loading={processing} onClick={() => submitProcess(1)}>
                Confirm Process
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}