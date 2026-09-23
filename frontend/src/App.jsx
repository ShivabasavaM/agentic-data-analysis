import React, { useState, useEffect, useRef } from 'react';

const formatMessage = (text) => {
  if (!text) return "";
  
  // Split the message by newlines to process block-level elements
  return text.split('\n').map((line, lineIdx) => {
    
    // 1. Identify Headers
    let isH1 = line.startsWith('# ');
    let isH2 = line.startsWith('## ');
    let isH3 = line.startsWith('### ');
    
    let rawText = line;
    if (isH1) rawText = line.substring(2);
    else if (isH2) rawText = line.substring(3);
    else if (isH3) rawText = line.substring(4);

    // 2. Process inline **bold** text within the line
    const parts = rawText.split(/(\*\*.*?\*\*)/g);
    const formattedInline = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    // 3. Wrap in appropriate HTML tags
    if (isH1) return <h1 key={lineIdx} style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '16px', marginBottom: '8px' }}>{formattedInline}</h1>;
    if (isH2) return <h2 key={lineIdx} style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '16px', marginBottom: '8px' }}>{formattedInline}</h2>;
    if (isH3) return <h3 key={lineIdx} style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '16px', marginBottom: '8px' }}>{formattedInline}</h3>;
    
    // 4. Return standard lines (empty lines will naturally create paragraph spacing)
    return <div key={lineIdx} style={{ minHeight: '1.5em' }}>{formattedInline}</div>;
  });
};

function App() {
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState('default');
  const [file, setFile] = useState(null);
  
  // Modals state
  const [showIntro, setShowIntro] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // Auto-scroll reference
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleAsk = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMsg, 
          file_id: dataSource === 'default' ? 'default' : 'custom_upload' 
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }
      
      const data = await res.json();
      
      setChatHistory(prev => [...prev, { 
        role: 'agent', 
        content: data.answer || data.explanation || "No explanation provided.",
        trace: data.trace || [] 
      }]);
      
    } catch (error) {
      setChatHistory(prev => [...prev, { 
        role: 'system-error', 
        content: `⚠️ System Error: ${error.message}` 
      }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', fontFamily: 'Arial, sans-serif', color: '#333', position: 'relative' }}>
      
      {/* ONBOARDING INTRO MODAL */}
      {showIntro && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', maxWidth: '550px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ color: '#5a287d', marginTop: 0 }}>Project 4 - Agentic Data Analysis with Tool Selection and Guardrails</h2>
            <p>Welcome! This is a production-ready GenAI data-analysis agent built for the NatWest Principal Engineer assessment.</p>
            <ul style={{ lineHeight: '1.6' }}>
              <li><strong>Strict Guardrails:</strong> The LLM translates natural language into a JSON plan. It <em>never</em> computes math directly.</li>
              <li><strong>Deterministic Execution:</strong> All aggregations and filters are executed strictly in Python (Pandas).</li>
              <li><strong>Transparency:</strong> Every answer includes a deterministic execution trace showing exactly what the engine did.</li>
            </ul>
            
            <div style={{ background: '#fff0f5', borderLeft: '4px solid #a50050', padding: '10px', margin: '15px 0', fontSize: '13px' }}>
              <strong>⚠️ Cold Boot Notice:</strong> As the backend is hosted on Render's free tier, the first question may take up to a minute to process while the server wakes up.
            </div>

            <p style={{ fontSize: '14px' }}>
              <strong>Source Code:</strong> <a href="YOUR_GITHUB_LINK_HERE" target="_blank" rel="noopener noreferrer" style={{ color: '#5a287d' }}>View complete details on GitHub</a>
            </p>

            <button onClick={() => setShowIntro(false)} style={{ width: '100%', padding: '12px', background: '#5a287d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* DEFAULT DATASET PREVIEW MODAL */}
      {showPreview && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', maxWidth: '750px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#5a287d', marginTop: 0 }}>Default Dataset (Complete 10 Rows)</h3>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', marginBottom: '20px' }}>
              <thead>
                <tr style={{ background: '#f4f4f9', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '8px' }}>id</th><th style={{ padding: '8px' }}>date</th><th style={{ padding: '8px' }}>region</th>
                  <th style={{ padding: '8px' }}>product</th><th style={{ padding: '8px' }}>units</th><th style={{ padding: '8px' }}>unit_price</th><th style={{ padding: '8px' }}>discount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>T001</td><td>2026-01-03</td><td>UK</td><td>Alpha</td><td>10.0</td><td>100.0</td><td>0.10</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>T002</td><td>2026-01-05</td><td>DE</td><td>Beta</td><td>5.0</td><td>200.0</td><td>0.00</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>T003</td><td>2026-01-11</td><td>UK</td><td>Beta</td><td>8.0</td><td>200.0</td><td>0.05</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>T004</td><td>2026-01-15</td><td>FR</td><td>Alpha</td><td>12.0</td><td>100.0</td><td>0.00</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>T005</td><td>2026-02-02</td><td>UK</td><td>Gamma</td><td>4.0</td><td>500.0</td><td>0.20</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>T006</td><td>2026-02-05</td><td>DE</td><td>Alpha</td><td>6.0</td><td>100.0</td><td>0.00</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>T007</td><td>2026-02-12</td><td>FR</td><td>Beta</td><td>7.0</td><td>200.0</td><td>0.10</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>T008</td><td>2026-02-18</td><td>UK</td><td>Gamma</td><td>5.0</td><td>500.0</td><td>0.00</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>T009</td><td>2026-03-01</td><td>DE</td><td>Gamma</td><td>3.0</td><td>500.0</td><td>0.15</td></tr>
                <tr style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '8px' }}>T010</td><td>2026-03-05</td><td>FR</td><td>Alpha</td><td>15.0</td><td>100.0</td><td>0.20</td></tr>
              </tbody>
            </table>

            <div style={{ background: '#f4f4f9', padding: '15px', borderRadius: '6px' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>💡 Try asking these example questions:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', lineHeight: '1.5' }}>
                <li><em>"What is the total net revenue for the UK region?"</em></li>
                <li><em>"How many total units of Alpha were sold across all regions?"</em></li>
              </ul>
            </div>

            <button onClick={() => setShowPreview(false)} style={{ marginTop: '20px', padding: '8px 16px', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', float: 'right' }}>Close</button>
          </div>
        </div>
      )}

      {/* Header Area */}
      <div style={{ borderBottom: '3px solid #5a287d', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#5a287d', margin: 0 }}>Project 4 - Agentic Data Analysis</h2>
          <p style={{ color: '#666', fontSize: '14px', margin: '5px 0 0 0' }}>NatWest Assessment Prototype</p>
        </div>
        <button onClick={() => setShowIntro(true)} style={{ background: 'none', border: '1px solid #5a287d', color: '#5a287d', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
          ℹ️ Project Info
        </button>
      </div>

      {/* Data Source Selector */}
      <div style={{ background: '#f4f4f9', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input type="radio" name="dataSource" value="default" checked={dataSource === 'default'} onChange={() => setDataSource('default')} />
            Use Default Data
          </label>
          
          {dataSource === 'default' && (
            <button onClick={() => setShowPreview(true)} style={{ fontSize: '12px', background: '#fff', border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
              👀 Preview Dataset & Examples
            </button>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input type="radio" name="dataSource" value="custom" checked={dataSource === 'custom'} onChange={() => setDataSource('custom')} />
            Upload Custom CSV
          </label>
        </div>

        {dataSource === 'custom' && (
          <div style={{ marginTop: '5px', padding: '10px', background: '#fff', border: '1px dashed #ccc', borderRadius: '4px' }}>
            <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} style={{ fontSize: '13px', marginBottom: '8px' }} />
            <div style={{ fontSize: '12px', color: '#666' }}>
              <strong>Requirements:</strong> Max size 5MB. Required exact columns: <code style={{ background: '#eee', padding: '2px 4px' }}>id, date, region, product, units, unit_price, discount</code>
            </div>
          </div>
        )}
      </div>

      {/* CONTINUOUS CHAT HISTORY */}
      <div style={{ height: '400px', overflowY: 'auto', background: '#fafafa', border: '1px solid #ddd', borderRadius: '8px', padding: '20px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {chatHistory.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', marginTop: '100px' }}>
            Start a conversation to analyze the data.
          </div>
        )}
        
        {chatHistory.map((msg, idx) => (
          <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            
            {/* Main Chat Bubble */}
            <div style={{ 
              padding: '14px 18px', 
              borderRadius: '8px', 
              background: msg.role === 'user' ? '#5a287d' : msg.role === 'system-error' ? '#fef2f2' : 'white', 
              color: msg.role === 'user' ? 'white' : msg.role === 'system-error' ? '#991b1b' : '#1f2937', 
              border: msg.role === 'user' ? 'none' : msg.role === 'system-error' ? '1px solid #f87171' : '1px solid #d1d5db', 
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)', 
              lineHeight: '1.6', 
              whiteSpace: 'pre-wrap', 
              fontSize: '16px',
              fontWeight: msg.role === 'system-error' ? 'bold' : 'normal'
            }}>
              {/* Apply the parser here so **text** becomes bold */}
              {formatMessage(msg.content)}
            </div>

            {/* DETERMINISTIC LOG (Dropdown) */}
            {msg.trace && msg.trace.length > 0 && (
              <details style={{ 
                marginTop: '8px', 
                background: '#eff6ff',
                borderLeft: '4px solid #2563eb',
                borderRadius: '4px',
                color: '#1e3a8a',
                overflow: 'hidden'
              }}>
                <summary style={{ 
                  padding: '8px 14px', 
                  cursor: 'pointer', 
                  fontWeight: 'bold', 
                  color: '#1d4ed8',
                  outline: 'none',
                  listStyle: 'inside disclosure-closed',
                  fontSize: '12px'
                }}>
                  🔧 Deterministic Execution Trace
                </summary>
                
                <div style={{ 
                  padding: '0 14px 10px 14px', 
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}>
                  {msg.trace.map((t, tIdx) => (
                    <div key={tIdx} style={{ marginBottom: '6px', paddingBottom: '4px', borderBottom: tIdx !== msg.trace.length - 1 ? '1px solid #bfdbfe' : 'none' }}>
                      <span style={{ fontWeight: 'bold' }}>[{t.tool || t.op || 'operation'}]</span>: <br/>
                      <span style={{ color: '#3b82f6' }}>{JSON.stringify(t.arguments || t.description || t, null, 2)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
        
        {loading && (
          <div style={{ alignSelf: 'flex-start', color: '#666', fontSize: '13px', fontStyle: 'italic' }}>
            Agent is thinking...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <textarea 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyDown={handleKeyDown}
          placeholder="e.g., What is the total revenue by region? (Press Enter to send)"
          style={{ flex: 1, height: '50px', padding: '12px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', fontSize: '15px' }}
        />
        <button 
          onClick={handleAsk} 
          disabled={loading || (dataSource === 'custom' && !file) || !input.trim()} 
          style={{ 
            padding: '0 25px', 
            background: (loading || (dataSource === 'custom' && !file) || !input.trim()) ? '#ccc' : '#a50050',
            color: '#fff', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: (loading || (dataSource === 'custom' && !file) || !input.trim()) ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            transition: 'background 0.2s',
            fontSize: '15px'
          }}
        >
          Send
        </button>
      </div>

    </div>
  );
}

export default App;