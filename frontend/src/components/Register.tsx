/**
 * Registration component for accepting user invitations
 */

import { useState, useEffect } from 'react';
import { acceptInvitation, verifyInvitationToken } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function Register() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Parse token from URL
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('token');

    if (!inviteToken) {
      setError('Invalid invitation link - no token provided');
      setIsVerifying(false);
      return;
    }

    setToken(inviteToken);

    // Verify token with backend
    verifyInvitationToken(inviteToken)
      .then((data) => {
        if (data.valid && data.invitation) {
          setEmail(data.invitation.email);
          setRole(data.invitation.role);
          setError(null);
        } else {
          setError(data.error || 'Invalid or expired invitation');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to verify invitation');
      })
      .finally(() => {
        setIsVerifying(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!token) {
      setError('Invalid invitation token');
      return;
    }

    setIsLoading(true);

    try {
      await acceptInvitation(token, password);
      setIsSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d1117]">
        <div className="text-center text-white">
          <p>Verifying invitation...</p>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d1117]">
        <Card className="w-full max-w-md bg-[#161b22] border-[#30363d]">
          <CardContent className="pt-6 text-center space-y-2">
            <h2 className="text-2xl font-bold text-success">✓ Account Created!</h2>
            <p className="text-gray-300">Your account has been created successfully.</p>
            <p className="text-gray-300">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid invitation state
  if (error && !token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d1117]">
        <Card className="w-full max-w-md bg-[#161b22] border-[#30363d]">
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-2xl font-bold text-destructive">Invalid Invitation</h2>
            <p className="text-gray-300">{error}</p>
            <Button onClick={() => (window.location.href = '/')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Registration form
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0d1117]">
      <Card className="w-full max-w-md bg-[#161b22] border-[#30363d]">
        <CardHeader>
          <CardTitle className="text-white">Complete Registration</CardTitle>
          <CardDescription className="text-gray-400">
            You've been invited to join ZedOps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {email && (
            <div className="p-3 bg-[#0d1117] rounded-md space-y-2">
              <div>
                <p className="text-xs text-gray-400">Email:</p>
                <p className="text-white font-bold">{email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Role:</p>
                <p className="text-info font-bold capitalize">{role}</p>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Enter your password (min 8 characters)"
                className="bg-[#0d1117] border-[#30363d] text-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-300">
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Confirm your password"
                className="bg-[#0d1117] border-[#30363d] text-gray-300"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              variant="success"
              className="w-full"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
