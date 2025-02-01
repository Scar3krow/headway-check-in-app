import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/dashboard.css";
import "../styles/buttons.css";
import "../styles/questionnaire.css";
import "../styles/table.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const ClientDashboard = () => {
    const [isCheckInVisible, setIsCheckInVisible] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [responses, setResponses] = useState({});
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuestions = async () => {
            const token = localStorage.getItem("token");
            const role = localStorage.getItem("role");
            const deviceToken = localStorage.getItem("device_token"); // 🔥 Added device token

            if (!token || role !== "client") {
                navigate("/login");
                return;
            }

            try {
                const response = await fetch(`${API_URL}/questions`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken, // 🔥 Send device token
                    },
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch questions.");
                }

                const data = await response.json();
                setQuestions(data);
            } catch (error) {
                console.error("Error fetching questions:", error);
                setErrorMessage("Error fetching questions. Please try again later.");
            }
        };

        fetchQuestions();
    }, [navigate]);

    const handleResponseChange = (questionId, value) => {
        setResponses({ ...responses, [questionId]: value });
    };

    const handleSubmitResponses = async () => {
        const token = localStorage.getItem("token");
        const deviceToken = localStorage.getItem("device_token"); // 🔥 Added device token
        const payload = {
            responses: Object.keys(responses).map((questionId) => ({
                question_id: questionId,
                response_value: responses[questionId],
            })),
        };

        try {
            const response = await fetch(`${API_URL}/submit-responses`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    "Device-Token": deviceToken, // 🔥 Send device token
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error("Failed to submit responses.");
            }

            setIsCheckInVisible(false);
            setResponses({});
        } catch (error) {
            console.error("Error submitting responses:", error);
            setErrorMessage("Error submitting responses. Please try again later.");
        }
    };

    const handleNavigateToResponses = () => {
        navigate("/client-responses");
    };

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem("token");
            const deviceToken = localStorage.getItem("device_token");

            if (token && deviceToken) {
                await fetch(`${API_URL}/logout-device`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                    body: JSON.stringify({ device_token: deviceToken }),
                });
            }
        } catch (error) {
            console.error("Error logging out:", error);
        }

        // ✅ Clear all stored session data
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user_id");
        localStorage.removeItem("device_token");

        navigate("/login"); // Redirect to login
    };

    return (
        <div className="client-dashboard-container">
            <h2 className="client-dashboard-title">Client Dashboard</h2>
            <div className="client-dashboard-content">
                <div className="client-dashboard-buttons">
                    <button
                        onClick={() => setIsCheckInVisible(true)}
                        className="dashboard-button primary"
                    >
                        Start Check-In
                    </button>
                    <button
                        onClick={handleNavigateToResponses}
                        className="dashboard-button info"
                    >
                        View Past Responses
                    </button>
                    <button onClick={handleLogout} className="dashboard-button secondary">
                        Logout
                    </button>
                </div>

                {isCheckInVisible && (
                    <div className="check-in-section">
                        <form className="questionnaire-form">
                            {questions.map((q) => (
                                <div key={q.id} className="question-row">
                                    <div className="question-left">
                                        <div className="question-text">{q.text}</div>
                                    </div>
                                    <div className="likert-options">
                                        {[
                                            "Not at all",
                                            "Occasionally",
                                            "Sometimes",
                                            "Often",
                                            "All the time",
                                        ].map((label, index) => (
                                            <label key={index} className="likert-option">
                                                <input
                                                    type="radio"
                                                    name={`question_${q.id}`}
                                                    value={index + 1}
                                                    checked={responses[q.id] === index + 1}
                                                    onChange={() => handleResponseChange(q.id, index + 1)}
                                                />
                                                <span className="likert-label">{label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <div className="form-buttons">
                                <button
                                    type="button"
                                    onClick={handleSubmitResponses}
                                    className="dashboard-button primary"
                                    disabled={Object.keys(responses).length !== questions.length}
                                >
                                    Submit Responses
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCheckInVisible(false)}
                                    className="dashboard-button secondary"
                                >
                                    Back
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>
    );
};

export default ClientDashboard;
