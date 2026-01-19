import React from "react";
import { FaBars, FaTimes, FaUserCircle, FaSignOutAlt } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import "./TopBar.css";

const TopBar = ({ isSidebarOpen, setSidebarOpen, user, onLogout }) => {
    const location = useLocation();

    // Helper to get legible page title from path
    const getPageTitle = (pathname) => {
        switch (pathname) {
            case "/": return "Dashboard";
            case "/farmers": return "Farmers Management";
            case "/collectors": return "Collectors Management";
            case "/milk-logs": return "Milk Logs";
            case "/payments": return "Payments & Deductions";
            case "/analytics": return "Analytics";
            case "/feeds": return "Feeds Inventory";
            default: return "Admin Portal";
        }
    };

    return (
        <header className={`topbar ${isSidebarOpen ? "sidebar-open" : ""}`}>
            <div className="topbar-left">
                <button
                    className="menu-toggle"
                    onClick={() => setSidebarOpen(!isSidebarOpen)}
                >
                    {isSidebarOpen ? <FaTimes /> : <FaBars />}
                </button>
                <h2 className="page-title">{getPageTitle(location.pathname)}</h2>
            </div>

            <div className="topbar-right">
                {user && (
                    <div className="user-profile">
                        <span className="user-name">{user.email?.split('@')[0] || "Admin"}</span>
                        <FaUserCircle className="user-icon" />
                    </div>
                )}
                <button className="logout-button" onClick={onLogout} title="Logout">
                    <FaSignOutAlt />
                </button>
            </div>
        </header>
    );
};

export default TopBar;
