# Findings: Milestone 3 - Log Streaming

**Purpose:** Track research discoveries, architectural findings, and implementation insights

**Last Updated:** 2026-01-10

---

## Research Findings

### Docker Log Streaming API

**Docker SDK for Go:**
- `client.ContainerLogs(ctx, containerID, types.ContainerLogsOptions)`
- Returns `io.ReadCloser` stream
- Options:
  - `ShowStdout: true` - Show stdout logs
  - `ShowStderr: true` - Show stderr logs
  - `Follow: true` - Stream continuously (like `docker logs -f`)
  - `Tail: "1000"` - Get last N lines
  - `Timestamps: true` - Include timestamps
  - `Since: "2023-01-01T00:00:00Z"` - Logs since timestamp

**Log Format:**
- Docker uses multiplexed stream format
- Each frame has 8-byte header:
  - Byte 0: Stream type (0=stdin, 1=stdout, 2=stderr)
  - Bytes 1-3: Reserved (zeros)
  - Bytes 4-7: Frame size (big-endian uint32)
- Followed by frame data (log message)

**Example Usage:**
```go
options := types.ContainerLogsOptions{
    ShowStdout: true,
    ShowStderr: true,
    Follow:     true,
    Timestamps: true,
    Tail:       "1000",
}

reader, err := cli.ContainerLogs(ctx, containerID, options)
if err != nil {
    return err
}
defer reader.Close()

// Read stream
scanner := bufio.NewScanner(reader)
for scanner.Scan() {
    logLine := scanner.Text()
    // Send to manager
}
```

---

## Pub/Sub Architecture

### Durable Object Pub/Sub Pattern

**Requirements:**
- Agent sends logs to Durable Object
- Durable Object forwards to N UI clients
- New clients get cached logs
- Old clients get only new logs

**Design:**

```typescript
class AgentConnection {
  // Existing agent WebSocket
  private ws: WebSocket | null = null;

  // Map of UI clients subscribed to container logs
  // Key: subscriberId (UUID), Value: { ws: WebSocket, containerId: string }
  private logSubscribers: Map<string, LogSubscriber> = new Map();

  // Log cache per container
  // Key: containerId, Value: CircularBuffer<LogLine>
  private logBuffers: Map<string, CircularBuffer<LogLine>> = new Map();
}

interface LogSubscriber {
  id: string;
  ws: WebSocket;
  containerId: string;
}

interface LogLine {
  timestamp: number;
  stream: 'stdout' | 'stderr';
  message: string;
}
```

**Message Flow:**

```
[Container] outputs log
    ↓
[Agent] reads via Docker SDK
    ↓
[Agent] sends to Durable Object:
    {
      subject: "log.line",
      data: {
        containerId: "abc123",
        timestamp: 1234567890,
        stream: "stdout",
        message: "Server started on port 8080"
      }
    }
    ↓
[Durable Object] receives log.line
    ↓
[Durable Object] adds to buffer for container
    ↓
[Durable Object] broadcasts to all subscribers:
    logSubscribers.forEach((sub) => {
      if (sub.containerId === msg.data.containerId) {
        sub.ws.send(JSON.stringify(msg))
      }
    })
    ↓
[UI Client] receives log line
    ↓
[UI Client] displays in log viewer
```

---

## UI Library Research

### Option 1: xterm.js

**Pros:**
- Full terminal emulator (VT100, xterm, etc.)
- Rich features (colors, cursor positioning, etc.)
- Used by VS Code, Hyper, etc.
- React wrapper available: `@xterm/xterm`, `@xterm/addon-fit`

**Cons:**
- Heavy (full terminal emulator)
- Overkill for log viewing
- Complex API

**Use Case:** Best for interactive terminals (RCON console in Milestone 5)

---

### Option 2: react-lazylog

**Pros:**
- Specifically designed for log viewing
- Lazy loading (virtualizes long logs)
- Auto-scroll support
- Search/filter built-in
- Lightweight

**Cons:**
- Less maintained (last update 2021)
- May need customization

**Use Case:** Good for log viewing, but outdated

---

### Option 3: Custom Component with Virtualization

**Pros:**
- Full control over features
- Can use react-window or react-virtuoso for virtualization
- Tailored to exact requirements
- Modern and maintainable

**Cons:**
- More implementation work
- Need to handle edge cases

**Recommendation:** Build custom component using react-virtuoso

---

## Circular Buffer for Log Caching

### Implementation Strategy

**Requirements:**
- Fixed size (1000 lines)
- FIFO (oldest logs dropped when full)
- Fast append and read
- Thread-safe (TypeScript single-threaded, but good practice)

**Implementation:**

```typescript
class CircularBuffer<T> {
  private buffer: T[];
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  append(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Buffer full, move head forward
      this.head = (this.head + 1) % this.capacity;
    }
  }

  getAll(): T[] {
    if (this.size === 0) return [];

    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.head + i) % this.capacity;
      result.push(this.buffer[index]);
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }
}
```

---

## Message Protocol Design

### New Subjects for Log Streaming

**Manager → Agent:**
- `log.stream.start` - Start streaming logs for container
  ```json
  {
    "subject": "log.stream.start",
    "data": {
      "containerId": "abc123",
      "tail": 1000,
      "follow": true,
      "timestamps": true
    }
  }
  ```

- `log.stream.stop` - Stop streaming logs for container
  ```json
  {
    "subject": "log.stream.stop",
    "data": {
      "containerId": "abc123"
    }
  }
  ```

**Agent → Manager:**
- `log.line` - Single log line
  ```json
  {
    "subject": "log.line",
    "data": {
      "containerId": "abc123",
      "timestamp": 1234567890123,
      "stream": "stdout",
      "message": "Server started"
    }
  }
  ```

- `log.stream.started` - Acknowledge stream started
- `log.stream.stopped` - Acknowledge stream stopped
- `log.stream.error` - Error starting/streaming logs

**UI → Manager:**
- `log.subscribe` - Subscribe to container logs (via WebSocket)
  ```json
  {
    "subject": "log.subscribe",
    "data": {
      "containerId": "abc123"
    }
  }
  ```

- `log.unsubscribe` - Unsubscribe from container logs
  ```json
  {
    "subject": "log.unsubscribe",
    "data": {
      "containerId": "abc123"
    }
  }
  ```

**Manager → UI:**
- `log.line` - Forwarded from agent
- `log.history` - Cached logs sent to new subscriber
  ```json
  {
    "subject": "log.history",
    "data": {
      "containerId": "abc123",
      "lines": [
        { "timestamp": 123, "stream": "stdout", "message": "..." },
        { "timestamp": 124, "stream": "stdout", "message": "..." }
      ]
    }
  }
  ```

---

## WebSocket Architecture for UI

### Current Architecture (HTTP Only)

UI currently uses HTTP for all operations:
- Login via HTTP
- Fetch agents via HTTP
- Container operations via HTTP

No WebSocket connection from UI to Manager.

### Proposed Architecture (WebSocket for Logs)

**Option 1: Dual Connection**
- Keep existing HTTP for operations
- Add WebSocket for log streaming only
- Pros: Simple, minimal changes
- Cons: Two connections per client

**Option 2: Full WebSocket**
- Replace HTTP with WebSocket for everything
- Pros: Single connection, real-time everything
- Cons: Major refactor, overkill for MVP

**Recommendation:** Option 1 (dual connection)

**Implementation:**
```typescript
// frontend/src/lib/websocket.ts
class LogStreamClient {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, (log: LogLine) => void> = new Map();

  connect(managerUrl: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(managerUrl);

      this.ws.onopen = () => {
        // Authenticate with token
        this.send({ subject: 'ui.auth', data: { token } });
        resolve();
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      };

      this.ws.onerror = (error) => reject(error);
    });
  }

  subscribe(containerId: string, callback: (log: LogLine) => void): void {
    this.subscribers.set(containerId, callback);
    this.send({ subject: 'log.subscribe', data: { containerId } });
  }

  unsubscribe(containerId: string): void {
    this.subscribers.delete(containerId);
    this.send({ subject: 'log.unsubscribe', data: { containerId } });
  }

  private handleMessage(msg: Message): void {
    if (msg.subject === 'log.line' || msg.subject === 'log.history') {
      const containerId = msg.data.containerId;
      const callback = this.subscribers.get(containerId);
      if (callback) callback(msg.data);
    }
  }
}
```

---

## Performance Considerations

### Log Volume

**Typical Project Zomboid server:**
- Low activity: 1-10 lines/second
- High activity: 50-100 lines/second
- Startup: 1000+ lines in 10 seconds

**Network bandwidth:**
- Average log line: ~100 bytes
- 100 lines/second = 10 KB/s per client
- 10 clients = 100 KB/s = ~0.8 Mbps

**Acceptable for WebSocket streaming.**

### Memory Usage

**Log buffer per container:**
- 1000 lines × 200 bytes/line = 200 KB per container
- 100 containers = 20 MB total (acceptable)

**Durable Object limits:**
- Cloudflare Durable Objects: 128 MB memory limit
- 20 MB for logs + code = well within limits

---

## Filtering Strategy

### Option 1: Agent-Side Filtering

Agent filters logs before sending to manager.

**Pros:**
- Reduces network traffic
- Reduces manager processing

**Cons:**
- Agent needs to know what to filter
- UI can't change filters without reconnecting

---

### Option 2: Manager-Side Filtering

Manager receives all logs, filters before forwarding to clients.

**Pros:**
- UI can change filters in real-time
- No agent changes needed

**Cons:**
- More network traffic (agent → manager)
- More manager processing

---

### Option 3: Client-Side Filtering

UI receives all logs, filters in browser.

**Pros:**
- No backend changes
- Instant filter changes
- Can search historical logs

**Cons:**
- Highest network usage
- Client memory usage

**Recommendation:** Option 3 for MVP (simplest, most flexible)

Later optimization: Add manager-side filtering for high-volume scenarios.

---

## Questions to Resolve

- [x] How does Docker log streaming work? → Answered above
- [x] What UI library to use? → Custom component with react-virtuoso
- [x] How to implement pub/sub? → Map of subscribers + circular buffer
- [ ] How to handle agent reconnection mid-stream?
- [ ] Should logs persist in D1? (for historical viewing)
- [ ] Rate limiting for log streaming?
- [ ] Max concurrent log streams per agent?

---

## References

- Docker Engine API - Logs: https://docs.docker.com/engine/api/v1.41/#tag/Container/operation/ContainerLogs
- Docker Go SDK - ContainerLogs: https://pkg.go.dev/github.com/docker/docker/client#Client.ContainerLogs
- xterm.js: https://xtermjs.org/
- react-lazylog: https://github.com/mozilla-frontend-infra/react-lazylog
- react-virtuoso: https://virtuoso.dev/
