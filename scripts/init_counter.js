const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc, getDoc } = require("firebase/firestore");

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

const initCounter = async () => {
    const counterRef = doc(db, "counters", "farmers");
    const docSnap = await getDoc(counterRef);

    if (!docSnap.exists()) {
        console.log("Initializing counter...");
        await setDoc(counterRef, { currentSequence: 0 });
        console.log("Counter initialized to 0.");
    } else {
        console.log("Counter already exists. Current value:", docSnap.data().currentSequence);
    }
    process.exit();
};

initCounter();
