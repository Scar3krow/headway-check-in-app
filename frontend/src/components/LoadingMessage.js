import React from "react";
import "../styles/loading.css"; // Create a new CSS file for loading styles

const LoadingMessage = ({ text = "Loading..." }) => {
    return (
        <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">{text}</p>
        </div>
    );
};

export default LoadingMessage;
