import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { StudyHistory, TutorResponse } from '../types';

type ConversationMessage = { role: 'user' | 'assistant'; content: string };

export function TutorPage() {
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [response, setResponse] = useState<TutorResponse | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedTopic = sessionStorage.getItem('studyflow-tutor-topic');
    const storedNotes = sessionStorage.getItem('studyflow-tutor-notes');
    if (storedTopic) setTopic(storedTopic);
    if (storedNotes) setNotes(storedNotes);
    const storedConversationId = sessionStorage.getItem('studyflow-tutor-conversation-id');
    setConversationId(storedConversationId);
    if (storedConversationId) {
      api.get<StudyHistory>('/study/history')
        .then((history) => setMessages(history.tutor_messages
          .filter((message) => message.conversation_id === storedConversationId)
          .map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: String(message.content ?? ''),
          }))))
        .catch((err: Error) => setError(err.message));
    }
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await api.post<TutorResponse>('/tutor/chat', {
        topic,
        notes,
        question,
        pdf_context: '',
        conversation_id: conversationId,
        chat_history: [],
      });
      setResponse(result);
      setConversationId(result.conversation_id);
      sessionStorage.setItem('studyflow-tutor-conversation-id', result.conversation_id);
      setMessages((current) => [
        ...current,
        { role: 'user', content: question },
        { role: 'assistant', content: result.answer },
      ]);
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to get tutor response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">AI Tutor</h1>
          <p className="page-subtitle">Get targeted explanations, examples, and misconceptions to guide deeper learning.</p>
        </div>
      </header>

      <div className="grid grid-2">
        <form className="card form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="tutorTopic">Topic</label>
            <input id="tutorTopic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tutorNotes">Current notes</label>
            <textarea id="tutorNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tutorQuestion">Question</label>
            <textarea id="tutorQuestion" value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <button className="primary-button" type="submit" disabled={loading || !topic.trim() || !notes.trim() || !question.trim()}>
            {loading ? 'Thinking…' : 'Ask tutor'}
          </button>
          {error ? <div className="status-box">{error}</div> : null}
        </form>

        <div className="card">
          <h3>Conversation</h3>
          {messages.length ? (
            <div className="conversation-thread" aria-live="polite">
              {messages.map((message, index) => (
                <div className={`conversation-message ${message.role}`} key={`${message.role}-${index}`}>
                  <span className="eyebrow">{message.role === 'user' ? 'You' : 'Tutor'}</span>
                  <p className="answer-box">{message.content}</p>
                </div>
              ))}
              {response ? <p className="muted"><strong>Follow-up:</strong> {response.follow_up}</p> : null}
            </div>
          ) : response ? (
            <>
              <div className="status-box answer-box">{response.answer}</div>
              <p className="muted"><strong>Follow-up:</strong> {response.follow_up}</p>
              <p className="muted"><strong>Source summary:</strong> {response.source_summary}</p>
            </>
          ) : (
            <p className="muted">Generate study notes, then ask a question grounded in that material.</p>
          )}
        </div>
      </div>
    </div>
  );
}
