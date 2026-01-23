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
  runTransaction,
} from "firebase/firestore";
import { db, auth, firebaseConfig } from "../services/firebase"; // Make sure auth and firebaseConfig are imported
import { getAuth, deleteUser, updateEmail, updateProfile, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getDoc } from "firebase/firestore"; // Ensure getDoc is imported here as well if not already in line 4
import { initializeApp, deleteApp } from "firebase/app";
import "./Farmers.css";

function Farmers() {
  const [farmers, setFarmers] = useState([]);

  const [editingFarmer, setEditingFarmer] = useState(null);
  const [showAddFarmerModal, setShowAddFarmerModal] = useState(false); // Added state
  const [formData, setFormData] = useState({ name: "", pin: "", email: "" });
  const [nextId, setNextId] = useState("Loading..."); // Added state for next ID

  // 🔹 Fetch all farmers from Firestore
  const fetchFarmers = async () => {
    const q = query(collection(db, "users"), where("role", "==", "farmer"));
    const snapshot = await getDocs(q);
    setFarmers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchFarmers();
  }, []);

  // 🔹 Fetch next available ID for display
  const fetchNextId = async () => {
    try {
      const counterRef = doc(db, "counters", "farmers");
      const counterSnap = await getDoc(doc(db, "counters", "farmers")); // Use getDoc imported from firestore

      let nextSeq = 1;
      if (counterSnap.exists()) {
        nextSeq = (counterSnap.data().currentSequence || 0) + 1;
      }
      setNextId(`PC${String(nextSeq).padStart(5, '0')}`);
    } catch (error) {
      console.error("Error fetching next ID:", error);
      setNextId("Error");
    }
  };

  // 🔹 Delete farmer
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this farmer?")) {
      try {
        await deleteDoc(doc(db, "users", id));
        fetchFarmers();
      } catch (error) {
        console.error("Error deleting farmer:", error);
        alert("Error deleting farmer: " + error.message);
      }
    }
  };

  // 🔹 Open edit farmer modal
  const handleEdit = (farmer) => {
    setEditingFarmer(farmer);
    setFormData({
      name: farmer.name || "",
      pin: farmer.pin || "",
      email: farmer.email || "",
    });
  };

  // 🔹 Handle input changes for farmer
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔹 Save updated farmer
  const handleSave = async () => {
    if (!editingFarmer) return;
    try {
      const ref = doc(db, "users", editingFarmer.id);
      await updateDoc(ref, {
        name: formData.name,
        pin: formData.pin,
        email: formData.email,
      });
      setEditingFarmer(null);
      fetchFarmers();
    } catch (error) {
      console.error("Error updating farmer:", error);
      alert("Error updating farmer: " + error.message);
    }
  };

  // 🔹 Add new farmer with transaction for unique ID
  const handleAddFarmer = async () => {
    if (!formData.name || !formData.pin) {
      alert("Please provide both Name and PIN.");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "counters", "farmers");
        const counterDoc = await transaction.get(counterRef);

        if (!counterDoc.exists()) {
          throw "Counter document does not exist!";
        }

        const newSequence = counterDoc.data().currentSequence + 1;
        transaction.update(counterRef, { currentSequence: newSequence });

        // Generate ID: PC00001, PC00002, etc.
        const newFarmerId = `PC${String(newSequence).padStart(5, '0')}`;
        const newFarmerRef = doc(db, "users", newFarmerId);

        transaction.set(newFarmerRef, {
          id: newFarmerId, // Include id in the document data as well
          farmerId: newFarmerId,
          name: formData.name,
          pin: formData.pin,
          email: formData.email,
          role: "farmer",
          createdAt: new Date(),
        });
      });

      alert("Farmer added successfully!");
      setShowAddFarmerModal(false);
      setFormData({ name: "", pin: "", email: "" });
      fetchFarmers();
    } catch (error) {
      console.error("Error adding farmer:", error);
      alert("Error adding farmer: " + error.message);
    }
  };

  // 🔹 Mask PIN for display
  const maskPin = (pin) => {
    if (!pin) return "N/A";
    return "•".repeat(Math.min(pin.length, 8));
  };

  return (
    <div className="farmers-page">
      {/* 🔹 Header Section */}
      <div className="header" style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
        <button
          className="add-btn"
          onClick={() => {
            setFormData({ name: "", pin: "", email: "" });
            setNextId("Loading...");
            fetchNextId();
            setShowAddFarmerModal(true);
          }}
        >
          ➕ Add Farmer
        </button>
      </div>

      <div className="table-container">
        <table className="farmers-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>PIN</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {farmers.map((farmer) => (
              <tr key={farmer.id}>
                <td>{farmer.farmerId || farmer.id}</td>
                <td>{farmer.name || "Unnamed"}</td>
                <td>{maskPin(farmer.pin)}</td>
                <td>{farmer.email || "N/A"}</td>
                <td>
                  <button
                    className="edit-btn"
                    onClick={() => handleEdit(farmer)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(farmer.id)}
                  >
                    ❌ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>



      {/* 🔹 Add Farmer Modal */}
      {showAddFarmerModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add New Farmer</h2>
            <label>
              Farmer ID:
              <input
                type="text"
                value={nextId}
                disabled
                style={{ backgroundColor: "#f0f0f0", cursor: "not-allowed" }}
              />
            </label>
            <label>
              Name:
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter farmer name"
              />
            </label>
            <label>
              PIN:
              <input
                type="text"
                name="pin"
                value={formData.pin}
                onChange={handleChange}
                placeholder="Enter PIN"
              />
            </label>
            <label>
              Email:
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email (optional)"
              />
            </label>

            <div className="modal-actions">
              <button className="save-btn" onClick={handleAddFarmer}>
                ➕ Add
              </button>
              <button
                className="cancel-btn"
                onClick={() => setShowAddFarmerModal(false)}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 Edit Farmer Modal */}
      {editingFarmer && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Edit Farmer</h2>
            <label>
              Name:
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter farmer name"
              />
            </label>
            <label>
              PIN:
              <input
                type="text"
                name="pin"
                value={formData.pin}
                onChange={handleChange}
                placeholder="Enter PIN"
              />
            </label>
            <label>
              Email:
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email"
              />
            </label>

            <div className="modal-actions">
              <button className="save-btn" onClick={handleSave}>
                💾 Save
              </button>
              <button
                className="cancel-btn"
                onClick={() => setEditingFarmer(null)}
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

export default Farmers;