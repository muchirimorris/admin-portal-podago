
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Sends a notification to a specific user.
 * 
 * @param {string} userId - The ID of the user to receive the notification.
 * @param {string} title - The title of the notification.
 * @param {string} body - The body text of the notification.
 * @param {string} type - The type of notification (e.g., 'payment', 'info', 'warning').
 * @returns {Promise<string>} - The ID of the created notification document.
 */
export const sendNotification = async (userId, title, body, type = 'info') => {
    try {
        const notificationRef = await addDoc(collection(db, "notifications"), {
            userId,
            title,
            body,
            type,
            isRead: false,
            createdAt: serverTimestamp(),
        });
        console.log("Notification sent with ID: ", notificationRef.id);
        return notificationRef.id;
    } catch (e) {
        console.error("Error adding notification: ", e);
        throw e;
    }
};
