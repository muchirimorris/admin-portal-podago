import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { FaDatabase, FaSave } from "react-icons/fa";
import {
  createMilkLot,
  fetchMilkLogs,
  fetchMilkLots,
} from "../services/milkLogService";
import "./MilkLots.css";

const initialForm = {
  lotNo: "",
  siteId: "",
  tankId: "",
  receivedAt: "",
  quantityLitres: "",
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

function MilkLots() {
  const [form, setForm] = useState(initialForm);
  const [deliveries, setDeliveries] = useState([]);
  const [lots, setLots] = useState([]);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [deliveryData, lotData] = await Promise.all([
        fetchMilkLogs(),
        fetchMilkLots(),
      ]);
      setDeliveries(deliveryData);
      setLots(lotData);
    } catch (loadError) {
      console.error("Error loading milk-lot data:", loadError);
      setError("Unable to load deliveries or milk lots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setMessage("");
  };

  const toggleDelivery = (deliveryId) => {
    setSelectedDeliveryIds((current) =>
      current.includes(deliveryId)
        ? current.filter((id) => id !== deliveryId)
        : [...current, deliveryId]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.lotNo || !form.siteId || !form.tankId || !form.receivedAt) {
      setError("Lot number, site, tank, and received time are required.");
      return;
    }
    if (!Number(form.quantityLitres) || Number(form.quantityLitres) <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    if (selectedDeliveryIds.length === 0) {
      setError("Link at least one source delivery to the milk lot.");
      return;
    }

    setSaving(true);
    try {
      await createMilkLot({
        ...form,
        deliveryIds: selectedDeliveryIds,
      });
      setForm(initialForm);
      setSelectedDeliveryIds([]);
      setMessage("Milk lot and initial tank movement created.");
      await loadData();
    } catch (saveError) {
      console.error("Error creating milk lot:", saveError);
      setError(saveError.message || "Unable to create the milk lot.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="milk-lots">
      <header className="milk-lots-header">
        <div>
          <p className="eyebrow">Traceability</p>
          <h1>Milk lots and tanks</h1>
          <p>Link received deliveries to a tank-held milk lot.</p>
        </div>
        <FaDatabase aria-hidden="true" />
      </header>

      {error && <div className="lot-alert lot-alert-error">{error}</div>}
      {message && <div className="lot-alert lot-alert-success">{message}</div>}

      <div className="milk-lots-grid">
        <div className="lot-panel">
          <h2>Create milk lot</h2>
          <form onSubmit={handleSubmit}>
            <div className="lot-form-grid">
              <label>
                Lot number
                <input name="lotNo" value={form.lotNo} onChange={handleChange} required />
              </label>
              <label>
                Site ID
                <input name="siteId" value={form.siteId} onChange={handleChange} required />
              </label>
              <label>
                Tank ID
                <input name="tankId" value={form.tankId} onChange={handleChange} required />
              </label>
              <label>
                Quantity (litres)
                <input
                  name="quantityLitres"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.quantityLitres}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            <label>
              Received at
              <input
                name="receivedAt"
                type="datetime-local"
                value={form.receivedAt}
                onChange={handleChange}
                required
              />
            </label>

            <fieldset>
              <legend>
                Source deliveries ({selectedDeliveryIds.length} selected)
              </legend>
              <div className="delivery-checklist">
                {loading ? (
                  <p>Loading deliveries...</p>
                ) : deliveries.length === 0 ? (
                  <p>No deliveries available.</p>
                ) : (
                  deliveries.slice(0, 40).map((delivery) => (
                    <label className="delivery-check" key={delivery.id}>
                      <input
                        type="checkbox"
                        checked={selectedDeliveryIds.includes(delivery.id)}
                        onChange={() => toggleDelivery(delivery.id)}
                      />
                      <span>
                        {delivery.farmerName || delivery.farmerId || "Unknown farmer"}{" "}
                        · {delivery.quantity || 0} L
                        <small>{displayDate(delivery.date)}</small>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <button type="submit" disabled={saving || loading}>
              <FaSave aria-hidden="true" />
              {saving ? "Saving..." : "Create milk lot"}
            </button>
          </form>
        </div>

        <div className="lot-panel">
          <h2>Recent lots</h2>
          {loading ? (
            <p>Loading lots...</p>
          ) : lots.length === 0 ? (
            <p>No milk lots created yet.</p>
          ) : (
            <div className="lot-list">
              {lots.slice(0, 20).map((lot) => (
                <article className="lot-item" key={lot.id}>
                  <strong>{lot.lotNo}</strong>
                  <span>{lot.quantityLitres || 0} L · Tank {lot.tankId}</span>
                  <small>
                    {lot.status || "available"} · {displayDate(lot.createdAt)}
                  </small>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default MilkLots;
