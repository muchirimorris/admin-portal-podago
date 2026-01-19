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

    return (
        <div className="collectors-page">
            {/* 🔹 Collectors Section */}
            <div className="header">
                <div>
                    <h1>🚛 Collectors</h1>
                    <p>Manage all registered milk collectors in the system</p>
                </div>
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
        </div>
    );
}

export default Collectors;
