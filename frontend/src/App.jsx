import React, { useState } from 'react';

function App() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState('default');
  const [file, setFile] = useState(null);
  
  // New state for the tooltip
  const [showTooltip, setShowTooltip] = useState(false);

  const handleAsk = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResponse('');
    
    // Dynamically pull the backend URL from Vite's environment variables
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, file_id: dataSource === 'default' ? 'default' : 'custom_upload' })
      });
      const data = await res.json();
      setResponse(data.answer);
    } catch (error) {
      setResponse("Error connecting to backend.");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '700px', margin: '40px auto', fontFamily: 'Arial, sans-serif', color: '#333' }}>
      {/* Header Area */}
      <div style={{ borderBottom: '3px solid #5a287d', paddingBottom: '10px', marginBottom: '20px' }}>
        <h2 style={{ color: '#5a287d', margin: 0 }}>Agentic Data Analyst</h2>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>NatWest Assessment Prototype</p>
      </div>

      {/* Data Source Selector */}
      <div style={{ background: '#f4f4f9', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid #e0e0e0' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input 
            type="radio" 
            name="dataSource" 
            value="default" 
            checked={dataSource === 'default'} 
            onChange={() => setDataSource('default')} 
          />
          Use Default Data
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input 
            type="radio" 
            name="dataSource" 
            value="custom" 
            checked={dataSource === 'custom'} 
            onChange={() => setDataSource('custom')} 
          />
          Upload Custom CSV
        </label>

        {dataSource === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
              type="file" 
              accept=".csv" 
              onChange={(e) => setFile(e.target.files[0])}
              style={{ fontSize: '13px' }}
            />
            
            {/* Custom React Tooltip Implementation */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div 
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                style={{
                  background: '#a50050', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', 
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', 
                  fontSize: '12px', fontWeight: 'bold', cursor: 'help'
                }}>
                i
              </div>
              
              {/* Tooltip Box */}
              {showTooltip && (
                <div style={{
                  position: 'absolute',
                  bottom: '130%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#333',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  width: '220px',
                  textAlign: 'center',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  lineHeight: '1.4'
                }}>
                  Max file size: 5MB. Required columns and Format should be: id, date, region, product, units, unit_price, discount.
                  {/* Tooltip Arrow pointing down */}
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    marginLeft: '-5px',
                    borderWidth: '5px',
                    borderStyle: 'solid',
                    borderColor: '#333 transparent transparent transparent'
                  }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat Area */}
      <textarea 
        value={query} 
        onChange={(e) => setQuery(e.target.value)} 
        placeholder="e.g., What is the total revenue by region?"
        style={{ width: '100%', height: '100px', marginBottom: '15px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
      />
      <button 
        onClick={handleAsk} 
        disabled={loading || (dataSource === 'custom' && !file)} 
        style={{ 
          padding: '10px 25px', 
          background: (loading || (dataSource === 'custom' && !file)) ? '#ccc' : '#5a287d', 
          color: '#fff', 
          border: 'none', 
          borderRadius: '4px', 
          cursor: (loading || (dataSource === 'custom' && !file)) ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          transition: 'background 0.2s'
        }}
      >
        {loading ? 'Analyzing...' : 'Ask Agent'}
      </button>
      
      {/* Response Area */}
      {response && (
        <div style={{ marginTop: '25px', padding: '20px', background: '#fff', borderRadius: '8px', borderLeft: '4px solid #a50050', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <strong style={{ color: '#5a287d', display: 'block', marginBottom: '10px' }}>Agent Response:</strong>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: '1.5' }}>{response}</p>
        </div>
      )}
    </div>
  );
}

export default App;