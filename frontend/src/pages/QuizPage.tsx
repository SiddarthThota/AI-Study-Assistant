import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { QuizResponse } from '../types';
import { useStudyContext } from '../contexts/StudyContext';

export function QuizPage() {
  const navigate = useNavigate();
  const { activeSession } = useStudyContext();

  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedScore, setSavedScore] = useState<number | null>(null);



  const handleGenerate = async () => {
    if (!activeSession) {
      setError('Create a study pack first before generating a quiz.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await api.post<QuizResponse>('/quizzes/generate', {
        topic: activeSession.topic,
        notes: activeSession.notes,
        study_session_id: activeSession.study_session_id,
      });
      setQuiz(response);
      setAnswers({});
      setSubmitted(false);
      setSavedScore(null);
    } catch (err) {
      setError(`FRONTEND ERROR LOG: ${err instanceof Error ? err.message : String(err)}`);
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
        answers: quiz.questions.map((_, index) => answers[index] || ""),
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
    <div className="page" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Practice</h1>
          <p className="page-subtitle">Test your understanding of the material you've just learned.</p>
        </div>
      </header>

      {!activeSession ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
          <h2 style={{ margin: '0 0 12px 0', color: '#0f172a' }}>No active study pack</h2>
          <p className="muted" style={{ margin: '0 0 24px 0' }}>Please create a study pack in the Learn section first.</p>
          <button className="primary-button" onClick={() => navigate('/learn')} style={{ padding: '12px 32px' }}>
            Go to Learn
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>

          {!quiz && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <span className="eyebrow">Current Study Pack</span>
                <h3 style={{ margin: '8px 0 0 0', fontSize: '20px' }}>{activeSession?.topic}</h3>
              </div>
              <p className="muted" style={{ marginBottom: '20px' }}>Generate concept-based multiple choice questions directly from your study notes to test your understanding.</p>
              <button className="primary-button" onClick={handleGenerate} disabled={loading} style={{ padding: '12px 24px' }}>
                {loading ? 'Generating questions...' : 'Start practice quiz'}
              </button>
              {error && <div className="status-box error-box" style={{ marginTop: '16px' }}>{error}</div>}
            </div>
          )}

          {quiz && (
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '20px' }}>{quiz.topic} Quiz</h3>
                {submitted && savedScore !== null && (
                  <div style={{ background: '#f0fdf4', color: '#166534', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold' }}>
                    Score: {savedScore} / {quiz.questions.length}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {quiz.questions.map((item, index) => {
                  const isCorrect = answers[index] === item.correct_answer;
                  return (
                    <div key={`${item.question}-${index}`} className="question-card" style={{ padding: '24px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <strong style={{ fontSize: '16px', lineHeight: '1.5' }}>{index + 1}. {item.question}</strong>
                        <span className="badge" style={{ background: '#e0e7ff', color: '#4338ca' }}>{item.concept}</span>
                      </div>

                      <div className="quiz-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {item.options.map((option) => (
                          <label key={option} className={`quiz-option${answers[index] === option ? ' selected' : ''}`} style={{
                            padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: submitted ? 'default' : 'pointer',
                            background: submitted && option === item.correct_answer ? '#f0fdf4' : (submitted && answers[index] === option && !isCorrect ? '#fef2f2' : 'white'),
                            borderColor: submitted && option === item.correct_answer ? '#22c55e' : (submitted && answers[index] === option && !isCorrect ? '#ef4444' : '#cbd5e1')
                          }}>
                            <input
                              type="radio"
                              name={`question-${index}`}
                              value={option}
                              checked={answers[index] === option}
                              disabled={submitted}
                              onChange={() => setAnswers((current) => ({ ...current, [index]: option }))}
                              style={{ marginRight: '12px' }}
                            />
                            <span style={{ color: submitted && option === item.correct_answer ? '#15803d' : (submitted && answers[index] === option && !isCorrect ? '#b91c1c' : 'inherit') }}>{option}</span>
                          </label>
                        ))}
                      </div>

                      {submitted && (
                        <div style={{ marginTop: '20px', padding: '16px', background: 'white', borderRadius: '6px', borderLeft: isCorrect ? '4px solid #22c55e' : '4px solid #ef4444' }}>
                          <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: isCorrect ? '#15803d' : '#b91c1c' }}>
                            {isCorrect ? 'Correct!' : 'Incorrect'}
                          </p>
                          <p className="muted" style={{ margin: '0 0 12px 0', lineHeight: '1.5' }}><strong>Explanation:</strong> {item.explanation}</p>
                          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}><em>Source reference: "{item.answer_evidence}"</em></p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!submitted ? (
                <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleCheckAnswers}
                    disabled={Object.keys(answers).length !== quiz.questions.length || submitting}
                    style={{ padding: '12px 32px' }}
                  >
                    {submitting ? 'Checking…' : 'Submit answers'}
                  </button>
                  {Object.keys(answers).length !== quiz.questions.length && (
                    <span className="muted" style={{ fontSize: '14px' }}>Answer all questions to submit</span>
                  )}
                  {error && <span style={{ color: '#ef4444' }}>{error}</span>}
                </div>
              ) : (
                <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
                  <button type="button" className="secondary-button" onClick={() => setQuiz(null)}>Try new quiz</button>
                  <button type="button" className="primary-button" onClick={() => navigate('/recall')}>Continue to Recall</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
