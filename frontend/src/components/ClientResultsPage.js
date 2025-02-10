import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/dashboard.css";
import "../styles/table.css";
import "../styles/loading.css";
import ClinicianGraph from "./ClinicianGraph";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";

const ClientResultsPage = () => {
    const { userId } = useParams();
    const [clientName, setClientName] = useState("");
    const [responsesTable, setResponsesTable] = useState({ rows: [], sessionDates: [], sessionIds: [] });
    const [graphData, setGraphData] = useState(null);
    const [sessionIds, setSessionIds] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchClientData = async () => {
            try {
                const token = localStorage.getItem("token");
                const deviceToken = localStorage.getItem("device_token");

                if (!token || !deviceToken) {
                    setErrorMessage("Session expired. Please log in again.");
                    navigate("/login");
                    return;
                }

                // Fetch client info
                const userInfoResponse = await fetch(`${API_URL}/user-info?user_id=${userId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                });

                if (!userInfoResponse.ok) {
                    throw new Error("Failed to fetch client info");
                }

                const userInfo = await userInfoResponse.json();
                setClientName(`${userInfo.first_name} ${userInfo.last_name}`);

                // Fetch past responses from Firestore
                const responsesResponse = await fetch(`${API_URL}/past-responses?user_id=${userId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                });

                const responseData = await responsesResponse.json();

                if (responsesResponse.ok) {
                    if (responseData.message === "No responses available for this user") {
                        setGraphData(null);
                        setResponsesTable({ rows: [], sessionDates: [] });
                    } else {
                        formatResponsesTable(responseData);
                    }
                } else {
                    throw new Error(responseData.message || "Failed to fetch client responses.");
                }
            } catch (error) {
                console.error("Error fetching client data:", error);
                setErrorMessage("Error fetching client data. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchClientData();
    }, [userId, navigate]);

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
            responses.forEach(({ question_id, response_value }) => {
                sessions[session_id].responses[question_id] = response_value;
            });
        });

        const sortedSessionIds = Object.keys(sessions).sort((a, b) => sessions[a].date - sessions[b].date);

        const allQuestionIds = new Set();
        data.forEach(session => {
            if (session.responses) {
                session.responses.forEach(({ question_id }) => allQuestionIds.add(question_id));
            }
        });

        const tableRows = [...allQuestionIds].map((questionId) => ({
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

    const handleBack = () => {
        navigate("/clinician-dashboard");
    };

    const handleSessionClick = (sessionId) => {
        navigate(`/client-session-details/${userId}/${sessionId}`);
    };

    return (
        <div className="client-dashboard-container">
            {isLoading ? (
                <LoadingMessage text="Loading client details..." />
            ) : (
                <>
                    <h2 className="client-dashboard-title">{`${clientName}'s Results`}</h2>
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
                </>
            )}
        </div>
    );
};

export default ClientResultsPage;
