import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { FaCheckCircle, FaSave } from "react-icons/fa";
import {
  fetchProductionBatches,
  recordBatchQcDecision,
} from "../services/milkLogService";
import "./BatchQc.css";

const initialForm = {
  batchId: "",
  testType: "release_review",
  result: "",
  ccpStatus: "within_limit",
  notes: "",
  decision: "released",
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

function BatchQc() {
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadBatches = async () => {
    try {
      setBatches(await fetchProductionBatches());
    } catch (loadError) {
      console.error("Error loading batches for QC:", loadError);
      setError("Unable to load production batches.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
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

    if (!form.batchId || !form.result) {
      setError("Select a held batch and enter a test result.");
      return;
    }

    setSaving(true);
    try {
      await recordBatchQcDecision(form);
      setForm(initialForm);
      setMessage("QC result recorded and batch status updated.");
      await loadBatches();
    } catch (saveError) {
      console.error("Error recording batch QC:", saveError);
      setError(saveError.message || "Unable to record batch QC.");
    } finally {
      setSaving(false);
    }
  };

  const heldBatches = batches.filter((batch) => batch.status === "held");

  return (
    <section className="batch-qc">
      <header className="batch-qc-header">
        <div>
          <p className="eyebrow">Quality and compliance</p>
          <h1>Batch QC and release</h1>
          <p>Review held batches before they become available for dispatch.</p>
        </div>
        <FaCheckCircle aria-hidden="true" />
      </header>

      {error && <div className="batch-qc-alert batch-qc-alert-error">{error}</div>}
      {message && (
        <div className="batch-qc-alert batch-qc-alert-success">{message}</div>
      )}

      <div className="batch-qc-grid">
        <div className="batch-qc-panel">
          <h2>Record QC decision</h2>
          <form onSubmit={handleSubmit}>
            <label>
              Held batch
              <select
                name="batchId"
                value={form.batchId}
                onChange={handleChange}
                disabled={loading || saving}
                required
              >
                <option value="">
                  {loading ? "Loading batches..." : "Select held batch"}
                </option>
                {heldBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchNo} · {batch.productName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Test type
              <select name="testType" value={form.testType} onChange={handleChange}>
                <option value="release_review">Release review</option>
                <option value="microbiological">Microbiological</option>
                <option value="chemical">Chemical</option>
                <option value="organoleptic">Organoleptic</option>
              </select>
            </label>

            <label>
              Result
              <textarea
                name="result"
                value={form.result}
                onChange={handleChange}
                rows="3"
                required
              />
            </label>

            <label>
              CCP status
              <select name="ccpStatus" value={form.ccpStatus} onChange={handleChange}>
                <option value="within_limit">Within limit</option>
                <option value="deviation">Deviation</option>
                <option value="not_applicable">Not applicable</option>
              </select>
            </label>

            <label>
              Decision
              <select name="decision" value={form.decision} onChange={handleChange}>
                <option value="released">Release</option>
                <option value="rejected">Reject</option>
                <option value="held">Keep on hold</option>
              </select>
            </label>

            <label>
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="3"
              />
            </label>

            <button type="submit" disabled={saving || loading}>
              <FaSave aria-hidden="true" />
              {saving ? "Saving..." : "Record QC decision"}
            </button>
          </form>
        </div>

        <div className="batch-qc-panel">
          <h2>Batch status</h2>
          {loading ? (
            <p>Loading batches...</p>
          ) : batches.length === 0 ? (
            <p>No production batches found.</p>
          ) : (
            <div className="batch-status-list">
              {batches.slice(0, 20).map((batch) => (
                <article key={batch.id}>
                  <strong>{batch.batchNo}</strong>
                  <span>{batch.productName}</span>
                  <small>
                    {batch.status || "held"} · {displayDate(batch.updatedAt || batch.createdAt)}
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

export default BatchQc;
