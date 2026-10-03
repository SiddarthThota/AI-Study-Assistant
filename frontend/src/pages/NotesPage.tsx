import { FormEvent, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { NotesResponse } from '../types';
import { useStudyContext } from '../contexts/StudyContext';

export function NotesPage() {
  const navigate = useNavigate();
  const { setActiveSession } = useStudyContext();
  const [mode, setMode] = useState<'topic' | 'pdf'>('topic');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [sourceText, setSourceText] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{ fileName: string; pageCount: number } | null>(null);
  const [extracting, setExtracting] = useState(false);

  const [result, setResult] = useState<NotesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState('');

  // Auto-progress animation for UX
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      interval = setInterval(() => {
        setProgressStep(s => (s < 3 ? s + 1 : s));
      }, 3000);
    } else {
      setProgressStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || extracting) return;

    if (mode === 'topic' && !topic.trim()) {
      setError('Please enter a topic to learn.');
      return;
    }
    if (mode === 'pdf' && !sourceText) {
      setError('Please extract text from a PDF first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post<NotesResponse>('/notes/generate', {
        topic: mode === 'pdf' ? (topic || pdfInfo?.fileName || 'Document Study') : topic,
        difficulty,
        source_text: sourceText,
        source_type: mode,
      });
      setResult(response);

      // Set active study pack in global context and backend
      await setActiveSession(response.study_session_id);    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to generate notes';

      if (msg.includes('Gemini') || msg.includes('failed') || msg.includes('503') || msg.includes('429') || msg.includes('unavailable')) {
        setError('AI generation is temporarily unavailable. Please try again.');
      } else if (msg.toLowerCase().includes('session') || msg.toLowerCase().includes('sign in')) {
        setError('Your session expired. Please sign in again.');
      } else if (msg.toLowerCase().includes('topic') || msg.toLowerCase().includes('valid')) {
        setError('Please enter a valid topic.');
      } else if (msg.includes('save') || msg.includes('Persistence')) {
        setError('We generated your study guide but could not save it. Please try again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async () => {
    if (!pdfFile) return;
    setExtracting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      const extracted = await api.upload<{ file_name: string; page_count: number; source_text: string }>(
        '/notes/extract-pdf',
        formData,
      );
      setSourceText(extracted.source_text);
      setPdfInfo({ fileName: extracted.file_name, pageCount: extracted.page_count });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to extract this PDF');
    } finally {
      setExtracting(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const blob = new Blob([`# ${result.topic}\n\n${result.notes}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${result.topic.toLowerCase().replace(/\s+/g, '-')}-notes.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const progressLabels = [
    'Preparing source material...',
    'Analyzing key concepts...',
    'Writing structured study guide...',
    'Building practice material...'
  ];

  return (
    <div className="page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">Learn</h1>
          <p className="page-subtitle">Turn a topic or your study material into a structured learning workspace.</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 200px', gap: '24px', alignItems: 'start' }}>

        {/* Left Column: Source Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>How do you want to learn?</h3>

            <div className="segmented-control" style={{ marginBottom: '20px' }}>
              <button type="button" className={mode === 'topic' ? 'segmented active' : 'segmented'} onClick={() => { setMode('topic'); setError(''); }}>
                Topic
              </button>
              <button type="button" className={mode === 'pdf' ? 'segmented active' : 'segmented'} onClick={() => { setMode('pdf'); setError(''); }}>
                PDF Document
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {mode === 'topic' ? (
                <>
                  <div className="field">
                    <label htmlFor="topic">Topic</label>
                    <input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis" />
                  </div>
                  <div className="field">
                    <label htmlFor="difficulty">Difficulty</label>
                    <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="pdfFile">Source PDF</label>
                    <input
                      id="pdfFile"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) => {
                        setPdfFile(event.target.files?.[0] ?? null);
                        setPdfInfo(null);
                        setSourceText('');
                        setError('');
                      }}
                    />
                    <button type="button" className="secondary-button" onClick={handlePdfUpload} disabled={!pdfFile || extracting} style={{ marginTop: '8px' }}>
                      {extracting ? 'Extracting…' : 'Extract PDF text'}
                    </button>
                    {pdfInfo && (
                      <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>
                        <strong>Source ready</strong><br/>
                        <span className="muted">{pdfInfo.pageCount} pages extracted from {pdfInfo.fileName}</span>
                      </div>
                    )}
                  </div>
                  <div className="field">
                    <label htmlFor="topicOptional">Topic (Optional)</label>
                    <input id="topicOptional" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Name this study pack" />
                  </div>
                </>
              )}

              <button className="primary-button" type="submit" disabled={loading || extracting} style={{ width: '100%', marginTop: '16px' }}>
                {loading ? 'Generating...' : 'Create study pack'}
              </button>
            </form>

            {error && (
              <div className="status-box error-box" style={{ marginTop: '16px', background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '6px' }}>
                {error}
                {(error.includes('temporarily unavailable') || error.includes('could not save')) && (
                  <button className="secondary-button" onClick={handleSubmit} style={{ marginTop: '12px', width: '100%' }}>
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Notes Output */}
        <div className="card" style={{ padding: '32px', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#64748b' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '24px' }}></div>
              <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Creating Study Pack</h3>
              <p>{progressLabels[progressStep]}</p>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : result ? (
            <div className="notes-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '28px', color: '#0f172a' }}>{result.topic}</h2>
                <span className="badge">{result.difficulty}</span>
              </div>
              <div style={{ lineHeight: '1.7', color: '#334155' }} dangerouslySetInnerHTML={{
                __html: result.notes
                  .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                  .replace(/^## (.*$)/gim, '<h2 style="margin-top: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">$1</h2>')
                  .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                  .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/gim, '<em>$1</em>')
                  .replace(/\[Page (\d+)\]/gim, '<span style="background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-size: 12px; margin-left: 4px;">Page $1</span>')
                  .replace(/\n\n/g, '<br/><br/>')
              }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
              <h3 style={{ color: '#0f172a', margin: '0 0 8px 0' }}>Your study guide will appear here</h3>
              <p style={{ maxWidth: '300px', margin: 0 }}>Select a topic or upload a PDF to generate a comprehensive, structured learning workspace.</p>
            </div>
          )}
        </div>

        {/* Right Column: Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Study Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button type="button" className="secondary-button" onClick={() => navigate('/quiz')} disabled={!result} style={{ justifyContent: 'flex-start' }}>
                📝 Practice Quiz
              </button>
              <button type="button" className="secondary-button" onClick={() => navigate('/flashcards')} disabled={!result} style={{ justifyContent: 'flex-start' }}>
                🗂️ Recall Cards
              </button>
              <button type="button" className="secondary-button" onClick={() => navigate('/tutor')} disabled={!result} style={{ justifyContent: 'flex-start' }}>
                💬 Ask AI Tutor
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button type="button" className="secondary-button" onClick={handleExport} disabled={!result} style={{ justifyContent: 'flex-start' }}>
                📥 Export Markdown
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
