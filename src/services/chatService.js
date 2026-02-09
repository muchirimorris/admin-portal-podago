import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc, increment } from "firebase/firestore";
import { db } from "./firebase";

const CHATS_COLLECTION = "chats";

class ChatService {
    // Listen to all chat threads
    getChats(callback) {
        const q = query(
            collection(db, CHATS_COLLECTION),
            orderBy("lastMessageTime", "desc")
        );

        return onSnapshot(q, (snapshot) => {
            const chats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(chats);
        });
    }

    // Listen to messages for a specific chat
    getMessages(userId, callback) {
        const q = query(
            collection(db, CHATS_COLLECTION, userId, "messages"),
            orderBy("timestamp", "asc")
        );

        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(messages);
        });
    }

    // Send a reply as Admin
    async sendMessage(userId, text, userData = null) {
        try {
            const timestamp = serverTimestamp();

            // 1. Add message to subcollection
            await addDoc(collection(db, CHATS_COLLECTION, userId, "messages"), {
                senderId: "admin",
                text: text,
                timestamp: timestamp,
                isRead: false,
            });

            // 2. Update chat metadata
            const updateData = {
                lastMessage: text,
                lastMessageTime: timestamp,
                userUnreadCount: increment(1)
            };

            // If creating a new chat, include user details
            if (userData) {
                updateData.userId = userId;
                updateData.userName = userData.name;
                updateData.userRole = userData.role;
            }

            // setDoc with merge: true handles both update and create
            await setDoc(doc(db, CHATS_COLLECTION, userId), updateData, { merge: true });


        } catch (error) {
            console.error("Error sending message:", error);
            throw error;
        }
    }

    // Mark chat as read (by admin)
    async markAsRead(userId) {
        try {
            await updateDoc(doc(db, CHATS_COLLECTION, userId), {
                unreadCount: 0 // Reset unread count for admin view
            });
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    }
}

export default new ChatService();
