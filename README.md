# QuickDrop: Decentralized Browser-to-Browser File Streaming Engine

QuickDrop is a production-quality, zero-knowledge, browser-based peer-to-peer file transfer application. Built entirely on standard client-side WebRTC protocols, it facilitates zero-friction, end-to-end encrypted packet transmission directly between two browser engines without cloud intermediate handshakes, persistent registries, size constraints, or cloud storage risks.

---

## Technical Architecture

```
                                +-------------------+
                                |   PeerJS Signaling |
                                |   (Broker Server) |
                                +---------+---------+
                                          |
                     1. SDP Offer/Answer  |  1. SDP Offer/Answer
                     & ICE Candidate Exchange
                                          |
                +-------------------------+-------------------------+
                |                                                   |
                v                                                   v
      +---------+---------+                               +---------+---------+
      |  Sender Browser   |  ===========================  | Receiver Browser  |
      |                   |   2. Direct E2E Encrypted     |                   |
      | [FS Read Slices]  |      RTCDataChannel Stream    | [RAM Chunk Buff]  |
      +-------------------+                               +-------------------+
```

### Protocol Specifications
1. **Signaling State Machine**: Initiates via a temporary signaling connection to negotiate session tokens. Once SDP handshakes complete, the broker is bypassed, leaving a direct, serverless RTCDataChannel.
2. **Dynamic Backpressure & Congestion Control**: Implements standard high-speed chunk throttling. Senders evaluate the browser socket queue depth (`bufferedAmount`) and halt further file slicing if memory buffers exceed `256 KB` to avoid packet loss.
3. **Collision-Resistant Room Identifiers**: Bypasses classic weak codes by pairing hum-readable names with a secure alphanumeric hash (e.g. `swift-wave-f8d2`), achieving high collision resistance.
4. **Reliable Chunk ACK System**: For every 8 file chunks processed, the receiver sends a `file-ack` confirmation. Senders maintain the last acknowledged byte position to support flawless pause, resume, and failed transfer recovery.

---

## Core Features

- **Chunked Transfer Optimization**: Dynamic 64KB packet streaming for fast network throughput on local and external channels.
- **Advanced State Queue Management**: Supports live bidirectional pause, resume, cancel, and automated recovery retries on active transfers.
- **Connection Diagnostics**: Responsive status indicators tracking `Connecting`, `Connected`, `Disconnected`, and `Reconnecting` states of signaling brokers.
- **Browser Compatibility Warnings**: Active evaluation of sandboxed WebRTC limitations, local session cookies, and secure context issues (HTTPS).
- **Absolute Privacy Design**: End-to-end peer encryption with zero local databases or servers caching private communication logs.

---

## Security Model

- **Absolute Zero Knowledge**: Since server-side storage is non-existent, files do not land on any cloud drive.
- **Data In-Transit Encrypted**: Direct browser tunnels run DTLS/SRTP cryptography out-of-the-box.
- **Metadata Confidentiality**: Room codes and peer details reside only in running JavaScript variables, completely avoiding telemetry risks.

---

## Production Installation & Dev Guide

### Prerequisites
- Node.js version 18.x or above.
- NPM client.

### Getting Started

1. **Clone the repository and reach the directory root**:
   ```bash
   cd quickdrop-peer-sharing
   ```

2. **Install exact dependencies**:
   ```bash
   npm install
   ```

3. **Spin up local dev instance**:
   ```bash
   npm run dev
   ```
   Open your browser to `http://localhost:3000` to interact.

4. **Run static lint compilation checks**:
   ```bash
   npm run lint
   ```

5. **Generate compiled static assets**:
   ```bash
   npm run build
   ```

---

## Production Deployment Specifications

### GitHub Pages (Config)
To deploy as a single-page app on GitHub Pages automatically, insert a custom workflow in `.github/workflows/deploy.yml`:
```yaml
name: Deploy static content to Pages
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - use: actions/setup-node@v4
      - run: npm ci && npm run build
      - uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: dist
```

### Vercel / Netlify
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- Set up a custom `_redirects` file (for Netlify) or `vercel.json` to handle SPA route redirection if fallback routing parameters are passed.

---

## Future Roadmap

- [ ] **Multi-device group broadcasts**: Stream chunks parallelly to 5+ simultaneous receivers under a fanout thread.
- [ ] **Native Local Discovery**: Fallback automatic service identification based on local network subnets using WebSSD / MDNS.
- [ ] **Origin Private File System (OPFS)**: Stream writes directly to disk to allow swapping storage, reducing maximum browser heap bounds on large multi-gigabyte transfers.
