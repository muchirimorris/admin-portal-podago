// src/pages/Analytics.js
import React, { useEffect, useState } from "react";
import { db } from "../services/firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query, where
} from "firebase/firestore";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import "./Analytics.css";

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Analytics() {
  const [tips, setTips] = useState([]);
  const [newTip, setNewTip] = useState("");
  const [role, setRole] = useState("farmer");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Analytics Stats
  const [collectorStats, setCollectorStats] = useState([]);
  const [farmerStats, setFarmerStats] = useState([]);
  const [feedStats, setFeedStats] = useState([]);
  const [financeStats, setFinanceStats] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Data Parallelly
        const [tipsSnap, logsSnap, feedsSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, "tips")),
          getDocs(collection(db, "milk_logs")),
          getDocs(collection(db, "feed_requests")),
          getDocs(collection(db, "users"))
        ]);

        // --- Process Tips ---
        const tipsData = tipsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTips(tipsData.sort((a, b) => new Date(b.createdAt?.toDate()) - new Date(a.createdAt?.toDate())));

        // --- Process Users Map (ID -> Name) ---
        const userMap = {};
        usersSnap.docs.forEach(doc => {
          userMap[doc.id] = doc.data().name || "Unknown";
        });

        const logs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const feeds = feedsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- 1. Collector Stats & Top Farmers ---
        const cStats = {};
        const fStats = {};
        const logsByMonth = {}; // Key: "yyyy-MM"

        logs.forEach(log => {
          // Collectors
          const cName = log.collectorName || "Unknown";
          if (!cStats[cName]) cStats[cName] = { name: cName, totalLiters: 0, count: 0 };
          cStats[cName].totalLiters += (Number(log.quantity) || 0);
          cStats[cName].count += 1;

          // Farmers
          const fName = userMap[log.farmerId] || log.farmerId || "Unknown";
          if (!fStats[fName]) fStats[fName] = { name: fName, totalLiters: 0 };
          fStats[fName].totalLiters += (Number(log.quantity) || 0);

          // Finances (Milk Income)
          if (log.date) {
            const d = log.date.toDate();
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!logsByMonth[monthKey]) logsByMonth[monthKey] = { month: monthKey, gross: 0, deductions: 0 };

            const price = log.pricePerLiter || 45; // Default price fallback
            logsByMonth[monthKey].gross += (Number(log.quantity) || 0) * price;
          }
        });

        // Sort & Set Leaders
        setCollectorStats(Object.values(cStats).filter(s => s.name !== "Unknown").sort((a, b) => b.totalLiters - a.totalLiters).slice(0, 5));
        setFarmerStats(Object.values(fStats).sort((a, b) => b.totalLiters - a.totalLiters).slice(0, 5));

        // --- 2. Feed Popularity ---
        const feedCounts = {};
        feeds.forEach(feed => {
          // Count confirmed orders (delivered) or pending, usually helpful to see demand
          const type = feed.feedTypeName || "Unknown";
          if (!feedCounts[type]) feedCounts[type] = 0;
          feedCounts[type] += (Number(feed.quantity) || 0);

          // Finances (Deductions)
          if (feed.createdAt && feed.status === 'delivered') { // Only counted if delivered/deducted
            const d = feed.createdAt.toDate();
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!logsByMonth[monthKey]) logsByMonth[monthKey] = { month: monthKey, gross: 0, deductions: 0 };

            logsByMonth[monthKey].deductions += (Number(feed.cost) || 0);
          }
        });

        const feedChartData = Object.keys(feedCounts).map(key => ({ name: key, value: feedCounts[key] }));
        setFeedStats(feedChartData);

        // --- 3. Financial Trends ---
        const financeData = Object.values(logsByMonth)
          .sort((a, b) => a.month.localeCompare(b.month))
          .map(item => {
            const [y, m] = item.month.split('-');
            return {
              name: `${MONTHS[parseInt(m) - 1]}`,
              Income: Math.round(item.gross),
              Deductions: Math.round(item.deductions)
            };
          })
          .slice(-6); // Last 6 months

        setFinanceStats(financeData);

      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ... (Tip functions: addTip, approveTip, deleteTip remain same)
  const addTip = async () => {
    if (!newTip.trim()) { alert("Please enter a tip!"); return; }
    try {
      await addDoc(collection(db, "tips"), { content: newTip, role, createdAt: serverTimestamp(), approved: false });
      setNewTip(""); alert("Tip added, pending approval!");
      const snapshot = await getDocs(collection(db, "tips"));
      setTips(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) { console.error(error); }
  };
  const approveTip = async (id) => {
    try { await updateDoc(doc(db, "tips", id), { approved: true }); setTips(tips.map(t => t.id === id ? { ...t, approved: true } : t)); } catch (e) { console.error(e); }
  };
  const deleteTip = async (id) => {
    if (window.confirm("Delete this tip?")) {
      try { await deleteDoc(doc(db, "tips", id)); setTips(tips.filter(t => t.id !== id)); } catch (e) { console.error(e); }
    }
  };

  const filteredTips = tips.filter(tip => {
    if (filter === "approved") return tip.approved;
    if (filter === "pending") return !tip.approved;
    return true;
  });

  if (loading) return <div className="analytics-container"><div className="loading-state"><div className="loading-spinner"></div><p>Loading analytics...</p></div></div>;

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h1 className="analytics-title">Analytics & Insights</h1>
      </div>

      <div className="analytics-grid">

        {/* 📊 Financial Trends */}
        <div className="chart-card wide-card">
          <h3>💰 Financial Performance (Last 6 Months)</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={financeStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `KES ${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Deductions" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🥧 Feed Popularity */}
        <div className="chart-card">
          <h3>🌾 Feed Demand (By Quantity)</h3>
          <div className="chart-wrapper">
            {feedStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={feedStats} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label={({ name }) => name}>
                    {feedStats.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} kg`} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="no-data">No feed data</p>}
          </div>
        </div>

        {/* 🏆 Top Farmers */}
        <div className="chart-card">
          <h3>🥇 Top Performing Farmers</h3>
          <div className="leaderboard-list">
            {farmerStats.map((stat, i) => (
              <div key={stat.name} className="leaderboard-item">
                <div className={`rank rank-${i + 1}`}>{i + 1}</div>
                <div className="info">
                  <span className="name">{stat.name}</span>
                  <span className="value">{stat.totalLiters.toLocaleString()} L</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🚚 Top Collecting Officers */}
        <div className="chart-card wide-card">
          <h3>🚛 Top Collecting Officers</h3>
          <div className="leaderboard-list">
            {collectorStats.map((stat, i) => (
              <div key={stat.name} className="leaderboard-item">
                <div className={`rank rank-${i + 1}`}>{i + 1}</div>
                <div className="stat-info">
                  <span className="stat-name">{stat.name}</span>
                  <span className="stat-details">{stat.count} collections</span>
                </div>
                <div className="stat-bar-container">
                  <div className="stat-bar" style={{ width: `${(stat.totalLiters / (collectorStats[0]?.totalLiters || 1)) * 100}%` }}></div>
                </div>
                <div className="stat-value">{stat.totalLiters.toLocaleString()} L</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="divider"></div>

      {/* 💡 Tips Management (Preserved) */}
      <div className="tips-management-section">
        <div className="analytics-header">
          <h2 className="section-title">💡 Tips Management</h2>
        </div>

        {/* ... Tips Form ... */}
        <div className="add-tip-form">
          <textarea className="tip-textarea" placeholder="Enter tip content..." value={newTip} onChange={(e) => setNewTip(e.target.value)} />
          <div className="form-row">
            <select className="role-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="farmer">For Farmers</option>
              <option value="collector">For Collectors</option>
            </select>
            <button className="add-tip-btn" onClick={addTip}>Add Tip</button>
          </div>
        </div>

        <div className="filter-buttons">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All ({tips.length})</button>
          <button className={`filter-btn ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>Approved</button>
          <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pending</button>
        </div>

        <div className="tips-section">
          {filteredTips.length === 0 ? <div className="empty-state"><p>No tips found</p></div> : (
            <table className="tips-table">
              <thead><tr><th>Content</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredTips.map(t => (
                  <tr key={t.id}>
                    <td className="tip-content">{t.content}</td>
                    <td><span className={`role-badge role-${t.role}`}>{t.role}</span></td>
                    <td><span className={`status-badge ${t.approved ? 'status-approved' : 'status-pending'}`}>{t.approved ? "Approved" : "Pending"}</span></td>
                    <td className="actions-cell">
                      {!t.approved && <button className="action-btn approve-btn" onClick={() => approveTip(t.id)}>Approve</button>}
                      <button className="action-btn delete-btn" onClick={() => deleteTip(t.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Analytics;