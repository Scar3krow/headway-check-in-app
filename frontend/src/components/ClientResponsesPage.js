import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ClientGraph from "./ClientGraph";
import "../styles/global.css";
import "../styles/table.css";
import "../styles/dashboard.css";
import "../styles/responsespage.css";
import "../styles/loading.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";

const ClientResponsesPage = () => {
    const [responsesTable, setResponsesTable] = useState({ rows: [], sessionDates: [], sessionIds: [] });
    const [graphData, setGraphData] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchResponses = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem("token");
                const deviceToken = localStorage.getItem("device_token");
                const userId = localStorage.getItem("user_id");

                if (!token || !deviceToken || !userId) {
                    setErrorMessage("Session expired. Please log in again.");
                    navigate("/login");
                    return;
                }

                const response = await fetch(`${API_URL}/past-responses?user_id=${userId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                });

                const responseData = await response.json();

                if (response.ok) {
                    if (responseData.message === "No responses available for this user") {
                        setGraphData(null);
                        setResponsesTable({ rows: [], sessionDates: [], sessionIds: [] });
                    } else {
                        formatResponsesTable(responseData);
                    }
                } else {
                    throw new Error(responseData.message || "Failed to fetch responses.");
                }
            } catch (error) {
                console.error("Error fetching responses:", error);
                setErrorMessage("Error fetching responses. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchResponses();
    }, [navigate]);

    const formatResponsesTable = (data) => {
        const sessions = {};

        data.forEach((session) => {
            const { session_id, timestamp, responses } = session;
            if (!sessions[session_id]) {
                sessions[session_id] = {
                    date: new Date(timestamp),
                    responses: {},
                };
            }

            // ✅ Ensure responses are properly extracted from Firestore subcollection
            responses.forEach(({ question_id, response_value }) => {
                sessions[session_id].responses[question_id] = response_value;
            });
        });

        // ✅ Sort session IDs by timestamp
        const sortedSessionIds = Object.keys(sessions).sort(
            (a, b) => sessions[a].date - sessions[b].date
        );

        // ✅ Extract all unique question IDs across all sessions
        const allQuestionIds = new Set();
        data.forEach(session => {
            session.responses.forEach(response => {
                allQuestionIds.add(response.question_id);
            });
        });

        // ✅ Format data into table rows with question text & responses
        const tableRows = [...allQuestionIds].map((questionId) => ({
            questionText: `Question ${questionId}`, // Placeholder; replace if needed
            responses: sortedSessionIds.map(
                (sessionId) => sessions[sessionId]?.responses[questionId] || "-"
            ),
        }));

        setResponsesTable({
            rows: tableRows,
            sessionDates: sortedSessionIds.map(
                (sessionId) => sessions[sessionId].date.toLocaleDateString()
            ),
            sessionIds: sortedSessionIds,
        });

        calculateGraphData(sortedSessionIds, sessions);
    };

    const calculateGraphData = (sessionIds, sessions) => {
        const totalScores = sessionIds.map((sessionId) =>
            Object.values(sessions[sessionId]?.responses || {}).reduce(
                (sum, response) => sum + parseInt(response || 0, 10),
                0
            ) - 10
        );

        const graphData = {
            labels: sessionIds.map((sessionId, index) => `Session ${index + 1}`),
            datasets: [
                {
                    label: "Level of Distress",
                    data: totalScores,
                    borderColor: "#587266",
                    backgroundColor: "rgba(53, 61, 95, 0.2)",
                    pointBackgroundColor: "#587266",
                    pointBorderColor: "#587266",
                    tension: 0.4,
                },
            ],
        };

        setGraphData(graphData);
    };

    const handleDataPointClick = (sessionIndex) => {
        const sessionId = responsesTable.sessionIds[sessionIndex];
        const sessionDate = responsesTable.sessionDates[sessionIndex];
        const sessionData = responsesTable.rows.map((row) => ({
            questionText: row.questionText,
            responseValue: row.responses[sessionIndex],
        }));

        localStorage.setItem("selectedSessionData", JSON.stringify({ sessionId, sessionDate, sessionData }));
        navigate(`/session-details/${sessionId}`);
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

        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user_id");
        localStorage.removeItem("device_token");

        navigate("/login");
    };

    return (
        <div className="responses-page-container">
            <h2 className="responses-title">Your Responses</h2>
            {errorMessage && <p className="error-message">{errorMessage}</p>}

            {isLoading ? (
                <LoadingMessage text="Fetching responses..." />
            ) : responsesTable.rows.length === 0 && !graphData ? (
                <p className="no-data-message">No responses available to display.</p>
            ) : (
                <>
                    {graphData && (
                        <ClientGraph
                            graphData={graphData}
                            onDataPointClick={handleDataPointClick}
                        />
                    )}
                </>
            )}

            {!isLoading && (
                <div className="form-actions">
                    <button onClick={() => navigate("/client-dashboard")} className="dashboard-button secondary">
                        Back to Dashboard
                    </button>
                    <button onClick={handleLogout} className="dashboard-button danger">
                        Logout
                    </button>
                </div>
            )}

            {!isLoading && graphData && (
                <p className="data-point-instructions">
                    Click on a data point to see answers for each question.
                </p>
            )}
        </div>
    );
};

export default ClientResponsesPage;
