import React, { useState } from "react";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Form-specific styles

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        setError("");

        try {
            const deviceToken = localStorage.getItem("device_token"); // 🔐 Include device token for security

            await axios.post(
                `${API_URL}/forgot-password`,
                { email },
                {
                    headers: {
                        "Device-Token": deviceToken, // 🔐 Secure API Request
                        "Content-Type": "application/json",
                    },
                }
            );

            setMessage("If this email exists in our system, you'll receive a reset link shortly.");
        } catch (error) {
            console.error("Error requesting password reset:", error);
            setError("An error occurred. Please try again.");
        }
    };

    return (
        <div className="form-container">
            <h2 className="form-title">Forgot Password</h2>
            <form onSubmit={handleSubmit} className="form-content">
                <div className="form-group">
                    <label className="form-question">Email Address</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-actions">
                    <button type="submit" className="dashboard-button primary">
                        Submit
                    </button>
                </div>
            </form>
            {message && <p className="success-message">{message}</p>}
            {error && <p className="error-message">{error}</p>}
        </div>
    );
};

export default ForgotPassword;
