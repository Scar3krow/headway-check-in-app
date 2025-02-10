import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/global.css";    
import "../styles/forms.css";     
import "../styles/table.css";     
import "../styles/sessiondetails.css"; 
import "../styles/loading.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";

const ClientSessionDetailsPage = () => {
    const { sessionId } = useParams();
    const [sessionDetails, setSessionDetails] = useState([]);
    const [questionMap, setQuestionMap] = useState({});
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

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
                const clinicianId = localStorage.getItem("user_id");
                const clientId = localStorage.getItem("selectedClientId"); // ✅ Get selected client ID

                if (!token || !deviceToken || !["clinician", "admin"].includes(role)) {
                    navigate("/unauthorized");
                    return;
                }

                if (!clientId) {
                    throw new Error("No client selected. Please select a client first.");
                }

                console.log(`Fetching session responses for client: ${clientId}, session: ${sessionId}`);

                // ✅ Fetch session responses from the correct client's session
                const sessionResponse = await fetch(`${API_URL}/user-data/${clientId}/sessions/${sessionId}/responses`, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                });

                if (!sessionResponse.ok) {
                    throw new Error("Failed to fetch session responses.");
                }

                const sessionData = await sessionResponse.json();

                // ✅ Extract questionnaire ID from responses
                const questionnaireId = sessionData.length > 0 ? sessionData[0].questionnaire_id : "default_questionnaire";

                // ✅ Fetch questions for the questionnaire
                const questionsResponse = await fetch(`${API_URL}/questions?questionnaire_id=${questionnaireId}`, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                });

                if (!questionsResponse.ok) {
                    throw new Error("Failed to fetch questions.");
                }

                const questionsData = await questionsResponse.json();

                // 📝 Map Question IDs to Text
                const qMap = questionsData.reduce((acc, question) => {
                    acc[question.id] = question.text;
                    return acc;
                }, {});

                setSessionDetails(sessionData);
                setQuestionMap(qMap);
            } catch (error) {
                console.error("Error fetching session details:", error);
                setErrorMessage("Error fetching session details. Please try again.");
            } finally {
                setIsLoading(false);
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
            {isLoading ? <LoadingMessage text="Fetching session details..." /> : null}
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
                <p className="no-data-message">{isLoading ? "" : "No session details available."}</p>
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
