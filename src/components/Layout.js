// src/components/Layout.js
import React, { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "./Layout.css";

function Layout({ children, user, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="layout">
      <TopBar
        isSidebarOpen={isSidebarOpen}
        setSidebarOpen={setIsSidebarOpen}
        user={user}
        onLogout={onLogout}
      />

      <div className="layout-body">
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />

        <main className={`main-content ${isSidebarOpen ? "sidebar-open" : ""}`}>
          <div className="content-wrapper">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
