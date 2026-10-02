import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { QuizResponse } from '../types';

export function QuizPage() {
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedScore, setSavedScore] = useState<number | null>(null);

  useEffect(() => {
    const storedTopic = sessionStorage.getItem('studyflow-practice-topic');
    const storedNotes = sessionStorage.getItem('studyflow-practice-notes');
    if (storedTopic) setTopic(storedTopic);
    if (storedNotes) setNotes(storedNotes);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!topic.trim() || !notes.trim()) {
      setError('Add a topic and study notes before generating a quiz.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await api.post<QuizResponse>('/quizzes/generate', {
        topic,
        notes,
        study_session_id: sessionStorage.getItem('studyflow-practice-session-id'),
      });
      setQuiz(response);
      setAnswers({});
      setSubmitted(false);
      setSavedScore(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAnswers = async () => {
    if (!quiz) return;

    setSubmitting(true);
    setError('');
    try {
      const result = await api.post<{ score: number }>('/quizzes/submit', {
        quiz_id: quiz.quiz_id,
        answers: quiz.questions.map((_, index) => answers[index]),
      });
      setSavedScore(result.score);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? `Your attempt was not saved: ${err.message}` : 'Your attempt was not saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Practice</h1>
          <p className="page-subtitle">Use concept-based questions to test understanding instead of memorization.</p>
        </div>
      </header>

      <div className="grid grid-2">
        <form className="card form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="quizTopic">Topic</label>
            <input id="quizTopic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="quizNotes">Notes</label>
            <textarea id="quizNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button className="primary-button" type="submit" disabled={loading || !topic.trim() || !notes.trim()}>
            {loading ? 'Generating…' : 'Generate quiz'}
          </button>
          {error ? <div className="status-box">{error}</div> : null}
        </form>

        <div className="card">
          <h3>Questions</h3>
          {quiz ? (
            <>
              {quiz.questions.map((item, index) => (
                <div key={`${item.question}-${index}`} className="question-card">
                  <strong>{index + 1}. {item.question}</strong>
                  <div className="quiz-options">
                    {item.options.map((option) => (
                      <label key={option} className={`quiz-option${answers[index] === option ? ' selected' : ''}`}>
                        <input
                          type="radio"
                          name={`question-${index}`}
                          value={option}
                          checked={answers[index] === option}
                          disabled={submitted}
                          onChange={() => setAnswers((current) => ({ ...current, [index]: option }))}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                  {submitted ? (
                    <>
                      <p className="muted"><strong>Correct answer:</strong> {item.correct_answer}</p>
                      <p className="muted"><strong>Why:</strong> {item.explanation}</p>
                      <p className="muted"><strong>From your notes:</strong> {item.answer_evidence}</p>
                      <span className="badge">{item.concept}</span>
                    </>
                  ) : null}
                </div>
              ))}
              {submitted ? (
                <div className="status-box">Score: {savedScore} / {quiz.questions.length}</div>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleCheckAnswers}
                  disabled={Object.keys(answers).length !== quiz.questions.length || submitting}
                >
                  {submitting ? 'Checking…' : 'Check answers'}
                </button>
              )}
            </>
          ) : (
            <p className="muted">Generate a quiz to evaluate the current topic.</p>
          )}
        </div>
      </div>
    </div>
  );
}
