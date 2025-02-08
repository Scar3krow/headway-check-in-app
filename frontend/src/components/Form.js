import React, { useState, useEffect } from "react";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Form-specific styles
import { API_URL } from "../config";

const Form = () => {
    const [questions, setQuestions] = useState([]);
    const [responses, setResponses] = useState({});
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await fetch(`${API_URL}/questions`, {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Device-Token": localStorage.getItem("device_token"), // 🔐 Secure API Request
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) throw new Error("Failed to fetch questions.");
                const data = await response.json();
                setQuestions(data);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching questions:", error);
                setMessage("Failed to load questions. Please try again.");
                setLoading(false);
            }
        };

        fetchQuestions();
    }, []);

    const handleResponseChange = (questionId, value) => {
        setResponses((prevResponses) => ({
            ...prevResponses,
            [questionId]: value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(""); // Reset message before submission

        const token = localStorage.getItem("token");

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
                    "Authorization": `Bearer ${token}`,
                    "Device-Token": localStorage.getItem("device_token"), // 🔐 Secure API Request
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Failed to submit responses.");
            }

            setMessage("Responses submitted successfully!");
            setResponses({}); // Reset responses
        } catch (error) {
            console.error("Error submitting responses:", error);
            setMessage("An error occurred. Please try again.");
        }
    };

    return (
        <div className="form-container">
            <h2 className="form-title">Questionnaire</h2>
            {loading ? (
                <p className="loading-message">Loading questions...</p>
            ) : questions.length === 0 ? (
                <p className="error-message">No questions available.</p>
            ) : (
                <form onSubmit={handleSubmit} className="form-content">
                    {questions.map((q) => (
                        <div key={q.id} className="form-group">
                            <label className="form-question">{q.text}</label>
                            <input
                                type="number"
                                min="1"
                                max="7"
                                value={responses[q.id] || ""}
                                onChange={(e) => handleResponseChange(q.id, parseInt(e.target.value))}
                                className="form-input"
                                required
                            />
                        </div>
                    ))}
                    <div className="form-actions">
                        <button type="submit" className="dashboard-button primary">
                            Submit
                        </button>
                    </div>
                </form>
            )}
            {message && (
                <p className={`message ${message.includes("success") ? "success-message" : "error-message"}`}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default Form;
