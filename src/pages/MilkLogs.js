// src/pages/MilkLogs.js
import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { FaTimes, FaDownload, FaTint, FaFileAlt } from "react-icons/fa";
import {
  fetchMilkLogs,
  fetchUsersByRole,
} from "../services/milkLogService";
import "./MilkLogs.css";

function MilkLogs() {
  const [logs, setLogs] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [collectors, setCollectors] = useState([]); // Added state
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [selectedCollector, setSelectedCollector] = useState(""); // Added state
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // 🔹 Fetch farmers
  // 🔹 Fetch farmers and collectors
  useEffect(() => {
    const fetchData = async () => {
      const [farmersData, collectorsData] = await Promise.all([
        fetchUsersByRole("farmer"),
        fetchUsersByRole("collector"),
      ]);
      setFarmers(farmersData);
      setCollectors(collectorsData);
    };
    fetchData();
  }, []);

  // 🔹 Fetch logs with filters
  const fetchLogs = async () => {
    let collectorName;
    if (selectedCollector) {
      const collector = collectors.find((item) => item.id === selectedCollector);
      collectorName = collector?.name;
    }

    // 2. Date Filtering (Exclusive Priority: Range > Month/Year > Year)
    let start, end;

    if (dateRange.start && dateRange.end) {
      // Date Range Priority
      start = new Date(dateRange.start);
      start.setHours(0, 0, 0, 0); // Start of day

      end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999); // End of day
    } else if (month) {
      // Month Priority (Default to current year if year not selected)
      const targetYear = year || new Date().getFullYear();
      start = new Date(targetYear, month - 1, 1);
      end = new Date(targetYear, month, 0, 23, 59, 59, 999);
    } else if (year) {
      // Year Priority
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
    }

    try {
      const fetchedLogs = await fetchMilkLogs({
        farmerId: selectedFarmer,
        collectorName,
        startDate: start && end ? start : undefined,
        endDate: start && end ? end : undefined,
      });
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      alert("Error fetching logs. You may need to create a Firestore index.");
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarmer, selectedCollector, year, month, dateRange]);

  // 🔹 Clear all filters
  const clearFilters = () => {
    setSelectedFarmer("");
    setSelectedCollector("");
    setYear("");
    setMonth("");
    setDateRange({ start: "", end: "" });
  };

  // 🔹 Export to CSV
  const exportCSV = () => {
    const header = ["Farmer", "Collector", "Quantity", "Notes", "Status", "Date"];
    const rows = logs.map((log) => [
      log.farmerName || log.farmerId,
      log.collectorName || "—",
      log.quantity,
      log.notes || "—",
      log.status,
      log.date?.toDate
        ? format(log.date.toDate(), "MMM dd, yyyy HH:mm")
        : "N/A",
    ]);

    // Calculate total quantity
    const totalQuantity = logs.reduce((sum, log) => sum + (Number(log.quantity) || 0), 0);

    // Add Total Row
    const totalRow = ["TOTALS", "", totalQuantity, "", "", ""];

    let csvContent =
      "data:text/csv;charset=utf-8," +
      [header, ...rows, totalRow].map((row) => row.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "milk_logs.csv");
    document.body.appendChild(link);
    link.click();
  };

  // 🔹 Calculate Date Constraints for Picker
  const getDateConstraints = () => {
    if (!year && !month) return { min: undefined, max: undefined };

    const targetYear = year || new Date().getFullYear();
    // month is 1-12
    const startMonthIndex = month ? parseInt(month) - 1 : 0;
    const endMonthIndex = month ? parseInt(month) : 12;

    const minD = new Date(targetYear, startMonthIndex, 1);
    const maxD = new Date(targetYear, endMonthIndex, 0);

    return {
      min: format(minD, "yyyy-MM-dd"),
      max: format(maxD, "yyyy-MM-dd"),
    };
  };

  const { min: minDate, max: maxDate } = getDateConstraints();

  // 🔹 Group logs by Month
  const groupLogsByMonth = (logsList) => {
    const groups = {};
    logsList.forEach((log) => {
      const date = log.date?.toDate ? log.date.toDate() : new Date();
      const monthYear = format(date, "MMMM yyyy");
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(log);
    });
    // Sort logs within each group by date desc
    /*
    Object.keys(groups).forEach(key => {
        groups[key].sort((a,b) => b.date.toDate() - a.date.toDate());
    });
    */
    return groups; // Keys are essentially already sorted if we process latest first? 
    // Actually the logs are already sorted by date desc from Firestore.
    // So iterating them will preserve order if we just push.
  };

  const groupedLogs = groupLogsByMonth(logs);

  return (
    <div className="milk-logs">
      {/* 🔹 Filters */}
      <div className="filters">
        <select
          value={selectedFarmer}
          onChange={(e) => setSelectedFarmer(e.target.value)}
        >
          <option value="">All Farmers</option>
          {farmers.map((farmer) => (
            <option key={farmer.id} value={farmer.id}>
              {farmer.name || farmer.id}
            </option>
          ))}
        </select>

        <select
          value={selectedCollector}
          onChange={(e) => setSelectedCollector(e.target.value)}
        >
          <option value="">All Collectors</option>
          {collectors.map((collector) => (
            <option key={collector.id} value={collector.id}>
              {collector.name || collector.id}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Year (e.g. 2025)"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />

        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">All Months</option>
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {format(new Date(2025, i), "MMMM")}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateRange.start}
          min={minDate}
          max={maxDate}
          onChange={(e) =>
            setDateRange({ ...dateRange, start: e.target.value })
          }
        />
        <input
          type="date"
          value={dateRange.end}
          min={minDate}
          max={maxDate}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
        />

        <button className="btn btn-primary" onClick={fetchLogs}>Apply</button>
        <button className="btn btn-danger" onClick={clearFilters}>
          <FaTimes className="icon" /> Clear
        </button>
        <button className="btn btn-outline" onClick={exportCSV}>
          <FaDownload className="icon" /> Export CSV
        </button>
      </div>

      {/* 🔹 Totals Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <h3><FaTint className="icon" /> Total Quantity</h3>
          <p className="value">
            {logs.reduce((sum, log) => sum + (Number(log.quantity) || 0), 0).toLocaleString()} L
          </p>
        </div>
        <div className="summary-card">
          <h3><FaFileAlt className="icon" /> Total Records</h3>
          <p className="value">{logs.length}</p>
        </div>
      </div>


      {/* 🔹 Logs Table Grouped by Month */}
      {Object.keys(groupedLogs).length === 0 ? (
        <div className="no-data">No logs found for the selected criteria.</div>
      ) : (
        Object.keys(groupedLogs).map((month) => (
          <div key={month} className="month-group">
            <h3 className="month-header">{month}</h3>
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Farmer</th>
                  <th>Collector</th>
                  <th>Quantity (L)</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {groupedLogs[month].map((log) => (
                  <tr key={log.id}>
                    <td>{log.farmerName || log.farmerId}</td>
                    <td>{log.collectorName || "—"}</td>
                    <td>{log.quantity}</td>
                    <td>{log.notes || "—"}</td>
                    <td
                      className={log.status === "paid" ? "status-paid" : "status-pending"}
                    >
                      {log.status}
                    </td>
                    <td>
                      {log.date?.toDate
                        ? format(log.date.toDate(), "MMM dd, yyyy HH:mm")
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

export default MilkLogs;
