import React, { useState } from "react";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Form-specific styles

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post("http://127.0.0.1:5000/forgot-password", { email });
            setMessage("If this email exists in our system, you'll receive a reset link shortly.");
        } catch (error) {
            setMessage("An error occurred. Please try again.");
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
            {message && (
                <p className={`message ${message.includes("reset link") ? "success-message" : "error-message"}`}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default ForgotPassword;
