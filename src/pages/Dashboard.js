// src/pages/Dashboard.js
import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  FaFilter, // Added import
} from "react-icons/fa";
import "./Dashboard.css";

function Dashboard({ user }) {
  const [farmers, setFarmers] = useState(0);

  const [collectors, setCollectors] = useState(0);
  const [milkTotal, setMilkTotal] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [logs, setLogs] = useState([]);
  const [topCollectors, setTopCollectors] = useState([]);
  const [topFarmers, setTopFarmers] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [filter, setFilter] = useState("week"); // default filter

  const [grossEarnings, setGrossEarnings] = useState(0);
  const [totalDeductions, setTotalDeductions] = useState(0);
  const [netEarnings, setNetEarnings] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      // ✅ Count farmers & collectors
      const usersSnap = await getDocs(collection(db, "users"));
      setFarmers(usersSnap.docs.filter((d) => d.data().role === "farmer").length);
      setCollectors(usersSnap.docs.filter((d) => d.data().role === "collector").length);

      // ✅ Fetch milk logs
      const logsSnap = await getDocs(collection(db, "milk_logs"));
      const allLogs = logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // ✅ Fetch Feed Deductions
      const q = query(
        collection(db, "feed_requests"),
        where("status", "==", "delivered")
      );
      const feedsSnap = await getDocs(q);
      const allFeeds = feedsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // ✅ Date ranges
      const now = new Date();
      let startDate = new Date();
      let rangeDays = 7;

      switch (filter) {
        case "today":
          rangeDays = 1;
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          rangeDays = 7;
          startDate.setDate(now.getDate() - 6); // Last 7 days including today
          break;
        case "month":
          rangeDays = 30;
          startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
          break;
        case "year":
          rangeDays = 12;
          startDate = new Date(now.getFullYear(), 0, 1); // Start of year
          break;
        case "all":
          startDate = new Date(0); // Beginning of time
          break;
        default:
          rangeDays = 7;
          startDate.setDate(now.getDate() - 6);
      }

      let totalMilk = 0;
      let pendingPay = 0;
      let grossPay = 0;
      let deductionTotal = 0;
      const pricePerLiter = 45;
      const timeTotals = {};

      allLogs.forEach((log) => {
        if (!log.date) return;
        const logDate = log.date.toDate();

        // Check if log is within selected filter range
        const isInRange = logDate >= startDate && logDate <= now;

        if (isInRange) {
          totalMilk += log.quantity ?? 0;
          grossPay += (log.quantity ?? 0) * (log.pricePerLiter || pricePerLiter);

          if (log.status === "pending") {
            pendingPay += (log.quantity ?? 0) * (log.pricePerLiter || pricePerLiter);
          }

          let key;
          if (filter === "today") {
            // Group by hour for today
            key = `${logDate.getHours().toString().padStart(2, '0')}:00`;
          } else if (filter === "year") {
            // Group by month for year
            key = logDate.toLocaleDateString("en-US", { month: "short" });
          } else if (filter === "all") {
            // Group by Month Year for All Time
            key = logDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
          } else if (filter === "month") {
            // Group by actual date for month view (e.g., "Jan 1", "Jan 2")
            key = logDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          } else {
            // Group by day name for week
            key = logDate.toLocaleDateString("en-US", { weekday: "short" });
          }

          timeTotals[key] = (timeTotals[key] ?? 0) + (log.quantity ?? 0);
        }
      });

      // ✅ Processing Deductions
      allFeeds.forEach((feed) => {
        const feedDate = feed.updatedAt?.toDate ? feed.updatedAt.toDate() : (feed.createdAt?.toDate ? feed.createdAt.toDate() : new Date());

        // Check if feed is within selected filter range
        if (feedDate >= startDate && feedDate <= now) {
          deductionTotal += Math.abs(feed.cost || 0);
        }
      });

      setMilkTotal(totalMilk);
      setPendingPayments(pendingPay);
      setGrossEarnings(grossPay);
      setTotalDeductions(deductionTotal);
      setNetEarnings(grossPay - deductionTotal);

      // ✅ Prepare chart data
      let chartRange = [];

      if (filter === "today") {
        // Generate 24 hours for today
        chartRange = [...Array(24)].map((_, i) => {
          const hour = i.toString().padStart(2, '0') + ':00';
          return { time: hour, liters: timeTotals[hour] ?? 0 };
        });
      } else if (filter === "year") {
        // Generate 12 months for year
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        chartRange = months.map(month => ({
          month: month,
          liters: timeTotals[month] ?? 0
        }));
      } else if (filter === "all") {
        // For All Time, we just map the keys that exist, sorted by date logic would be ideal but simple object keys might suffice or we reconstruct
        // Better: Find min and max date in logs and iterate? Or just use the keys form timeTotals since "All Time" can be sparse.
        // For simplicity/robustness: Use the keys we collected.
        chartRange = Object.keys(timeTotals).map(key => ({
          period: key,
          liters: timeTotals[key]
        }));
        // Sort might be tricky with string keys "Jan 24", "Feb 24". 
        // Let's settle for just showing what we have or sorting roughly.
        // A better approach for "all" is usually listing the data points sorted chronologically.
        // Let's iterate from the first log date to now by month.

        // Simple approach: Use keys.
      } else if (filter === "month") {
        // Generate actual dates for current month (e.g., "Jan 1", "Jan 2", etc.)
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const currentMonth = now.toLocaleDateString("en-US", { month: "short" });

        chartRange = [...Array(daysInMonth)].map((_, i) => {
          const day = i + 1;
          const dateKey = `${currentMonth} ${day}`;
          return {
            date: dateKey,
            liters: timeTotals[dateKey] ?? 0
          };
        });
      } else {
        // Generate days for week
        chartRange = [...Array(rangeDays)].map((_, i) => {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          const label = date.toLocaleDateString("en-US", { weekday: "short" });
          return { day: label, liters: timeTotals[label] ?? 0 };
        });
      }

      setChartData(chartRange);

      // ✅ Save last 5 logs for recent activity
      // ✅ Calculate Top Collectors & Farmers
      const collectorStats = {};
      const farmerStats = {};

      allLogs.forEach(log => {
        // Collectors
        const colName = log.enteredBy || log.collectorName || "Unknown";
        if (!collectorStats[colName]) {
          collectorStats[colName] = { name: colName, quantity: 0, count: 0 };
        }
        collectorStats[colName].quantity += (log.quantity || 0);
        collectorStats[colName].count += 1;

        // Farmers
        const farmName = log.farmerName || log.farmerId || "Unknown";
        if (!farmerStats[farmName]) {
          farmerStats[farmName] = { name: farmName, quantity: 0, count: 0 };
        }
        farmerStats[farmName].quantity += (log.quantity || 0);
        farmerStats[farmName].count += 1;
      });

      // Sort & Slice
      setTopCollectors(
        Object.values(collectorStats)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 3)
      );

      setTopFarmers(
        Object.values(farmerStats)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 3)
      );
    };

    fetchData();
  }, [filter]);

  // Function to get chart label based on filter
  const getChartLabel = () => {
    switch (filter) {
      case "today": return "Time";
      case "year": return "Month";
      case "month": return "Date";
      case "all": return "Period";
      default: return "Day";
    }
  };

  // Function to get data key based on filter
  const getDataKey = () => {
    switch (filter) {
      case "today": return "time";
      case "year": return "month";
      case "month": return "date";
      case "all": return "period";
      default: return "day";
    }
  };

  // Function to format tooltip label for month view
  const formatTooltipLabel = (label) => {
    if (filter === "month") {
      return `Date: ${label}`;
    }
    return `${getChartLabel()}: ${label}`;
  };

  // Function to get icon based on filter
  const getFilterIcon = (filterType) => {
    const icons = {
      today: "📅",
      week: "📊",
      month: "🗓️",
      year: "📈",
      all: "♾️"
    };
    return icons[filterType] || "📊";
  };

  // Helper to get time of day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="dashboard-container">
      {/* 🔹 Welcome Banner */}
      <div className="welcome-banner">
        <div className="welcome-text">
          <h1>{getGreeting()}, {user?.displayName?.split(' ')[0] || 'Admin'}! 👋</h1>
          <p>Here's what's happening with your cooperative today.</p>
        </div>
        <div className="date-badge">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>
      {/* 🔹 Filters */}
      <div className="filters">
        <button
          onClick={() => setFilter("all")}
          className={filter === "all" ? "active" : ""}
        >
          <span className="filter-icon">{getFilterIcon("all")}</span>
          All Time
        </button>
        <button
          className={filter === "today" ? "active" : ""}
          onClick={() => setFilter("today")}
        >
          <span className="filter-icon">{getFilterIcon("today")}</span>
          Today
        </button>
        <button
          className={filter === "week" ? "active" : ""}
          onClick={() => setFilter("week")}
        >
          <span className="filter-icon">{getFilterIcon("week")}</span>
          This Week
        </button>
        <button
          className={filter === "month" ? "active" : ""}
          onClick={() => setFilter("month")}
        >
          <span className="filter-icon">{getFilterIcon("month")}</span>
          This Month
        </button>
        <button
          className={filter === "year" ? "active" : ""}
          onClick={() => setFilter("year")}
        >
          <span className="filter-icon">{getFilterIcon("year")}</span>
          This Year
        </button>
      </div>


      {/* ✅ Chart */}
      <div className="chart-section">
        <h2>
          <span className="chart-icon">📊</span>
          Milk Trends - {filter.charAt(0).toUpperCase() + filter.slice(1)}
        </h2>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={getDataKey()}
                label={{ value: getChartLabel(), position: 'insideBottom', offset: -5 }}
              />
              <YAxis label={{ value: 'Liters', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                formatter={(value) => [`${value} L`, 'Quantity']}
                labelFormatter={formatTooltipLabel}
              />
              <Line
                type="monotone"
                dataKey="liters"
                stroke="#047857" /* Emerald Stroke */
                strokeWidth={3}
                dot={{ fill: "#047857", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ✅ Cards */}
      <div className="cards-grid">
        <div className="card">
          <h3>👨‍🌾 Farmers</h3>
          <p>{farmers}</p>
        </div>
        <div className="card">
          <h3>🚛 Collectors</h3>
          <p>{collectors}</p>
        </div>
        <div className="card">
          <h3>🥛 Milk ({filter})</h3>
          <p>{milkTotal} L</p>
        </div>
        <div className="card money income">
          <h3>💰 Gross Earnings</h3>
          <p>KES {grossEarnings.toLocaleString()}</p>
        </div>
        <div className="card money expense">
          <h3>🌾 Deductions</h3>
          <p className="negative">- KES {totalDeductions.toLocaleString()}</p>
        </div>
        <div className="card money net">
          <h3>💵 Net Payable</h3>
          <p>KES {netEarnings.toLocaleString()}</p>
        </div>
        <div className="card money pending">
          <h3>⏳ Pending Payouts</h3>
          <p>KES {pendingPayments.toLocaleString()}</p>
        </div>
      </div>

      {/* ✅ Leaderboard Section */}
      <div className="leaderboard-grid">
        {/* Top Farmers */}
        <div className="leaderboard-cardfarmers">
          <h2>👨‍🌾 Top Farmers</h2>
          <div className="collectors-list">
            {topFarmers.length === 0 ? (
              <p className="no-data">No data available</p>
            ) : (
              topFarmers.map((farmer, index) => (
                <div key={index} className="collector-card">
                  <div className={`rank-badge rank-${index + 1}`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="collector-info">
                    <h4>{farmer.name}</h4>
                    <span>{farmer.count} deliveries</span>
                  </div>
                  <div className="collector-stat">
                    <strong>{farmer.quantity} L</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Collectors */}
        <div className="leaderboard-card collectors">
          <h2>🚛 Top Collectors</h2>
          <div className="collectors-list">
            {topCollectors.length === 0 ? (
              <p className="no-data">No data available</p>
            ) : (
              topCollectors.map((collector, index) => (
                <div key={index} className="collector-card">
                  <div className={`rank-badge rank-${index + 1}`}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="collector-info">
                    <h4>{collector.name}</h4>
                    <span>{collector.count} collections</span>
                  </div>
                  <div className="collector-stat">
                    <strong>{collector.quantity} L</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ✅ Recent Logs */}
      <div className="recent-logs">
        <h2>📝 Recent Milk Logs</h2>
        {logs.length === 0 ? (
          <div className="no-data">
            <p>No milk logs found</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Farmer</th>
                <th>Quantity (L)</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.farmerName || log.farmerId || "Unknown"}</td>
                  <td>{log.quantity}</td>
                  <td>
                    <span
                      className={`status ${log.status === "paid" ? "paid" : "pending"
                        }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td>{log.date?.toDate().toLocaleString() || "Invalid Date"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div >
  );
}

export default Dashboard;