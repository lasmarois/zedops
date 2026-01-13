/**
 * Role Assignments Manager Component
 *
 * Manages user role assignments using the new RBAC system.
 * Replaces the old PermissionsManager with role-based assignments.
 */

import { useState } from 'react';
import {
  useUserRoleAssignments,
  useGrantRoleAssignment,
  useRevokeRoleAssignment,
} from '../hooks/useUsers';
import { useAgents } from '../hooks/useAgents';
import type { UserAccount, RoleAssignment } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RoleAssignmentsManagerProps {
  user: UserAccount;
  onBack: () => void;
}

export function RoleAssignmentsManager({ user, onBack }: RoleAssignmentsManagerProps) {
  const { data, isLoading, error } = useUserRoleAssignments(user.id);
  const { data: agentsData } = useAgents();
  const grantMutation = useGrantRoleAssignment();
  const revokeMutation = useRevokeRoleAssignment();

  const [showGrantForm, setShowGrantForm] = useState(false);
  const [role, setRole] = useState<'agent-admin' | 'operator' | 'viewer'>('viewer');
  const [scope, setScope] = useState<'global' | 'agent' | 'server'>('agent');
  const [resourceId, setResourceId] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGrantRoleAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // Validate constraints
    if (role === 'agent-admin' && scope !== 'agent') {
      setMessage({
        type: 'error',
        text: 'agent-admin role can only be assigned at agent scope',
      });
      return;
    }

    if (scope === 'global' && resourceId) {
      setMessage({
        type: 'error',
        text: 'global scope cannot have a resource ID',
      });
      return;
    }

    if (scope !== 'global' && !resourceId) {
      setMessage({
        type: 'error',
        text: `${scope} scope requires a resource ID`,
      });
      return;
    }

    try {
      await grantMutation.mutateAsync({
        userId: user.id,
        role,
        scope,
        resourceId: scope === 'global' ? null : resourceId || null,
      });
      setMessage({ type: 'success', text: 'Role assignment granted successfully' });
      setShowGrantForm(false);
      setResourceId('');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to grant role assignment',
      });
    }
  };

  const handleRevokeRoleAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to revoke this role assignment?')) {
      return;
    }

    try {
      await revokeMutation.mutateAsync({ assignmentId, userId: user.id });
      setMessage({ type: 'success', text: 'Role assignment revoked successfully' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to revoke role assignment',
      });
    }
  };

  const getResourceName = (assignment: RoleAssignment) => {
    if (assignment.scope === 'global') {
      return 'Global (all agents & servers)';
    }
    if (assignment.scope === 'agent' && assignment.resource_id) {
      const agent = agentsData?.agents.find((a) => a.id === assignment.resource_id);
      return agent ? `Agent: ${agent.name}` : `Agent: ${assignment.resource_id}`;
    }
    if (assignment.scope === 'server' && assignment.resource_id) {
      return `Server: ${assignment.resource_id}`;
    }
    return assignment.scope;
  };

  const formatRole = (role: string) => {
    const roleNames: Record<string, string> = {
      'agent-admin': 'Agent Admin',
      'operator': 'Operator',
      'viewer': 'Viewer',
    };
    return roleNames[role] || role;
  };

  const getRoleBadgeVariant = (role: string): 'success' | 'default' | 'secondary' => {
    const variants: Record<string, 'success' | 'default' | 'secondary'> = {
      'agent-admin': 'success',
      'operator': 'default',
      'viewer': 'secondary',
    };
    return variants[role] || 'secondary';
  };

  if (isLoading) {
    return <div className="p-8">Loading role assignments...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Error: {error.message}</AlertDescription>
        </Alert>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onBack}>
            ← Back
          </Button>
          <h1 className="text-3xl font-bold">Role Assignments for {user.email}</h1>
        </div>
        <Button
          onClick={() => {
            setShowGrantForm(!showGrantForm);
            setMessage(null);
          }}
        >
          {showGrantForm ? 'Cancel' : '+ Grant Role'}
        </Button>
      </div>

      {/* System Role Badge */}
      {data?.user.systemRole === 'admin' && (
        <Alert variant="success" className="mb-4">
          <AlertDescription>
            <strong>System Admin:</strong> This user has global admin access and bypasses all permission checks.
            Role assignments are not needed.
          </AlertDescription>
        </Alert>
      )}

      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'destructive'} className="mb-4">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {showGrantForm && (
        <div className="bg-[#2d2d2d] p-6 rounded-lg mb-8">
          <h2 className="text-xl font-bold mb-4 mt-0">Grant New Role Assignment</h2>
          <form onSubmit={handleGrantRoleAssignment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role" className="text-gray-300">
                Role
              </Label>
              <Select
                value={role}
                onValueChange={(val) => {
                  setRole(val as 'agent-admin' | 'operator' | 'viewer');
                  // Reset scope if agent-admin (must be agent scope)
                  if (val === 'agent-admin' && scope !== 'agent') {
                    setScope('agent');
                  }
                }}
              >
                <SelectTrigger id="role" className="bg-[#1a1a1a] border-[#444] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                  <SelectItem value="operator">Operator (control + RCON)</SelectItem>
                  <SelectItem value="agent-admin">Agent Admin (full control of agent)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === 'viewer' && 'Can view servers and logs'}
                {role === 'operator' && 'Can start/stop/restart servers and use RCON'}
                {role === 'agent-admin' && 'Can create/delete servers on assigned agent'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope" className="text-gray-300">
                Scope
              </Label>
              <Select
                value={scope}
                onValueChange={(val) => {
                  setScope(val as 'global' | 'agent' | 'server');
                  setResourceId('');
                }}
                disabled={role === 'agent-admin'}
              >
                <SelectTrigger
                  id="scope"
                  className="bg-[#1a1a1a] border-[#444] text-white"
                  disabled={role === 'agent-admin'}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (all agents & servers)</SelectItem>
                  <SelectItem value="agent">Agent (all servers on agent)</SelectItem>
                  <SelectItem value="server">Server (specific server only)</SelectItem>
                </SelectContent>
              </Select>
              {role === 'agent-admin' && (
                <p className="text-xs text-warning">
                  agent-admin role can only be assigned at agent scope
                </p>
              )}
            </div>

            {scope !== 'global' && (
              <div className="space-y-2">
                <Label htmlFor="resourceId" className="text-gray-300">
                  {scope === 'agent' ? 'Agent' : 'Server ID'}
                </Label>
                {scope === 'agent' ? (
                  <Select value={resourceId} onValueChange={setResourceId}>
                    <SelectTrigger id="resourceId" className="bg-[#1a1a1a] border-[#444] text-white">
                      <SelectValue placeholder="Select an agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agentsData?.agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name} ({agent.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="resourceId"
                    type="text"
                    value={resourceId}
                    onChange={(e) => setResourceId(e.target.value)}
                    placeholder="Enter server ID"
                    required
                    className="bg-[#1a1a1a] border-[#444] text-white"
                  />
                )}
              </div>
            )}

            <Button type="submit" disabled={grantMutation.isPending}>
              {grantMutation.isPending ? 'Granting...' : 'Grant Role'}
            </Button>
          </form>
        </div>
      )}

      <div className="mb-4">
        <p className="text-muted-foreground">
          Total role assignments: {data?.roleAssignments.length || 0}
        </p>
      </div>

      {data?.roleAssignments && data.roleAssignments.length > 0 ? (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.roleAssignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(assignment.role)}>
                      {formatRole(assignment.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{assignment.scope}</TableCell>
                  <TableCell>{getResourceName(assignment)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRevokeRoleAssignment(assignment.id)}
                      disabled={revokeMutation.isPending}
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center p-8 bg-muted rounded-md">
          No role assignments yet. Click "Grant Role" to add one.
          {data?.user.systemRole !== 'admin' && (
            <>
              <br />
              <br />
              <span className="text-sm text-warning">
                This user has no access until roles are assigned.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
