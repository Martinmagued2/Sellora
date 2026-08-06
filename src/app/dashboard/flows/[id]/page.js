"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  Handle, Position, applyNodeChanges, applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  MessageCircle, ShoppingCart, Clock, Zap, Save, Play, Pause,
  ArrowRight, Trash2, Plus, X, Loader2,
} from "lucide-react";

// ─── Custom Node Components ───

function TriggerNode({ data }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
      color: "#fff", padding: "12px 16px", borderRadius: 12,
      border: "none", minWidth: 180, textAlign: "center",
      boxShadow: "0 4px 12px rgba(108, 92, 231, 0.3)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
        <Zap size={14} />
        <strong>{data.label || "Trigger"}</strong>
      </div>
      <div style={{ fontSize: 11, opacity: 0.85 }}>{data.description || "When..."}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: "#fff" }} />
    </div>
  );
}

function ActionNode({ data }) {
  const colors = {
    message: "#3b82f6",
    delay: "#f59e0b",
    order: "#10b981",
    condition: "#a855f7",
  };
  const color = colors[data.actionType] || "#6c5ce7";
  return (
    <div style={{
      background: "var(--bg-card, #fff)", padding: "10px 14px", borderRadius: 10,
      border: `2px solid ${color}`, minWidth: 160, textAlign: "center",
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
        {data.actionType === "message" && <MessageCircle size={12} color={color} />}
        {data.actionType === "delay" && <Clock size={12} color={color} />}
        {data.actionType === "order" && <ShoppingCart size={12} color={color} />}
        {data.actionType === "condition" && <ArrowRight size={12} color={color} />}
        <strong style={{ fontSize: 13, color: "var(--text-primary, #111)" }}>{data.label || "Action"}</strong>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary, #888)" }}>{data.description || ""}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
    </div>
  );
}

const nodeTypes = { trigger: TriggerNode, action: ActionNode };

const NODE_TEMPLATES = [
  { type: "trigger", label: "Keyword Trigger", description: "Customer sends a keyword", actionType: "trigger", icon: Zap },
  { type: "trigger", label: "New Conversation", description: "First message from new customer", actionType: "trigger", icon: Zap },
  { type: "trigger", label: "No Reply", description: "Customer hasn't replied in X hours", actionType: "trigger", icon: Clock },
  { type: "action", label: "Send Message", description: "Send a text reply", actionType: "message", icon: MessageCircle },
  { type: "action", label: "Wait/Delay", description: "Wait before next action", actionType: "delay", icon: Clock },
  { type: "action", label: "Create Order", description: "Create an order for the customer", actionType: "order", icon: ShoppingCart },
];

let nodeId = 100;

export default function FlowBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const flowId = params?.id;
  const [saving, setSaving] = useState(false);
  const [flowName, setFlowName] = useState("Untitled Flow");
  const [showPalette, setShowPalette] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const initialNodes = [
    { id: "1", type: "trigger", position: { x: 250, y: 50 }, data: { label: "Start Here", description: "When a customer sends a message..." } },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#6c5ce7", strokeWidth: 2 } }, eds));
  }, [setEdges]);

  const addNode = (template) => {
    const newNode = {
      id: `node_${nodeId++}`,
      type: template.type,
      position: { x: 200 + Math.random() * 200, y: 150 + nodes.length * 80 },
      data: { label: template.label, description: template.description, actionType: template.actionType },
    };
    setNodes((nds) => [...nds, newNode]);
    setShowPalette(false);
  };

  const deleteNode = (id) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const saveFlow = async () => {
    setSaving(true);
    try {
      const flowData = {
        name: flowName,
        nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
      };

      if (flowId && flowId !== "new") {
        await fetch(`/api/flows/${flowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: flowName, config: flowData }),
        });
      } else {
        await fetch("/api/flows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: flowName, config: flowData }),
        });
      }
      router.push("/dashboard/flows");
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div style={{
        padding: "10px 16px", background: "var(--bg-card)", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", gap: 12, zIndex: 10,
      }}>
        <input
          type="text"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          style={{
            background: "transparent", border: "1px solid var(--border-medium)",
            borderRadius: 8, padding: "6px 12px", fontSize: 14, color: "var(--text-primary)",
            outline: "none", minWidth: 200,
          }}
          placeholder="Flow name..."
        />
        <button
          onClick={() => setShowPalette(!showPalette)}
          style={{
            background: "var(--bg-hover)", border: "1px solid var(--border-medium)",
            borderRadius: 8, padding: "6px 12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4, fontSize: 13,
          }}
        >
          <Plus size={14} /> Add Node
        </button>
        
        {/* Sandbox Live Replay Toggle */}
        <button
          onClick={() => setIsSimulating(!isSimulating)}
          style={{
            background: isSimulating ? "rgba(16, 185, 129, 0.15)" : "var(--bg-hover)", 
            border: isSimulating ? "1px solid #10b981" : "1px solid var(--border-medium)",
            color: isSimulating ? "#10b981" : "var(--text-primary)",
            borderRadius: 8, padding: "6px 12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600
          }}
        >
          {isSimulating ? <Pause size={14} /> : <Play size={14} />}
          {isSimulating ? "Stop Live Sandbox" : "Live Session Sandbox Replay"}
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/dashboard/flows")} style={{
            background: "none", border: "1px solid var(--border-medium)",
            borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13,
          }}>
            Cancel
          </button>
          <button onClick={saveFlow} disabled={saving} style={{
            background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
            border: "none", borderRadius: 8, padding: "6px 16px", cursor: "pointer",
            color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
          }}>
            {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Flow"}
          </button>
        </div>
      </div>

      {/* Node palette dropdown */}
      {showPalette && (
        <div style={{
          position: "absolute", top: 60, left: 120, zIndex: 20,
          background: "var(--bg-card)", border: "1px solid var(--border-medium)",
          borderRadius: 12, padding: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column", gap: 4, minWidth: 220,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", padding: "4px 8px" }}>
            Add Node
          </div>
          {NODE_TEMPLATES.map((tpl, i) => (
            <button
              key={i}
              onClick={() => addNode(tpl)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "8px 10px", borderRadius: 8, textAlign: "left",
                display: "flex", alignItems: "center", gap: 8, fontSize: 13,
                color: "var(--text-primary)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              <tpl.icon size={14} color="#6c5ce7" />
              <div>
                <div style={{ fontWeight: 600 }}>{tpl.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{tpl.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Flow canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          style={{ background: "var(--bg-secondary, #f9fafb)" }}
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={(n) => n.type === "trigger" ? "#6c5ce7" : "#3b82f6"}
            maskColor="rgba(0,0,0,0.1)"
          />
        </ReactFlow>

        {/* Live Session Sandbox Simulation Overlay */}
        {isSimulating && (
          <div style={{
            position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: "#0f172a", border: "1px solid #334155", borderRadius: 16,
            padding: "16px 24px", color: "#f8fafc", width: "90%", maxWidth: 640,
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)", zIndex: 30
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyBetween: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981 animate-pulse" }}></span>
                <strong style={{ fontSize: 14 }}>Live Customer Session #4912 Step Execution</strong>
              </div>
              <span style={{ fontSize: 11, background: "#1e293b", padding: "2px 8px", borderRadius: 6, color: "#94a3b8" }}>
                Token Cost: 0.0042 ($0.0001)
              </span>
            </div>
            
            <div style={{ fontSize: 12, color: "#cbd5e1", background: "#1e293b", padding: 10, borderRadius: 8, fontFamily: "monospace" }}>
              Input: "Hi, do you offer bundle discounts for silk shirts?" → <strong style={{ color: "#38bdf8" }}>Node 1 Triggered</strong> → <strong style={{ color: "#4ade80" }}>Action Node Executed: Dynamic 15% Offer</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
