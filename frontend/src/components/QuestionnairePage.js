import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/questionnaire.css";
import "../styles/dashboard.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";

const QuestionnairePage = () => {
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [responses, setResponses] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const token = localStorage.getItem("token");
                const deviceToken = localStorage.getItem("device_token");

                const response = await fetch(`${API_URL}/questions`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                });

                if (!response.ok) throw new Error("Failed to fetch questions.");
                
                const data = await response.json();
                setQuestions(data);
            } catch (error) {
                console.error("Error fetching questions:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuestions();
    }, []);

    const handleAnswerSelect = (questionId, value) => {
        setResponses({ ...responses, [questionId]: value });
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleSubmit = async () => {
        const token = localStorage.getItem("token");
        const deviceToken = localStorage.getItem("device_token");

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
                    "Device-Token": deviceToken,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error("Failed to submit responses.");
            }

            navigate("/client-dashboard");
        } catch (error) {
            console.error("Error submitting responses:", error);
        }
    };

    return (
        <div className="questionnaire-container">
            {isLoading ? <LoadingMessage text="Loading questionnaire..." /> : null}

            {/* ✅ Desktop Questionnaire (Keep it exactly as before) */}
            <div className="desktop-questionnaire">
                <h2 className="questionnaire-title">Check-In</h2>
                <form className="questionnaire-form">
                    {questions.map((q) => (
                        <div key={q.id} className="question-row">
                            <div className="question-left">
                                <div className="question-text">{q.text}</div>
                            </div>
                            <div className="likert-options">
                                {["Not at all", "Occasionally", "Sometimes", "Often", "All the time"].map(
                                    (label, index) => (
                                        <label key={index} className="likert-option">
                                            <input
                                                type="radio"
                                                name={`question_${q.id}`}
                                                value={index + 1}
                                                checked={responses[q.id] === index + 1}
                                                onChange={() => handleAnswerSelect(q.id, index + 1)}
                                            />
                                            <span className="likert-label">{label}</span>
                                        </label>
                                    )
                                )}
                            </div>
                        </div>
                    ))}
                </form>
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="submit-btn"
                    disabled={Object.keys(responses).length !== questions.length}
                >
                    Submit Responses
                </button>
            </div>

            {/* ✅ Mobile Questionnaire (Fixed) */}
            <div className="mobile-questionnaire-container">
                <h2 className="questionnaire-title">Check-In</h2>
                {questions.length > 0 && (
                    <>
                        <p className="question-text">{questions[currentIndex].text}</p>
                        <div className="response-options">
                            {["Not at all", "Occasionally", "Sometimes", "Often", "All the time"].map(
                                (label, index) => (
                                    <button
                                        key={index}
                                        className={`response-btn ${responses[questions[currentIndex].id] === index + 1 ? "selected" : ""}`}
                                        onClick={() => handleAnswerSelect(questions[currentIndex].id, index + 1)}
                                    >
                                        {label}
                                    </button>
                                )
                            )}
                        </div>
                        <div className="navigation-buttons">
                            <button className="nav-btn" onClick={handlePrevious} disabled={currentIndex === 0}>
                                ⬅️
                            </button>
                            <button className="nav-btn" onClick={handleNext} disabled={currentIndex === questions.length - 1}>
                                ➡️
                            </button>
                        </div>
                        {currentIndex === questions.length - 1 && (
                            <button className="submit-btn" onClick={handleSubmit} disabled={Object.keys(responses).length !== questions.length}>
                                Submit Responses
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default QuestionnairePage;
