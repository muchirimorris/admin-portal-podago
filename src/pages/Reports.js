import React, { useEffect, useMemo, useState } from "react";
import { FaSync } from "react-icons/fa";
import {
  fetchDispatches,
  fetchInventoryBalances,
  fetchMilkLogs,
  fetchMilkLots,
  fetchProductionBatches,
} from "../services/milkLogService";
import "./Reports.css";

function Reports() {
  const [data, setData] = useState({
    logs: [],
    lots: [],
    batches: [],
    balances: [],
    dispatches: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
    setLoading(true);
    setError("");
    try {
      const [logs, lots, batches, balances, dispatches] = await Promise.all([
        fetchMilkLogs(),
        fetchMilkLots(),
        fetchProductionBatches(),
        fetchInventoryBalances(),
        fetchDispatches(),
      ]);
      setData({ logs, lots, batches, balances, dispatches });
    } catch (loadError) {
      console.error("Error loading reports:", loadError);
      setError("Unable to load reporting data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const metrics = useMemo(() => {
    const intakeLitres = data.logs.reduce(
      (total, log) => total + (Number(log.quantity) || 0),
      0
    );
    const acceptedLogs = data.logs.filter(
      (log) => log.status === "accepted" || log.status === "paid"
    ).length;
    const inventoryQuantity = data.balances.reduce(
      (total, balance) => total + (Number(balance.quantity) || 0),
      0
    );

    return {
      intakeLitres,
      acceptedLogs,
      rejectedLogs: data.logs.filter((log) => log.status === "rejected").length,
      lots: data.lots.length,
      heldBatches: data.batches.filter((batch) => batch.status === "held").length,
      releasedBatches: data.batches.filter((batch) => batch.status === "released")
        .length,
      inventoryQuantity,
      dispatches: data.dispatches.length,
    };
  }, [data]);

  return (
    <section className="reports">
      <header className="reports-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Production reports</h1>
          <p>Operational metrics from intake through dispatch.</p>
        </div>
        <button type="button" onClick={loadReports} disabled={loading}>
          <FaSync aria-hidden="true" />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {error && <div className="reports-alert">{error}</div>}

      <div className="reports-cards">
        <article>
          <span>Milk intake</span>
          <strong>{metrics.intakeLitres.toLocaleString()} L</strong>
          <small>{data.logs.length} legacy delivery records</small>
        </article>
        <article>
          <span>Accepted deliveries</span>
          <strong>{metrics.acceptedLogs}</strong>
          <small>{metrics.rejectedLogs} rejected records</small>
        </article>
        <article>
          <span>Milk lots</span>
          <strong>{metrics.lots}</strong>
          <small>Created for traceability</small>
        </article>
        <article>
          <span>Held batches</span>
          <strong>{metrics.heldBatches}</strong>
          <small>{metrics.releasedBatches} released batches</small>
        </article>
        <article>
          <span>Inventory balance</span>
          <strong>{metrics.inventoryQuantity.toLocaleString()}</strong>
          <small>Across item/lot/location balances</small>
        </article>
        <article>
          <span>Dispatches</span>
          <strong>{metrics.dispatches}</strong>
          <small>Prepared dispatch records</small>
        </article>
      </div>

      <div className="reports-panel">
        <h2>Operational status</h2>
        {loading ? (
          <p>Loading report data...</p>
        ) : (
          <div className="status-list">
            <div>
              <span>Legacy intake data</span>
              <strong>{data.logs.length ? "Available" : "No records"}</strong>
            </div>
            <div>
              <span>Traceability lots</span>
              <strong>{data.lots.length ? "Active" : "Not started"}</strong>
            </div>
            <div>
              <span>Production QC queue</span>
              <strong>
                {metrics.heldBatches ? `${metrics.heldBatches} awaiting review` : "Clear"}
              </strong>
            </div>
            <div>
              <span>Dispatch pipeline</span>
              <strong>{data.dispatches.length ? "In use" : "No dispatches"}</strong>
            </div>
          </div>
        )}
      </div>

      <p className="reports-note">
        Metrics are operational only. Payment, accounting, payroll, and HR data
        are intentionally excluded.
      </p>
    </section>
  );
}

export default Reports;
