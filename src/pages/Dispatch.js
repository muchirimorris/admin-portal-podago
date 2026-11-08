import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { FaRoute, FaSave } from "react-icons/fa";
import {
  createDispatch,
  fetchDispatches,
  fetchProductionBatches,
} from "../services/milkLogService";
import "./Dispatch.css";

const initialForm = {
  dispatchNo: "",
  batchId: "",
  outputLotNo: "",
  quantity: "",
  vehicleRegistration: "",
  driverName: "",
  route: "",
  departureAt: "",
  departureTemperatureC: "",
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

function Dispatch() {
  const [batches, setBatches] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [batchData, dispatchData] = await Promise.all([
        fetchProductionBatches(),
        fetchDispatches(),
      ]);
      setBatches(batchData);
      setDispatches(dispatchData);
    } catch (loadError) {
      console.error("Error loading dispatch data:", loadError);
      setError("Unable to load released batches or dispatches.");
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (
      !form.dispatchNo ||
      !form.batchId ||
      !form.outputLotNo ||
      !form.vehicleRegistration ||
      !form.departureAt
    ) {
      setError("Dispatch, released batch, output lot, vehicle, and time are required.");
      return;
    }
    if (!Number(form.quantity) || !Number(form.departureTemperatureC)) {
      setError("Quantity and departure temperature are required.");
      return;
    }

    setSaving(true);
    try {
      await createDispatch(form);
      setForm(initialForm);
      setMessage("Dispatch prepared and cold-chain temperature recorded.");
      await loadData();
    } catch (saveError) {
      console.error("Error creating dispatch:", saveError);
      setError(saveError.message || "Unable to create dispatch.");
    } finally {
      setSaving(false);
    }
  };

  const releasedBatches = batches.filter((batch) => batch.status === "released");

  return (
    <section className="dispatch">
      <header className="dispatch-header">
        <div>
          <p className="eyebrow">Logistics</p>
          <h1>Dispatch and cold chain</h1>
          <p>Prepare dispatches only from QC-released batches.</p>
        </div>
        <FaRoute aria-hidden="true" />
      </header>

      {error && <div className="dispatch-alert dispatch-alert-error">{error}</div>}
      {message && (
        <div className="dispatch-alert dispatch-alert-success">{message}</div>
      )}

      <div className="dispatch-grid">
        <div className="dispatch-panel">
          <h2>Prepare dispatch</h2>
          <form onSubmit={handleSubmit}>
            <div className="dispatch-form-grid">
              <label>
                Dispatch number
                <input name="dispatchNo" value={form.dispatchNo} onChange={handleChange} required />
              </label>
              <label>
                Vehicle registration
                <input
                  name="vehicleRegistration"
                  value={form.vehicleRegistration}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Driver
                <input name="driverName" value={form.driverName} onChange={handleChange} />
              </label>
              <label>
                Delivery route
                <input name="route" value={form.route} onChange={handleChange} />
              </label>
            </div>

            <label>
              Released production batch
              <select
                name="batchId"
                value={form.batchId}
                onChange={handleChange}
                disabled={loading}
                required
              >
                <option value="">
                  {loading ? "Loading batches..." : "Select released batch"}
                </option>
                {releasedBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchNo} · {batch.productName}
                  </option>
                ))}
              </select>
            </label>

            <div className="dispatch-form-grid">
              <label>
                Output lot number
                <input name="outputLotNo" value={form.outputLotNo} onChange={handleChange} required />
              </label>
              <label>
                Quantity
                <input
                  name="quantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.quantity}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Departure time
                <input
                  name="departureAt"
                  type="datetime-local"
                  value={form.departureAt}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Departure temperature (°C)
                <input
                  name="departureTemperatureC"
                  type="number"
                  step="0.01"
                  value={form.departureTemperatureC}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            <button type="submit" disabled={saving || loading}>
              <FaSave aria-hidden="true" />
              {saving ? "Saving..." : "Prepare dispatch"}
            </button>
          </form>
        </div>

        <div className="dispatch-panel">
          <h2>Recent dispatches</h2>
          {loading ? (
            <p>Loading dispatches...</p>
          ) : dispatches.length === 0 ? (
            <p>No dispatches prepared yet.</p>
          ) : (
            <div className="dispatch-list">
              {dispatches.slice(0, 20).map((dispatch) => (
                <article key={dispatch.id}>
                  <strong>{dispatch.dispatchNo}</strong>
                  <span>{dispatch.vehicleRegistration} · {dispatch.status}</span>
                  <small>{displayDate(dispatch.dispatchedAt)}</small>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Dispatch;
