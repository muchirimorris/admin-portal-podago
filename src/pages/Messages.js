import React, { useState, useEffect, useRef } from 'react';
import ChatService from '../services/chatService';
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";
import './Messages.css';

// Simple Avatar Utility
const getAvatarColor = (name) => {
    const colors = ['#FF5733', '#33C1FF', '#33FF57', '#FF33A1', '#FF8C33', '#8C33FF'];
    let hash = 0;
    if (!name) return colors[0];
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const Messages = () => {
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const messagesEndRef = useRef(null);

    // Load Chats
    useEffect(() => {
        const unsubscribe = ChatService.getChats((data) => {
            setChats(data);
        });
        return () => unsubscribe();
    }, []);

    // Load Messages when chat is selected
    useEffect(() => {
        if (selectedChat) {
            const unsubscribe = ChatService.getMessages(selectedChat.id, (data) => {
                setMessages(data);
                // Mark as read when opening
                ChatService.markAsRead(selectedChat.id);
            });
            return () => unsubscribe();
        }
    }, [selectedChat]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        try {
            // If this is a new chat (no messages yet), we need to pass user data to create metadata
            const userData = {
                name: selectedChat.userName,
                role: selectedChat.userRole
            };

            await ChatService.sendMessage(selectedChat.id, newMessage, userData);
            setNewMessage("");
        } catch (error) {
            console.error("Failed to send message", error);
        }
    };

    const openNewChatModal = async () => {
        setShowNewChatModal(true);
        try {
            // Fetch all users
            const q = query(collection(db, "users"), orderBy("name"));
            const snapshot = await getDocs(q);
            const userList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(userList);
        } catch (e) {
            console.error("Error fetching users", e);
        }
    };

    const startChat = (user) => {
        // Check if chat already exists
        const existingChat = chats.find(c => c.id === user.id);
        if (existingChat) {
            setSelectedChat(existingChat);
        } else {
            // Create a temporary chat object
            setSelectedChat({
                id: user.id,
                userName: user.name,
                userRole: user.role,
                lastMessage: '',
                unreadCount: 0
            });
        }
        setShowNewChatModal(false);
    };

    const filteredUsers = users.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatTime = (timestamp) => {
        if (!timestamp) return "";
        const date = timestamp.toDate();
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return "";
        const date = timestamp.toDate();
        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString();
    };

    return (
        <div className="messages-container">
            {/* Sidebar - Chat List */}
            <div className="chat-list-sidebar">
                <div className="chat-list-header">
                    <h2>Messages</h2>
                    <button className="new-chat-btn" onClick={openNewChatModal} title="New Message">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                    </button>
                </div>
                <div className="chat-list">
                    {chats.map((chat) => (
                        <div
                            key={chat.id}
                            className={`chat-item ${selectedChat?.id === chat.id ? 'active' : ''}`}
                            onClick={() => setSelectedChat(chat)}
                        >
                            <div
                                className="chat-avatar"
                                style={{ backgroundColor: getAvatarColor(chat.userName) }}
                            >
                                {chat.userName ? chat.userName.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="chat-info">
                                <div className="chat-name">{chat.userName || 'Unknown User'}</div>
                                <div className="chat-preview">{chat.lastMessage}</div>
                            </div>
                            <div className="chat-meta">
                                <span className="chat-time">{formatDate(chat.lastMessageTime)}</span>
                                {chat.unreadCount > 0 && (
                                    <span className="unread-badge">{chat.unreadCount}</span>
                                )}
                            </div>
                        </div>
                    ))}
                    {chats.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No conversations yet</div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="chat-area">
                {selectedChat ? (
                    <>
                        <div className="chat-header">
                            <h3>{selectedChat.userName}</h3>
                            <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#888', textTransform: 'capitalize' }}>
                                ({selectedChat.userRole})
                            </span>
                        </div>

                        <div className="chat-messages">
                            {messages.map((msg) => {
                                const isMe = msg.senderId === 'admin';
                                return (
                                    <div key={msg.id} className={`message-bubble ${isMe ? 'sent' : 'received'}`}>
                                        {msg.text}
                                        <span className="message-time">{formatTime(msg.timestamp)}</span>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <form className="chat-input-area" onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                className="chat-input"
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                            />
                            <button type="submit" className="send-button" disabled={!newMessage.trim()}>
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                                </svg>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="no-chat-selected">
                        <svg viewBox="0 0 24 24" width="60" height="60" fill="#ddd">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
                        </svg>
                        <p>Select a conversation to start chatting</p>
                    </div>
                )}
            </div>

            {/* New Chat Modal */}
            {showNewChatModal && (
                <div className="modal-overlay" onClick={() => setShowNewChatModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>New Message</h3>
                            <button onClick={() => setShowNewChatModal(false)}>×</button>
                        </div>
                        <div className="modal-search">
                            <input
                                type="text"
                                placeholder="Search farmers or collectors..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="user-list">
                            {filteredUsers.map(user => (
                                <div key={user.id} className="user-item" onClick={() => startChat(user)}>
                                    <div
                                        className="chat-avatar"
                                        style={{ backgroundColor: getAvatarColor(user.name), width: 32, height: 32, fontSize: '0.9rem' }}
                                    >
                                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div className="user-info">
                                        <div className="user-name">{user.name}</div>
                                        <div className="user-role">{user.role}</div>
                                    </div>
                                </div>
                            ))}
                            {filteredUsers.length === 0 && (
                                <div className="no-results">No users found</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Messages;
