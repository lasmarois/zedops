/**
 * User list component for managing users
 */

import { useState } from 'react';
import { useUsers, useDeleteUser, useInviteUser } from '../hooks/useUsers';
import { useUser } from '../contexts/UserContext';
import type { UserAccount } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

interface UserListProps {
  onBack: () => void;
  onManagePermissions: (user: UserAccount) => void;
}

export function UserList({ onBack, onManagePermissions }: UserListProps) {
  const { data, isLoading, error } = useUsers();
  const { user: currentUser } = useUser();
  const deleteUserMutation = useDeleteUser();
  const inviteUserMutation = useInviteUser();

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const result = await inviteUserMutation.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
      });

      if (result.success && result.invitation) {
        const inviteUrl = `${window.location.origin}/register?token=${result.invitation.token}`;
        setInviteToken(inviteUrl);
        setMessage({
          type: 'success',
          text: 'User invited successfully! Share the invitation link below.',
        });
        setInviteEmail('');
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to invite user',
      });
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user ${userEmail}?`)) {
      return;
    }

    try {
      await deleteUserMutation.mutateAsync(userId);
      setMessage({ type: 'success', text: 'User deleted successfully' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete user',
      });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-[80px]" />
            <Skeleton className="h-9 w-[250px]" />
          </div>
          <Skeleton className="h-10 w-[120px]" />
        </div>
        <Skeleton className="h-5 w-[150px] mb-4" />
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-[180px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[70px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Skeleton className="h-9 w-[100px]" />
                      <Skeleton className="h-9 w-[80px]" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
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

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onBack}>
            ← Back
          </Button>
          <h1 className="text-3xl font-bold">User Management</h1>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setShowInviteForm(!showInviteForm);
              setInviteToken(null);
              setMessage(null);
            }}
          >
            {showInviteForm ? 'Cancel' : '+ Invite User'}
          </Button>
        )}
      </div>

      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'destructive'} className="mb-4">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {showInviteForm && (
        <div className="bg-[#2d2d2d] p-6 rounded-lg mb-8">
          <h2 className="text-xl font-bold mb-4 mt-0">Invite New User</h2>
          <form onSubmit={handleInviteUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="bg-[#1a1a1a] border-[#444] text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-gray-300">
                Role
              </Label>
              <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as 'admin' | 'user')}>
                <SelectTrigger id="role" className="bg-[#1a1a1a] border-[#444] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={inviteUserMutation.isPending}
            >
              {inviteUserMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </Button>
          </form>

          {inviteToken && (
            <div className="mt-4 p-4 bg-[#1a1a1a] rounded-md">
              <p className="text-gray-300 mb-2">Invitation Link:</p>
              <code className="block p-2 bg-black text-success rounded-md overflow-x-auto text-sm">
                {inviteToken}
              </code>
              <Button
                size="sm"
                variant="success"
                onClick={() => {
                  navigator.clipboard.writeText(inviteToken);
                  setMessage({ type: 'success', text: 'Link copied to clipboard!' });
                }}
                className="mt-2"
              >
                Copy Link
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <p className="text-muted-foreground">Total users: {data?.users.length || 0}</p>
      </div>

      {data?.users.length === 0 ? (
        <div className="text-center p-8 bg-muted rounded-md">
          No users found.
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    {user.email}
                    {user.id === currentUser?.id && (
                      <Badge variant="default" className="ml-2">
                        You
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'}>
                      {user.role === 'admin' ? 'admin' : 'user'}
                    </Badge>
                    {!user.role && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (role assignments)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          onClick={() => onManagePermissions(user)}
                        >
                          Permissions
                        </Button>
                        {user.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            disabled={deleteUserMutation.isPending}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
