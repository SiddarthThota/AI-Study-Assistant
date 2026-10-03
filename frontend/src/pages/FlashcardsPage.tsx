import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { FlashcardResponse } from '../types';
import { useStudyContext } from '../contexts/StudyContext';

export function FlashcardsPage() {
  const navigate = useNavigate();
  const { activeSession, loading: sessionLoading } = useStudyContext();

  const [cards, setCards] = useState<FlashcardResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reviewed, setReviewed] = useState<Record<number, boolean>>({});
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!activeSession) {
      setHistoryLoading(false);
      return;
    }
    api.get<{ sets: Array<Record<string, unknown>>; reviews: Array<Record<string, unknown>> }>('/flashcards/history')
      .then(({ sets, reviews }) => {
        const latest = sets.find(s => String(s.study_session_id) === activeSession.study_session_id);
        if (!latest) return;

        const flashcardSetId = String(latest.id);
        const savedReviews = reviews
          .filter((review) => String(review.flashcard_id) === flashcardSetId && review.reviewed === true)
          .reduce<Record<number, boolean>>((state, review) => {
            state[Number(review.card_index)] = true;
            return state;
          }, {});

        setCards({
          flashcard_set_id: flashcardSetId,
          topic: String(latest.topic),
          cards: (latest.flashcard_content ?? []) as FlashcardResponse['cards'],
        });
        setReviewed(savedReviews);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setHistoryLoading(false));
  }, [activeSession, sessionLoading]);

  const currentCard = cards?.cards[activeIndex];

  const handleGenerate = async () => {
    if (!activeSession) {
      setError('Create a study pack first before generating flashcards.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await api.post<FlashcardResponse>('/flashcards/generate', {
        topic: activeSession.topic,
        notes: activeSession.notes,
        study_session_id: activeSession.study_session_id,
      });
      setCards(response);
      setActiveIndex(0);
      setReviewed({});
      setFlipped(false);
      setFinished(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes('Gemini') || err.message.includes('failed') || err.message.includes('503')
             ? 'We couldn\'t generate flashcards right now. Please try again.'
             : err.message
          : 'Unable to generate flashcards'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (quality: 'again' | 'hard' | 'good' | 'easy') => {
    if (!cards || reviewed[activeIndex]) return;
    setReviewLoading(true);
    setError('');

    // For now, any rating other than 'again' marks it as reviewed in the backend
    const isReviewed = quality !== 'again';

    try {
      if (isReviewed) {
        await api.post(`/flashcards/${cards.flashcard_set_id}/review`, { card_index: activeIndex, reviewed: true });
        setReviewed((prev) => ({ ...prev, [activeIndex]: true }));
      }

      if (activeIndex < cards.cards.length - 1) {
        setActiveIndex(idx => idx + 1);
        setFlipped(false);
      } else {
        setFinished(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save review state');
    } finally {
      setReviewLoading(false);
    }
  };

  const progress = cards ? Math.round((Object.keys(reviewed).length / cards.cards.length) * 100) : 0;

  return (
    <div className="page" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Recall</h1>
          <p className="page-subtitle">Strengthen memory with focused review.</p>
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

          {!cards && !historyLoading && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <span className="eyebrow">Current Study Pack</span>
                <h3 style={{ margin: '8px 0 0 0', fontSize: '20px' }}>{activeSession?.topic}</h3>
              </div>
              <p className="muted" style={{ marginBottom: '20px' }}>Generate independent review cards based on your study notes to reinforce your weakest concepts.</p>
              <button className="primary-button" onClick={handleGenerate} disabled={loading} style={{ padding: '12px 24px' }}>
                {loading ? 'Generating flashcards...' : 'Start recall session'}
              </button>
              {error && <div className="status-box error-box" style={{ marginTop: '16px' }}>{error}</div>}
            </div>
          )}

          {cards && !finished && currentCard && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: '#475569' }}>Card {activeIndex + 1} of {cards.cards.length}</span>
                <span style={{ fontWeight: 600, color: '#4f46e5' }}>{progress}% Reviewed</span>
              </div>
              <div style={{ width: '100%', background: '#e2e8f0', height: '8px', borderRadius: '4px', marginBottom: '32px', overflow: 'hidden' }}>
                <div style={{ background: '#4f46e5', height: '100%', width: `${progress}%`, transition: 'width 0.3s ease' }}></div>
              </div>

              <div
                onClick={() => setFlipped(!flipped)}
                style={{
                  width: '100%', maxWidth: '600px', minHeight: '300px', padding: '40px', cursor: 'pointer',
                  background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
                  transition: 'transform 0.6s', transformStyle: 'preserve-3d', position: 'relative'
                }}
              >
                {!flipped ? (
                  <>
                    <span className="badge" style={{ position: 'absolute', top: '16px', left: '16px', background: '#e0e7ff', color: '#4338ca' }}>{currentCard.type ?? 'Concept'}</span>
                    <h2 style={{ fontSize: '24px', color: '#0f172a', fontWeight: 500, lineHeight: 1.5, margin: 0 }}>{currentCard.question}</h2>
                    <p className="muted" style={{ position: 'absolute', bottom: '16px' }}>Tap to reveal answer</p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>{currentCard.question}</div>
                    <div style={{ fontSize: '20px', color: '#0f172a', lineHeight: 1.6 }}>{currentCard.answer}</div>
                  </>
                )}
              </div>

              {flipped && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '32px', width: '100%', maxWidth: '600px' }}>
                  <button type="button" className="secondary-button" style={{ flex: 1, padding: '12px', color: '#ef4444', borderColor: '#fca5a5' }} onClick={(e) => { e.stopPropagation(); handleReview('again'); }} disabled={reviewLoading}>
                    Again
                  </button>
                  <button type="button" className="secondary-button" style={{ flex: 1, padding: '12px', color: '#f59e0b', borderColor: '#fcd34d' }} onClick={(e) => { e.stopPropagation(); handleReview('hard'); }} disabled={reviewLoading}>
                    Hard
                  </button>
                  <button type="button" className="secondary-button" style={{ flex: 1, padding: '12px', color: '#3b82f6', borderColor: '#93c5fd' }} onClick={(e) => { e.stopPropagation(); handleReview('good'); }} disabled={reviewLoading}>
                    Good
                  </button>
                  <button type="button" className="secondary-button" style={{ flex: 1, padding: '12px', color: '#10b981', borderColor: '#6ee7b7' }} onClick={(e) => { e.stopPropagation(); handleReview('easy'); }} disabled={reviewLoading}>
                    Easy
                  </button>
                </div>
              )}
            </div>
          )}

          {finished && (
            <div className="card" style={{ padding: '40px', textAlign: 'center', background: '#f8fafc' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
              <h2 style={{ margin: '0 0 12px 0', color: '#0f172a' }}>Review complete</h2>
              <p className="muted" style={{ margin: '0 0 24px 0' }}>You've reviewed {cards?.cards.length} cards from {activeSession?.topic}. Great job building your retention.</p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                <button className="secondary-button" onClick={() => { setActiveIndex(0); setFlipped(false); setFinished(false); }}>
                  Review again
                </button>
                <button className="primary-button" onClick={() => navigate('/tutor')}>
                  Ask Tutor
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
