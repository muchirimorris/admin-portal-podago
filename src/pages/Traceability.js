import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { FaProjectDiagram } from "react-icons/fa";
import {
  fetchMilkLotTraceability,
  fetchMilkLots,
} from "../services/milkLogService";
import "./Traceability.css";

function displayDate(value) {
  if (value?.toDate) {
    return format(value.toDate(), "MMM dd, yyyy HH:mm");
  }
  if (value) {
    return format(new Date(value), "MMM dd, yyyy HH:mm");
  }
  return "—";
}

function Traceability() {
  const [lots, setLots] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadLots = async () => {
      try {
        setLots(await fetchMilkLots());
      } catch (loadError) {
        console.error("Error loading traceability lots:", loadError);
        setError("Unable to load milk lots.");
      } finally {
        setLoading(false);
      }
    };

    loadLots();
  }, []);

  const handleLotChange = async (event) => {
    const lotId = event.target.value;
    setSelectedLotId(lotId);
    setTrace(null);
    setError("");

    if (!lotId) {
      return;
    }

    setLoadingTrace(true);
    try {
      setTrace(await fetchMilkLotTraceability(lotId));
    } catch (traceError) {
      console.error("Error loading milk-lot traceability:", traceError);
      setError("Unable to load the selected lot traceability.");
    } finally {
      setLoadingTrace(false);
    }
  };

  return (
    <section className="traceability">
      <header className="traceability-header">
        <div>
          <p className="eyebrow">Traceability</p>
          <h1>Milk-lot trace</h1>
          <p>Follow a lot back to its source deliveries and tanks.</p>
        </div>
        <FaProjectDiagram aria-hidden="true" />
      </header>

      {error && <div className="trace-alert">{error}</div>}

      <div className="trace-panel">
        <label>
          Milk lot
          <select
            value={selectedLotId}
            onChange={handleLotChange}
            disabled={loading || loadingTrace}
          >
            <option value="">
              {loading ? "Loading lots..." : "Select milk lot"}
            </option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.lotNo} · {lot.quantityLitres || 0} L
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadingTrace && <p>Loading traceability...</p>}

      {trace && (
        <div className="trace-grid">
          <section className="trace-panel">
            <h2>Lot summary</h2>
            <dl className="trace-summary">
              <div>
                <dt>Lot number</dt>
                <dd>{trace.lot.lotNo}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{trace.lot.status || "—"}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{trace.lot.quantityLitres || 0} L</dd>
              </div>
              <div>
                <dt>Tank</dt>
                <dd>{trace.lot.tankId || "—"}</dd>
              </div>
              <div>
                <dt>Received</dt>
                <dd>{displayDate(trace.lot.receivedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="trace-panel">
            <h2>Tank movements</h2>
            {trace.movements.length === 0 ? (
              <p>No tank movements recorded.</p>
            ) : (
              <div className="trace-list">
                {trace.movements.map((movement) => (
                  <article key={movement.id}>
                    <strong>{movement.movementType}</strong>
                    <span>
                      {movement.quantityLitres || 0} L · Tank{" "}
                      {movement.tankId || "—"}
                    </span>
                    <small>{displayDate(movement.occurredAt)}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="trace-panel trace-panel-wide">
            <h2>Source deliveries</h2>
            {trace.deliveries.length === 0 ? (
              <p>No source delivery records were found.</p>
            ) : (
              <div className="trace-table-wrap">
                <table className="trace-table">
                  <thead>
                    <tr>
                      <th>Farmer</th>
                      <th>Collector</th>
                      <th>Quantity</th>
                      <th>Captured</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.deliveries.map((delivery) => (
                      <tr key={delivery.id}>
                        <td>{delivery.farmerName || delivery.farmerId || "—"}</td>
                        <td>{delivery.collectorName || "—"}</td>
                        <td>{delivery.quantity || 0} L</td>
                        <td>{displayDate(delivery.date)}</td>
                        <td>{delivery.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default Traceability;
