import React, { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Form-specific styles

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000"

const ResetPassword = () => {
    const { token } = useParams();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage("Passwords do not match.");
            return;
        }

        try {
            await axios.post('${API_URL}/reset-password', { token, password });
            setMessage("Your password has been reset successfully.");
        } catch (error) {
            setMessage("An error occurred. Please try again.");
        }
    };

    return (
        <div className="form-container">
            <h2 className="form-title">Reset Password</h2>
            <form onSubmit={handleSubmit} className="form-content">
                <div className="form-group">
                    <label>New Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Confirm Password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-actions">
                    <button type="submit" className="dashboard-button primary">
                        Reset Password
                    </button>
                </div>
            </form>
            {message && <p className={`message ${message.includes("successfully") ? "success-message" : "error-message"}`}>
                {message}
            </p>}
        </div>
    );
};

export default ResetPassword;
