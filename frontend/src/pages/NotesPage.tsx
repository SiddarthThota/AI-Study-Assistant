import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { NotesResponse } from '../types';

export function NotesPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('Machine Learning');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [sourceText, setSourceText] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{ fileName: string; pageCount: number } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<NotesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post<NotesResponse>('/notes/generate', {
        topic,
        difficulty,
        source_text: sourceText,
        source_type: pdfInfo ? 'pdf' : 'topic',
      });
      setResult(response);
      sessionStorage.setItem('studyflow-last-topic', response.topic);
      sessionStorage.setItem('studyflow-last-notes', response.notes);
      sessionStorage.setItem('studyflow-last-session-id', response.study_session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate notes');
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
    if (!result) {
      setError('Generate notes before exporting.');
      return;
    }

    const blob = new Blob([`# ${result.topic}\n\n${result.notes}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${result.topic.toLowerCase().replace(/\s+/g, '-')}-notes.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handlePractice = () => {
    if (!result) {
      setError('Generate notes before starting practice.');
      return;
    }

    sessionStorage.setItem('studyflow-practice-topic', result.topic);
    sessionStorage.setItem('studyflow-practice-notes', result.notes);
    sessionStorage.setItem('studyflow-practice-session-id', result.study_session_id);
    navigate('/quiz');
  };

  const handleFlashcards = () => {
    if (!result) {
      setError('Generate notes before creating flashcards.');
      return;
    }

    sessionStorage.setItem('studyflow-flashcards-topic', result.topic);
    sessionStorage.setItem('studyflow-flashcards-notes', result.notes);
    sessionStorage.setItem('studyflow-flashcards-session-id', result.study_session_id);
    navigate('/flashcards');
  };

  const handleTutor = () => {
    if (!result) {
      setError('Generate notes before asking the tutor.');
      return;
    }

    sessionStorage.setItem('studyflow-tutor-topic', result.topic);
    sessionStorage.setItem('studyflow-tutor-notes', result.notes);
    sessionStorage.setItem('studyflow-tutor-session-id', result.study_session_id);
    navigate('/tutor');
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Learn</h1>
          <p className="page-subtitle">Turn a topic or source document into structured study notes.</p>
        </div>
      </header>

      <div className="grid grid-2">
        <form className="card form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="topic">Topic</label>
            <input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="difficulty">Difficulty</label>
            <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>

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
              }}
            />
            <button type="button" className="secondary-button" onClick={handlePdfUpload} disabled={!pdfFile || extracting}>
              {extracting ? 'Extracting…' : 'Extract PDF text'}
            </button>
            {pdfInfo ? <span className="muted">{pdfInfo.fileName} · {pdfInfo.pageCount} pages extracted</span> : null}
          </div>

          <div className="field">
            <label htmlFor="sourceText">Source context</label>
            <textarea
              id="sourceText"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Paste notes or inspect/edit text extracted from your PDF. This source grounds generated notes."
            />
          </div>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Generating…' : 'Generate notes'}
          </button>

          <div className="inline-actions">
            <button type="button" className="secondary-button" disabled={!result}>
              {result ? 'Saved to History' : 'Save'}
            </button>
            <button type="button" className="secondary-button" onClick={handleExport} disabled={!result}>Export</button>
            <button type="button" className="secondary-button" onClick={handlePractice} disabled={!result}>Practice</button>
            <button type="button" className="secondary-button" onClick={handleFlashcards} disabled={!result}>Flashcards</button>
            <button type="button" className="secondary-button" onClick={handleTutor} disabled={!result}>Ask Tutor</button>
          </div>

          {error ? <div className="status-box">{error}</div> : null}
        </form>

        <div className="card">
          <h3>Study notes</h3>
          {result ? (
            <>
              <span className="badge">{result.difficulty}</span>
              <div className="status-box answer-box notes-content">{result.notes}</div>
            </>
          ) : (
            <p className="muted">Generate a note set to begin your study session.</p>
          )}
        </div>
      </div>
    </div>
  );
}
