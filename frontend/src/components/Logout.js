import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage"; // ✅ Import the loading message component
import "../styles/loading.css";

const Logout = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true); // ✅ Add loading state

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

            // ✅ Redirect to login page after a short delay
            setTimeout(() => {
                setIsLoading(false);
                navigate("/login");
            }, 1000); // Delay to show logout message briefly
        };

        logoutUser();
    }, [navigate]);

    return <LoadingMessage text="Logging out, please wait..." />; // ✅ Use the new loading component
};

export default Logout;
