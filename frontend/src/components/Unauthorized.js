import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/unauthorized.css"; // Specific to this page

const Unauthorized = () => {
    const navigate = useNavigate();

    return (
        <div className="unauthorized-container">
            <h2 className="unauthorized-title">Unauthorized Access</h2>
            <p className="unauthorized-message">
                You do not have permission to access this page.
            </p>
            <button onClick={() => navigate("/login")} className="dashboard-button primary">
                Go to Login
            </button>
        </div>
    );
};

export default Unauthorized;
