import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/global.css";    // Consolidated global styles
import "../styles/forms.css";     // Form layouts & messages
import "../styles/table.css";     // Shared table styles
import "../styles/sessiondetails.css"; // Specific styles for session details
import "../styles/loading.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";
//UPDATED

const SessionDetailsPage = () => {
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
        const userId = localStorage.getItem("user_id");

        if (!token || !["client", "clinician", "admin"].includes(role)) {
          navigate("/unauthorized");
          return;
        }

        // ✅ Fetch Session Details from new user_data structure
        const sessionRef = `${API_URL}/user-data/${userId}/sessions/${sessionId}/responses`;
        const [sessionResponse, questionnaireResponse] = await Promise.all([
          fetch(sessionRef, {
            headers: { 
              "Content-Type": "application/json", 
              Authorization: `Bearer ${token}`,
              "Device-Token": deviceToken,
            },
          }),
          fetch(`${API_URL}/questionnaires`, {
            headers: { 
              "Content-Type": "application/json", 
              Authorization: `Bearer ${token}`,
              "Device-Token": deviceToken,
            },
          }),
        ]);

        if (sessionResponse.status === 401 || questionnaireResponse.status === 401) {
          throw new Error("Unauthorized access. You may not have permission.");
        }

        if (!sessionResponse.ok || !questionnaireResponse.ok) {
          throw new Error("Failed to fetch session data.");
        }

        const sessionData = await sessionResponse.json();
        const questionnaires = await questionnaireResponse.json();

        // ✅ Determine the questionnaire ID from responses
        const questionnaireId = sessionData.length > 0 ? sessionData[0].questionnaire_id : null;
        if (!questionnaireId) {
          throw new Error("Questionnaire ID missing in session data.");
        }

        // ✅ Fetch questions for the specific questionnaire
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

        // 📝 **Map Question IDs to Text**
        const qMap = questionsData.reduce((acc, question) => {
          acc[question.id] = question.text;
          return acc;
        }, {});

        setSessionDetails(sessionData);
        setQuestionMap(qMap);
      } catch (error) {
        console.error("Error fetching session details:", error);
        setErrorMessage("An error occurred while fetching session details. Please try again.");
      } finally {
          setIsLoading(false);
      }
    };

    fetchData();
  }, [sessionId, navigate]);

  const handleBackToClientResults = () => {
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
          onClick={handleBackToClientResults}
          className="dashboard-button secondary"
        >
          Back to Results
        </button>
      </div>
    </div>
  );
};

export default SessionDetailsPage;
