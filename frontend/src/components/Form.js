import React, { useState, useEffect } from 'react';
import '../styles/global.css'; // Consolidated global styles
import '../styles/forms.css'; // Form-specific styles

const Form = () => {
    const [questions, setQuestions] = useState([]);
    const [responses, setResponses] = useState({});
    const [message, setMessage] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('token');

        fetch('http://127.0.0.1:5000/questions', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        })
            .then((res) => res.json())
            .then((data) => setQuestions(data))
            .catch((error) => console.error('Error fetching questions:', error));
    }, []);

    const handleResponseChange = (questionId, value) => {
        setResponses({ ...responses, [questionId]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');

        const payload = {
            responses: Object.keys(responses).map((questionId) => ({
                question_id: questionId,
                response_value: responses[questionId],
            })),
        };

        try {
            const response = await fetch('http://127.0.0.1:5000/submit-responses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            setMessage(data.message);
        } catch (error) {
            console.error('Error submitting responses:', error);
            setMessage('An error occurred. Please try again.');
        }
    };

    return (
        <div className="form-container">
            <h2 className="form-title">Questionnaire</h2>
            {questions.length === 0 ? (
                <p className="loading-message">Loading questions...</p>
            ) : (
                <form onSubmit={handleSubmit} className="form-content">
                    {questions.map((q) => (
                        <div key={q.id} className="form-group">
                            <label className="form-question">{q.text}</label>
                            <input
                                type="number"
                                min="1"
                                max="7"
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
            {message && <p className={`message ${message.includes('success') ? 'success-message' : 'error-message'}`}>
                {message}
            </p>}
        </div>
    );
};

export default Form;
