import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Avatar, Input, Spin, Tooltip, Drawer, FloatButton } from 'antd';
import { YoutubeOutlined, FileTextOutlined, ArrowLeftOutlined, RobotOutlined, UserOutlined, FilePdfOutlined, LinkOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

function getYoutubeEmbedUrl(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}

const ResourceBar = ({ resources, selected, onSelect, onBack }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: '#fff',
    borderBottom: '1px solid #eee',
    padding: '10px 18px',
    boxShadow: 'none',
    position: 'relative',
    zIndex: 2,
    minHeight: 56
  }}>
    <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ marginRight: 8 }}>
      Back to Roadmap
    </Button>
    {(resources || []).map((res, idx) => (
      <Button
        key={idx}
        type={selected === idx ? 'primary' : 'default'}
        icon={
          res.type === 'youtube' ? <YoutubeOutlined /> :
          res.type === 'pdf' ? <FilePdfOutlined /> :
          res.type === 'article' ? <FileTextOutlined /> : <LinkOutlined />
        }
        onClick={() => onSelect(idx)}
        style={{ fontWeight: 500 }}
      >
        {res.title && res.title.length > 24 ? res.title.slice(0, 22) + '…' : res.title}
      </Button>
    ))}
  </div>
);

const ResourceContent = ({ resource, area }) => {
  if (resource.type === 'youtube' && area === 'left') {
    return (
      <div style={{ width: '100%', height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: 0 }}>
        <iframe width="100%" height="100%" src={getYoutubeEmbedUrl(resource.url)} title={resource.title} frameBorder="0" allowFullScreen style={{ borderRadius: 0 }} />
      </div>
    );
  }
  if ((resource.type === 'article' || resource.type === 'pdf') && area === 'left') {
    return (
      <div style={{ width: '100%', height: 320, background: '#fff', borderRadius: 0, border: 'none', overflow: 'hidden' }}>
        <iframe src={resource.url} title={resource.title} width="100%" height="100%" style={{ border: 'none', borderRadius: 0 }} />
      </div>
    );
  }
  if ((resource.type === 'article' || resource.type === 'pdf') && area === 'right') {
    return (
      <div style={{ width: '100%', height: 'calc(100vh - 120px)', background: '#fff', borderRadius: 0, border: 'none', overflow: 'hidden' }}>
        <iframe src={resource.url} title={resource.title} width="100%" height="100%" style={{ border: 'none', borderRadius: 0 }} />
      </div>
    );
  }
  // fallback: link
  return (
    <div style={{ margin: 32, textAlign: 'center' }}>
      <Paragraph><LinkOutlined /> <a href={resource.url} target="_blank" rel="noopener noreferrer">Open {resource.title}</a></Paragraph>
    </div>
  );
};

// Helper to structure/clean AI response
function formatAIResponse(raw) {
  if (!raw) return '';
  // Remove all ** and ```
  let text = raw.replace(/\*\*/g, '');
  text = text.replace(/```/g, '');
  // Convert numbered lists
  text = text.replace(/\n(\d+\.) /g, '\n\n$1 ');
  // Convert bullet lists
  text = text.replace(/\n[-•] /g, '\n\n• ');
  // Remove repeated blank lines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

const NodeDetailPage = ({ plan }) => {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const node = useMemo(() => (plan || []).find(n => String(n.id) === String(nodeId)), [plan, nodeId]);
  const resources = node?.resources || [];
  // Find first video and first article/pdf
  const firstVideoIdx = resources.findIndex(r => r.type === 'youtube');
  const firstDocIdx = resources.findIndex(r => r.type === 'article' || r.type === 'pdf');
  // State for selected resource in each pane
  const [leftIdx, setLeftIdx] = useState(firstVideoIdx >= 0 ? firstVideoIdx : (firstDocIdx >= 0 ? firstDocIdx : 0));
  const [rightIdx, setRightIdx] = useState(firstDocIdx >= 0 ? firstDocIdx : (firstVideoIdx >= 0 ? firstVideoIdx : 0));
  // Chatbot drawer state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('python');
  const LANGUAGES = [
    { label: 'Python', value: 'python' },
    { label: 'JavaScript', value: 'javascript' },
    { label: 'C++', value: 'cpp' },
    { label: 'Java', value: 'java' },
    { label: 'C', value: 'c' },
  ];
  const [code, setCode] = useState('print("hello world")');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);

  // Remove draggable/floating code panel logic

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    setChatHistory(prev => [...prev, { role: "user", content: chatInput }]);
    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `About ${node?.topic}: ${chatInput}` }),
      });
      const data = await res.json();
      // Structure/clean the AI response before adding to chat
      const formatted = formatAIResponse(data.response);
      setChatHistory(prev => [...prev, { role: "assistant", content: formatted }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: "assistant", content: "[Error: Could not get response from AI]" }]);
    }
    setChatInput("");
    setChatLoading(false);
  };

  if (!node) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /> Loading...</div>;
  }

  // Resource bar toggle logic
  const handleResourceClick = idx => {
    const res = resources[idx];
    if (res.type === 'youtube') setLeftIdx(idx);
    else setRightIdx(idx);
  };

  const hasVideo = firstVideoIdx >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f7f9fb', margin: 0, padding: 0 }}>
      {/* Resource bar at top, always visible, with back button */}
      <ResourceBar
        resources={Array.isArray(resources) ? resources : []}
        selected={null}
        onSelect={handleResourceClick}
        onBack={() => navigate('/')}
      />
      {/* Main content: split if video, single pane if not */}
      {hasVideo ? (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, margin: 0, padding: 0 }}>
          {/* Left: Fixed width, video at top, details below */}
          <div style={{ width: 520, minWidth: 400, maxWidth: 600, height: 'calc(100vh - 56px)', background: '#fff', borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 0 }}>
            {/* Video at top */}
            {resources[leftIdx] && resources[leftIdx].type === 'youtube' ? (
              <ResourceContent resource={resources[leftIdx]} area="left" />
            ) : null}
            {/* Node details below video */}
            <div style={{ width: '100%', padding: 24, boxSizing: 'border-box', borderRadius: 0, boxShadow: 'none', background: 'none' }}>
              <Title level={3} style={{ marginBottom: 8 }}>{node.topic}</Title>
              <Paragraph strong>Materials: {node.materials && node.materials.join(", ")}</Paragraph>
            </div>
          </div>
          {/* Right: Flexible, all resources, scrollable */}
          <div style={{ flex: 1, background: '#fafbfc', padding: 32, overflow: 'auto', minWidth: 420, height: 'calc(100vh - 56px)', borderRadius: 0, boxShadow: 'none' }}>
            {resources[rightIdx] && (resources[rightIdx].type === 'article' || resources[rightIdx].type === 'pdf') ? (
              <ResourceContent resource={resources[rightIdx]} area="right" />
            ) : resources[rightIdx] ? (
              <ResourceContent resource={resources[rightIdx]} area="right" />
            ) : (
              <Paragraph>No resources available for this day.</Paragraph>
            )}
          </div>
        </div>
      ) : (
        // No video: single full-width pane for resources
        <div style={{ flex: 1, background: '#fafbfc', padding: 32, overflow: 'auto', minWidth: 420, height: 'calc(100vh - 56px)', borderRadius: 0, boxShadow: 'none' }}>
          <Title level={3} style={{ marginBottom: 8 }}>{node.topic}</Title>
          <Paragraph strong>Materials: {node.materials && node.materials.join(", ")}</Paragraph>
          {resources[rightIdx] && (resources[rightIdx].type === 'article' || resources[rightIdx].type === 'pdf') ? (
            <ResourceContent resource={resources[rightIdx]} area="right" />
          ) : resources[rightIdx] ? (
            <ResourceContent resource={resources[rightIdx]} area="right" />
          ) : (
            <Paragraph>No resources available for this day.</Paragraph>
          )}
        </div>
      )}
      {/* Chatbot FAB and Drawer */}
      <FloatButton
        icon={
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
            <RobotOutlined style={{ fontSize: 32, margin: 0, padding: 0, display: 'block' }} />
          </span>
        }
        type="primary"
        style={{
          right: 32,
          bottom: 32,
          zIndex: 1000,
          color: '#3b82f6',
          background: '#fff',
          boxShadow: '0 2px 8px #e0eaff',
          opacity: 1,
          borderRadius: '50%',
          width: 60,
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0
        }}
        onClick={() => setChatOpen(true)}
        tooltip="Ask AI about this topic"
      />
      {/* Code Editor FAB and Panel */}
      <FloatButton
        icon={
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
            <AppstoreOutlined style={{ fontSize: 32, margin: 0, padding: 0, display: 'block' }} />
          </span>
        }
        type="primary"
        style={{
          right: 110,
          bottom: 32,
          zIndex: 1000,
          color: '#3b82f6',
          background: '#fff',
          boxShadow: '0 2px 8px #e0eaff',
          opacity: 1,
          borderRadius: '50%',
          width: 60,
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0
        }}
        onClick={() => setCodeOpen(v => !v)}
        tooltip="Try Code"
      />
      {codeOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '50vw',
            maxWidth: 700,
            height: '100vh',
            background: '#fff',
            borderLeft: '2px solid #3b82f6',
            boxShadow: '-8px 0 32px 0 rgba(31, 38, 135, 0.18)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            transition: 'right 0.3s',
          }}
        >
          <div
            style={{
              background: '#f7f9fb',
              borderTopRightRadius: 0,
              borderTopLeftRadius: 0,
              padding: '18px 32px',
              fontWeight: 700,
              fontSize: 22,
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #e0eaff',
            }}
          >
            Try Code
            <span style={{ cursor: 'pointer', fontSize: 28, color: '#888' }} onClick={() => setCodeOpen(false)}>&times;</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 32px 0 32px' }}>
            <span style={{ fontWeight: 600, fontSize: 16 }}>Language:</span>
            <select value={selectedLang} onChange={e => setSelectedLang(e.target.value)} style={{ fontSize: 15, padding: '6px 16px', borderRadius: 8, border: '1px solid #ddd' }}>
              {LANGUAGES.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, border: '1px solid #222c', borderRadius: 10, background: '#181c24', margin: 32, marginTop: 16, fontFamily: 'Fira Mono, Menlo, Monaco, Consolas, monospace', fontSize: 16, color: '#f8f8f2', width: 'auto', minHeight: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', boxShadow: '0 2px 8px #0002', position: 'relative', overflow: 'hidden' }}>
            {/* IDE look with textarea and line numbers */}
            <div style={{ height: '100%', minHeight: 0, background: '#232634', color: '#7f848e', padding: '16px 0 16px 0', borderTopLeftRadius: 10, borderBottomLeftRadius: 10, fontSize: 15, fontFamily: 'inherit', userSelect: 'none', textAlign: 'right', width: 40, position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 1, overflow: 'hidden' }}>
              {Array.from({ length: code.split('\n').length || 1 }).map((_, i) => <div key={i} style={{ height: 22, lineHeight: '22px', paddingRight: 6 }}>{i + 1}</div>)}
            </div>
            <div style={{ flex: 1, overflow: 'auto', width: '100%' }}>
              <textarea
                style={{
                  background: 'transparent',
                  color: '#f8f8f2',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  fontSize: 16,
                  padding: '16px 16px 16px 56px',
                  minHeight: '100%',
                  height: '100%',
                  width: '100%',
                  boxSizing: 'border-box',
                  zIndex: 2,
                  overflow: 'auto',
                  whiteSpace: 'pre',
                }}
                spellCheck={false}
                placeholder={`# Write your code here...`}
                value={code}
                onChange={e => setCode(e.target.value)}
                disabled={selectedLang !== 'python'}
                rows={Math.max(10, code.split('\n').length)}
              />
            </div>
          </div>
          {selectedLang === 'python' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '0 32px 24px 32px' }}>
              <Button type="primary" loading={running} onClick={async () => {
                setRunning(true);
                setOutput('');
                try {
                  const res = await fetch('http://localhost:8000/api/execute/python', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                  });
                  if (!res.ok) throw new Error('Server error');
                  const data = await res.json();
                  setOutput(data.output || data.result || data.error || '');
                } catch (err) {
                  setOutput('Error running code. Is the backend running?');
                }
                setRunning(false);
              }}>Run</Button>
              <span style={{ color: '#bbb', fontSize: 15 }}>Python 3</span>
            </div>
          ) : (
            <div style={{ color: '#bbb', margin: '0 32px 24px 32px', fontSize: 15 }}>Only Python execution is supported for now.</div>
          )}
          {output && (
            <div style={{ background: '#232634', color: '#aaffaa', fontFamily: 'Fira Mono, monospace', fontSize: 15, borderRadius: 8, margin: '0 32px 24px 32px', padding: '16px 20px', whiteSpace: 'pre-wrap', minHeight: 40 }}>
              {output}
            </div>
          )}
        </div>
      )}
      <Drawer
        title={`Ask AI about ${node.topic}`}
        placement="right"
        onClose={() => setChatOpen(false)}
        open={chatOpen}
        width={600}
        bodyStyle={{ padding: 0, overflow: 'visible', height: 'auto', maxHeight: 'none' }}
      >
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', width: '100%', height: 'auto', maxHeight: 'none', overflow: 'visible' }}>
          <div style={{ width: '100%', height: 'auto', maxHeight: 'none', overflow: 'visible' }}>
            {chatHistory.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bbb', marginTop: 48 }}>
                <RobotOutlined style={{ fontSize: 48 }} />
                <div style={{ marginTop: 16 }}>No messages yet</div>
              </div>
            ) : (
              chatHistory.map((item, idx) => (
                <div key={idx} style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start' }}>
                  <Avatar icon={item.role === 'user' ? <UserOutlined /> : <RobotOutlined />} style={{ background: item.role === 'user' ? '#eee' : '#3b82f6', marginRight: 8 }} />
                  <div style={{
                    background: item.role === 'user' ? '#f5f5f5' : '#e6f0ff',
                    borderRadius: 8,
                    padding: 16,
                    fontFamily: item.role === 'assistant' ? 'inherit' : 'inherit',
                    whiteSpace: item.role === 'assistant' ? 'pre-wrap' : 'normal',
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    fontSize: 16
                  }}>
                    {item.role === 'assistant' ? <pre style={{ margin: 0, fontFamily: 'inherit', background: 'none', whiteSpace: 'pre-wrap', overflow: 'hidden' }}>{item.content}</pre> : item.content}
                  </div>
                </div>
              ))
            )}
          </div>
          <Input.Group compact style={{ marginTop: 16 }}>
            <Input
              style={{ width: 'calc(100% - 48px)' }}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onPressEnter={handleChatSend}
              placeholder={`Ask about ${node.topic}...`}
              disabled={chatLoading}
            />
            <Button type="primary" icon={<RobotOutlined />} onClick={handleChatSend} loading={chatLoading} />
          </Input.Group>
          {chatLoading && <Spin style={{ marginTop: 8 }} />}
        </div>
      </Drawer>
    </div>
  );
};

export default NodeDetailPage; 