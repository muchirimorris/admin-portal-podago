// src/components/Sidebar.js
import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaHome,
  FaUserFriends,
  FaTint,
  FaVial,
  FaDatabase,
  FaProjectDiagram,
  FaIndustry,
  FaCheckCircle,
  FaBoxes,
  FaRoute,
  FaChartBar,
  FaMoneyBillWave,
  FaChartLine,
  FaTruck,
  FaComments
} from "react-icons/fa";
import { FaBowlFood } from "react-icons/fa6";
import "./Sidebar.css";

function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();

  const menuItems = [
    { path: "/", name: "Dashboard", icon: <FaHome /> },
    { path: "/farmers", name: "Farmers", icon: <FaUserFriends /> },
    { path: "/collectors", name: "Collectors", icon: <FaTruck /> },
    { path: "/milk-logs", name: "Milk Logs", icon: <FaTint /> },
    { path: "/reception-qc", name: "Reception QC", icon: <FaVial /> },
    { path: "/milk-lots", name: "Milk Lots", icon: <FaDatabase /> },
    { path: "/traceability", name: "Traceability", icon: <FaProjectDiagram /> },
    { path: "/production-batches", name: "Production Batches", icon: <FaIndustry /> },
    { path: "/batch-qc", name: "Batch QC", icon: <FaCheckCircle /> },
    { path: "/inventory", name: "Inventory", icon: <FaBoxes /> },
    { path: "/dispatch", name: "Dispatch", icon: <FaRoute /> },
    { path: "/reports", name: "Reports", icon: <FaChartBar /> },
    { path: "/payments", name: "Payments", icon: <FaMoneyBillWave /> },
    { path: "/analytics", name: "Analytics", icon: <FaChartLine /> },
    { path: "/feeds", name: "Feeds", icon: <FaBowlFood /> },
    { path: "/messages", name: "Messages", icon: <FaComments /> },
  ];

  return (
    <>
      {/* 🔹 Sidebar slides in/out */}
      <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
        {/* Logo / Brand Area */}
        <div className="sidebar-header">
          <h2 className="brand-logo">Podago</h2>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => window.innerWidth <= 768 && setIsOpen(false)}
            >
              <span className="icon">{item.icon}</span>
              {isOpen && <span className="label">{item.name}</span>}
            </Link>
          ))}
        </nav>
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}
    </>
  );
}

export default Sidebar;