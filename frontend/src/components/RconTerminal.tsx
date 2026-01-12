/**
 * RCON Terminal Component
 * Provides an interactive terminal for server administration via RCON
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useRcon } from '../hooks/useRcon';
import '@xterm/xterm/css/xterm.css';

interface RconTerminalProps {
  agentId: string;
  serverId: string;
  serverName: string;
  containerID: string;
  rconPort: number;
  rconPassword: string;   // Server's RCON_PASSWORD for RCON connection
  onClose: () => void;
}

export function RconTerminal({
  agentId,
  serverId,
  serverName,
  containerID,
  rconPort,
  rconPassword,
  onClose,
}: RconTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentCommandRef = useRef(''); // Use ref for synchronous updates
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const commandHistoryRef = useRef<string[]>([]); // Ref for closure access
  const historyIndexRef = useRef(-1); // Ref for closure access
  const [players, setPlayers] = useState<string[]>([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const { isConnected, error, sendCommand } = useRcon({
    agentId,
    serverId,
    containerID,
    port: rconPort,  // Use the RCON port from DB (container listens on this port internally)
    rconPassword,
    enabled: true,
  });

  // Keep refs in sync with state for closure access
  useEffect(() => {
    commandHistoryRef.current = commandHistory;
  }, [commandHistory]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) {
      return;
    }

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Courier New", monospace',
      scrollback: 5000, // Keep 5000 lines of history
      convertEol: true, // Convert \n to \r\n
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
    });

    // Create fit addon
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Open terminal
    terminal.open(terminalRef.current);
    fitAddon.fit();

    // Reduce rows by 2 to leave space at bottom for visibility
    const initialRows = terminal.rows;
    if (initialRows > 5) {
      terminal.resize(terminal.cols, initialRows - 2);
    }

    // Store refs
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Welcome message
    terminal.writeln('\x1b[1;36m╔════════════════════════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[1;36m║\x1b[0m         \x1b[1;32mZedOps RCON Console\x1b[0m                         \x1b[1;36m║\x1b[0m');
    terminal.writeln('\x1b[1;36m╚════════════════════════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');
    terminal.writeln(`Server: \x1b[1;33m${serverName}\x1b[0m`);
    terminal.writeln(`Port: \x1b[1;33m${rconPort}\x1b[0m`);
    terminal.writeln('');
    terminal.writeln('\x1b[90mConnecting to RCON server...\x1b[0m');
    terminal.writeln('');

    // Handle terminal input
    terminal.onData((data) => {
      const code = data.charCodeAt(0);

      // Enter key
      if (code === 13) {
        handleCommandSubmit(terminal);
      }
      // Backspace
      else if (code === 127) {
        if (currentCommandRef.current.length > 0) {
          currentCommandRef.current = currentCommandRef.current.slice(0, -1);
          terminal.write('\b \b');
        }
      }
      // Up arrow (previous command)
      else if (data === '\x1b[A') {
        navigateHistory('up', terminal);
      }
      // Down arrow (next command)
      else if (data === '\x1b[B') {
        navigateHistory('down', terminal);
      }
      // Ctrl+C
      else if (code === 3) {
        terminal.writeln('^C');
        currentCommandRef.current = '';
        showPrompt(terminal);
      }
      // Ctrl+L (clear screen)
      else if (code === 12) {
        terminal.clear();
        showPrompt(terminal);
      }
      // Regular character
      else if (code >= 32 && code < 127) {
        currentCommandRef.current += data;
        terminal.write(data);
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        // Reduce rows by 2 to leave space at bottom for visibility
        const currentRows = xtermRef.current.rows;
        if (currentRows > 5) {
          xtermRef.current.resize(xtermRef.current.cols, currentRows - 2);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [serverName, rconPort]);

  // Handle connection status
  useEffect(() => {
    const terminal = xtermRef.current;
    if (!terminal) return;

    if (isConnected) {
      terminal.writeln('\x1b[1;32m✓ Connected to RCON server\x1b[0m');
      terminal.writeln('');
      terminal.writeln('\x1b[90mType "help" for available commands\x1b[0m');
      terminal.writeln('');
      showPrompt(terminal);

      // Ensure terminal is properly sized and scrolled
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        // Reduce rows by 2 to leave space at bottom for visibility
        const currentRows = xtermRef.current.rows;
        if (currentRows > 5) {
          xtermRef.current.resize(xtermRef.current.cols, currentRows - 2);
        }
      }
      setTimeout(() => {
        terminal.scrollToBottom();
      }, 10);
    } else if (error) {
      terminal.writeln(`\x1b[1;31m✗ Connection failed: ${error}\x1b[0m`);
      terminal.writeln('');
    }
  }, [isConnected, error]);

  const showPrompt = (terminal: Terminal) => {
    terminal.write('\x1b[1;32m>\x1b[0m ');
  };

  const handleCommandSubmit = async (terminal: Terminal) => {
    const command = currentCommandRef.current.trim(); // Use ref for synchronous read
    terminal.writeln(''); // New line after command

    if (!command) {
      showPrompt(terminal);
      return;
    }

    // Add to history
    setCommandHistory((prev) => [...prev, command]);
    setHistoryIndex(-1);

    // Send command via RCON
    try {
      terminal.writeln(`\x1b[90mExecuting: ${command}\x1b[0m`);
      const response = await sendCommand(command);

      // Display response
      if (response) {
        const lines = response.split('\n');
        lines.forEach((line) => {
          terminal.writeln(line);
        });
      } else {
        terminal.writeln('\x1b[90m(no output)\x1b[0m');
      }
    } catch (err) {
      terminal.writeln(`\x1b[1;31mError: ${err instanceof Error ? err.message : 'Command failed'}\x1b[0m`);
    }

    terminal.writeln('');
    currentCommandRef.current = ''; // Clear ref
    showPrompt(terminal);

    // Ensure terminal viewport is updated and scroll to show prompt
    // Use setTimeout to ensure rendering is complete before scrolling
    if (fitAddonRef.current && xtermRef.current) {
      fitAddonRef.current.fit();
      // Reduce rows by 2 to leave space at bottom for visibility
      const currentRows = xtermRef.current.rows;
      if (currentRows > 5) {
        xtermRef.current.resize(xtermRef.current.cols, currentRows - 2);
      }
    }
    setTimeout(() => {
      terminal.scrollToBottom();
    }, 10);
  };

  const navigateHistory = (direction: 'up' | 'down', terminal: Terminal) => {
    // Use refs for closure access (state is stale in onData handler)
    const history = commandHistoryRef.current;
    const currentIndex = historyIndexRef.current;

    if (history.length === 0) return;

    let newIndex = currentIndex;

    if (direction === 'up') {
      newIndex = currentIndex === -1 ? history.length - 1 : Math.max(0, currentIndex - 1);
    } else {
      newIndex = currentIndex === -1 ? -1 : Math.min(history.length - 1, currentIndex + 1);
    }

    if (newIndex !== currentIndex) {
      setHistoryIndex(newIndex);

      // Clear current line
      terminal.write('\r\x1b[K');
      showPrompt(terminal);

      if (newIndex >= 0 && newIndex < history.length) {
        const cmd = history[newIndex];
        currentCommandRef.current = cmd;
        terminal.write(cmd);
      } else {
        currentCommandRef.current = '';
      }
    }
  };

  // Load command history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem(`rcon-history-${serverId}`);
    if (savedHistory) {
      try {
        setCommandHistory(JSON.parse(savedHistory));
      } catch (err) {
        console.error('Failed to load command history:', err);
      }
    }
  }, [serverId]);

  // Save command history to localStorage
  useEffect(() => {
    if (commandHistory.length > 0) {
      localStorage.setItem(`rcon-history-${serverId}`, JSON.stringify(commandHistory.slice(-100)));
    }
  }, [commandHistory, serverId]);

  // Parse players command response
  const parsePlayersResponse = (response: string): string[] => {
    // Players command typically returns format like:
    // "Players connected (3): player1, player2, player3"
    // or just "player1, player2, player3"
    // or line-by-line format
    const lines = response.split('\n').filter(line => line.trim());
    const playerList: string[] = [];

    for (const line of lines) {
      // Check for comma-separated format
      if (line.includes(',')) {
        const parts = line.split(':');
        const playersPart = parts.length > 1 ? parts[1] : parts[0];
        const names = playersPart.split(',').map(p => p.trim()).filter(p => p);
        playerList.push(...names);
      } else {
        // Single player per line (ignore header lines)
        const trimmed = line.trim();
        if (trimmed && !trimmed.toLowerCase().includes('players') && !trimmed.toLowerCase().includes('connected')) {
          playerList.push(trimmed);
        }
      }
    }

    return playerList;
  };

  // Quick action: Refresh player list
  const handleRefreshPlayers = useCallback(async () => {
    if (!isConnected) return;

    try {
      const response = await sendCommand('players');
      const playerList = parsePlayersResponse(response);
      setPlayers(playerList);

      // Also display in terminal
      const terminal = xtermRef.current;
      if (terminal) {
        terminal.writeln('');
        terminal.writeln(`\x1b[90mRefreshed player list (${playerList.length} online)\x1b[0m`);
        showPrompt(terminal);
      }
    } catch (err) {
      console.error('Failed to refresh players:', err);
    }
  }, [isConnected, sendCommand]);

  // Quick action: Kick player
  const handleKickPlayer = (playerName: string) => {
    const terminal = xtermRef.current;
    if (!terminal) return;

    // Pre-fill command in terminal
    const command = `kickuser "${playerName}"`;
    currentCommandRef.current = command;
    terminal.write('\r\x1b[K');
    showPrompt(terminal);
    terminal.write(command);
  };

  // Quick action: Ban player
  const handleBanPlayer = (playerName: string) => {
    const terminal = xtermRef.current;
    if (!terminal) return;

    // Pre-fill command in terminal
    const command = `banuser "${playerName}"`;
    currentCommandRef.current = command;
    terminal.write('\r\x1b[K');
    showPrompt(terminal);
    terminal.write(command);
  };

  // Quick action: Save world
  const handleSaveWorld = async () => {
    if (!isConnected) return;

    try {
      await sendCommand('save');

      const terminal = xtermRef.current;
      if (terminal) {
        terminal.writeln('');
        terminal.writeln('\x1b[1;32m✓ World saved\x1b[0m');
        showPrompt(terminal);
      }
    } catch (err) {
      console.error('Failed to save world:', err);
    }
  };

  // Quick action: Broadcast message
  const handleBroadcast = async () => {
    if (!isConnected || !broadcastMessage.trim()) return;

    try {
      await sendCommand(`servermsg "${broadcastMessage}"`);

      const terminal = xtermRef.current;
      if (terminal) {
        terminal.writeln('');
        terminal.writeln(`\x1b[1;32m✓ Broadcast sent: "${broadcastMessage}"\x1b[0m`);
        showPrompt(terminal);
      }

      setBroadcastMessage('');
      setShowBroadcastModal(false);
    } catch (err) {
      console.error('Failed to broadcast message:', err);
    }
  };

  // Auto-refresh players on connect
  useEffect(() => {
    if (isConnected) {
      handleRefreshPlayers();
    }
  }, [isConnected, handleRefreshPlayers]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '1200px',
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#252526',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#e5e5e5' }}>
              RCON Console - {serverName}
            </h2>
            <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#888' }}>
              {isConnected ? (
                <span style={{ color: '#0dbc79' }}>● Connected</span>
              ) : error ? (
                <span style={{ color: '#f14c4c' }}>● Disconnected</span>
              ) : (
                <span style={{ color: '#e5e510' }}>● Connecting...</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#e5e5e5',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#f14c4c')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#e5e5e5')}
          >
            ✕
          </button>
        </div>

        {/* Quick Actions & Player List */}
        <div style={{
          padding: '1rem 1.5rem',
          backgroundColor: '#1e1e1e',
          borderBottom: '1px solid #333',
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleRefreshPlayers}
              disabled={!isConnected}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: isConnected ? '#17a2b8' : '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isConnected ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                fontWeight: 'bold',
              }}
            >
              🔄 Refresh Players
            </button>
            <button
              onClick={handleSaveWorld}
              disabled={!isConnected}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: isConnected ? '#28a745' : '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isConnected ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                fontWeight: 'bold',
              }}
            >
              💾 Save World
            </button>
            <button
              onClick={() => setShowBroadcastModal(true)}
              disabled={!isConnected}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: isConnected ? '#fd7e14' : '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isConnected ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                fontWeight: 'bold',
              }}
            >
              📢 Broadcast Message
            </button>
          </div>

          {/* Player List */}
          {players.length > 0 ? (
            <div>
              <div style={{ marginBottom: '0.5rem', color: '#888', fontSize: '0.875rem' }}>
                Players Online ({players.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {players.map((player, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem',
                      backgroundColor: '#252526',
                      borderRadius: '4px',
                    }}
                  >
                    <span style={{ color: '#e5e5e5', fontSize: '0.875rem' }}>{player}</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleKickPlayer(player)}
                        disabled={!isConnected}
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: isConnected ? '#ffc107' : '#666',
                          color: '#000',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isConnected ? 'pointer' : 'not-allowed',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                        }}
                      >
                        Kick
                      </button>
                      <button
                        onClick={() => handleBanPlayer(player)}
                        disabled={!isConnected}
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: isConnected ? '#dc3545' : '#666',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isConnected ? 'pointer' : 'not-allowed',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                        }}
                      >
                        Ban
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: '#888', fontSize: '0.875rem', textAlign: 'center' }}>
              No players online
            </div>
          )}
        </div>

        {/* Terminal */}
        <div
          ref={terminalRef}
          style={{
            flex: 1,
            padding: '1rem',
            overflow: 'hidden',
            minHeight: 0, // Important for flex child to shrink correctly
          }}
        />

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1.5rem',
          borderTop: '1px solid #333',
          backgroundColor: '#252526',
          fontSize: '0.875rem',
          color: '#888',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Press Ctrl+L to clear | Ctrl+C to cancel</span>
            <span>↑↓ for command history</span>
          </div>
        </div>
      </div>

      {/* Broadcast Message Modal */}
      {showBroadcastModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: '#252526',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5)',
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#e5e5e5' }}>Broadcast Message</h3>
            <input
              type="text"
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleBroadcast();
                } else if (e.key === 'Escape') {
                  setShowBroadcastModal(false);
                  setBroadcastMessage('');
                }
              }}
              placeholder="Enter message to broadcast to all players..."
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                backgroundColor: '#1e1e1e',
                color: '#e5e5e5',
                border: '1px solid #333',
                borderRadius: '4px',
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowBroadcastModal(false);
                  setBroadcastMessage('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBroadcast}
                disabled={!broadcastMessage.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: broadcastMessage.trim() ? '#fd7e14' : '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: broadcastMessage.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
