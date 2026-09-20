import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const navItems = [
  { to: "/dashboard", icon: "🏠", label: "Dashboard" },
  { to: "/report", icon: "📷", label: "Report Hazard" },
  { to: "/map", icon: "🗺️", label: "Hazard Map" },
  { to: "/sustainability", icon: "🌿", label: "Sustainability" },
];

const munItems = [
  { to: "/municipality", icon: "🏛️", label: "Municipality Hub" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const isMunicipal = ["municipality", "admin"].includes(user?.role);

  return (
    <div className="layout-wrapper">
      {/* Sidebar overlay on mobile */}
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

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🛣️</div>
          <div>
            <div className="sidebar-logo-text">PotholeVision</div>
            <div className="sidebar-logo-sub">AI Road Safety</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {isMunicipal && (
            <>
              <div className="sidebar-section-label">Administration</div>
              {munItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? "active" : ""}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}

          <div className="sidebar-section-label">Account</div>
          <button className="sidebar-link" onClick={toggle}>
            <span className="sidebar-link-icon">{isDark ? "☀️" : "🌙"}</span>
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
          <button className="sidebar-link" onClick={handleLogout}>
            <span className="sidebar-link-icon">🚪</span>
            Sign Out
          </button>
        </nav>

        {/* User info at bottom */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "var(--brand-gradient)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{ fontSize: 13, fontWeight: 600, truncate: true }}
                className="truncate"
              >
                {user?.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {user?.role}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="topnav">
          <div className="topnav-left">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ display: "none" }}
              id="sidebar-toggle"
            >
              ☰
            </button>
            <span className="topnav-title">PotholeVision AI</span>
            <span className="badge badge-blue">Beta</span>
          </div>
          <div className="topnav-right">
            <button
              className="btn btn-ghost btn-sm"
              onClick={toggle}
              title="Toggle theme"
            >
              {isDark ? "☀️" : "🌙"}
            </button>
            <NavLink to="/report" className="btn btn-primary btn-sm">
              + Report Hazard
            </NavLink>
          </div>
        </header>

        <main className="page-body fade-in">
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          #sidebar-toggle { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
