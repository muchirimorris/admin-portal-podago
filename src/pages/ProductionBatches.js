import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { FaIndustry, FaSave } from "react-icons/fa";
import {
  createProductionBatch,
  fetchMilkLots,
  fetchProductionBatches,
} from "../services/milkLogService";
import "./ProductionBatches.css";

const initialForm = {
  batchNo: "",
  productCode: "",
  productName: "",
  inputLotId: "",
  inputQuantityLitres: "",
  outputQuantity: "",
  outputUnit: "litres",
  startedAt: "",
  pasteurisationTime: "",
  pasteurisationTempC: "",
  line: "",
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

function ProductionBatches() {
  const [form, setForm] = useState(initialForm);
  const [lots, setLots] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [lotData, batchData] = await Promise.all([
        fetchMilkLots(),
        fetchProductionBatches(),
      ]);
      setLots(lotData);
      setBatches(batchData);
    } catch (loadError) {
      console.error("Error loading production data:", loadError);
      setError("Unable to load milk lots or production batches.");
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
      !form.batchNo ||
      !form.productCode ||
      !form.productName ||
      !form.inputLotId ||
      !form.startedAt ||
      !form.pasteurisationTime
    ) {
      setError("Batch, product, input lot, and process times are required.");
      return;
    }

    const numericFields = [
      form.inputQuantityLitres,
      form.outputQuantity,
      form.pasteurisationTempC,
    ];
    if (numericFields.some((value) => !Number(value) || Number(value) <= 0)) {
      setError("Input, output, and pasteurisation values must be greater than zero.");
      return;
    }
    const selectedLot = lots.find((lot) => lot.id === form.inputLotId);
    if (
      selectedLot &&
      Number(form.inputQuantityLitres) > Number(selectedLot.quantityLitres)
    ) {
      setError("Input quantity cannot exceed the selected milk lot quantity.");
      return;
    }

    setSaving(true);
    try {
      await createProductionBatch(form);
      setForm(initialForm);
      setMessage("Production batch created and placed on hold.");
      await loadData();
    } catch (saveError) {
      console.error("Error creating production batch:", saveError);
      setError(saveError.message || "Unable to create the production batch.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="production-batches">
      <header className="production-header">
        <div>
          <p className="eyebrow">Production</p>
          <h1>Production batches</h1>
          <p>Create a batch from a milk lot and hold it for QC release.</p>
        </div>
        <FaIndustry aria-hidden="true" />
      </header>

      {error && <div className="production-alert production-alert-error">{error}</div>}
      {message && (
        <div className="production-alert production-alert-success">{message}</div>
      )}

      <div className="production-grid">
        <div className="production-panel">
          <h2>Create batch</h2>
          <form onSubmit={handleSubmit}>
            <div className="production-form-grid">
              <label>
                Batch number
                <input name="batchNo" value={form.batchNo} onChange={handleChange} required />
              </label>
              <label>
                Production line
                <input name="line" value={form.line} onChange={handleChange} />
              </label>
              <label>
                Product code
                <input
                  name="productCode"
                  value={form.productCode}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Product name
                <input
                  name="productName"
                  value={form.productName}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            <label>
              Source milk lot
              <select
                name="inputLotId"
                value={form.inputLotId}
                onChange={handleChange}
                disabled={loading}
                required
              >
                <option value="">
                  {loading ? "Loading lots..." : "Select milk lot"}
                </option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lotNo} · {lot.quantityLitres || 0} L · {lot.status || "available"}
                  </option>
                ))}
              </select>
            </label>

            <div className="production-form-grid">
              <label>
                Input quantity (L)
                <input
                  name="inputQuantityLitres"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.inputQuantityLitres}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Output quantity
                <input
                  name="outputQuantity"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={form.outputQuantity}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Output unit
                <select name="outputUnit" value={form.outputUnit} onChange={handleChange}>
                  <option value="litres">Litres</option>
                  <option value="kilograms">Kilograms</option>
                  <option value="units">Units</option>
                </select>
              </label>
              <label>
                Pasteurisation temperature (°C)
                <input
                  name="pasteurisationTempC"
                  type="number"
                  min="0.001"
                  step="0.01"
                  value={form.pasteurisationTempC}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            <div className="production-form-grid">
              <label>
                Started at
                <input
                  name="startedAt"
                  type="datetime-local"
                  value={form.startedAt}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Pasteurisation time
                <input
                  name="pasteurisationTime"
                  type="datetime-local"
                  value={form.pasteurisationTime}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            <button type="submit" disabled={saving || loading}>
              <FaSave aria-hidden="true" />
              {saving ? "Saving..." : "Create batch"}
            </button>
          </form>
        </div>

        <div className="production-panel">
          <h2>Recent batches</h2>
          {loading ? (
            <p>Loading batches...</p>
          ) : batches.length === 0 ? (
            <p>No production batches created yet.</p>
          ) : (
            <div className="batch-list">
              {batches.slice(0, 20).map((batch) => (
                <article key={batch.id}>
                  <strong>{batch.batchNo}</strong>
                  <span>{batch.productName} · {batch.status || "held"}</span>
                  <small>{displayDate(batch.createdAt)}</small>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ProductionBatches;
