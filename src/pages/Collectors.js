import React, { useEffect, useState } from "react";
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    deleteDoc,
    updateDoc,
    setDoc,
} from "firebase/firestore";
import { db, auth, firebaseConfig } from "../services/firebase";
import { getAuth, createUserWithEmailAndPassword, signOut, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import "./Collectors.css";

function Collectors() {
    const [collectors, setCollectors] = useState([]);
    const [editingCollector, setEditingCollector] = useState(null);
    const [collectorFormData, setCollectorFormData] = useState({ name: "", pin: "", email: "" });
    const [showAddCollectorModal, setShowAddCollectorModal] = useState(false);
    const [newCollectorData, setNewCollectorData] = useState({ name: "", email: "", password: "" });
    const [isAddingCollector, setIsAddingCollector] = useState(false);

    // 🔹 Activity Log States
    const [viewingActivityCollector, setViewingActivityCollector] = useState(null);
    const [activityLogs, setActivityLogs] = useState([]);
    const [registeredFarmers, setRegisteredFarmers] = useState([]);
    const [activityTab, setActivityTab] = useState("milk"); // 'milk' or 'farmers'
    const [loadingActivity, setLoadingActivity] = useState(false);

    // 🔹 Fetch all collectors from Firestore
    const fetchCollectors = async () => {
        try {
            const q = query(collection(db, "users"), where("role", "==", "collector"));
            const snapshot = await getDocs(q);
            const collectorsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setCollectors(collectorsData);
        } catch (error) {
            console.error("Error fetching collectors:", error);
        }
    };

    useEffect(() => {
        fetchCollectors();
    }, []);

    // 🔹 Delete collector
    const handleDeleteCollector = async (collector) => {
        if (window.confirm("Are you sure you want to delete this collector?")) {
            try {
                await deleteDoc(doc(db, "users", collector.id));
                fetchCollectors();
            } catch (error) {
                console.error("Error deleting collector:", error);
                alert("Error deleting collector: " + error.message);
            }
        }
    };

    // 🔹 Open edit collector modal
    const handleEditCollector = (collector) => {
        setEditingCollector(collector);
        setCollectorFormData({
            name: collector.name || "",
            pin: collector.pin || "",
            email: collector.email || "",
        });
    };

    // 🔹 Handle input changes for collector
    const handleCollectorChange = (e) => {
        setCollectorFormData({ ...collectorFormData, [e.target.name]: e.target.value });
    };

    // 🔹 Save updated collector
    const handleSaveCollector = async () => {
        if (!editingCollector) return;
        try {
            const ref = doc(db, "users", editingCollector.id);
            await updateDoc(ref, {
                name: collectorFormData.name,
                pin: collectorFormData.pin,
                email: collectorFormData.email,
            });

            setEditingCollector(null);
            fetchCollectors();
        } catch (error) {
            console.error("Error updating collector:", error);
            alert("Error updating collector: " + error.message);
        }
    };

    // 🔹 Handle New Collector Input Change
    const handleNewCollectorChange = (e) => {
        setNewCollectorData({ ...newCollectorData, [e.target.name]: e.target.value });
    };

    // 🔹 Handle Add Collector
    const handleAddCollector = async () => {
        const { name, email, password } = newCollectorData;
        if (!name || !email || !password) {
            alert("Please fill in all fields");
            return;
        }


        setIsAddingCollector(true);
        let secondaryApp;
        try {
            // 1. Initialize secondary app to create user without logging out admin
            // Use a unique name to ensure no conflict
            const appName = `Secondary_${Date.now()}`;
            secondaryApp = initializeApp(firebaseConfig, appName);

            // Use inMemoryPersistence to avoid conflict with main app's storage
            const secondaryAuth = initializeAuth(secondaryApp, {
                persistence: inMemoryPersistence
            });

            // 2. Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const user = userCredential.user;

            // 3. Create user document in Firestore (using main db instance)
            await setDoc(doc(db, "users", user.uid), {
                name,
                email,
                role: "collector",
                createdAt: new Date(),
            });

            alert("Collector added successfully!. you can now login with the new collector credentials");
            setShowAddCollectorModal(false);
            setNewCollectorData({ name: "", email: "", password: "" });
            fetchCollectors(); // Refresh list

            // 4. Cleanup
            await signOut(secondaryAuth);

        } catch (error) {
            console.error("Error adding collector:", error);
            if (error.code === 'auth/email-already-in-use') {
                alert("This email is already registered. Please use a different email.");
            } else if (error.code === 'auth/weak-password') {
                alert("Password is too weak. Please use a stronger password.");
            } else if (error.code === 'auth/invalid-email') {
                alert("Invalid email address.");
            } else {
                alert("Error adding collector: " + error.message);
            }
        } finally {
            setIsAddingCollector(false);
            if (secondaryApp) {
                try {
                    await deleteApp(secondaryApp);
                } catch (e) {
                    console.error("Error deleting secondary app", e);
                }
            }
        }
    };

    // 🔹 Mask PIN for display
    const maskPin = (pin) => {
        if (!pin) return "N/A";
        return "•".repeat(Math.min(pin.length, 8));
    };

    // 🔹 Fetch Activity 
    const handleViewActivity = async (collector) => {
        setViewingActivityCollector(collector);
        setLoadingActivity(true);
        setActivityLogs([]);
        setRegisteredFarmers([]);
        setActivityTab("milk"); // Default tab

        try {
            // 1. Fetch Milk Logs (where collectorName == collector.name)
            // Note: Ideally use collectorId if available, but falling back to name as per plan
            const logsQuery = query(
                collection(db, "milk_logs"),
                where("collectorName", "==", collector.name)
            );
            const logsSnapshot = await getDocs(logsQuery);
            const logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort by date desc (client-side to avoid composite index requirement for now)
            logs.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
            setActivityLogs(logs);

            // 2. Fetch Registered Farmers (where registeredBy == collector.name)
            const farmersQuery = query(
                collection(db, "users"),
                where("role", "==", "farmer"),
                where("registeredBy", "==", collector.name)
            );
            const farmersSnapshot = await getDocs(farmersQuery);
            const farmers = farmersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort by createdAt desc
            farmers.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setRegisteredFarmers(farmers);

        } catch (error) {
            console.error("Error fetching activity:", error);
            alert("Error fetching activity data.");
        } finally {
            setLoadingActivity(false);
        }
    };

    return (
        <div className="collectors-page">
            {/* 🔹 Collectors Section */}
            <div className="header" style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
                <button className="add-btn" onClick={() => setShowAddCollectorModal(true)}>
                    ➕ Add Collector
                </button>
            </div>

            <div className="table-container">
                <table className="farmers-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>PIN</th>
                            <th>Email</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {collectors.map((collector) => (
                            <tr key={collector.id}>
                                <td>{collector.name || "Unnamed"}</td>
                                <td>{maskPin(collector.pin)}</td>
                                <td>{collector.email || "N/A"}</td>
                                <td>
                                    <button
                                        className="edit-btn"
                                        onClick={() => handleViewActivity(collector)}
                                        style={{ backgroundColor: '#3498db', marginRight: '5px' }}
                                    >
                                        📋 Show Activities
                                    </button>
                                    <button
                                        className="edit-btn"
                                        onClick={() => handleEditCollector(collector)}
                                    >
                                        ✏️ Edit
                                    </button>
                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDeleteCollector(collector)}
                                    >
                                        ❌ Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 🔹 Edit Collector Modal */}
            {editingCollector && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Edit Collector</h2>
                        <label>
                            Name:
                            <input
                                type="text"
                                name="name"
                                value={collectorFormData.name}
                                onChange={handleCollectorChange}
                                placeholder="Enter collector name"
                            />
                        </label>
                        <label>
                            PIN:
                            <input
                                type="text"
                                name="pin"
                                value={collectorFormData.pin}
                                onChange={handleCollectorChange}
                                placeholder="Enter PIN"
                            />
                        </label>
                        <label>
                            Email:
                            <input
                                type="email"
                                name="email"
                                value={collectorFormData.email}
                                onChange={handleCollectorChange}
                                placeholder="Enter email"
                            />
                        </label>

                        <div className="modal-actions">
                            <button className="save-btn" onClick={handleSaveCollector}>
                                💾 Save
                            </button>
                            <button
                                className="cancel-btn"
                                onClick={() => setEditingCollector(null)}
                            >
                                ❌ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🔹 Add Collector Modal */}
            {showAddCollectorModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Add New Collector</h2>
                        <label>
                            Name:
                            <input
                                type="text"
                                name="name"
                                value={newCollectorData.name}
                                onChange={handleNewCollectorChange}
                                placeholder="Enter collector name"
                            />
                        </label>
                        <label>
                            Email:
                            <input
                                type="email"
                                name="email"
                                value={newCollectorData.email}
                                onChange={handleNewCollectorChange}
                                placeholder="Enter email"
                            />
                        </label>
                        <label>
                            Password:
                            <input
                                type="password"
                                name="password"
                                value={newCollectorData.password}
                                onChange={handleNewCollectorChange}
                                placeholder="Enter password"
                            />
                        </label>

                        <div className="modal-actions">
                            <button
                                className="save-btn"
                                onClick={handleAddCollector}
                                disabled={isAddingCollector}
                            >
                                {isAddingCollector ? "Creating..." : "✅ Create"}
                            </button>
                            <button
                                className="cancel-btn"
                                onClick={() => setShowAddCollectorModal(false)}
                                disabled={isAddingCollector}
                            >
                                ❌ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🔹 Activity Log Modal */}
            {viewingActivityCollector && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '800px', width: '90%' }}>
                        <h2>Activity Log: {viewingActivityCollector.name}</h2>
                        <div className="tabs" style={{ display: 'flex', gap: '10px', marginBottom: '15px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
                            <button
                                onClick={() => setActivityTab("milk")}
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    backgroundColor: activityTab === 'milk' ? '#2ecc71' : '#f0f0f0',
                                    color: activityTab === 'milk' ? 'white' : 'black',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                🥛 Milk Collected ({activityLogs.length})
                            </button>
                            <button
                                onClick={() => setActivityTab("farmers")}
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    backgroundColor: activityTab === 'farmers' ? '#3498db' : '#f0f0f0',
                                    color: activityTab === 'farmers' ? 'white' : 'black',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}
                            >
                                🧑‍🌾 Farmers Registered ({registeredFarmers.length})
                            </button>
                        </div>

                        <div className="activity-content" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {loadingActivity ? (
                                <p>Loading activity...</p>
                            ) : (
                                <>
                                    {activityTab === "milk" && (
                                        <table className="farmers-table" style={{ width: '100%' }}>
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Farmer</th>
                                                    <th>Quantity (L)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activityLogs.length > 0 ? (
                                                    activityLogs.map(log => (
                                                        <tr key={log.id}>
                                                            <td>{log.date?.toDate ? log.date.toDate().toLocaleDateString() + ' ' + log.date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                                                            <td>{log.farmerName || "Unknown"}</td>
                                                            <td>{log.quantity}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="3" style={{ textAlign: 'center' }}>No milk collection records found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    )}

                                    {activityTab === "farmers" && (
                                        <table className="farmers-table" style={{ width: '100%' }}>
                                            <thead>
                                                <tr>
                                                    <th>Joined Date</th>
                                                    <th>Name</th>
                                                    <th>Email</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {registeredFarmers.length > 0 ? (
                                                    registeredFarmers.map(farmer => (
                                                        <tr key={farmer.id}>
                                                            <td>{farmer.createdAt?.toDate ? farmer.createdAt.toDate().toLocaleDateString() : 'N/A'}</td>
                                                            <td>{farmer.name}</td>
                                                            <td>{farmer.email}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="3" style={{ textAlign: 'center' }}>No farmers registered by this collector.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="modal-actions" style={{ marginTop: '20px' }}>
                            <button
                                className="cancel-btn"
                                onClick={() => setViewingActivityCollector(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Collectors;
