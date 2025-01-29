import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/dashboard.css"; // Dashboard-specific styles
import "../styles/table.css"; // Shared table styles
import ClinicianGraph from "./ClinicianGraph"; // For the graph display

const ClientResultsPage = () => {
    const { userId } = useParams();
    const [clientName, setClientName] = useState("");
    const [responsesTable, setResponsesTable] = useState({ rows: [], sessionDates: [] });
    const [graphData, setGraphData] = useState(null);
    const [sessionIds, setSessionIds] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchClientData = async () => {
            try {
                const token = localStorage.getItem("token");
            
                // Fetch client info
                const userInfoResponse = await fetch(
                    `http://127.0.0.1:5000/user-info?user_id=${userId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
            
                if (!userInfoResponse.ok) {
                    throw new Error("Failed to fetch client info");
                }
            
                const userInfo = await userInfoResponse.json();
                setClientName(`${userInfo.first_name} ${userInfo.last_name}`);
            
                // Fetch past responses
                const responsesResponse = await fetch(
                    `http://127.0.0.1:5000/past-responses?user_id=${userId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
            
                const responseData = await responsesResponse.json();
            
                if (responsesResponse.ok) {
                    if (responseData.message === "No responses available for this user") {
                        setGraphData(null); // No graph data available
                        setResponsesTable({ rows: [], sessionDates: [] }); // Clear table data
                    } else {
                        formatResponsesTable(responseData); // Process the valid data
                    }
                } else {
                    throw new Error(responseData.message || "Failed to fetch client responses.");
                }
            } catch (error) {
                console.error("Error fetching client data:", error);
                setErrorMessage(
                    ""
                );
            }            
        };

        fetchClientData();
    }, [userId]);

    const formatResponsesTable = (data) => {
        const sessions = data.reduce((acc, response) => {
            const { session_id, question_id, response_value, timestamp } = response;

            if (!acc[session_id]) {
                acc[session_id] = {
                    date: new Date(timestamp),
                    responses: {},
                };
            }
            acc[session_id].responses[question_id] = response_value;
            return acc;
        }, {});

        // Sort sessions by date in ascending order
        const sortedSessionIds = Object.keys(sessions).sort(
            (a, b) => sessions[a].date - sessions[b].date
        );

        const tableRows = Object.keys(data[0]?.responses || {}).map((questionId) => ({
            questionText: `Question ${questionId}`,
            responses: sortedSessionIds.map(
                (sessionId) => sessions[sessionId]?.responses[questionId] || "-"
            ),
        }));

        setResponsesTable({
            rows: tableRows,
            sessionDates: sortedSessionIds.map((sessionId) =>
                sessions[sessionId].date.toLocaleDateString()
            ),
        });

        setSessionIds(sortedSessionIds);
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
                    borderColor: "#353d5f",
                    backgroundColor: "rgba(53, 61, 95, 0.2)",
                    pointBackgroundColor: "#353d5f",
                    pointBorderColor: "#353d5f",
                    tension: 0.4,
                },
            ],
        };

        setGraphData(graphData);
    };

    const handleBack = () => {
        navigate("/clinician-dashboard");
    };

    const handleSessionClick = (sessionId) => {
        navigate(`/session-details/${sessionId}`);
    };

    return (
        <div className="client-dashboard-container">
            <h2 className="client-dashboard-title">{clientName}'s Results</h2>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            {!graphData && !responsesTable.rows.length ? (
                <p className="no-data-message">No check-ins have been completed.</p>
            ) : (
                <ClinicianGraph
                    graphData={graphData}
                    firstSessionScore={graphData.datasets[0]?.data[0] || 0}
                    sessionIds={sessionIds}
                    onSessionClick={handleSessionClick}
                />
            )}
            <div className="form-actions">
                <button onClick={handleBack} className="dashboard-button secondary">
                    Back to Dashboard
                </button>
            </div>
            {graphData && (
                <p className="data-point-instructions">
                    Click on a data point to see answers for each question.
                </p>
            )}
        </div>
    );
};

export default ClientResultsPage;
