import { useState, useEffect, useRef } from 'react';
import { Peer, DataConnection } from 'peerjs';
import { FileTransfer, PeerInfo, PeerMessage, SignalingStatus } from '../types';
import { getDeviceDetails, generateRoomCode } from '../utils/helpers';

// Hardcoded, redundancy-grade STUN servers for robust WebRTC NAT Traversal
const PEER_CONFIG = {
  debug: 1, // Log errors/warnings only to prevent console spam
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' }
    ]
  }
};

interface ActiveSend {
  file: File;
  currentOffset: number;
  isPaused: boolean;
  chunkSize: number;
  connections: DataConnection[];
}

export function usePeer() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [peerError, setPeerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [signalingStatus, setSignalingStatus] = useState<SignalingStatus>('disconnected');

  const peerInstanceRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  
  // Track details for active file receivers: fileId -> { chunks: Blob[], bytesReceived: number, name, size, mime, chunksCount: number }
  const activeReceivesRef = useRef<Map<string, {
    chunks: Blob[];
    bytesReceived: number;
    name: string;
    size: number;
    mime: string;
    chunksCount: number;
  }>>(new Map());

  // Track the timestamp of the last React state update for each transfer to support throttling
  const lastStateUpdateRef = useRef<Record<string, number>>({});

  // Track active sends: fileId -> sending state parameters
  const activeSendsRef = useRef<Map<string, ActiveSend>>(new Map());

  // Track progress of active transfers for speed/ETA calculations
  const transferProgressRef = useRef<Map<string, {
    lastBytes: number;
    lastTime: number;
  }>>(new Map());

  // Periodically compute transfer metrics (Speed and ETA)
  useEffect(() => {
    const interval = setInterval(() => {
      setTransfers(prevTransfers => {
        return prevTransfers.map(t => {
          if (t.status === 'transferring') {
            const now = Date.now();
            const prog = transferProgressRef.current.get(t.id);
            
            if (prog) {
              const elapsedSecs = (now - prog.lastTime) / 1000;
              const bytesDiff = t.bytesTransferred - prog.lastBytes;
              
              let currentSpeed = 0;
              if (elapsedSecs > 0) {
                // Calculate instant speed over this 1s interval
                currentSpeed = Math.max(0, bytesDiff / elapsedSecs);
              }
              
              // Smooth out speed calculations using some basic smoothing
              const smoothedSpeed = t.speed > 0 ? (t.speed * 0.6) + (currentSpeed * 0.4) : currentSpeed;
              
              const bytesLeft = t.size - t.bytesTransferred;
              const timeLeft = smoothedSpeed > 100 ? bytesLeft / smoothedSpeed : Infinity;

              // Save state for next tick
              transferProgressRef.current.set(t.id, {
                lastBytes: t.bytesTransferred,
                lastTime: now
              });

              return {
                ...t,
                speed: smoothedSpeed,
                timeLeft: timeLeft === Infinity ? undefined : Math.round(timeLeft),
              };
            } else {
              transferProgressRef.current.set(t.id, {
                lastBytes: t.bytesTransferred,
                lastTime: now
              });
            }
          }
          return t;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup connections on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    setSignalingStatus('disconnected');
    // Close all data connections
    connectionsRef.current.forEach(conn => {
      try {
        conn.close();
      } catch (e) {
        console.error('Error closing peer connection', e);
      }
    });
    connectionsRef.current.clear();

    // Destroy peer instance
    if (peerInstanceRef.current) {
      try {
        peerInstanceRef.current.destroy();
      } catch (e) {
        console.error('Error destroying peer instance', e);
      }
      peerInstanceRef.current = null;
    }

    setPeers([]);
    setRoomCode(null);
    setIsHost(false);
    setPeerError(null);
    activeReceivesRef.current.clear();
    activeSendsRef.current.clear();
    transferProgressRef.current.clear();
  };

  /**
   * Helper to execute a chunk transmission safely
   */
  const readAndSendNextChunk = (fileId: string) => {
    const sendState = activeSendsRef.current.get(fileId);
    if (!sendState || sendState.isPaused) return;

    const { file, currentOffset, chunkSize, connections } = sendState;

    // Filter connections to only include currently active and open channels
    const activeConns = connections.filter(conn => conn.open && conn.dataChannel?.readyState === 'open');
    if (activeConns.length === 0) {
      setTransfers(prev => prev.map(t => {
        if (t.id === fileId) {
          return { ...t, status: 'failed', error: 'All remote peers disconnected' };
        }
        return t;
      }));
      activeSendsRef.current.delete(fileId);
      transferProgressRef.current.delete(fileId);
      return;
    }

    if (currentOffset >= file.size) {
      // Completed Outgoing Stream
      activeConns.forEach(conn => {
        try {
          conn.send({ type: 'file-end', id: fileId });
        } catch (err) {
          console.error('File-end transfer broadcast failure:', err);
        }
      });

      setTransfers(prev => prev.map(t => {
        if (t.id === fileId) {
          return {
            ...t,
            status: 'completed',
            progress: 100,
            bytesTransferred: file.size,
            speed: 0,
            timeLeft: 0
          };
        }
        return t;
      }));

      activeSendsRef.current.delete(fileId);
      transferProgressRef.current.delete(fileId);
      return;
    }

    const slice = file.slice(currentOffset, currentOffset + chunkSize);
    const reader = new FileReader();

    reader.onload = async (event) => {
      if (!event.target || !(event.target.result instanceof ArrayBuffer)) {
        return;
      }
      const buffer = event.target.result;

      // WebRTC Backpressure Avoiding System / Congestion Management
      let isCongested = true;
      while (isCongested) {
        // Quick abort check if transfer state changed in mid-tick
        const currentSend = activeSendsRef.current.get(fileId);
        if (!currentSend || currentSend.isPaused) return;

        isCongested = false;

        // Verify that we still have open destination channels
        const dynamicConns = activeConns.filter(conn => conn.open && conn.dataChannel?.readyState === 'open');
        if (dynamicConns.length === 0) {
          setTransfers(prev => prev.map(t => {
            if (t.id === fileId) {
              return { ...t, status: 'failed', error: 'All remote peers disconnected' };
            }
            return t;
          }));
          activeSendsRef.current.delete(fileId);
          transferProgressRef.current.delete(fileId);
          return;
        }

        dynamicConns.forEach(conn => {
          const channel = conn.dataChannel;
          // Benchmark threshold: buffer queue > 256KB requires backoff to prevent packet drops
          if (channel && channel.bufferedAmount > 256 * 1024) {
            isCongested = true;
          }
        });

        if (isCongested) {
          // If the tab is hidden, raise sleep slightly to prevent extreme CPU cycles while backgrounded
          const waitTime = document.hidden ? 100 : 20;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Re-evaluate pause state after potential delay
      const currentSend = activeSendsRef.current.get(fileId);
      if (!currentSend || currentSend.isPaused) return;

      // Broadcast slice chunk to active connected destinations
      const finalConns = activeConns.filter(conn => conn.open && conn.dataChannel?.readyState === 'open');
      finalConns.forEach(conn => {
        try {
          conn.send({
            type: 'file-chunk',
            id: fileId,
            chunk: buffer,
            offset: currentOffset
          });
        } catch (err) {
          console.error('Error broadcasting package slice:', err);
        }
      });

      // Advance internal tracker
      sendState.currentOffset += buffer.byteLength;

      // Update local progression track - throttled to prevent React performance bottleneck
      setTransfers(prev => {
        let changed = false;
        const next = prev.map(t => {
          if (t.id === fileId) {
            const bytesTransferred = sendState.currentOffset;
            const progress = Math.min(100, Math.round((bytesTransferred / t.size) * 100));
            const now = Date.now();
            const lastUpdate = lastStateUpdateRef.current[fileId] || 0;

            if (progress === 100 || progress !== t.progress || now - lastUpdate > 250) {
              lastStateUpdateRef.current[fileId] = now;
              changed = true;
              return {
                ...t,
                bytesTransferred,
                progress
              };
            }
          }
          return t;
        });
        return changed ? next : prev;
      });

      // Pull next slice
      readAndSendNextChunk(fileId);
    };

    reader.onerror = (err) => {
      console.error('Slice FileReader error:', err);
      setTransfers(prev => prev.map(t => {
        if (t.id === fileId) {
          return { ...t, status: 'failed', error: 'Local file access read failed' };
        }
        return t;
      }));
      activeSendsRef.current.delete(fileId);
      transferProgressRef.current.delete(fileId);
    };

    reader.readAsArrayBuffer(slice);
  };

  /**
   * Set up event listeners for a data connection
   */
  const registerConnectionEvents = (conn: DataConnection) => {
    const peerId = conn.peer;

    conn.on('open', () => {
      // Send device identifier immediately
      const infoMsg: PeerMessage = { type: 'peer-info', device: getDeviceDetails() };
      conn.send(infoMsg);

      // Cache connection
      connectionsRef.current.set(peerId, conn);

      // Add to connected peer roster
      setPeers(prev => {
        if (prev.some(p => p.id === peerId)) return prev;
        return [...prev, {
          id: peerId,
          isSender: !isHost,
          connectedAt: Date.now(),
          device: 'Connecting device...'
        }];
      });
    });

    conn.on('data', (data: any) => {
      const msg = data as PeerMessage;
      
      switch (msg.type) {
        case 'peer-info': {
          setPeers(prev => prev.map(p => {
            if (p.id === peerId) {
              return { ...p, device: msg.device };
            }
            return p;
          }));
          break;
        }

        case 'file-meta': {
          // Initialize direct local receiver buffers
          activeReceivesRef.current.set(msg.id, {
            chunks: [],
            bytesReceived: 0,
            name: msg.name,
            size: msg.size,
            mime: msg.mime,
            chunksCount: 0
          });

          // Register transaction in React state
          const newTransfer: FileTransfer = {
            id: msg.id,
            name: msg.name,
            size: msg.size,
            progress: 0,
            bytesTransferred: 0,
            speed: 0,
            status: 'transferring',
            direction: 'receive',
            startTime: Date.now()
          };
          
          setTransfers(prev => [newTransfer, ...prev]);
          transferProgressRef.current.set(msg.id, {
            lastBytes: 0,
            lastTime: Date.now()
          });
          break;
        }

        case 'file-chunk': {
          const rec = activeReceivesRef.current.get(msg.id);
          if (rec) {
            // Memory Optimization: Push a disk-backed Blob instead of holding raw ArrayBuffers on the JS Heap
            rec.chunks.push(new Blob([msg.chunk]));
            rec.bytesReceived += msg.chunk.byteLength;
            rec.chunksCount += 1;
            
            // Periodically reply with ACK back to sender to support reliability/flow checks
            if (rec.chunksCount % 8 === 0) {
              try {
                conn.send({ type: 'file-ack', id: msg.id, offset: rec.bytesReceived });
              } catch (e) {
                console.warn('ACK echo failure (non-blocking):', e);
              }
            }

            // Throttled UI State Updates: Reduces Chrome/Safari/Firefox frame-drop & browser OOM/tab crashes
            setTransfers(prev => {
              let changed = false;
              const next = prev.map(t => {
                if (t.id === msg.id) {
                  const updatedBytes = Math.min(t.size, rec.bytesReceived);
                  const progress = Math.min(100, Math.round((updatedBytes / t.size) * 100));
                  const now = Date.now();
                  const lastUpdate = lastStateUpdateRef.current[msg.id] || 0;

                  if (progress === 100 || progress !== t.progress || now - lastUpdate > 250) {
                    lastStateUpdateRef.current[msg.id] = now;
                    changed = true;
                    return {
                      ...t,
                      status: 'transferring',
                      bytesTransferred: updatedBytes,
                      progress
                    };
                  }
                }
                return t;
              });
              return changed ? next : prev;
            });
          }
          break;
        }

        case 'file-end': {
          const rec = activeReceivesRef.current.get(msg.id);
          if (rec) {
            // Compile final Blob structure in sandbox memory
            const fileBlob = new Blob(rec.chunks, { type: rec.mime });
            const blobUrl = URL.createObjectURL(fileBlob);

            setTransfers(prev => prev.map(t => {
              if (t.id === msg.id) {
                return {
                  ...t,
                  status: 'completed',
                  progress: 100,
                  bytesTransferred: t.size,
                  blobUrl
                };
              }
              return t;
            }));

            // Launch system auto-download sequence
            const dl = document.createElement('a');
            dl.href = blobUrl;
            dl.download = rec.name;
            document.body.appendChild(dl);
            dl.click();
            document.body.removeChild(dl);

            activeReceivesRef.current.delete(msg.id);
            transferProgressRef.current.delete(msg.id);
          }
          break;
        }

        case 'file-cancel': {
          setTransfers(prev => prev.map(t => {
            if (t.id === msg.id) {
              return { ...t, status: 'failed', error: 'Terminated by peer connection' };
            }
            return t;
          }));
          activeReceivesRef.current.delete(msg.id);
          activeSendsRef.current.delete(msg.id);
          transferProgressRef.current.delete(msg.id);
          break;
        }

        case 'file-pause': {
          // A peer requested to pause the incoming file flow
          setTransfers(prev => prev.map(t => {
            if (t.id === msg.id) {
              return { 
                ...t, 
                status: 'paused', 
                isPausedByPeer: msg.pausedBy === 'sender' ? false : true,
                isPausedByMe: msg.pausedBy === 'sender' ? true : false
              };
            }
            return t;
          }));

          // If we are the sender, freeze active chunk generation
          const sendState = activeSendsRef.current.get(msg.id);
          if (sendState) {
            sendState.isPaused = true;
          }
          break;
        }

        case 'file-resume': {
          // Peer requested transfer resumption
          setTransfers(prev => prev.map(t => {
            if (t.id === msg.id) {
              return { 
                ...t, 
                status: 'transferring', 
                isPausedByMe: false, 
                isPausedByPeer: false,
                bytesTransferred: msg.offset
              };
            }
            return t;
          }));

          // Resume Outgoing Sender
          const sendState = activeSendsRef.current.get(msg.id);
          if (sendState) {
            sendState.currentOffset = msg.offset;
            sendState.isPaused = false;
            readAndSendNextChunk(msg.id);
          }
          break;
        }

        case 'file-ack': {
          // Received confirmation of safely processed bytes from receiver
          setTransfers(prev => prev.map(t => {
            if (t.id === msg.id && t.status === 'transferring') {
              return {
                ...t,
                bytesTransferred: Math.max(t.bytesTransferred, msg.offset)
              };
            }
            return t;
          }));
          break;
        }
      }
    });

    conn.on('close', () => {
      connectionsRef.current.delete(peerId);
      setPeers(prev => {
        const nextPeers = prev.filter(p => p.id !== peerId);
        if (nextPeers.length === 0) {
          // Garbage collect active file buffers immediately when all remote peers are disconnected
          activeReceivesRef.current.clear();
          activeSendsRef.current.clear();
          lastStateUpdateRef.current = {};
        }
        return nextPeers;
      });
    });

    conn.on('error', (err) => {
      console.error('Connection error for peer', peerId, err);
      setTransfers(prev => prev.map(t => {
        if (t.status === 'transferring' || t.status === 'connecting') {
          return { ...t, status: 'failed', error: 'Connection lost' };
        }
        return t;
      }));
    });
  };

  /**
   * Host / Create Room
   */
  const createRoom = async () => {
    cleanup();
    setIsInitializing(true);
    setPeerError(null);
    setSignalingStatus('connecting');

    const code = generateRoomCode();
    const serverPeerId = `qd-${code}`;

    const peer = new Peer(serverPeerId, PEER_CONFIG);

    peerRefSetup(peer, code, true);
  };

  /**
   * Guest / Join Room
   */
  const joinRoom = async (code: string) => {
    const formattedCode = code.trim().toLowerCase();
    if (!formattedCode) {
      setPeerError('Please enter a valid room code.');
      return;
    }

    cleanup();
    setIsInitializing(true);
    setPeerError(null);
    setSignalingStatus('connecting');

    const clientPeer = new Peer(PEER_CONFIG);

    clientPeer.on('open', () => {
      setSignalingStatus('connected');
      const serverPeerId = `qd-${formattedCode}`;
      const conn = clientPeer.connect(serverPeerId, {
        reliable: true
      });
      registerConnectionEvents(conn);
      
      setRoomCode(formattedCode);
      setIsHost(false);
      setIsInitializing(false);
    });

    clientPeer.on('disconnected', () => {
      setSignalingStatus('reconnecting');
      clientPeer.reconnect();
    });

    clientPeer.on('error', (err: any) => {
      console.error('PeerJS client error:', err);
      setIsInitializing(false);
      setSignalingStatus('disconnected');
      
      if (err.type === 'peer-unavailable') {
        setPeerError(`Room "${formattedCode}" not found. Verify the code and try again.`);
        cleanup();
      } else {
        setPeerError(`WebRTC client error: ${err.message || 'Could not connect'}`);
        cleanup();
      }
    });

    peerInstanceRef.current = clientPeer;
  };

  const peerRefSetup = (peer: Peer, code: string, isCreator: boolean) => {
    peerInstanceRef.current = peer;

    peer.on('open', () => {
      setRoomCode(code);
      setIsHost(isCreator);
      setIsInitializing(false);
      setSignalingStatus('connected');
    });

    peer.on('connection', (conn) => {
      registerConnectionEvents(conn);
    });

    peer.on('disconnected', () => {
      setSignalingStatus('reconnecting');
      peer.reconnect();
    });

    peer.on('close', () => {
      setSignalingStatus('disconnected');
    });

    peer.on('error', (err: any) => {
      console.error('PeerJS signaling error:', err);
      setIsInitializing(false);
      setSignalingStatus('disconnected');

      if (err.type === 'unavailable-id') {
        console.warn('Room code collision. Re-initializing with a new random hash code...');
        createRoom();
      } else {
        setPeerError(`WebRTC signal failure: ${err.message || 'Identity register failed'}`);
      }
    });
  };

  /**
   * Distribute a binary file to all connected Peers via WebRTC data channel chunk-streaming
   */
  const sendFile = async (file: File) => {
    if (connectionsRef.current.size === 0) {
      setPeerError('Cannot send file: No remote devices connected in this sandbox room.');
      return;
    }

    const fileId = Math.random().toString(36).substring(2, 9);
    
    // Register active transaction entry
    const newTransfer: FileTransfer = {
      id: fileId,
      name: file.name,
      size: file.size,
      progress: 0,
      bytesTransferred: 0,
      speed: 0,
      status: 'connecting',
      direction: 'send',
      startTime: Date.now(),
      fileObject: file // Cache in state for failsafe recovery or retries
    };

    setTransfers(prev => [newTransfer, ...prev]);
    transferProgressRef.current.set(fileId, {
      lastBytes: 0,
      lastTime: Date.now()
    });

    // Populate parameters in Ref
    const sendState: ActiveSend = {
      file,
      currentOffset: 0,
      isPaused: false,
      chunkSize: 64 * 1024, // High-performance 64KB slices
      connections: Array.from(connectionsRef.current.values())
    };
    activeSendsRef.current.set(fileId, sendState);

    // Announce File Header Metadata
    connectionsRef.current.forEach(conn => {
      const metaMsg: PeerMessage = {
        type: 'file-meta',
        id: fileId,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream'
      };
      
      try {
        conn.send(metaMsg);
      } catch (e) {
        console.error('Meta transmission failure:', e);
      }
    });

    // Update status to active
    setTransfers(prev => prev.map(t => {
      if (t.id === fileId) {
        return { ...t, status: 'transferring' };
      }
      return t;
    }));

    // Initiate transmission loop
    readAndSendNextChunk(fileId);
  };

  /**
   * Toggles transmission pause state for file
   */
  const togglePauseTransfer = (id: string) => {
    setTransfers(prev => prev.map(t => {
      if (t.id !== id) return t;

      const isCurrentlyPaused = t.status === 'paused';
      
      if (t.direction === 'send') {
        const sendState = activeSendsRef.current.get(id);
        if (sendState) {
          sendState.isPaused = !isCurrentlyPaused;
          
          // Notify peer devices of pause event
          connectionsRef.current.forEach(conn => {
            try {
              if (isCurrentlyPaused) {
                conn.send({ type: 'file-resume', id, offset: sendState.currentOffset });
              } else {
                conn.send({ type: 'file-pause', id, pausedBy: 'sender' });
              }
            } catch (err) {
              console.error('Error broadcasting pause message:', err);
            }
          });

          // If resuming, trigger the loop
          if (isCurrentlyPaused) {
            readAndSendNextChunk(id);
          }
        }

        return {
          ...t,
          status: isCurrentlyPaused ? 'transferring' : ('paused' as const),
          isPausedByMe: !isCurrentlyPaused,
          isPausedByPeer: false
        };
      } else {
        // We are the receiver pausing
        connectionsRef.current.forEach(conn => {
          try {
            if (isCurrentlyPaused) {
              conn.send({ type: 'file-resume', id, offset: t.bytesTransferred });
            } else {
              conn.send({ type: 'file-pause', id, pausedBy: 'receiver' });
            }
          } catch (err) {
            console.error('Error sending receiver pause signal:', err);
          }
        });

        return {
          ...t,
          status: isCurrentlyPaused ? 'transferring' : ('paused' as const),
          isPausedByMe: !isCurrentlyPaused,
          isPausedByPeer: false
        };
      }
    }));
  };

  /**
   * Cancel file transaction operation
   */
  const cancelTransfer = (transferId: string) => {
    connectionsRef.current.forEach(conn => {
      try {
        conn.send({ type: 'file-cancel', id: transferId });
      } catch (e) {
        console.error('Error sending cancel message:', e);
      }
    });

    setTransfers(prev => prev.map(t => {
      if (t.id === transferId) {
        return { ...t, status: 'failed', error: 'Cancelled by user request' };
      }
      return t;
    }));

    activeSendsRef.current.delete(transferId);
    activeReceivesRef.current.delete(transferId);
    transferProgressRef.current.delete(transferId);
  };

  /**
   * Retry/Restart a failed outgoing file operation
   */
  const retryTransfer = (id: string) => {
    const t = transfers.find(item => item.id === id);
    if (!t || !t.fileObject) {
      setPeerError('Failed to retry: Original file reference handles were released by the GC.');
      return;
    }

    // Capture original file object
    const file = t.fileObject;

    // Filter current failed task entry out of queue
    setTransfers(prev => prev.filter(item => item.id !== id));

    // Start fresh streaming process
    sendFile(file);
  };

  const clearCompletedTransfers = () => {
    setTransfers(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'failed'));
  };

  return {
    roomCode,
    isHost,
    peers,
    transfers,
    peerError,
    isInitializing,
    signalingStatus,
    createRoom,
    joinRoom,
    sendFile,
    togglePauseTransfer,
    cancelTransfer,
    retryTransfer,
    clearCompletedTransfers,
    leaveRoom: cleanup
  };
}
