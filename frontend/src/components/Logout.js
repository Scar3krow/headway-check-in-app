import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const Logout = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const logoutUser = async () => {
            try {
                const token = localStorage.getItem("token");
                const deviceToken = localStorage.getItem("device_token");

                if (token && deviceToken) {
                    // ✅ Send request to remove device session from Firestore
                    await axios.post(
                        `${API_URL}/logout-device`,
                        { device_token: deviceToken }, // 🔥 Send device_token to backend
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        }
                    );
                }
            } catch (error) {
                console.error("Error logging out:", error);
            }

            // ✅ Clear all stored session data (LocalStorage)
            localStorage.removeItem("token");
            localStorage.removeItem("role");
            localStorage.removeItem("user_id");
            localStorage.removeItem("device_token");

            // ✅ Redirect to login page
            navigate("/login");
        };

        logoutUser();
    }, [navigate]);

    return <p>Logging out...</p>; // Simple loading message
};

export default Logout;
