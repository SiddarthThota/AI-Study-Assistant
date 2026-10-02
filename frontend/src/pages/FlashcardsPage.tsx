import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { FlashcardResponse } from '../types';

export function FlashcardsPage() {
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [cards, setCards] = useState<FlashcardResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reviewed, setReviewed] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedTopic = sessionStorage.getItem('studyflow-flashcards-topic');
    const storedNotes = sessionStorage.getItem('studyflow-flashcards-notes');
    if (storedTopic) setTopic(storedTopic);
    if (storedNotes) setNotes(storedNotes);
    api.get<{ sets: Array<Record<string, unknown>>; reviews: Array<Record<string, unknown>> }>('/flashcards/history')
      .then(({ sets, reviews }) => {
        const latest = sets[0];
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
  }, []);

  const currentCard = cards?.cards[activeIndex];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post<FlashcardResponse>('/flashcards/generate', {
        topic,
        notes,
        study_session_id: sessionStorage.getItem('studyflow-flashcards-session-id'),
      });
      setCards(response);
      setActiveIndex(0);
      setReviewed({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate flashcards');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkReviewed = async () => {
    if (!cards || reviewed[activeIndex]) return;
    setReviewLoading(true);
    setError('');
    try {
      await api.post(`/flashcards/${cards.flashcard_set_id}/review`, { card_index: activeIndex, reviewed: true });
      setReviewed((prev) => ({ ...prev, [activeIndex]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save review state');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Recall</h1>
          <p className="page-subtitle">Build independent review cards to help retention and spaced repetition.</p>
        </div>
      </header>

      <div className="grid grid-2">
        <form className="card form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="flashcardTopic">Topic</label>
            <input id="flashcardTopic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="flashcardNotes">Notes</label>
            <textarea id="flashcardNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button className="primary-button" type="submit" disabled={loading || !topic.trim() || !notes.trim()}>
            {loading ? 'Generating…' : 'Generate flashcards'}
          </button>
          {error ? <div className="status-box">{error}</div> : null}
        </form>

        <div className="card">
          <h3>Flashcards</h3>
          {cards && currentCard ? (
            <>
              <div className="flashcard-shell">
                <div className="flashcard-question">Q: {currentCard.question}</div>
                <div className="flashcard-answer">A: {currentCard.answer}</div>
                <div className="inline-actions" style={{ marginTop: '12px' }}>
                  <span className="badge">{currentCard.type ?? 'Concept'}</span>
                  {reviewed[activeIndex] ? <span className="badge success-badge">Reviewed</span> : null}
                </div>
              </div>
              <div className="inline-actions" style={{ marginTop: '16px' }}>
                <button type="button" className="secondary-button" onClick={() => setActiveIndex((idx) => Math.max(0, idx - 1))} disabled={activeIndex === 0}>Previous</button>
                <button type="button" className="secondary-button" onClick={() => setActiveIndex((idx) => Math.min((cards.cards.length ?? 1) - 1, idx + 1))} disabled={activeIndex >= (cards.cards.length ?? 1) - 1}>Next</button>
                <button type="button" className="primary-button" onClick={handleMarkReviewed} disabled={reviewLoading || reviewed[activeIndex]}>
                  {reviewLoading ? 'Saving…' : reviewed[activeIndex] ? 'Reviewed' : 'Mark reviewed'}
                </button>
              </div>
            </>
          ) : historyLoading ? (
            <p className="muted" role="status">Loading saved flashcards…</p>
          ) : (
            <p className="muted">Create a review set to reinforce your weakest concepts.</p>
          )}
        </div>
      </div>
    </div>
  );
}
