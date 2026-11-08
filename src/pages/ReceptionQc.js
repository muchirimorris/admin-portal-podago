import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { FaSave, FaTint } from "react-icons/fa";
import {
  createReceptionTest,
  fetchMilkLogs,
} from "../services/milkLogService";
import "./ReceptionQc.css";

const initialForm = {
  deliveryId: "",
  temperatureC: "",
  alcoholCobResult: "",
  density: "",
  fatPercent: "",
  snfPercent: "",
  antibioticResult: "",
  adulterationResult: "",
  decision: "accepted",
  reason: "",
  ruleVersion: "reception-v1",
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

function ReceptionQc() {
  const [deliveries, setDeliveries] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedDelivery = useMemo(
    () => deliveries.find((delivery) => delivery.id === form.deliveryId),
    [deliveries, form.deliveryId]
  );

  useEffect(() => {
    let active = true;

    const loadDeliveries = async () => {
      try {
        const records = await fetchMilkLogs();
        if (active) {
          setDeliveries(records);
        }
      } catch (loadError) {
        console.error("Error loading deliveries for QC:", loadError);
        if (active) {
          setError("Unable to load milk deliveries. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDeliveries();
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.deliveryId) {
      setError("Select a delivery before recording the test.");
      return;
    }

    setSaving(true);
    try {
      await createReceptionTest(form);
      setForm(initialForm);
      setMessage("Reception test recorded successfully.");
    } catch (saveError) {
      console.error("Error recording reception test:", saveError);
      setError(saveError.message || "Unable to record the reception test.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="reception-qc">
      <div className="reception-qc-header">
        <div>
          <p className="eyebrow">Milk intake</p>
          <h1>Reception quality control</h1>
          <p>
            Record QC results separately from the mobile delivery record.
          </p>
        </div>
        <FaTint aria-hidden="true" />
      </div>

      {error && <div className="qc-alert qc-alert-error">{error}</div>}
      {message && <div className="qc-alert qc-alert-success">{message}</div>}

      <div className="reception-qc-grid">
        <div className="qc-panel">
          <h2>Record test</h2>
          <form onSubmit={handleSubmit}>
            <label>
              Delivery
              <select
                name="deliveryId"
                value={form.deliveryId}
                onChange={handleChange}
                required
                disabled={loading || saving}
              >
                <option value="">
                  {loading ? "Loading deliveries..." : "Select delivery"}
                </option>
                {deliveries.map((delivery) => (
                  <option key={delivery.id} value={delivery.id}>
                    {delivery.farmerName || delivery.farmerId || delivery.id} —{" "}
                    {delivery.quantity || 0} L — {displayDate(delivery.date)}
                  </option>
                ))}
              </select>
            </label>

            {selectedDelivery && (
              <div className="selected-delivery">
                <strong>Selected delivery</strong>
                <span>
                  {selectedDelivery.collectorName || "Collector unavailable"} ·{" "}
                  {selectedDelivery.quantity || 0} L
                </span>
              </div>
            )}

            <div className="qc-form-grid">
              <label>
                Temperature (°C)
                <input
                  name="temperatureC"
                  type="number"
                  step="0.01"
                  value={form.temperatureC}
                  onChange={handleChange}
                />
              </label>
              <label>
                Density
                <input
                  name="density"
                  type="number"
                  step="0.0001"
                  value={form.density}
                  onChange={handleChange}
                />
              </label>
              <label>
                Fat (%)
                <input
                  name="fatPercent"
                  type="number"
                  step="0.001"
                  value={form.fatPercent}
                  onChange={handleChange}
                />
              </label>
              <label>
                SNF (%)
                <input
                  name="snfPercent"
                  type="number"
                  step="0.001"
                  value={form.snfPercent}
                  onChange={handleChange}
                />
              </label>
            </div>

            <div className="qc-form-grid">
              <label>
                Alcohol/COB
                <select
                  name="alcoholCobResult"
                  value={form.alcoholCobResult}
                  onChange={handleChange}
                >
                  <option value="">Not recorded</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </label>
              <label>
                Antibiotic residue
                <select
                  name="antibioticResult"
                  value={form.antibioticResult}
                  onChange={handleChange}
                >
                  <option value="">Not recorded</option>
                  <option value="negative">Negative</option>
                  <option value="positive">Positive</option>
                </select>
              </label>
              <label>
                Adulteration
                <select
                  name="adulterationResult"
                  value={form.adulterationResult}
                  onChange={handleChange}
                >
                  <option value="">Not recorded</option>
                  <option value="clear">Clear</option>
                  <option value="suspected">Suspected</option>
                </select>
              </label>
              <label>
                Decision
                <select
                  name="decision"
                  value={form.decision}
                  onChange={handleChange}
                  required
                >
                  <option value="accepted">Accepted</option>
                  <option value="downgraded">Downgraded</option>
                  <option value="rejected">Rejected</option>
                  <option value="held">Held</option>
                </select>
              </label>
            </div>

            <label>
              Reason or notes
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                rows="3"
              />
            </label>

            <label>
              Rule version
              <input
                name="ruleVersion"
                value={form.ruleVersion}
                onChange={handleChange}
                required
              />
            </label>

            <button type="submit" disabled={saving || loading}>
              <FaSave aria-hidden="true" />
              {saving ? "Saving..." : "Record reception test"}
            </button>
          </form>
        </div>

        <div className="qc-panel">
          <h2>Recent deliveries</h2>
          {loading ? (
            <p>Loading deliveries...</p>
          ) : deliveries.length === 0 ? (
            <p>No milk deliveries found.</p>
          ) : (
            <div className="qc-delivery-list">
              {deliveries.slice(0, 20).map((delivery) => (
                <button
                  type="button"
                  key={delivery.id}
                  className={
                    delivery.id === form.deliveryId
                      ? "delivery-item selected"
                      : "delivery-item"
                  }
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      deliveryId: delivery.id,
                    }))
                  }
                >
                  <strong>
                    {delivery.farmerName || delivery.farmerId || "Unknown farmer"}
                  </strong>
                  <span>{delivery.quantity || 0} L</span>
                  <small>{displayDate(delivery.date)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ReceptionQc;
