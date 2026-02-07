import React from 'react';
import './Loading.css';

const Loading = ({ message = "Loading Podago Portal..." }) => {
    return (
        <div className="loading-container">
            <div className="loading-content">
                <div className="spinner-ring"></div>
                <div className="logo-pulse">🥬</div>
                <p className="loading-text">{message}</p>
            </div>
        </div>
    );
};

export default Loading;
