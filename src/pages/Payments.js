// src/pages/Payments.js
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  onSnapshot,
  addDoc,
  writeBatch,
  setDoc,
  getDoc
} from "firebase/firestore";
import { db } from "../services/firebase";
import { format } from "date-fns";
import { toast } from "react-hot-toast";
import "./Payments.css";

function Payments() {
  const [logs, setLogs] = useState([]);
  const [feedDeductions, setFeedDeductions] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" }); // Added Date Range State
  const [paymentType, setPaymentType] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pricePerLiter, setPricePerLiter] = useState(45);
  const [showPriceInput, setShowPriceInput] = useState(false);

  // 🔹 Load milk price from system configuration
  useEffect(() => {
    const loadMilkPrice = async () => {
      try {
        const priceDoc = await getDoc(doc(db, "system_config", "milk_price"));
        if (priceDoc.exists()) {
          const data = priceDoc.data();
          setPricePerLiter(data.pricePerLiter || 45);
          console.log(`✅ Loaded milk price from config: KES ${data.pricePerLiter}`);
        }
      } catch (error) {
        console.error("Error loading milk price:", error);
      }
    };
    loadMilkPrice();
  }, []);

  // 🔹 Save milk price to system configuration
  const saveMilkPriceToConfig = async (price) => {
    try {
      await setDoc(doc(db, "system_config", "milk_price"), {
        pricePerLiter: price,
        updatedAt: new Date(),
        updatedBy: "admin"
      });
      console.log(`✅ Milk price saved to system config: KES ${price}`);
    } catch (error) {
      console.error("❌ Error saving milk price:", error);
      throw error;
    }
  };

  // 🔹 Update milk price and save to config
  const updateMilkPrice = async (newPrice) => {
    if (newPrice <= 0) {
      alert('Price must be greater than 0');
      return;
    }

    try {
      setPricePerLiter(newPrice);
      await saveMilkPriceToConfig(newPrice);
      alert(`✅ Milk price updated to KES ${newPrice} per liter`);
      fetchMilkPayments(); // Refresh data with new price
    } catch (error) {
      alert('❌ Failed to save milk price: ' + error.message);
      // Revert to previous price on error
      const priceDoc = await getDoc(doc(db, "system_config", "milk_price"));
      if (priceDoc.exists()) {
        const data = priceDoc.data();
        setPricePerLiter(data.pricePerLiter || 45);
      }
    }
  };

  // 🔹 Fetch farmers
  useEffect(() => {
    const fetchFarmers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const farmerList = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((u) => u.role === "farmer");
      setFarmers(farmerList);
    };
    fetchFarmers();
  }, []);

  // 🔹 Fetch milk logs
  const fetchMilkPayments = async () => {
    let q = query(collection(db, "milk_logs"), orderBy("date", "desc"));

    if (selectedFarmer) {
      q = query(q, where("farmerId", "==", selectedFarmer));
    }
    if (statusFilter) {
      q = query(q, where("status", "==", statusFilter));
    }
    // 🔹 Date Filtering (Exclusive Priority: Range > Month/Year > Year)
    let start, end;

    if (dateRange.start && dateRange.end) {
      // Date Range Priority
      start = new Date(dateRange.start);
      start.setHours(0, 0, 0, 0);

      end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
    } else if (month) {
      // Month Priority (Default to current year if year not selected)
      const targetYear = year || new Date().getFullYear();
      start = new Date(targetYear, month - 1, 1);
      end = new Date(targetYear, month, 0, 23, 59, 59, 999);
    } else if (year) {
      // Year Priority
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
    }

    if (start && end) {
      q = query(q, where("date", ">=", start), where("date", "<=", end));
    }

    const snapshot = await getDocs(q);
    const milkLogs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      type: 'milk_payment',
      // Prioritize stored price, fallback to global config
      amount: (doc.data().quantity ?? 0) * (doc.data().pricePerLiter || pricePerLiter)
    }));

    setLogs(milkLogs);
  };

  // 🔹 Fetch Milk Payments (One-time fetch based on filters)
  useEffect(() => {
    fetchMilkPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarmer, statusFilter, month, year, dateRange, pricePerLiter]);

  // 🔹 Fetch Feed Deductions
  const fetchFeedDeductions = async () => {
    try {
      let q = query(
        collection(db, "payments"),
        where("type", "==", "feed_deduction"),
        orderBy("createdAt", "desc")
      );

      if (selectedFarmer) {
        q = query(q, where("farmerId", "==", selectedFarmer));
      }

      const snapshot = await getDocs(q);
      const deductions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        type: "feed_deduction",
      }));
      setFeedDeductions(deductions);
    } catch (error) {
      console.error("Error fetching feed deductions:", error);
    }
  };

  // 🔹 Fetch Feed Deductions on selection change
  useEffect(() => {
    fetchFeedDeductions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarmer]);

  // 🔹 Clear all filters
  const clearFilters = () => {
    setSelectedFarmer("");
    setStatusFilter("");
    setPaymentType("all");
    setYear("");
    setMonth("");
    setDateRange({ start: "", end: "" });
  };

  // 🔹 INTERNAL: Process payment for a single farmer (returns result object)
  const processSingleFarmerPaymentInternal = async (farmer, batch, timestamp) => {
    // Get farmer's pending milk logs
    let pendingMilkQuery = query(
      collection(db, "milk_logs"),
      where("farmerId", "==", farmer.id),
      where("status", "==", "pending")
    );

    // 🔹 Apply date filter (Month/Year) if selected
    let paymentPeriodLabel = "ALL Pending";
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      pendingMilkQuery = query(pendingMilkQuery, where("date", ">=", start), where("date", "<=", end));
      paymentPeriodLabel = format(start, "MMMM yyyy");
    } else if (year) {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59, 999);
      pendingMilkQuery = query(pendingMilkQuery, where("date", ">=", start), where("date", "<=", end));
      paymentPeriodLabel = `Year ${year}`;
    } else if (month) {
      const currentYear = new Date().getFullYear();
      const start = new Date(currentYear, month - 1, 1);
      const end = new Date(currentYear, month, 0, 23, 59, 59, 999);
      pendingMilkQuery = query(pendingMilkQuery, where("date", ">=", start), where("date", "<=", end));
      paymentPeriodLabel = format(start, "MMMM yyyy");
    }

    const pendingMilkSnapshot = await getDocs(pendingMilkQuery);
    const pendingMilkLogs = pendingMilkSnapshot.docs;

    if (pendingMilkLogs.length === 0) return { success: false, reason: "No pending logs" };

    // Calculate total pending amount
    const totalPendingAmount = pendingMilkLogs.reduce((sum, doc) => {
      const data = doc.data();
      const price = data.pricePerLiter || pricePerLiter;
      return sum + ((data.quantity || 0) * price);
    }, 0);

    // Get pending feed deductions
    const farmerDeductions = feedDeductions.filter(ded =>
      ded.farmerId === farmer.id && ded.status !== 'processed'
    );
    const totalFeedDeductions = farmerDeductions.reduce((sum, ded) =>
      sum + Math.abs(ded.amount || 0), 0
    );

    // Calculate net amount
    const netAmount = totalPendingAmount - totalFeedDeductions;

    if (netAmount <= 0) return { success: false, reason: "Negative or zero balance" };

    // 1. Mark milk logs as paid
    pendingMilkLogs.forEach(milkDoc => {
      const milkRef = doc(db, "milk_logs", milkDoc.id);
      batch.update(milkRef, {
        status: "paid",
        paidDate: timestamp,
        paidAmount: netAmount > 0 ? netAmount : 0,
        pricePerLiter: pricePerLiter
      });
    });

    // 2. Create payment record
    const paymentRef = doc(collection(db, "payments"));
    batch.set(paymentRef, {
      farmerId: farmer.id,
      type: 'milk_payment',
      amount: netAmount,
      description: `Milk payment for ${pendingMilkLogs.length} deliveries (${paymentPeriodLabel})`,
      status: 'completed',
      pendingMilkAmount: totalPendingAmount,
      feedDeductions: totalFeedDeductions,
      netAmount: netAmount,
      pricePerLiter: pricePerLiter,
      createdAt: timestamp,
      updatedAt: timestamp
    });

    // 3. Mark deductions as processed
    farmerDeductions.forEach(deduction => {
      const deductionRef = doc(db, "payments", deduction.id);
      batch.update(deductionRef, {
        status: 'processed',
        processedDate: timestamp,
        appliedToPayment: paymentRef.id
      });
    });

    return {
      success: true,
      netAmount,
      logsCount: pendingMilkLogs.length,
      deductionsCount: farmerDeductions.length
    };
  };

  // 🔹 PROCESS SINGLE PAYMENT (Wrapper)
  const processPayment = async (farmerId) => {
    setIsProcessing(true);
    try {
      const farmer = farmers.find(f => f.id === farmerId);
      if (!farmer) return;

      const batch = writeBatch(db);
      const result = await processSingleFarmerPaymentInternal(farmer, batch, new Date());

      if (result.success) {
        await batch.commit();
        toast.success(`Payment processed for ${farmer.name}!\nAmount: KES ${result.netAmount}`);
        fetchMilkPayments();
        fetchFeedDeductions();
      } else {
        toast.error(`Could not process payment: ${result.reason}`);
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error('Error: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔹 PROCESS ALL PAYMENTS (Bulk)
  const processAllPayments = async () => {
    if (!window.confirm(`Are you sure you want to pay ALL farmers for ${month ? format(new Date(2025, month - 1), 'MMMM') : 'ALL pending periods'}?`)) return;

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const timestamp = new Date();
      let processedCount = 0;
      let totalPaid = 0;

      // Improve: Process in chunks if farmers list is huge, for now batch limit is 500 ops.
      // Assuming avg 10 logs + 1 payment + 2 deductions = ~13 ops per farmer.
      // Safe to process ~30 farmers per batch. For safety, let's just do one batch for simplicity if small scale,
      // OR commits iteratively.

      // Strategy: Create a new batch every iteration? No, commit needs to be atomic or chunked.
      // Firestore batch limit is 500 writes.
      // If we have many farmers, one big batch might fail.
      // Let's iterate and commit per farmer for safety/simplicity in this UI context?
      // OR better: use one batch but check size?
      // Simplest robust approach for "Admin Dashboard" usually implies reasonable scale < 50 farmers active pay.
      // Let's reuse the single helper but with a shared batch, and commit if it gets too big (not easy to track ops count accurately without logic).
      // ALTERNATIVE: Commit PER FARMER (slower but safer and easier for now).

      let successResults = [];

      for (const farmer of farmers) {
        // Create a FRESH batch for each farmer to ensure atomicity per farmer and avoid 500 limit overflow across all farmers
        const singleFarmerBatch = writeBatch(db);
        const result = await processSingleFarmerPaymentInternal(farmer, singleFarmerBatch, timestamp);

        if (result.success) {
          await singleFarmerBatch.commit();
          processedCount++;
          totalPaid += result.netAmount;
          successResults.push(`${farmer.name}: KES ${result.netAmount}`);
        }
      }

      if (processedCount > 0) {
        toast.success(`Bulk Payment Complete!\nPaid ${processedCount} farmers.\nTotal Payout: KES ${totalPaid}`, { duration: 6000 });
        fetchMilkPayments();
        fetchFeedDeductions();
      } else {
        toast('No eligible pending payments found for any farmer.', { icon: 'ℹ️' });
      }

    } catch (error) {
      console.error("Error in bulk payment:", error);
      toast.error('Error executing bulk payments: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔹 AUTO-DEDUCT: Apply feed deductions to pending milk
  const autoDeductFeedCosts = async () => {
    setIsProcessing(true);
    try {
      let totalDeducted = 0;
      let farmersProcessed = 0;

      // Process each farmer
      for (const farmer of farmers) {
        const farmerDeductions = feedDeductions.filter(ded =>
          ded.farmerId === farmer.id && ded.status !== 'processed'
        );

        if (farmerDeductions.length === 0) continue;

        const totalDeductions = farmerDeductions.reduce((sum, ded) =>
          sum + Math.abs(ded.amount || 0), 0
        );

        // Get pending milk logs for this farmer
        const pendingMilkQuery = query(
          collection(db, "milk_logs"),
          where("farmerId", "==", farmer.id),
          where("status", "==", "pending")
        );

        const pendingMilkSnapshot = await getDocs(pendingMilkQuery);
        const pendingMilkLogs = pendingMilkSnapshot.docs;

        if (pendingMilkLogs.length === 0) continue;

        const totalPending = pendingMilkLogs.reduce((sum, doc) => {
          const data = doc.data();
          const price = data.pricePerLiter || pricePerLiter;
          return sum + ((data.quantity || 0) * price);
        }, 0);

        // Calculate deduction amount (can't deduct more than pending)
        const deductionAmount = Math.min(totalDeductions, totalPending);

        if (deductionAmount > 0) {
          const batch = writeBatch(db);

          // Create deduction application record
          const deductionAppRef = doc(collection(db, "deduction_applications"));
          batch.set(deductionAppRef, {
            farmerId: farmer.id,
            amount: -deductionAmount,
            description: `Feed cost deduction applied to pending milk @ KES ${pricePerLiter}/L`,
            originalPending: totalPending,
            deductedAmount: deductionAmount,
            remainingPending: totalPending - deductionAmount,
            pricePerLiter: pricePerLiter,
            createdAt: new Date()
          });

          // Mark deductions as processed
          farmerDeductions.forEach(deduction => {
            const deductionRef = doc(db, "payments", deduction.id);
            batch.update(deductionRef, {
              status: 'processed',
              processedDate: new Date()
            });
          });

          await batch.commit();

          totalDeducted += deductionAmount;
          farmersProcessed++;
          console.log(`✅ Deducted KES ${deductionAmount} from ${farmer.name}`);
        }
      }

      if (totalDeducted > 0) {
        alert(`✅ Successfully applied KES ${totalDeducted} in feed deductions across ${farmersProcessed} farmers`);
      } else {
        alert('ℹ️ No deductions were applied (no matching pending payments)');
      }

      fetchMilkPayments();
      fetchFeedDeductions();

    } catch (error) {
      console.error("Error auto-deducting feed costs:", error);
      alert('❌ Error auto-deducting feed costs: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 🔹 MARK INDIVIDUAL MILK AS PAID (for single payments)
  const markAsPaid = async (milkLogId) => {
    try {
      const milkLog = logs.find(log => log.id === milkLogId);
      if (!milkLog) return;

      await updateDoc(doc(db, "milk_logs", milkLogId), {
        status: "paid",
        paidDate: new Date(),
        pricePerLiter: pricePerLiter
      });

      alert(`✅ Milk delivery marked as paid: ${milkLog.quantity}L @ KES ${pricePerLiter}/L = KES ${milkLog.amount}`);
      fetchMilkPayments();

    } catch (error) {
      console.error("Error marking as paid:", error);
      alert('❌ Error marking as paid: ' + error.message);
    }
  };

  // 🔹 CALCULATE FARMER BALANCE
  const calculateFarmerBalance = (farmerId) => {
    const farmerMilkPending = logs.filter(log =>
      log.farmerId === farmerId && log.status === "pending"
    );
    const farmerMilkPaid = logs.filter(log =>
      log.farmerId === farmerId && log.status === "paid"
    );
    const farmerDeductions = feedDeductions.filter(ded =>
      ded.farmerId === farmerId && ded.status !== 'processed'
    );

    const totalPending = farmerMilkPending.reduce((sum, log) => sum + (log.amount || 0), 0);
    const totalPaid = farmerMilkPaid.reduce((sum, log) => sum + (log.amount || 0), 0);
    const totalDeductions = farmerDeductions.reduce((sum, ded) => sum + Math.abs(ded.amount || 0), 0);

    const netPayable = totalPending - totalDeductions;

    return {
      totalPending,
      totalPaid,
      totalDeductions,
      netPayable,
      hasPending: totalPending > 0,
      hasDeductions: totalDeductions > 0
    };
  };

  // 🔹 CALCULATE TOTALS
  const calculateTotals = () => {
    const milkPaid = logs.filter(log => log.status === "paid");
    const milkPending = logs.filter(log => log.status === "pending");
    const activeDeductions = feedDeductions.filter(ded => ded.status !== 'processed');

    const totalMilkPaid = milkPaid.reduce((sum, log) => sum + (log.amount || 0), 0);
    const totalMilkPending = milkPending.reduce((sum, log) => sum + (log.amount || 0), 0);
    const totalFeedDeductions = activeDeductions.reduce((sum, deduction) =>
      sum + Math.abs(deduction.amount || 0), 0
    );

    const totalMilkValue = totalMilkPaid + totalMilkPending;
    const netPayable = totalMilkPending - totalFeedDeductions;

    return {
      totalMilkPaid,
      totalMilkPending,
      totalFeedDeductions,
      totalMilkValue,
      netPayable
    };
  };

  const {
    totalMilkPaid,
    totalMilkPending,
    totalFeedDeductions,
    totalMilkValue,
    netPayable
  } = calculateTotals();

  const filteredTransactions = [
    ...logs.map(log => ({ ...log, transactionType: 'milk' })),
    ...feedDeductions.filter(ded => ded.status !== 'processed')
      .map(deduction => ({ ...deduction, transactionType: 'feed' }))
  ].filter(transaction => {
    if (paymentType === "milk") return transaction.type === 'milk_payment';
    if (paymentType === "feed") return transaction.type === 'feed_deduction';
    return true;
  });

  // 🔹 Calculate Date Constraints for Picker
  const getDateConstraints = () => {
    if (!year && !month) return { min: undefined, max: undefined };

    const targetYear = year || new Date().getFullYear();
    // month is 1-12
    const startMonthIndex = month ? parseInt(month) - 1 : 0;
    const endMonthIndex = month ? parseInt(month) : 12;

    const minD = new Date(targetYear, startMonthIndex, 1);
    const maxD = new Date(targetYear, endMonthIndex, 0);

    return {
      min: format(minD, "yyyy-MM-dd"),
      max: format(maxD, "yyyy-MM-dd"),
    };
  };

  const { min: minDate, max: maxDate } = getDateConstraints();

  // 🔹 Group transactions by Month
  const groupTransactionsByMonth = (transactions) => {
    const groups = {};
    transactions.forEach((t) => {
      // Use date or createdAt
      const dateObj = t.date?.toDate
        ? t.date.toDate()
        : t.createdAt?.toDate
          ? t.createdAt.toDate()
          : new Date();
      const monthYear = format(dateObj, "MMMM yyyy");
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(t);
    });
    return groups;
  };

  const groupedTransactions = groupTransactionsByMonth(filteredTransactions);

  // 🔹 Export to CSV
  const exportCSV = () => {
    const header = ["Type", "Farmer", "Description", "Amount (KES)", "Status", "Date"];
    const rows = filteredTransactions.map((t) => {
      const farmerName = farmers.find(f => f.id === t.farmerId)?.name || t.farmerId;
      const typeLabel = t.type === 'feed_deduction' ? 'Feed Deduction' : 'Milk Payment';
      const amount = t.type === 'feed_deduction' ? -Math.abs(t.amount || 0) : (t.amount || 0);
      const dateStr = t.date?.toDate
        ? format(t.date.toDate(), "MMM dd, yyyy")
        : t.createdAt?.toDate
          ? format(t.createdAt.toDate(), "MMM dd, yyyy")
          : "N/A";

      return [typeLabel, farmerName, t.description || "", amount, t.status || "pending", dateStr];
    });

    // Calculate total amount
    const totalAmount = filteredTransactions.reduce((sum, t) => {
      const val = t.type === 'feed_deduction' ? -Math.abs(t.amount || 0) : (t.amount || 0);
      return sum + val;
    }, 0);

    // Add Total Row
    const totalRow = ["TOTALS", "", "", totalAmount, "", ""];

    let csvContent =
      "data:text/csv;charset=utf-8," +
      [header, ...rows, totalRow].map((row) => row.map(item => `"${item}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "payments_report.csv");
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="payments">

      {/* 🔹 Milk Price Configuration */}
      <div className="price-configuration">
        <div className="price-header">
          <h3>📈 Milk Price Configuration</h3>
          <button
            className="btn-toggle-price"
            onClick={() => setShowPriceInput(!showPriceInput)}
          >
            {showPriceInput ? '▼ Hide' : '⚙️ Configure Price'}
          </button>
        </div>

        {showPriceInput && (
          <div className="price-input-section">
            <div className="price-input-group">
              <label htmlFor="pricePerLiter">Price per Liter (KES):</label>
              <input
                id="pricePerLiter"
                type="number"
                value={pricePerLiter}
                onChange={(e) => setPricePerLiter(Number(e.target.value))}
                min="1"
                step="0.5"
                placeholder="Enter price per liter"
              />
              <span className="price-info">Current: KES {pricePerLiter} per liter</span>
            </div>
            <div className="price-actions">
              <button
                className="btn-apply-price"
                onClick={() => updateMilkPrice(pricePerLiter)}
              >
                Save Price
              </button>
              <button
                className="btn-reset-price"
                onClick={() => updateMilkPrice(45)}
              >
                Reset to Default
              </button>
            </div>
            <div className="price-save-info">
              <small>Price will be saved to system configuration and used across all calculations</small>
            </div>
          </div>
        )}
      </div>

      {/* 🔹 Payment Processing Section */}
      <div className="payment-processing-section">
        <h3>💳 Payment Processing</h3>

        <div className="processing-buttons">
          <button
            className="btn-auto-deduct"
            onClick={autoDeductFeedCosts}
            disabled={feedDeductions.length === 0 || isProcessing}
          >
            {isProcessing ? '⏳ Processing...' : '🔄 Apply Feed Deductions to Pending Milk'}
          </button>

          {selectedFarmer ? (() => {
            const balance = calculateFarmerBalance(selectedFarmer);
            return (
              <button
                className="btn-process-payment"
                onClick={() => processPayment(selectedFarmer)}
                disabled={!balance.hasPending || isProcessing}
              >
                {isProcessing ? '⏳ Processing...' : `💰 Pay ${farmers.find(f => f.id === selectedFarmer)?.name} (${month ? format(new Date(2025, month - 1), 'MMM') : 'All'}) - KES ${balance.netPayable}`}
              </button>
            );
          })() : (
            <button
              className="btn-process-payment btn-pay-all"
              onClick={processAllPayments}
              disabled={isProcessing}
              style={{ backgroundColor: "#8e44ad" }} // Distinct color for bulk action
            >
              {isProcessing ? '⏳ Processing Bulk...' : `💰 Pay ALL Farmers (${month ? format(new Date(2025, month - 1), 'MMM') : 'All Pending'})`}
            </button>
          )}
        </div>

        <div className="processing-info">
          <p>
            <strong>Current Price:</strong> KES {pricePerLiter} per liter
          </p>
          <p>
            <strong>Feed Deductions:</strong> Apply feed costs to pending milk payments
          </p>
          <p>
            <strong>Process Payment:</strong> Pay farmer after deductions (select farmer first)
          </p>
        </div>
      </div>

      {/* 🔹 Filters */}
      <div className="filters">
        <select
          value={selectedFarmer}
          onChange={(e) => setSelectedFarmer(e.target.value)}
        >
          <option value="">All Farmers</option>
          {farmers.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name || f.id}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>

        <select
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
        >
          <option value="all">All Transactions</option>
          <option value="milk">Milk Payments Only</option>
          <option value="feed">Feed Deductions Only</option>
        </select>

        <input
          type="number"
          placeholder="Year (e.g. 2025)"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />

        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">All Months</option>
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {format(new Date(2025, i), "MMMM")}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateRange.start}
          min={minDate}
          max={maxDate}
          onChange={(e) =>
            setDateRange({ ...dateRange, start: e.target.value })
          }
        />
        <input
          type="date"
          value={dateRange.end}
          min={minDate}
          max={maxDate}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
        />

        <button onClick={fetchMilkPayments}>Apply</button>
        <button className="clear-btn" onClick={clearFilters}>
          ✖ Clear
        </button>
        <button className="export-btn" onClick={exportCSV} style={{ backgroundColor: "#f39c12", color: "white" }}>
          ⬇ Export CSV
        </button>
      </div>

      {/* 🔹 Financial Summary */}
      <div className="financial-summary">
        <div className="summary-card total-milk">
          <h3>🥛 Total Milk Value</h3>
          <div className="amount positive">KES {totalMilkValue}</div>
          <div className="subtext">
            Paid: KES {totalMilkPaid} | Pending: KES {totalMilkPending}
          </div>
          <div className="price-subtext">@ KES {pricePerLiter}/L</div>
        </div>

        <div className="summary-card feed-deductions">
          <h3>🌾 Feed Deductions</h3>
          <div className="amount negative">- KES {totalFeedDeductions}</div>
          <div className="subtext">
            To be deducted from pending milk
          </div>
        </div>

        <div className="summary-card net-payable">
          <h3>💰 Net Payable</h3>
          <div className={`amount ${netPayable >= 0 ? 'positive' : 'negative'}`}>
            KES {netPayable}
          </div>
          <div className="subtext">
            Pending milk after deductions
          </div>
          <div className="price-subtext">@ KES {pricePerLiter}/L</div>
        </div>
      </div>

      {/* 🔹 Transactions Table Grouped by Month */}
      <div className="payments-table-container">
        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="no-transactions">
            <p>No transactions found for the selected filters.</p>
          </div>
        ) : (
          Object.keys(groupedTransactions).map((month) => (
            <div key={month} className="month-group">
              <h3 className="month-header">{month}</h3>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Farmer</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTransactions[month].map((transaction) => (
                    <tr
                      key={transaction.id}
                      className={
                        transaction.type === "feed_deduction" ? "deduction-row" : ""
                      }
                    >
                      <td>
                        {transaction.type === "feed_deduction" ? (
                          <span className="transaction-type feed">🌾 Feed</span>
                        ) : (
                          <span className="transaction-type milk">🥛 Milk</span>
                        )}
                      </td>
                      <td className="farmer-name">
                        {farmers.find((f) => f.id === transaction.farmerId)?.name ||
                          transaction.farmerId}
                      </td>
                      <td className="description">
                        {transaction.type === "feed_deduction"
                          ? transaction.description || `Feed Purchase`
                          : `Milk Delivery: ${transaction.quantity}L @ KES ${pricePerLiter}/L`}
                      </td>
                      <td
                        className={`amount-cell ${transaction.type === "feed_deduction"
                          ? "deduction-amount"
                          : "payment-amount"
                          }`}
                      >
                        {transaction.type === "feed_deduction"
                          ? `- KES ${Math.abs(transaction.amount || 0)}`
                          : `KES ${transaction.amount}`}
                      </td>
                      <td className={`status-${transaction.status}`}>
                        {transaction.status || "pending"}
                      </td>
                      <td>
                        {transaction.date?.toDate
                          ? format(transaction.date.toDate(), "MMM dd, yyyy")
                          : transaction.createdAt?.toDate
                            ? format(transaction.createdAt.toDate(), "MMM dd, yyyy")
                            : "N/A"}
                      </td>
                      <td>
                        {transaction.type === "milk_payment" &&
                          transaction.status === "pending" ? (
                          <button
                            onClick={() => markAsPaid(transaction.id)}
                            className="mark-paid"
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span className="no-action">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* 🔹 Farmer-wise Breakdown */}
      <div className="farmer-breakdown">
        <h3>📊 Farmer Balances</h3>
        <div className="breakdown-cards">
          {farmers.filter(f => !selectedFarmer || f.id === selectedFarmer).map(farmer => {
            const balance = calculateFarmerBalance(farmer.id);

            return (
              <div key={farmer.id} className="farmer-card">
                <h4>{farmer.name || farmer.id}</h4>
                <div className="farmer-stats">
                  <div>Pending Milk: <span className="pending">KES {balance.totalPending}</span></div>
                  <div>Feed Deductions: <span className="negative">- KES {balance.totalDeductions}</span></div>
                  <div className="net-amount">
                    Net Payable: <span className={balance.netPayable >= 0 ? 'positive' : 'negative'}>KES {balance.netPayable}</span>
                  </div>
                  <div className="price-info">Price: KES {pricePerLiter}/L</div>
                </div>
                <div className="farmer-actions">
                  <button
                    onClick={() => processPayment(farmer.id)}
                    disabled={!balance.hasPending || isProcessing}
                    className="btn-pay-farmer"
                  >
                    {isProcessing ? 'Processing...' : `Pay KES ${balance.netPayable}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Payments;