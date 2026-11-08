import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const USERS_COLLECTION = "users";
const MILK_LOGS_COLLECTION = "milk_logs";

export async function fetchUsersByRole(role) {
  const snapshot = await getDocs(
    query(collection(db, USERS_COLLECTION), where("role", "==", role))
  );

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function fetchMilkLogs({
  farmerId,
  collectorName,
  startDate,
  endDate,
} = {}) {
  const constraints = [];

  if (farmerId) {
    constraints.push(where("farmerId", "==", farmerId));
  }

  if (collectorName) {
    constraints.push(where("collectorName", "==", collectorName));
  }

  if (startDate && endDate) {
    constraints.push(where("date", ">=", startDate));
    constraints.push(where("date", "<=", endDate));
  }

  constraints.push(orderBy("date", "desc"));

  const snapshot = await getDocs(
    query(collection(db, MILK_LOGS_COLLECTION), ...constraints)
  );

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function createReceptionTest({
  deliveryId,
  temperatureC,
  alcoholCobResult,
  density,
  fatPercent,
  snfPercent,
  antibioticResult,
  adulterationResult,
  decision,
  reason,
  ruleVersion,
}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to record a reception test.");
  }

  const reference = await addDoc(collection(db, "reception_tests"), {
    deliveryId,
    temperatureC,
    alcoholCobResult,
    density,
    fatPercent,
    snfPercent,
    antibioticResult,
    adulterationResult,
    decision,
    reason: reason || null,
    ruleVersion,
    testedByUid: user.uid,
    testedAt: serverTimestamp(),
  });

  return reference.id;
}

export async function fetchMilkLots() {
  const snapshot = await getDocs(
    query(collection(db, "milk_lots"), orderBy("createdAt", "desc"))
  );

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function createMilkLot({
  lotNo,
  siteId,
  tankId,
  receivedAt,
  quantityLitres,
  deliveryIds,
}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to create a milk lot.");
  }

  const batch = writeBatch(db);
  const lotReference = doc(collection(db, "milk_lots"));
  const movementReference = doc(collection(db, "tank_movements"));
  const auditReference = doc(collection(db, "audit_events"));
  const receivedDate = new Date(receivedAt);

  if (Number.isNaN(receivedDate.getTime())) {
    throw new Error("Received time is invalid.");
  }

  batch.set(lotReference, {
    lotNo,
    siteId,
    tankId,
    receivedAt: receivedDate,
    quantityLitres: Number(quantityLitres),
    status: "available",
    deliveryIds,
    createdByUid: user.uid,
    createdAt: serverTimestamp(),
  });

  deliveryIds.forEach((deliveryId) => {
    batch.set(
      doc(collection(db, "milk_lots", lotReference.id, "deliveries"), deliveryId),
      {
        deliveryId,
        linkedByUid: user.uid,
        linkedAt: serverTimestamp(),
      }
    );
  });

  batch.set(movementReference, {
    milkLotId: lotReference.id,
    tankId,
    movementType: "in",
    quantityLitres: Number(quantityLitres),
    occurredAt: receivedDate,
    recordedByUid: user.uid,
    createdAt: serverTimestamp(),
  });

  batch.set(auditReference, {
    action: "milk_lot_created",
    entityType: "milk_lot",
    entityId: lotReference.id,
    actorUid: user.uid,
    source: "web",
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return lotReference.id;
}

export async function fetchMilkLotTraceability(lotId) {
  const lotSnapshot = await getDoc(doc(db, "milk_lots", lotId));
  if (!lotSnapshot.exists()) {
    throw new Error("Milk lot was not found.");
  }

  const lot = { id: lotSnapshot.id, ...lotSnapshot.data() };
  const deliveryIds = Array.isArray(lot.deliveryIds) ? lot.deliveryIds : [];

  const [deliverySnapshots, movementSnapshot] = await Promise.all([
    Promise.all(
      deliveryIds.map((deliveryId) =>
        getDoc(doc(db, "milk_logs", deliveryId))
      )
    ),
    getDocs(
      query(
        collection(db, "tank_movements"),
        where("milkLotId", "==", lotId),
        orderBy("occurredAt", "desc")
      )
    ),
  ]);

  return {
    lot,
    deliveries: deliverySnapshots
      .filter((snapshot) => snapshot.exists())
      .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
    movements: movementSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
  };
}

export async function fetchProductionBatches() {
  const snapshot = await getDocs(
    query(
      collection(db, "production_batches"),
      orderBy("createdAt", "desc")
    )
  );

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function createProductionBatch({
  batchNo,
  productCode,
  productName,
  inputLotId,
  inputQuantityLitres,
  outputQuantity,
  outputUnit,
  startedAt,
  pasteurisationTime,
  pasteurisationTempC,
  line,
}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to create a production batch.");
  }

  const startedDate = new Date(startedAt);
  const pasteurisationDate = new Date(pasteurisationTime);
  if (Number.isNaN(startedDate.getTime()) || Number.isNaN(pasteurisationDate.getTime())) {
    throw new Error("Batch times are invalid.");
  }

  const batch = writeBatch(db);
  const batchReference = doc(collection(db, "production_batches"));
  const inputReference = doc(
    collection(db, "production_batches", batchReference.id, "inputs")
  );
  const outputReference = doc(
    collection(db, "production_batches", batchReference.id, "outputs")
  );
  const auditReference = doc(collection(db, "audit_events"));

  batch.set(batchReference, {
    batchNo,
    productCode,
    productName,
    line: line || null,
    status: "held",
    startedAt: startedDate,
    pasteurisationTime: pasteurisationDate,
    pasteurisationTempC: Number(pasteurisationTempC),
    createdByUid: user.uid,
    createdAt: serverTimestamp(),
  });

  batch.set(inputReference, {
    milkLotId: inputLotId,
    quantityLitres: Number(inputQuantityLitres),
    createdAt: serverTimestamp(),
  });

  batch.set(outputReference, {
    productCode,
    productName,
    quantity: Number(outputQuantity),
    unit: outputUnit,
    status: "held",
    createdAt: serverTimestamp(),
  });

  batch.set(auditReference, {
    action: "production_batch_created",
    entityType: "production_batch",
    entityId: batchReference.id,
    actorUid: user.uid,
    source: "web",
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return batchReference.id;
}

export async function recordBatchQcDecision({
  batchId,
  testType,
  result,
  ccpStatus,
  notes,
  decision,
}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to record batch QC.");
  }

  const batchReference = doc(db, "production_batches", batchId);
  const qualityReference = doc(collection(db, "batch_quality_tests"));
  const auditReference = doc(collection(db, "audit_events"));

  await runTransaction(db, async (transaction) => {
    const batchSnapshot = await transaction.get(batchReference);
    if (!batchSnapshot.exists()) {
      throw new Error("Production batch was not found.");
    }

    const currentStatus = batchSnapshot.data().status;
    if (currentStatus !== "held") {
      throw new Error(
        `This batch is already ${currentStatus || "closed"} and cannot be changed.`
      );
    }

    transaction.set(qualityReference, {
      batchId,
      testType,
      result,
      ccpStatus,
      notes: notes || null,
      decision,
      testedByUid: user.uid,
      testedAt: serverTimestamp(),
    });

    transaction.update(batchReference, {
      status: decision,
      lastQcTestId: qualityReference.id,
      updatedAt: serverTimestamp(),
    });

    transaction.set(auditReference, {
      action: `production_batch_${decision}`,
      entityType: "production_batch",
      entityId: batchId,
      actorUid: user.uid,
      source: "web",
      createdAt: serverTimestamp(),
    });
  });
}

export async function fetchInventoryItems() {
  const snapshot = await getDocs(
    query(collection(db, "inventory_items"), orderBy("name", "asc"))
  );

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function fetchInventoryMovements() {
  const snapshot = await getDocs(
    query(
      collection(db, "inventory_movements"),
      orderBy("createdAt", "desc")
    )
  );

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function createInventoryItem({
  itemCode,
  name,
  category,
  unit,
  reorderLevel,
}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to create an inventory item.");
  }

  await setDoc(doc(db, "inventory_items", itemCode), {
    itemCode,
    name,
    category,
    unit,
    reorderLevel: Number(reorderLevel) || 0,
    active: true,
    createdByUid: user.uid,
    createdAt: serverTimestamp(),
  });
}

export async function recordInventoryMovement({
  itemCode,
  lotNo,
  movementType,
  quantity,
  unit,
  location,
  sourceLocation,
  expiryDate,
  reference,
  reason,
}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to record inventory movement.");
  }
  if (!Number(quantity) || Number(quantity) <= 0) {
    throw new Error("Inventory quantity must be greater than zero.");
  }

  if (movementType === "transfer" && (!sourceLocation || sourceLocation === location)) {
    throw new Error("Transfers require different source and destination locations.");
  }

  const movementReference = doc(collection(db, "inventory_movements"));
  const auditReference = doc(collection(db, "audit_events"));
  const movementQuantity = Number(quantity);
  const balanceId = (balanceLocation) =>
    [itemCode, lotNo, balanceLocation]
      .map((value) => encodeURIComponent(value))
      .join("__");
  const sourceBalanceReference = doc(
    db,
    "inventory_balances",
    balanceId(movementType === "transfer" ? sourceLocation : location)
  );
  const destinationBalanceReference = doc(
    db,
    "inventory_balances",
    balanceId(location)
  );

  await runTransaction(db, async (transaction) => {
    const sourceSnapshot = await transaction.get(sourceBalanceReference);
    const sourceQuantity = Number(sourceSnapshot.data()?.quantity || 0);
    const decreasesStock = movementType === "issue" || movementType === "wastage";
    const isTransfer = movementType === "transfer";

    if ((decreasesStock || isTransfer) && sourceQuantity < movementQuantity) {
      throw new Error(
        `Insufficient stock. Available: ${sourceQuantity} ${unit}.`
      );
    }

    const movement = {
      itemCode,
      lotNo,
      movementType,
      quantity: movementQuantity,
      unit,
      location,
      sourceLocation: sourceLocation || null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      reference: reference || null,
      reason: reason || null,
      recordedByUid: user.uid,
      createdAt: serverTimestamp(),
    };

    transaction.set(movementReference, movement);

    if (isTransfer) {
      const destinationSnapshot = await transaction.get(destinationBalanceReference);
      const destinationQuantity = Number(destinationSnapshot.data()?.quantity || 0);
      transaction.set(sourceBalanceReference, {
        itemCode,
        lotNo,
        location: sourceLocation,
        unit,
        quantity: sourceQuantity - movementQuantity,
        updatedAt: serverTimestamp(),
      });
      transaction.set(destinationBalanceReference, {
        itemCode,
        lotNo,
        location,
        unit,
        quantity: destinationQuantity + movementQuantity,
        updatedAt: serverTimestamp(),
      });
    } else {
      const delta = decreasesStock ? -movementQuantity : movementQuantity;
      transaction.set(destinationBalanceReference, {
        itemCode,
        lotNo,
        location,
        unit,
        quantity: sourceQuantity + delta,
        updatedAt: serverTimestamp(),
      });
    }

    transaction.set(auditReference, {
      action: "inventory_movement_recorded",
      entityType: "inventory_movement",
      entityId: movementReference.id,
      actorUid: user.uid,
      source: "web",
      createdAt: serverTimestamp(),
    });
  });
}

export async function fetchInventoryBalances() {
  const snapshot = await getDocs(
    query(collection(db, "inventory_balances"), orderBy("updatedAt", "desc"))
  );

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function fetchDispatches() {
  const snapshot = await getDocs(
    query(collection(db, "dispatches"), orderBy("createdAt", "desc"))
  );

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function createDispatch({
  dispatchNo,
  batchId,
  outputLotNo,
  quantity,
  vehicleRegistration,
  driverName,
  route,
  departureAt,
  departureTemperatureC,
}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to create a dispatch.");
  }

  const departureDate = new Date(departureAt);
  if (Number.isNaN(departureDate.getTime())) {
    throw new Error("Departure time is invalid.");
  }
  if (!Number(quantity) || Number(quantity) <= 0) {
    throw new Error("Dispatch quantity must be greater than zero.");
  }

  const dispatchReference = doc(collection(db, "dispatches"));
  const itemReference = doc(
    collection(db, "dispatches", dispatchReference.id, "items")
  );
  const temperatureReference = doc(collection(db, "cold_chain_logs"));
  const auditReference = doc(collection(db, "audit_events"));
  const batchReference = doc(db, "production_batches", batchId);

  await runTransaction(db, async (transaction) => {
    const batchSnapshot = await transaction.get(batchReference);
    if (!batchSnapshot.exists()) {
      throw new Error("Production batch was not found.");
    }
    if (batchSnapshot.data().status !== "released") {
      throw new Error("Only released production batches can be dispatched.");
    }

    transaction.set(dispatchReference, {
      dispatchNo,
      batchId,
      vehicleRegistration,
      driverName,
      route,
      status: "prepared",
      dispatchedAt: departureDate,
      createdByUid: user.uid,
      createdAt: serverTimestamp(),
    });

    transaction.set(itemReference, {
      outputLotNo,
      quantity: Number(quantity),
      createdAt: serverTimestamp(),
    });

    transaction.set(temperatureReference, {
      dispatchId: dispatchReference.id,
      temperatureC: Number(departureTemperatureC),
      recordedAt: departureDate,
      recordedByUid: user.uid,
      createdAt: serverTimestamp(),
    });

    transaction.set(auditReference, {
      action: "dispatch_created",
      entityType: "dispatch",
      entityId: dispatchReference.id,
      actorUid: user.uid,
      source: "web",
      createdAt: serverTimestamp(),
    });
  });
}
