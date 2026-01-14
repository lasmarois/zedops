/**
 * RCON Terminal Component
 * Provides an interactive terminal for server administration via RCON
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useRcon } from '../hooks/useRcon';
import '@xterm/xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RconTerminalProps {
  agentId: string;
  serverId: string;
  serverName: string;
  containerID: string;
  rconPort: number;
  rconPassword: string;   // Server's RCON_PASSWORD for RCON connection
  onClose: () => void;
  embedded?: boolean;     // If true, renders inline; if false/undefined, renders as overlay
}

export function RconTerminal({
  agentId,
  serverId,
  serverName,
  containerID,
  rconPort,
  rconPassword,
  onClose,
  embedded = false,
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

  // Badge color styling for better contrast (matching AgentList improvements)
  const getBadgeStyle = (state: 'success' | 'destructive' | 'warning'): string => {
    switch (state) {
      case 'success':
        return 'bg-green-600 text-white border-green-700';
      case 'warning':
        return 'bg-orange-600 text-white border-orange-700';
      case 'destructive':
        return 'bg-red-700 text-white border-red-800';
      default:
        return 'bg-gray-600 text-white border-gray-700';
    }
  };

  const getConnectionBadge = () => {
    if (isConnected) {
      return <Badge className={getBadgeStyle('success')}>● Connected</Badge>;
    } else if (error) {
      return <Badge className={getBadgeStyle('destructive')}>● Disconnected</Badge>;
    } else {
      return <Badge className={getBadgeStyle('warning')}>● Connecting...</Badge>;
    }
  };

  // Main content JSX (used in both embedded and overlay modes)
  const terminalContent = (
    <>
      {/* Header */}
      <div className="p-4 px-6 border-b border-[#333] flex justify-between items-center bg-[#252526] rounded-t-lg">
        <div>
          <h2 className="m-0 text-xl text-[#e5e5e5]">
            RCON Console - {serverName}
          </h2>
          <div className="mt-1 text-sm">
            {getConnectionBadge()}
          </div>
        </div>
        {!embedded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-2xl hover:text-destructive"
          >
            ✕
          </Button>
        )}
      </div>

        {/* Quick Actions & Player List */}
        <div className="p-4 px-6 bg-[#1e1e1e] border-b border-[#333] max-h-[200px] overflow-y-auto">
          {/* Quick Action Buttons */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Button
              variant="info"
              size="sm"
              onClick={handleRefreshPlayers}
              disabled={!isConnected}
            >
              🔄 Refresh Players
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={handleSaveWorld}
              disabled={!isConnected}
            >
              💾 Save World
            </Button>
            <Button
              variant="warning"
              size="sm"
              onClick={() => setShowBroadcastModal(true)}
              disabled={!isConnected}
            >
              📢 Broadcast Message
            </Button>
          </div>

          {/* Player List */}
          {players.length > 0 ? (
            <div>
              <div className="mb-2 text-muted-foreground text-sm">
                Players Online ({players.length}):
              </div>
              <div className="flex flex-col gap-2">
                {players.map((player, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-2 bg-[#252526] rounded"
                  >
                    <span className="text-[#e5e5e5] text-sm">{player}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="warning"
                        size="sm"
                        onClick={() => handleKickPlayer(player)}
                        disabled={!isConnected}
                        className="h-7 px-3 text-xs"
                      >
                        Kick
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleBanPlayer(player)}
                        disabled={!isConnected}
                        className="h-7 px-3 text-xs"
                      >
                        Ban
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center">
              No players online
            </div>
          )}
        </div>

        {/* Terminal */}
        <div
          ref={terminalRef}
          className="flex-1 p-4 overflow-hidden min-h-0"
        />

      {/* Footer */}
      <div className="p-3 px-6 border-t border-[#333] bg-[#252526] text-sm text-muted-foreground rounded-b-lg">
        <div className="flex justify-between">
          <span>Press Ctrl+L to clear | Ctrl+C to cancel</span>
          <span>↑↓ for command history</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {embedded ? (
        // Embedded mode: renders inline in parent container
        <div className="bg-[#1e1e1e] rounded-lg w-full h-[calc(100vh-300px)] flex flex-col shadow-lg">
          {terminalContent}
        </div>
      ) : (
        // Overlay mode: full-screen fixed overlay with backdrop
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/80">
          <div className="bg-[#1e1e1e] rounded-lg w-full max-w-[1200px] h-[80vh] flex flex-col shadow-2xl">
            {terminalContent}
          </div>
        </div>
      )}

      {/* Broadcast Message Dialog */}
      <Dialog open={showBroadcastModal} onOpenChange={setShowBroadcastModal}>
        <DialogContent className="bg-[#252526] text-[#e5e5e5] max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-[#e5e5e5]">Broadcast Message</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Send a message to all players on the server
            </DialogDescription>
          </DialogHeader>
          <Input
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
            className="bg-[#1e1e1e] text-[#e5e5e5] border-[#333]"
          />
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setShowBroadcastModal(false);
                setBroadcastMessage('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="warning"
              onClick={handleBroadcast}
              disabled={!broadcastMessage.trim()}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
