const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, writeBatch, getDoc, setDoc } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyAovcyET3wBQsSblFqx144lBR0cPUdxi2M",
    authDomain: "podago-77fb0.firebaseapp.com",
    projectId: "podago-77fb0",
    storageBucket: "podago-77fb0.firebasestorage.app",
    messagingSenderId: "1891379737",
    appId: "1:1891379737:web:ea1024cd2c3e92266e1888"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const migrateFarmers = async () => {
    console.log("Starting migration...");

    // 1. Get current counter
    const counterRef = doc(db, "counters", "farmers");
    let counterSnap = await getDoc(counterRef);
    let currentSequence = 0;

    if (counterSnap.exists()) {
        currentSequence = counterSnap.data().currentSequence || 0;
        console.log(`Current counter is at: ${currentSequence}`);
    } else {
        console.log("Counter not initialized. Starting from 0.");
    }

    // 2. Get all farmers
    const farmersRef = collection(db, "users");
    const snapshot = await getDocs(farmersRef);

    const farmersToUpdate = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.role === 'farmer') {
            // Check if they already have a valid PC ID
            if (!data.farmerId || !data.farmerId.startsWith('PC')) {
                farmersToUpdate.push({ ref: doc.ref, data: data });
            }
        }
    });

    console.log(`Found ${farmersToUpdate.length} farmers needing migration.`);

    if (farmersToUpdate.length === 0) {
        console.log("No farmers to migrate.");
        process.exit(0);
    }

    // 3. Update in batches
    const batchSize = 500;
    const batches = [];
    let batch = writeBatch(db);
    let operationCount = 0;

    for (const farmer of farmersToUpdate) {
        currentSequence++;
        const newId = `PC${String(currentSequence).padStart(5, '0')}`;

        // Update the farmer document with the new farmerId field
        // We preserve the Document ID (random string) but add the clean ID as a field
        batch.update(farmer.ref, { farmerId: newId });

        console.log(`Assigning ${newId} to ${farmer.data.name} (${farmer.ref.id})`);

        operationCount++;
        if (operationCount >= batchSize) {
            batches.push(batch.commit());
            batch = writeBatch(db);
            operationCount = 0;
        }
    }

    if (operationCount > 0) {
        batches.push(batch.commit());
    }

    await Promise.all(batches);

    // 4. Update final counter
    await setDoc(counterRef, { currentSequence: currentSequence });
    console.log(`Migration complete! Final sequence: ${currentSequence}`);

    process.exit(0);
};

migrateFarmers();
