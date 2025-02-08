import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/forms.css";
import "../styles/table.css";
import "../styles/sessiondetails.css";
import { API_URL } from "../config";

const ClientSessionDetailsPage = () => {
    const { sessionId } = useParams();
    const [sessionDetails, setSessionDetails] = useState([]);
    const [questionMap, setQuestionMap] = useState({});
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();

    const responseTextMap = {
        1: "Not at all",
        2: "Occasionally",
        3: "Sometimes",
        4: "Often",
        5: "All the time",
    };

    useEffect(() => {
        if (!sessionId) {
            setErrorMessage("Session ID not provided. Please select a session.");
            return;
        }

        const fetchData = async () => {
            try {
                const token = localStorage.getItem("token");
                const deviceToken = localStorage.getItem("device_token");
                const role = localStorage.getItem("role");
                const userId = localStorage.getItem("user_id");

                if (!token || !deviceToken || !["client", "clinician", "admin"].includes(role)) {
                    navigate("/unauthorized");
                    return;
                }

                // 🔥 **Fetch Session Details & Questions**
                const [sessionResponse, questionsResponse] = await Promise.all([
                    fetch(`${API_URL}/session-details?session_id=${sessionId}`, {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                            "Device-Token": deviceToken,
                        },
                    }),
                    fetch(`${API_URL}/questions`, {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                            "Device-Token": deviceToken,
                        },
                    }),
                ]);

                // 🔒 Handle Unauthorized Errors
                if (sessionResponse.status === 401 || questionsResponse.status === 401) {
                    throw new Error("Unauthorized access.");
                }

                if (!sessionResponse.ok || !questionsResponse.ok) {
                    throw new Error("Failed to fetch data.");
                }

                const sessionData = await sessionResponse.json();
                const questionsData = await questionsResponse.json();

                // ✅ **Restrict Clients to Their Own Data**
                if (role === "client") {
                    const isClientSession = sessionData.every(detail => detail.user_id === userId);
                    if (!isClientSession) {
                        throw new Error("Unauthorized: You cannot view another user's session.");
                    }
                }

                // 📝 **Map Question IDs to Text**
                const questionMap = questionsData.reduce((acc, question) => {
                    acc[question.id] = question.text;
                    return acc;
                }, {});

                setSessionDetails(sessionData);
                setQuestionMap(questionMap);
            } catch (error) {
                console.error("Error fetching session details:", error);
                setErrorMessage("Error fetching session details. Please try again.");
            }
        };

        fetchData();
    }, [sessionId, navigate]);

    const handleBackToClientResponses = () => {
        navigate(-1); // Navigate back to the previous page
    };

    return (
        <div className="session-details-container">
            <h2 className="session-details-title">Session Details</h2>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            {sessionDetails.length > 0 ? (
                <div className="session-details-table-wrapper">
                    <table className="session-details-table">
                        <thead>
                            <tr>
                                <th>Question</th>
                                <th>Response</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessionDetails.map((detail) => (
                                <tr key={detail.question_id}>
                                    <td>{questionMap[detail.question_id] || `Question ${detail.question_id}`}</td>
                                    <td>{responseTextMap[detail.response_value] || "Unknown"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="no-data-message">No session details available.</p>
            )}
            <div className="form-actions">
                <button
                    onClick={handleBackToClientResponses}
                    className="dashboard-button secondary"
                >
                    Back to Responses
                </button>
            </div>
        </div>
    );
};

export default ClientSessionDetailsPage;
