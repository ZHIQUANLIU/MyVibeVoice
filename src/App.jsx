import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, Pause, RefreshCw, Languages, BookOpen, Volume2, Sparkles, CheckCircle2 } from 'lucide-react';
import './index.css';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: 'Chinese (Mandarin)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
];

const BOOKS = [
  { id: 'book1', title: 'The Little Prince' },
  { id: 'book2', title: '1984 by George Orwell' },
  { id: 'book3', title: 'Harry Potter' },
  { id: 'book4', title: 'To Kill a Mockingbird' },
];

function App() {
  const [mode, setMode] = useState('translate'); // 'translate' | 'clone'
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [targetLang, setTargetLang] = useState('zh');
  const [inputText, setInputText] = useState('');
  const [selectedBook, setSelectedBook] = useState('');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('geminiKey') || '');

  useEffect(() => {
    localStorage.setItem('geminiKey', geminiKey);
  }, [geminiKey]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);

  // Recording logic
  const handleRecordToggle = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        // Stop all tracks to release microphone
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
      setIsReady(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          setHasRecorded(true);
        };

        mediaRecorder.start();
        setIsRecording(true);
        setHasRecorded(false);
        setIsReady(false);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Could not access microphone. Please ensure microphone permissions are granted.');
      }
    }
  };

  const handleProcess = async () => {
    if (!geminiKey) {
      alert("Please enter your Gemini API Key in the Output Settings.");
      return;
    }

    setIsProcessing(true);
    setIsReady(false);
    
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'record.webm');
      formData.append('mode', mode);
      formData.append('targetLang', targetLang);
      formData.append('inputText', mode === 'clone' ? inputText : '');
      formData.append('geminiKey', geminiKey);

      const response = await fetch('http://localhost:8000/api/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Backend processing failed. Make sure the server is running and key is correct.');
      }

      const outputBlob = await response.blob();
      const url = URL.createObjectURL(outputBlob);
      setAudioUrl(url);
      setIsReady(true);
    } catch (err) {
      console.error(err);
      alert('Error during processing: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlayToggle = () => {
    if (!audioPlayerRef.current && audioUrl) {
      audioPlayerRef.current = new Audio(audioUrl);
      audioPlayerRef.current.onended = () => setIsPlaying(false);
    }
    
    if (isPlaying) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const resetState = () => {
    setHasRecorded(false);
    setIsReady(false);
    setIsPlaying(false);
    setIsProcessing(false);
    setAudioUrl(null);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
  };

  return (
    <div className="app-container">
      <header className="fade-in">
        <h1>
          <span className="gradient-text">VibeVoice</span> AI
        </h1>
        <p className="subtitle">Next-Generation Voice Translation & Cloning</p>
      </header>

      <div className="mode-selector fade-in" style={{ animationDelay: '0.1s' }}>
        <div 
          className={`mode-btn ${mode === 'translate' ? 'active' : ''}`}
          onClick={() => { setMode('translate'); resetState(); }}
        >
          Real-time Translation
        </div>
        <div 
          className={`mode-btn ${mode === 'clone' ? 'active' : ''}`}
          onClick={() => { setMode('clone'); resetState(); }}
        >
          Voice Cloning & Reading
        </div>
      </div>

      <div className="grid">
        {/* Left Column: Input / Recording */}
        <div className="glass-panel fade-in" style={{ animationDelay: '0.2s' }}>
          <h2><Mic size={24} color="var(--primary)" /> Voice Input</h2>
          
          <div style={{ textAlign: 'center', margin: '2rem 0' }}>
            <div 
              className={`record-pulse ${isRecording ? 'recording' : ''}`}
              onClick={handleRecordToggle}
            >
              {isRecording ? <Square color="white" fill="white" /> : <Mic size={32} color="white" />}
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              {isRecording ? 'Recording in progress...' : 
               hasRecorded ? 'Recording captured successfully!' : 
               'Tap to start recording'}
            </p>
          </div>

          {mode === 'clone' && (
            <div className="form-group fade-in">
              <label>What should your cloned voice read?</label>
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <BookOpen size={18} color="var(--secondary)" />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select a book:</span>
                </div>
                <div className="books-list">
                  {BOOKS.map(book => (
                    <div 
                      key={book.id} 
                      className={`book-item ${selectedBook === book.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedBook(book.id);
                        setInputText(`Reading excerpt from ${book.title}...`);
                      }}
                    >
                      <BookOpen className="book-icon" size={20} />
                      <span className="book-title">{book.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>— OR —</div>
              
              <textarea 
                placeholder="Type any custom text here for your voice to read..."
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setSelectedBook('');
                }}
              />
            </div>
          )}
        </div>

        {/* Right Column: Output / Processing */}
        <div className="glass-panel fade-in" style={{ animationDelay: '0.3s' }}>
          <h2><Sparkles size={24} color="var(--secondary)" /> Output Settings</h2>
          
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Languages size={18} /> Target Language
            </label>
            <select 
              value={targetLang} 
              onChange={(e) => setTargetLang(e.target.value)}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} /> Gemini API Key
            </label>
            <input 
              type="password" 
              placeholder="Enter your Gemini Key here..."
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
              onClick={handleProcess}
              disabled={!hasRecorded || isProcessing || (mode === 'clone' && !inputText)}
            >
              {isProcessing ? (
                <><RefreshCw className="processing" size={20} /> Processing via VibeVoice AI...</>
              ) : (
                <>Generate {mode === 'translate' ? 'Translation' : 'Voice Clone'}</>
              )}
            </button>
            
            <div className="status-indicator">
              <div className={`dot ${isProcessing ? 'processing' : isReady ? 'ready' : ''}`}></div>
              <span>
                {!hasRecorded ? 'Waiting for voice input...' :
                 isProcessing ? 'AI models are synthesizing audio...' :
                 isReady ? 'Audio ready for playback!' :
                 'Ready to generate'}
              </span>
            </div>
          </div>

          {isReady && (
            <div className="audio-player-container fade-in">
              <div className="audio-controls">
                <button 
                  className="btn" 
                  style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0 }}
                  onClick={handlePlayToggle}
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: '4px' }} />}
                </button>
                <div className={`waveform ${isPlaying ? 'playing' : ''}`}></div>
                <Volume2 size={20} color="var(--text-secondary)" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
