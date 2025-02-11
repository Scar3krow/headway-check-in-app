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
  // Expect both sessionId (the session being viewed) and userId (the client’s ID) in the URL parameters.
  const { userId, sessionId } = useParams();
  const navigate = useNavigate();

  const [sessionDetails, setSessionDetails] = useState([]);
  const [questionMap, setQuestionMap] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Mapping of response values to text
  const responseTextMap = {
    1: "Not at all",
    2: "Occasionally",
    3: "Sometimes",
    4: "Often",
    5: "All the time",
  };

  useEffect(() => {
    console.log("userId from URL:", userId);
    console.log("sessionId from URL:", sessionId);
    console.log("token:", localStorage.getItem("token"));
    console.log("deviceToken:", localStorage.getItem("device_token"));
    console.log("role:", localStorage.getItem("role"));
    console.log("localUserId:", localStorage.getItem("user_id"));

    const fetchData = async () => {
      try {
        // Retrieve credentials from localStorage.
        const token = localStorage.getItem("token");
        const deviceToken = localStorage.getItem("device_token");
        const role = localStorage.getItem("role");
        const localUserId = localStorage.getItem("user_id");

        // Validate that we have the required credentials and a permitted role.
        if (!token || !deviceToken || !role || !["client", "clinician", "admin"].includes(role)) {
          navigate("/unauthorized");
          return;
        }

        // If a client is logged in, they can only access their own session.
        if (role === "client" && localUserId !== userId) {
          setErrorMessage("Unauthorized: You cannot view another user's session.");
          navigate("/unauthorized");
          return;
        }

        // Construct the URL for fetching session responses from the new database structure.
        const sessionUrl = `${API_URL}/user-data/${userId}/sessions/${sessionId}/responses`;
        const sessionResponse = await fetch(sessionUrl, {
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
        console.log("✅ Session responses:", sessionData);

        // Determine the questionnaire ID from the response data.
        const questionnaireId = sessionData.length > 0 ? sessionData[0].questionnaire_id : null;
        if (!questionnaireId) {
          throw new Error("Questionnaire ID missing in session data.");
        }

        // Fetch the questions for this questionnaire.
        const questionsUrl = `${API_URL}/questions?questionnaire_id=${questionnaireId}`;
        const questionsResponse = await fetch(questionsUrl, {
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
        console.log("✅ Questions data:", questionsData);

        // Build a map from question IDs to question text.
        const qMap = questionsData.reduce((acc, question) => {
          acc[question.id] = question.text;
          return acc;
        }, {});

        setSessionDetails(sessionData);
        setQuestionMap(qMap);
      } catch (error) {
        console.error("Error fetching session details:", error);
        setErrorMessage(error.message || "Error fetching session details. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sessionId, userId, navigate]);

  // Navigate back to the previous page (e.g., client responses page)
  const handleBackToClientResponses = () => {
    navigate(-1);
  };

  return (
    <div className="session-details-container">
      <h2 className="session-details-title">Session Details</h2>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      {isLoading && <LoadingMessage text="Fetching session details..." />}
      {!isLoading && sessionDetails.length === 0 && (
        <p className="no-data-message">No session details available.</p>
      )}
      {sessionDetails.length > 0 && (
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
      )}
      <div className="form-actions">
        <button onClick={handleBackToClientResponses} className="dashboard-button secondary">
          Back to Responses
        </button>
      </div>
    </div>
  );
};

export default ClientSessionDetailsPage;
