import React, { useState } from "react";
import { Layout, Typography, Form, Input, Button, Progress, theme, ConfigProvider, message, List, Avatar, Spin } from "antd";
import { PlusOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import GraphView from "./components/GraphView";
import "antd/dist/reset.css";
import { UserOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import NodeDetailPage from './components/NodeDetailPage';
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

const { Header, Content, Footer, Sider } = Layout;
const { Title, Text, Link } = Typography;

// Copy getNodesAndEdges from GraphView.jsx
function getNodesAndEdges(plan) {
  if (!plan || !Array.isArray(plan) || plan.length === 0) return { nodes: [], edges: [] };
  const nodeSpacing = 220;
  const nodes = plan.map((node, idx) => ({
    id: String(node.id),
    type: 'customNode',
    data: { label: node.topic, node },
    position: { x: 100 + idx * nodeSpacing, y: 150 },
    draggable: true,
    style: {
      border: '2px solid #3b82f6',
      borderRadius: 32,
      background: 'rgba(255,255,255,0.7)',
      color: '#1d4ed8',
      fontFamily: 'system-ui',
      fontWeight: 600,
      minWidth: 140,
      maxWidth: 200,
      wordBreak: 'break-word',
      whiteSpace: 'pre-line',
      padding: 0,
      boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.18)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      textAlign: 'center',
      cursor: 'pointer',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s',
    },
  }));
  const nodeIds = new Set(nodes.map(n => n.id));
  let edges = plan.flatMap((node) =>
    (node.prerequisites || []).map(prereqId => {
      const source = String(prereqId);
      const target = String(node.id);
      if (nodeIds.has(source) && nodeIds.has(target) && source !== target) {
        return {
          id: `e${source}-${target}`,
          source,
          target,
          style: { stroke: '#3b82f6', strokeWidth: 2 },
          type: 'simplebezier',
        };
      }
      return null;
    }).filter(Boolean)
  );
  if (edges.length === 0 && nodes.length > 1) {
    edges = nodes.slice(1).map((node, idx) => ({
      id: `e${nodes[idx].id}-${node.id}`,
      source: nodes[idx].id,
      target: node.id,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
      type: 'simplebezier',
    }));
  }
  return { nodes, edges };
}

function App() {
  const [form] = Form.useForm();
  const [topic, setTopic] = useState("");
  const [timeframeValue, setTimeframeValue] = useState(3);
  const [timeframeUnit, setTimeframeUnit] = useState('months');
  const [loading, setLoading] = useState(false);
  // Remove plan state, use graphData for everything
  const [graphData, setGraphData] = useState(null);
  const [allPlans, setAllPlans] = useState([]); // List of plan IDs
  const [selectedPlanId, setSelectedPlanId] = useState('userPlan');
  const [graphViewVersion, setGraphViewVersion] = useState(0);
  const [siderOpen, setSiderOpen] = useState(false);
  const siderWidth = 220;

  // Chatbot state
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Helper for empty graph
  const EMPTY_GRAPH = { nodes: [], edges: [] };

  // Fetch all available plans on mount
  React.useEffect(() => {
    const fetchAllPlans = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'plans'));
        const ids = [];
        querySnapshot.forEach(doc => ids.push(doc.id));
        setAllPlans(ids);
      } catch (err) {
        console.error('Error fetching plans:', err);
      }
    };
    fetchAllPlans();
  }, []);

  // Fetch selected plan
  React.useEffect(() => {
    const fetchGraph = async () => {
      try {
        const docRef = doc(db, 'plans', selectedPlanId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const loaded = docSnap.data().plan;
          if (loaded && loaded.nodes && loaded.edges) {
            setGraphData(loaded);
          } else if (Array.isArray(loaded)) {
            setGraphData(getNodesAndEdges(loaded));
          }
        }
      } catch (err) {
        console.error('Error loading plan from Firestore:', err);
      }
    };
    fetchGraph();
  }, [selectedPlanId]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: values.topic, timeframe: `${timeframeValue} ${timeframeUnit}` }),
      });
      const data = await res.json();
      setGraphData(getNodesAndEdges(data.plan)); // Convert plan to graph format
    } catch (err) {
      message.error("Error generating plan");
    }
    setLoading(false);
  };

  const handleSaveGraph = async (graph) => {
    try {
      // Save the graph as-is, trusting status is present in each node's data
      await setDoc(doc(db, 'plans', selectedPlanId), { plan: graph });
      setGraphData(graph); // update local state with full graph
      // Re-fetch all plans after save
      const querySnapshot = await getDocs(collection(db, 'plans'));
      const ids = [];
      querySnapshot.forEach(doc => ids.push(doc.id));
      setAllPlans(ids);
      setGraphViewVersion(v => v + 1); // force GraphView re-render
      message.success('Plan saved to cloud!');
    } catch (err) {
      message.error('Failed to save plan to cloud');
      console.error('Error saving plan to Firestore:', err);
    }
  };

  // For detail view, derive plan from graphData.nodes if available
  const plan = graphData && graphData.nodes ? graphData.nodes.map(n => n.data.node) : null;

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    setChatHistory(prev => [...prev, { role: "user", content: chatInput }]);
    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatInput }),
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: "assistant", content: "[Error: Could not get response from AI]" }]);
    }
    setChatInput("");
    setChatLoading(false);
  };

  // Save current plan before switching
  const handlePlanSwitch = async (newPlanId) => {
    if (selectedPlanId && graphData) {
      await handleSaveGraph(graphData);
    }
    setSelectedPlanId(newPlanId);
  };

  // Add new plan logic
  const handleAddNewPlan = async () => {
    // Save current plan
    if (selectedPlanId && graphData) {
      await handleSaveGraph(graphData);
    }
    const newId = prompt('Enter new plan name:');
    if (newId && !allPlans.includes(newId)) {
      // Create new plan in Firestore with empty graph
      await setDoc(doc(db, 'plans', newId), { plan: EMPTY_GRAPH });
      // Update sidebar immediately
      setAllPlans(prev => [...prev, newId]);
      setSelectedPlanId(newId);
      setGraphData(EMPTY_GRAPH);
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#3b82f6',
          borderRadius: 8,
          fontFamily: 'system-ui, sans-serif',
        },
      }}
    >
      <Router>
        <Layout style={{ minHeight: "100vh", background: "#f7f9fb" }}>
          <Header style={{ background: "#fff", boxShadow: "0 2px 8px #f0f1f3", padding: 0, position: 'relative', zIndex: 10 }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
              <Title level={2} style={{ margin: 0, padding: "18px 0 8px 0", fontWeight: 800, letterSpacing: 0.5 }}>
                AI Learning Pathway
              </Title>
            </div>
          </Header>
          {/* Overlay Sider and + icon trigger */}
          <div style={{ position: 'absolute', top: 90, left: 0, zIndex: 20, display: 'flex', alignItems: 'flex-start', width: '100%' }}>
            <div style={{ position: 'relative', height: 0 }}>
              <Button
                type="primary"
                shape="circle"
                icon={<PlusOutlined />}
                style={{ marginLeft: 12, marginTop: 0, background: '#3b82f6', border: 'none', boxShadow: '0 2px 8px #e0eaff' }}
                onMouseEnter={() => setSiderOpen(true)}
                onClick={() => setSiderOpen(true)}
                aria-label="Show plans"
              />
              {/* Overlay Sider */}
              <div
                onMouseLeave={() => setSiderOpen(false)}
                style={{
                  position: 'fixed',
                  top: 80,
                  left: siderOpen ? 0 : -siderWidth,
                  width: siderWidth,
                  height: 'calc(100vh - 80px)',
                  background: '#fff',
                  boxShadow: '2px 0 16px #e0eaff',
                  borderTopRightRadius: 16,
                  borderBottomRightRadius: 16,
                  transition: 'left 0.25s cubic-bezier(.4,2,.6,1)',
                  zIndex: 100,
                  overflowY: 'auto',
                  paddingTop: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<PlusOutlined />}
                    style={{ background: '#3b82f6', border: 'none' }}
                    onClick={handleAddNewPlan}
                    aria-label="Add new plan"
                  />
                </div>
                <List
                  size="small"
                  bordered={false}
                  dataSource={allPlans}
                  renderItem={pid => (
                    <List.Item
                      style={{
                        background: selectedPlanId === pid ? '#e0eaff' : 'transparent',
                        cursor: 'pointer',
                        borderRadius: 6,
                        margin: '4px 8px',
                        padding: '8px 12px',
                        fontWeight: selectedPlanId === pid ? 700 : 400,
                        color: selectedPlanId === pid ? '#1d4ed8' : '#222',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      onClick={() => handlePlanSwitch(pid)}
                    >
                      {pid}
                    </List.Item>
                  )}
                />
              </div>
            </div>
            {/* Spacer to align with topic input field */}
            <div style={{ width: 56 }} />
          </div>
          <Layout>
            <Content style={{ maxWidth: 1200, margin: "0 auto", width: "100%", padding: "32px 16px 0 16px", display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Routes>
                  <Route path="/" element={
                    <>
                      <Form
                        form={form}
                        layout="inline"
                        onFinish={handleSubmit}
                        style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 32, marginLeft: 0 }}
                        size="large"
                      >
                        <Form.Item name="topic" rules={[{ required: true, message: "Enter a topic" }]}> 
                          <Input
                            placeholder="What do you want to learn? (e.g. Python)"
                            style={{ minWidth: 220 }}
                            disabled={loading}
                          />
                        </Form.Item>
                        <Form.Item>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Button
                              type="default"
                              shape="circle"
                              onClick={() => setTimeframeValue(Math.max(1, timeframeValue - 1))}
                              disabled={loading || timeframeValue <= 1}
                              style={{ fontWeight: 700 }}
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              max={52}
                              value={timeframeValue}
                              onChange={e => setTimeframeValue(Math.max(1, parseInt(e.target.value) || 1))}
                              style={{ width: 60, textAlign: 'center' }}
                              disabled={loading}
                            />
                            <Button
                              type="default"
                              shape="circle"
                              onClick={() => setTimeframeValue(timeframeValue + 1)}
                              disabled={loading || timeframeValue >= 52}
                              style={{ fontWeight: 700 }}
                            >
                              +
                            </Button>
                            <Button.Group>
                              <Button
                                type={timeframeUnit === 'weeks' ? 'primary' : 'default'}
                                onClick={() => setTimeframeUnit('weeks')}
                                disabled={loading}
                              >
                                Weeks
                              </Button>
                              <Button
                                type={timeframeUnit === 'months' ? 'primary' : 'default'}
                                onClick={() => setTimeframeUnit('months')}
                                disabled={loading}
                              >
                                Months
                              </Button>
                            </Button.Group>
                          </div>
                        </Form.Item>
                        <Form.Item>
                          <Button type="primary" htmlType="submit" loading={loading} icon={<PlusOutlined />}>Plan</Button>
                        </Form.Item>
                      </Form>
                      <div style={{ margin: "0 auto", background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px #e5e7eb", padding: 24, minHeight: 260 }}>
                        <GraphView plan={plan} graphData={graphData} onSaveGraph={handleSaveGraph} key={selectedPlanId + '-' + graphViewVersion} />
                      </div>
                      <Progress percent={33} showInfo={false} strokeColor="#3b82f6" style={{ margin: "40px 0 0 0", height: 8, borderRadius: 8 }} />
                    </>
                  } />
                  <Route path="/plan/:nodeId" element={<NodeDetailPage plan={plan} />} />
                </Routes>
              </div>
            </Content>
            <Footer style={{ background: "#fff", borderTop: "1px solid #eee", marginTop: 40, textAlign: "left", padding: "24px 32px 8px 32px" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                OSS project | <Link href="https://github.com/" target="_blank">GitHub</Link> | Powered by FastAPI, LangGraph, React, ChromaDB, Llama 3
              </Text>
            </Footer>
          </Layout>
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

export default App; 