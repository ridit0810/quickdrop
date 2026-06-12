/**
 * File Transfer Types for QuickDrop
 */

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  mime: string;
}

export type TransferStatus = 'pending' | 'connecting' | 'transferring' | 'paused' | 'completed' | 'failed';
export type TransferDirection = 'send' | 'receive';
export type SignalingStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface FileTransfer {
  id: string;
  name: string;
  size: number;
  progress: number; // 0 to 100
  bytesTransferred: number;
  speed: number; // bytes/sec
  status: TransferStatus;
  direction: TransferDirection;
  startTime?: number;
  timeLeft?: number; // seconds remaining
  blobUrl?: string; // for completed receives
  error?: string;
  fileObject?: File; // cached File handle for re-sends or resumption
  isPausedByMe?: boolean;
  isPausedByPeer?: boolean;
  retryCount?: number;
}

export interface PeerInfo {
  id: string;
  isSender: boolean;
  connectedAt: number;
  device?: string; // simple browser/platform identifier
}

export type PeerMessage =
  | { type: 'peer-info'; device: string }
  | { type: 'file-meta'; id: string; name: string; size: number; mime: string }
  | { type: 'file-chunk'; id: string; chunk: ArrayBuffer; offset: number }
  | { type: 'file-end'; id: string }
  | { type: 'file-cancel'; id: string }
  | { type: 'file-pause'; id: string; pausedBy: 'sender' | 'receiver' }
  | { type: 'file-resume'; id: string; offset: number }
  | { type: 'file-ack'; id: string; offset: number }
  | { type: 'text-msg'; text: string; sender: string };
