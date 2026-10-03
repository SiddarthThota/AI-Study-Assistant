import { FormEvent, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { StudyHistory, TutorResponse } from '../types';
import { useStudyContext } from '../contexts/StudyContext';

type ConversationMessage = { role: 'user' | 'assistant'; content: string };

export function TutorPage() {
  const navigate = useNavigate();
  const { activeSession, loading: sessionLoading, refreshActiveSession } = useStudyContext();

  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Speech Recognition if supported
  const win = window as unknown as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognition = (win.SpeechRecognition || win.webkitSpeechRecognition) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognition: any = SpeechRecognition ? new SpeechRecognition() : null;

  if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: { results: { transcript: string }[][] }) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(prev => (prev ? prev + ' ' : '') + transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
  }

  const toggleListening = () => {
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.start();
      setListening(true);
    }
  };

  useEffect(() => {
    if (sessionLoading) return;

    // We get conversationId from the active session if it exists, otherwise it's a new conversation
    const storedConversationId = activeSession?.tutor_conversation_id || null;
    setConversationId(storedConversationId);

    if (storedConversationId) {
      api.get<StudyHistory>('/study/history')
        .then((history) => {
          const msgs = history.tutor_messages
            .filter((message) => String(message.conversation_id) === storedConversationId)
            .map((message) => ({
              role: message.role === 'assistant' ? 'assistant' : 'user',
              content: String(message.content ?? ''),
            } as ConversationMessage));

          if (msgs.length > 0) {
            setMessages(msgs);
          } else {
            setMessages([{ role: 'assistant', content: `Hi! I'm your AI Tutor. I can help explain concepts from ${activeSession?.topic || 'your study pack'}. What would you like to know?` }]);
          }
        })
        .catch((err: Error) => setError(err.message));
    } else if (activeSession) {
      setMessages([{ role: 'assistant', content: `Hi! I'm your AI Tutor. I can help explain concepts from ${activeSession.topic}. What would you like to know?` }]);
    }
  }, [activeSession, sessionLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;

    const userQuestion = question;
    setQuestion('');
    setMessages(current => [...current, { role: 'user', content: userQuestion }]);
    setLoading(true);
    setError('');

    try {
      const result = await api.post<TutorResponse>('/tutor/chat', {
        topic: activeSession?.topic || '',
        notes: activeSession?.notes || '',
        question: userQuestion,
        pdf_context: '',
        conversation_id: conversationId,
        study_session_id: activeSession?.study_session_id || null,
        chat_history: messages.slice(-10), // Send last 10 messages for context
      });
      setConversationId(result.conversation_id);
      if (!conversationId) {
        setConversationId(result.conversation_id);
        refreshActiveSession();
      }

      setMessages(current => [
        ...current,
        { role: 'assistant', content: result.answer },
      ]);

      if (result.follow_up) {
         setMessages(current => [
           ...current,
           { role: 'assistant', content: `Here's a follow-up: ${result.follow_up}` },
         ]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes('Gemini') || err.message.includes('failed') || err.message.includes('503')
             ? 'We couldn\'t process your request right now. Please try again.'
             : err.message
          : 'Unable to get tutor response'
      );
      // Revert optimistic update on failure
      setMessages(current => current.slice(0, -1));
      setQuestion(userQuestion);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: '1000px', margin: '0 auto', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <header className="page-header" style={{ marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h1 className="page-title">AI Tutor</h1>
          <p className="page-subtitle">Ask questions about your current study material.</p>
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
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>Study Context: {activeSession?.topic}</span>
            <button className="secondary-button" onClick={() => { setMessages([{ role: 'assistant', content: `Hi! I'm your AI Tutor. I can help explain concepts from ${activeSession?.topic}. What would you like to know?` }]); setConversationId(null); }} style={{ padding: '6px 12px', fontSize: '12px' }}>
              New Chat
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'white' }}>
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%', alignSelf: isUser ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{isUser ? 'You' : 'AI Tutor'}</span>
                  </div>
                  <div style={{
                    padding: '16px 20px',
                    background: isUser ? '#4f46e5' : '#f1f5f9',
                    color: isUser ? 'white' : '#0f172a',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    lineHeight: 1.6,
                    fontSize: '15px'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: message.content
                      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
                      .replace(/\[Page (\d+)\]/gim, '<span style="background: rgba(99, 102, 241, 0.2); padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 4px;">Page $1</span>')
                      .replace(/\n/g, '<br/>')
                  }} />
                </div>
              );
            })}

            {loading && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid #cbd5e1', borderTopColor: '#64748b', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                </div>
                <span className="muted">Tutor is thinking...</span>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            {error && <div className="status-box error-box" style={{ marginBottom: '16px', padding: '8px 12px' }}>{error}</div>}

            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (question.trim() && !loading) {
                        handleSubmit(e as unknown as FormEvent);
                      }
                    }
                  }}
                  placeholder="Ask a question about the material..."
                  style={{ width: '100%', minHeight: '60px', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'none', lineHeight: 1.5 }}
                  disabled={loading}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', paddingBottom: '8px' }}>
                {recognition && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className="secondary-button"
                    style={{ padding: '12px', borderRadius: '8px', background: listening ? '#fee2e2' : 'white', borderColor: listening ? '#fca5a5' : '#cbd5e1' }}
                    title={listening ? 'Stop listening' : 'Use microphone'}
                    disabled={loading}
                  >
                    🎤
                  </button>
                )}
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!question.trim() || loading}
                  style={{ padding: '12px 24px', borderRadius: '8px' }}
                >
                  Send
                </button>
              </div>
            </form>
            {!recognition && (
               <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px', textAlign: 'right' }}>
                 Voice input is not supported in this browser. You can continue with text.
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
