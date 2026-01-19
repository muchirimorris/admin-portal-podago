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
import { db, auth, firebaseConfig } from "../services/firebase"; // Make sure auth and firebaseConfig are imported
import { getAuth, deleteUser, updateEmail, updateProfile, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import "./Farmers.css";

function Farmers() {
  const [farmers, setFarmers] = useState([]);

  const [editingFarmer, setEditingFarmer] = useState(null);
  const [showAddFarmerModal, setShowAddFarmerModal] = useState(false); // Added state
  const [formData, setFormData] = useState({ name: "", pin: "", email: "" });

  // 🔹 Fetch all farmers from Firestore
  const fetchFarmers = async () => {
    const q = query(collection(db, "users"), where("role", "==", "farmer"));
    const snapshot = await getDocs(q);
    setFarmers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchFarmers();
  }, []);

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

  // 🔹 Mask PIN for display
  const maskPin = (pin) => {
    if (!pin) return "N/A";
    return "•".repeat(Math.min(pin.length, 8));
  };

  return (
    <div className="farmers-page">
      {/* 🔹 Header Section */}
      <div className="header" style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
        <button className="add-btn" onClick={() => setShowAddFarmerModal(true)}>
          ➕ Add Farmer
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
            {farmers.map((farmer) => (
              <tr key={farmer.id}>
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