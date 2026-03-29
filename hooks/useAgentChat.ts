'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CitizenDef } from '@/types/world';
import type { ChatBlock } from '@/components/world/ChatPanel';

export interface QueuedIncident {
  id: string;
  title: string;
  description: string;
  images: string[]; // base64 data URIs
}

interface UseAgentChatOptions {
  digimundoProjectId: string | null;
  digiProjects: { id: string; name: string; agentId: string }[];
}

export default function useAgentChat({ digimundoProjectId, digiProjects }: UseAgentChatOptions) {
  const [citizen, setCitizen] = useState<CitizenDef | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [externalMessage, setExternalMessage] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<QueuedIncident[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const pendingQueueRef = useRef(pendingQueue);
  pendingQueueRef.current = pendingQueue;

  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  // Detect localhost
  useEffect(() => {
    const h = window.location.hostname;
    setIsLocalhost(h === 'localhost' || h === '127.0.0.1');
  }, []);

  // Resolve agent when digimundo project changes
  useEffect(() => {
    if (!digimundoProjectId || digiProjects.length === 0) {
      setCitizen(null);
      return;
    }

    const digiProject = digiProjects.find(p => p.id === digimundoProjectId);
    if (!digiProject) { setCitizen(null); return; }

    setAgentLoading(true);
    fetch('/api/world')
      .then(r => r.json())
      .then(async (data) => {
        const citizens: CitizenDef[] = data.citizens || [];
        const found = citizens.find(c => c.agentId === digiProject.agentId);
        setCitizen(found || null);

        // Clear previous session so the agent starts fresh in the correct projectPath
        if (found) {
          await fetch('/api/chat/clear-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: found.agentId }),
          }).catch(() => {});
          setBlocks([]);
        }
      })
      .catch(() => setCitizen(null))
      .finally(() => setAgentLoading(false));
  }, [digimundoProjectId, digiProjects]);

  // Process queue - convert images and build message
  const processNextInQueue = useCallback(async () => {
    const queue = pendingQueueRef.current;
    if (queue.length === 0 || isProcessingRef.current) return;

    setIsProcessing(true);
    const incident = queue[0];
    setPendingQueue(prev => prev.slice(1));

    try {
      // Convert base64 images to temp files
      const imagePaths: string[] = [];
      for (const b64 of incident.images) {
        const match = b64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!match) continue;
        const [, mime, data] = match;
        const ext = mime.split('/')[1] || 'png';
        const blob = await fetch(b64).then(r => r.blob());
        const formData = new FormData();
        formData.append('file', new File([blob], `incident_${Date.now()}.${ext}`, { type: mime }));
        const res = await fetch('/api/chat-upload', { method: 'POST', body: formData });
        if (res.ok) {
          const { path } = await res.json();
          imagePaths.push(path);
        }
      }

      // Build message
      let msg = `**Incidencia aprobada: ${incident.title}**\n\n${incident.description}`;
      if (imagePaths.length > 0) {
        msg += `\n\n[The user has attached ${imagePaths.length} image(s). Read them with the Read tool to see them: ${imagePaths.map(p => `"${p}"`).join(', ')}]`;
      }

      setExternalMessage(msg);
    } catch {
      setIsProcessing(false);
    }
  }, []);

  // Enqueue an approved incident
  const enqueueIncident = useCallback((incident: QueuedIncident) => {
    setPendingQueue(prev => [...prev, incident]);

    // If not currently processing, start immediately
    if (!isProcessingRef.current) {
      // Small delay to let state update
      setTimeout(() => processNextInQueue(), 100);
    }
  }, [processNextInQueue]);

  // Stable ref to track previous block count (avoids recreating callback)
  const blocksLenRef = useRef(0);

  // Handle blocks change - detect when agent finishes
  // IMPORTANT: this callback must be stable (no blocks.length dep) to avoid
  // breaking ChatPanel's SSE streaming by re-rendering mid-stream
  const onBlocksChange = useCallback((newBlocks: ChatBlock[]) => {
    const prevLen = blocksLenRef.current;
    blocksLenRef.current = newBlocks.length;
    setBlocks(newBlocks);

    // Check if a 'result' block was added (agent finished)
    const newResultBlocks = newBlocks.slice(prevLen).filter(b => b.type === 'result');
    if (newResultBlocks.length > 0) {
      setIsProcessing(false);
      setJustCompleted(true);
      setTimeout(() => setJustCompleted(false), 5000);
      setTimeout(() => processNextInQueue(), 1000);
    }
  }, [processNextInQueue]);

  const onExternalMessageConsumed = useCallback(() => {
    setExternalMessage(null);
  }, []);

  // Derive streaming state: agent is working if there's a 'user' block without a following 'result'
  const isStreaming = blocks.length > 0 && (() => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].type === 'result') return false;
      if (blocks[i].type === 'user') return true;
    }
    return false;
  })();

  // Navigation guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isProcessing || pendingQueue.length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isProcessing, pendingQueue.length]);

  return {
    citizen,
    agentLoading,
    blocks,
    onBlocksChange,
    externalMessage,
    onExternalMessageConsumed,
    chatOpen,
    setChatOpen,
    chatMinimized,
    setChatMinimized,
    pendingQueue,
    enqueueIncident,
    isProcessing,
    isStreaming,
    justCompleted,
    isLocalhost,
  };
}
