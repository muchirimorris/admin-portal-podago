import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { FaBoxes, FaSave } from "react-icons/fa";
import {
  createInventoryItem,
  fetchInventoryItems,
  fetchInventoryBalances,
  fetchInventoryMovements,
  recordInventoryMovement,
} from "../services/milkLogService";
import "./Inventory.css";

const initialItem = {
  itemCode: "",
  name: "",
  category: "ingredient",
  unit: "kg",
  reorderLevel: "",
};

const initialMovement = {
  itemCode: "",
  lotNo: "",
  movementType: "receipt",
  quantity: "",
  unit: "kg",
  location: "",
  sourceLocation: "",
  expiryDate: "",
  reference: "",
  reason: "",
};

function displayDate(value) {
  if (value?.toDate) {
    return format(value.toDate(), "MMM dd, yyyy HH:mm");
  }
  if (value) {
    return format(new Date(value), "MMM dd, yyyy HH:mm");
  }
  return "—";
}

function Inventory() {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [balances, setBalances] = useState([]);
  const [itemForm, setItemForm] = useState(initialItem);
  const [movementForm, setMovementForm] = useState(initialMovement);
  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [itemData, movementData] = await Promise.all([
        fetchInventoryItems(),
        fetchInventoryMovements(),
      ]);
      const balanceData = await fetchInventoryBalances();
      setItems(itemData);
      setMovements(movementData);
      setBalances(balanceData);
    } catch (loadError) {
      console.error("Error loading inventory:", loadError);
      setError("Unable to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleItemChange = (event) => {
    const { name, value } = event.target;
    setItemForm((current) => ({ ...current, [name]: value }));
    setError("");
    setMessage("");
  };

  const handleMovementChange = (event) => {
    const { name, value } = event.target;
    setMovementForm((current) => ({ ...current, [name]: value }));
    setError("");
    setMessage("");
  };

  const handleItemSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!itemForm.itemCode || !itemForm.name || !itemForm.unit) {
      setError("Item code, name, and unit are required.");
      return;
    }

    setSavingItem(true);
    try {
      await createInventoryItem(itemForm);
      setItemForm(initialItem);
      setMessage("Inventory item saved.");
      await loadData();
    } catch (saveError) {
      console.error("Error saving inventory item:", saveError);
      setError(saveError.message || "Unable to save inventory item.");
    } finally {
      setSavingItem(false);
    }
  };

  const handleMovementSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!movementForm.itemCode || !movementForm.lotNo || !movementForm.location) {
      setError("Item, lot number, and location are required.");
      return;
    }

    setSavingMovement(true);
    try {
      await recordInventoryMovement(movementForm);
      setMovementForm(initialMovement);
      setMessage("Inventory movement recorded.");
      await loadData();
    } catch (saveError) {
      console.error("Error recording inventory movement:", saveError);
      setError(saveError.message || "Unable to record inventory movement.");
    } finally {
      setSavingMovement(false);
    }
  };

  return (
    <section className="inventory">
      <header className="inventory-header">
        <div>
          <p className="eyebrow">Stores</p>
          <h1>Inventory and FEFO lots</h1>
          <p>Maintain item masters and lot-level stock movements.</p>
        </div>
        <FaBoxes aria-hidden="true" />
      </header>

      {error && <div className="inventory-alert inventory-alert-error">{error}</div>}
      {message && (
        <div className="inventory-alert inventory-alert-success">{message}</div>
      )}

      <div className="inventory-forms">
        <div className="inventory-panel">
          <h2>Item master</h2>
          <form onSubmit={handleItemSubmit}>
            <label>
              Item code
              <input
                name="itemCode"
                value={itemForm.itemCode}
                onChange={handleItemChange}
                required
              />
            </label>
            <label>
              Name
              <input
                name="name"
                value={itemForm.name}
                onChange={handleItemChange}
                required
              />
            </label>
            <label>
              Category
              <select name="category" value={itemForm.category} onChange={handleItemChange}>
                <option value="ingredient">Ingredient</option>
                <option value="packaging">Packaging</option>
                <option value="spare">Spare</option>
                <option value="chemical">Chemical</option>
                <option value="finished_good">Finished good</option>
              </select>
            </label>
            <label>
              Unit
              <input name="unit" value={itemForm.unit} onChange={handleItemChange} required />
            </label>
            <label>
              Reorder level
              <input
                name="reorderLevel"
                type="number"
                min="0"
                step="0.001"
                value={itemForm.reorderLevel}
                onChange={handleItemChange}
              />
            </label>
            <button type="submit" disabled={savingItem}>
              <FaSave aria-hidden="true" />
              {savingItem ? "Saving..." : "Save item"}
            </button>
          </form>
        </div>

        <div className="inventory-panel">
          <h2>Stock movement</h2>
          <form onSubmit={handleMovementSubmit}>
            <label>
              Item
              <select
                name="itemCode"
                value={movementForm.itemCode}
                onChange={(event) => {
                  const selected = items.find((item) => item.itemCode === event.target.value);
                  setMovementForm((current) => ({
                    ...current,
                    itemCode: event.target.value,
                    unit: selected?.unit || current.unit,
                  }));
                }}
                disabled={loading}
                required
              >
                <option value="">
                  {loading ? "Loading items..." : "Select item"}
                </option>
                {items.map((item) => (
                  <option key={item.id} value={item.itemCode}>
                    {item.itemCode} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="inventory-form-grid">
              <label>
                Lot number
                <input name="lotNo" value={movementForm.lotNo} onChange={handleMovementChange} required />
              </label>
              <label>
                Quantity
                <input
                  name="quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={movementForm.quantity}
                  onChange={handleMovementChange}
                  required
                />
              </label>
              <label>
                Movement
                <select
                  name="movementType"
                  value={movementForm.movementType}
                  onChange={handleMovementChange}
                >
                  <option value="receipt">Receipt</option>
                  <option value="issue">Issue</option>
                  <option value="transfer">Transfer</option>
                  <option value="wastage">Wastage</option>
                  <option value="return">Return</option>
                </select>
              </label>
              <label>
                Unit
                <input name="unit" value={movementForm.unit} onChange={handleMovementChange} required />
              </label>
            </div>
            <label>
              Location
              <input
                name="location"
                value={movementForm.location}
                onChange={handleMovementChange}
                placeholder="Stores or cold room"
                required
              />
            </label>
              {movementForm.movementType === "transfer" && (
                <label>
                  Source location
                  <input
                    name="sourceLocation"
                    value={movementForm.sourceLocation}
                    onChange={handleMovementChange}
                    required
                  />
                </label>
              )}
            <label>
              Expiry date
              <input
                name="expiryDate"
                type="date"
                value={movementForm.expiryDate}
                onChange={handleMovementChange}
              />
            </label>
            <label>
              Reference/reason
              <textarea
                name="reference"
                value={movementForm.reference}
                onChange={handleMovementChange}
                rows="2"
              />
            </label>
            <button type="submit" disabled={savingMovement || loading}>
              <FaSave aria-hidden="true" />
              {savingMovement ? "Saving..." : "Record movement"}
            </button>
          </form>
        </div>
      </div>

      <div className="inventory-panel inventory-table-panel">
        <h2>Current balances</h2>
        {loading ? (
          <p>Loading balances...</p>
        ) : balances.length === 0 ? (
          <p>No stock balances recorded yet.</p>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Lot</th>
                  <th>Location</th>
                  <th>Balance</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {balances.slice(0, 40).map((balance) => (
                  <tr key={balance.id}>
                    <td>{balance.itemCode}</td>
                    <td>{balance.lotNo}</td>
                    <td>{balance.location}</td>
                    <td>{balance.quantity} {balance.unit}</td>
                    <td>{displayDate(balance.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="inventory-panel inventory-table-panel">
        <h2>Recent movements</h2>
        {loading ? (
          <p>Loading movements...</p>
        ) : movements.length === 0 ? (
          <p>No inventory movements recorded yet.</p>
        ) : (
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Lot</th>
                  <th>Movement</th>
                  <th>Quantity</th>
                  <th>Location</th>
                  <th>Expiry</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 40).map((movement) => (
                  <tr key={movement.id}>
                    <td>{movement.itemCode}</td>
                    <td>{movement.lotNo}</td>
                    <td>{movement.movementType}</td>
                    <td>{movement.quantity} {movement.unit}</td>
                    <td>{movement.location}</td>
                    <td>{displayDate(movement.expiryDate)}</td>
                    <td>{displayDate(movement.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default Inventory;
