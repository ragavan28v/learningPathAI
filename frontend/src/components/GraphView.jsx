import React, { useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, Handle, Position } from "reactflow";
import "reactflow/dist/style.css";
import { Card, Typography, Modal, Popover, Button, Input, Tooltip, message } from "antd";
import { YoutubeOutlined, FileTextOutlined, CloseOutlined, EditOutlined, CheckCircleTwoTone, ExclamationCircleTwoTone, CloseCircleTwoTone } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Paragraph, Link } = Typography;

const getNodesAndEdges = (plan) => {
  if (!plan || !Array.isArray(plan) || plan.length === 0) return { nodes: [], edges: [] };
  const nodeSpacing = 220;
  const nodes = plan.map((node, idx) => ({
    id: String(node.id),
    type: 'customNode',
    data: { label: node.topic, node },
    position: { x: 100 + idx * nodeSpacing, y: 150 },
    draggable: true, // Explicitly allow dragging
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

  // Fallback: If no edges, create a linear chain
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
};

// Helper to convert YouTube URLs to embed format
function getYoutubeEmbedUrl(url) {
  // Handles both full and short YouTube URLs
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}

const ResourceList = ({ resources }) => (
  <div style={{ marginTop: 8 }}>
    {resources && resources.map((res, idx) => (
      <div key={idx} style={{ marginBottom: 8 }}>
        {res.type === 'youtube' ? (
          <div>
            <YoutubeOutlined style={{ color: '#f00', marginRight: 6 }} />
            <span>{res.title}</span>
            <div style={{ margin: '8px 0' }}>
              <iframe width="320" height="180" src={getYoutubeEmbedUrl(res.url)} title={res.title} frameBorder="0" allowFullScreen />
            </div>
          </div>
        ) : (
          <div>
            <FileTextOutlined style={{ color: '#3b82f6', marginRight: 6 }} />
            <Link href={res.url} target="_blank">{res.title}</Link>
          </div>
        )}
      </div>
    ))}
  </div>
);

const NodeDetailPanel = ({ node, onClose }) => (
  <Modal open={!!node} onCancel={onClose} footer={null} width={480} title={node?.topic} closeIcon={<CloseOutlined />}>
    <Paragraph strong>Materials: {node?.materials && node.materials.join(", ")}</Paragraph>
    <ResourceList resources={node?.resources} />
  </Modal>
);

const STATUS_COLORS = {
  done: { border: '#52c41a', bg: 'rgba(82,196,26,0.12)' },
  progress: { border: '#faad14', bg: 'rgba(250,173,20,0.12)' },
  skipped: { border: '#ff4d4f', bg: 'rgba(255,77,79,0.12)' },
  default: { border: '#3b82f6', bg: 'rgba(255,255,255,0.7)' },
};

const STATUS_ICONS = {
  done: <CheckCircleTwoTone twoToneColor="#52c41a" />, // green
  progress: <ExclamationCircleTwoTone twoToneColor="#faad14" />, // yellow
  skipped: <CloseCircleTwoTone twoToneColor="#ff4d4f" />, // red
};

const STATUS_LABELS = {
  done: 'Done',
  progress: 'In Progress',
  skipped: 'Skipped',
};

const CustomNode = ({ data }) => {
  const [hovered, setHovered] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const status = data.status || 'default';
  const color = STATUS_COLORS[status] || STATUS_COLORS.default;

  const handleStatusChange = (newStatus) => {
    if (data.onStatusChange) data.onStatusChange(data.node, newStatus);
    setPopoverOpen(false);
  };

  return (
    <div
      style={{
        minWidth: 140,
        maxWidth: 200,
        wordBreak: 'break-word',
        whiteSpace: 'pre-line',
        padding: 18,
        textAlign: 'center',
        cursor: 'pointer',
        position: 'relative',
        borderRadius: 32,
        background: color.bg,
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.18)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: `2.5px solid ${color.border}`,
        color: '#1d4ed8',
        fontWeight: 600,
        transition: 'box-shadow 0.2s, border 0.2s, background 0.2s',
      }}
      onClick={() => data.onClick(data.node)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPopoverOpen(false); }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color.border }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {data.label}
        {status !== 'default' && STATUS_ICONS[status]}
        {hovered && (
          <Popover
            content={
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Button icon={<CheckCircleTwoTone twoToneColor="#52c41a" />} size="small" onClick={e => { e.stopPropagation(); handleStatusChange('done'); }}>Done</Button>
                <Button icon={<ExclamationCircleTwoTone twoToneColor="#faad14" />} size="small" onClick={e => { e.stopPropagation(); handleStatusChange('progress'); }}>In Progress</Button>
                <Button icon={<CloseCircleTwoTone twoToneColor="#ff4d4f" />} size="small" onClick={e => { e.stopPropagation(); handleStatusChange('skipped'); }}>Skipped</Button>
                <Button size="small" onClick={e => { e.stopPropagation(); handleStatusChange('default'); }}>Clear</Button>
              </div>
            }
            trigger="click"
            open={popoverOpen}
            onOpenChange={setPopoverOpen}
            placement="bottomRight"
          >
            <EditOutlined style={{ marginLeft: 4, color: '#888' }} onClick={e => { e.stopPropagation(); setPopoverOpen(true); }} />
          </Popover>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color.border }} />
    </div>
  );
};

export default function GraphView({ plan, graphData, onSaveGraph }) {
  const navigate = useNavigate();
  const [nodeStatus, setNodeStatus] = React.useState({}); // { [nodeId]: status }
  const [editMode, setEditMode] = React.useState(false);
  // Use graphData as the source of truth if present
  const [graph, setGraph] = React.useState(() => {
    if (graphData && graphData.nodes && graphData.edges) return graphData;
    if (plan && Array.isArray(plan)) return getNodesAndEdges(plan);
    return { nodes: [], edges: [] };
  });
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeResources, setNewNodeResources] = useState("");
  const [addingNode, setAddingNode] = useState(false);
  const [fetchingResources, setFetchingResources] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  // Force sync local graph with latest graphData after save or reload
  React.useEffect(() => {
    if (!editMode && graphData && graphData.nodes && graphData.edges) {
      setGraph(graphData);
    }
  }, [editMode, graphData]);

  // Handlers for edit mode
  const handleAddNode = (pos) => {
    setAddingNode(true);
    setNewNodeLabel("");
    setSelectedNode({ pos });
  };
  const handleConfirmAddNode = () => {
    if (!newNodeLabel.trim()) return;
    const id = Date.now().toString();
    const resources = newNodeResources
      .split('\n')
      .map(r => r.trim())
      .filter(Boolean);
    setGraph(prev => ({
      ...prev,
      nodes: [
        ...prev.nodes,
        {
          id,
          type: 'customNode',
          data: { label: newNodeLabel, node: { id, topic: newNodeLabel, resources }, status: 'default' },
          position: selectedNode.pos,
          draggable: true,
          style: prev.nodes[0]?.style || {},
        }
      ]
    }));
    setAddingNode(false);
    setSelectedNode(null);
    setNewNodeLabel("");
    setNewNodeResources("");
  };
  const handleDeleteNode = (nodeId) => {
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    }));
  };
  const handleAddEdge = (params) => {
    setGraph(prev => ({ ...prev, edges: [...prev.edges, { ...params, id: `e${params.source}-${params.target}`, style: { stroke: '#3b82f6', strokeWidth: 2 }, type: 'simplebezier' }] }));
  };
  const handleDeleteEdge = (edgeId) => {
    setGraph(prev => ({ ...prev, edges: prev.edges.filter(e => e.id !== edgeId) }));
  };
  const handleNodeDrag = (event, node) => {
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === node.id ? { ...n, position: node.position } : n)
    }));
  };
  // Node edit (label/status)
  const handleNodeLabelChange = (nodeId, label) => {
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label, node: { ...n.data.node, topic: label } } } : n)
    }));
  };
  const handleNodeStatusChange = (node, status) => {
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, status } } : n)
    }));
  };
  // Custom node for edit mode
  const EditableCustomNode = ({ data, id }) => {
    const [hovered, setHovered] = React.useState(false);
    const [popoverOpen, setPopoverOpen] = React.useState(false);
    const [editLabel, setEditLabel] = React.useState(false);
    const status = data.status || 'default';
    const color = STATUS_COLORS[status] || STATUS_COLORS.default;
    return (
      <div
        style={{
          minWidth: 140,
          maxWidth: 200,
          wordBreak: 'break-word',
          whiteSpace: 'pre-line',
          padding: 18,
          textAlign: 'center',
          cursor: 'pointer',
          position: 'relative',
          borderRadius: 32,
          background: color.bg,
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.18)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: `2.5px solid ${color.border}`,
          color: '#1d4ed8',
          fontWeight: 600,
          transition: 'box-shadow 0.2s, border 0.2s, background 0.2s',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPopoverOpen(false); }}
      >
        <Handle type="target" position={Position.Left} style={{ background: color.border }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {editLabel ? (
            <Input size="small" value={data.label} autoFocus onChange={e => handleNodeLabelChange(id, e.target.value)} onBlur={() => setEditLabel(false)} onPressEnter={() => setEditLabel(false)} style={{ width: 100 }} />
          ) : (
            <span onDoubleClick={() => setEditLabel(true)}>{data.label}</span>
          )}
          {status !== 'default' && STATUS_ICONS[status]}
          {hovered && (
            <>
              <Popover
                content={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Button icon={<CheckCircleTwoTone twoToneColor="#52c41a" />} size="small" onClick={e => { e.stopPropagation(); handleNodeStatusChange(data.node, 'done'); }}>Done</Button>
                    <Button icon={<ExclamationCircleTwoTone twoToneColor="#faad14" />} size="small" onClick={e => { e.stopPropagation(); handleNodeStatusChange(data.node, 'progress'); }}>In Progress</Button>
                    <Button icon={<CloseCircleTwoTone twoToneColor="#ff4d4f" />} size="small" onClick={e => { e.stopPropagation(); handleNodeStatusChange(data.node, 'skipped'); }}>Skipped</Button>
                    <Button size="small" onClick={e => { e.stopPropagation(); handleNodeStatusChange(data.node, 'default'); }}>Clear</Button>
                  </div>
                }
                trigger="click"
                open={popoverOpen}
                onOpenChange={setPopoverOpen}
                placement="bottomRight"
              >
                <EditOutlined style={{ marginLeft: 4, color: '#888' }} onClick={e => { e.stopPropagation(); setPopoverOpen(true); }} />
              </Popover>
              <Tooltip title="Delete Node"><Button size="small" danger shape="circle" icon={<CloseOutlined />} style={{ marginLeft: 4 }} onClick={e => { e.stopPropagation(); handleDeleteNode(id); }} /></Tooltip>
            </>
          )}
        </div>
        <Handle type="source" position={Position.Right} style={{ background: color.border }} />
      </div>
    );
  };
  const nodeTypes = editMode ? { customNode: EditableCustomNode } : { customNode: CustomNode };
  // Helper to attach handlers to nodes
  function attachHandlersToNodes(nodes) {
    return nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        onClick: (node) => navigate(`/plan/${n.data?.node?.id || n.id}`),
        status: n.data?.status || 'default',
        onStatusChange: (node, status) => setGraph(prev => ({
          ...prev,
          nodes: prev.nodes.map(nn => nn.id === n.id ? { ...nn, data: { ...nn.data, status } } : nn)
        })),
      }
    }));
  }

  const handleFetchResourcesAI = async () => {
    if (!newNodeLabel.trim()) return;
    setFetchingResources(true);
    try {
      const res = await fetch("http://localhost:8000/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: newNodeLabel }),
      });
      const data = await res.json();
      if (data && data.resources) {
        setNewNodeResources(Array.isArray(data.resources) ? data.resources.join('\n') : String(data.resources));
      } else {
        message.error("AI did not return resources");
      }
    } catch (err) {
      message.error("Error fetching resources from AI");
    }
    setFetchingResources(false);
  };
  // Render
  return (
    <div style={{ width: "100%", height: 400, background: "#fafbfc", borderRadius: 12, overflowX: "auto", position: 'relative' }}>
      <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 10, display: 'flex', gap: 8 }}>
        {!editMode && <Button type="primary" onClick={() => setEditMode(true)}>Edit</Button>}
        {editMode && <Button type="primary" onClick={() => {
          onSaveGraph(graph);
          setEditMode(false);
          message.success('Changes saved!');
        }}>Save</Button>}
        {editMode && <Button onClick={() => setEditMode(false)} danger>Cancel</Button>}
        {editMode && <Button onClick={e => {
          // Add node at center of viewport
          const pos = { x: 200 + Math.random() * 200, y: 100 + Math.random() * 100 };
          handleAddNode(pos);
        }}>Add Node</Button>}
      </div>
      <ReactFlow
        nodes={attachHandlersToNodes(graph.nodes)}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        panOnScroll
        zoomOnScroll={false}
        minZoom={0.5}
        maxZoom={2}
        style={{ background: "#fafbfc" }}
        nodesDraggable={editMode}
        nodesConnectable={editMode}
        elementsSelectable={editMode}
        onConnect={editMode ? handleAddEdge : undefined}
        onNodeDragStop={editMode ? handleNodeDrag : undefined}
        onEdgeDoubleClick={editMode ? (event, edge) => handleDeleteEdge(edge.id) : undefined}
      >
        <Background />
        <MiniMap />
        <Controls />
      </ReactFlow>
      {/* Add Node Modal */}
      <Modal open={addingNode} onCancel={() => setAddingNode(false)} onOk={handleConfirmAddNode} okText="Add Node" title="Add New Node">
        <Input value={newNodeLabel} onChange={e => setNewNodeLabel(e.target.value)} placeholder="Node label/topic" style={{ marginBottom: 12 }} />
        <Input.TextArea
          value={newNodeResources}
          onChange={e => setNewNodeResources(e.target.value)}
          placeholder="Resources (one per line or paste links/descriptions)"
          autoSize={{ minRows: 3, maxRows: 6 }}
          style={{ marginBottom: 8 }}
        />
        <Button
          type="dashed"
          loading={fetchingResources}
          onClick={handleFetchResourcesAI}
          disabled={!newNodeLabel.trim() || fetchingResources}
          style={{ marginBottom: 0 }}
          block
        >
          Suggest Resources with AI
        </Button>
      </Modal>
    </div>
  );
} 