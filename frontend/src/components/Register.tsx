/**
 * Registration component for accepting user invitations
 */

import { useState, useEffect } from 'react';
import { acceptInvitation, verifyInvitationToken } from '../lib/api';

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

  if (isVerifying) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#0d1117',
        }}
      >
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <p>Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#0d1117',
        }}
      >
        <div
          style={{
            backgroundColor: '#161b22',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            width: '400px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ color: '#28a745', marginBottom: '1rem' }}>✓ Account Created!</h2>
          <p style={{ color: '#ccc' }}>Your account has been created successfully.</p>
          <p style={{ color: '#ccc' }}>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (error && !token) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#0d1117',
        }}
      >
        <div
          style={{
            backgroundColor: '#161b22',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            width: '400px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ color: '#dc3545', marginBottom: '1rem' }}>Invalid Invitation</h2>
          <p style={{ color: '#ccc', marginBottom: '1.5rem' }}>{error}</p>
          <button
            onClick={() => (window.location.href = '/')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#0d1117',
      }}
    >
      <div
        style={{
          backgroundColor: '#161b22',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          width: '400px',
        }}
      >
        <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>Complete Registration</h2>
        <p style={{ color: '#8b949e', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          You've been invited to join ZedOps
        </p>

        {email && (
          <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: '#0d1117', borderRadius: '4px' }}>
            <p style={{ color: '#8b949e', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Email:</p>
            <p style={{ color: '#fff', fontWeight: 'bold' }}>{email}</p>
            <p style={{ color: '#8b949e', fontSize: '0.875rem', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
              Role:
            </p>
            <p style={{ color: '#58a6ff', fontWeight: 'bold', textTransform: 'capitalize' }}>{role}</p>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              borderRadius: '4px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#c9d1d9',
                fontSize: '0.875rem',
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Enter your password (min 8 characters)"
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#c9d1d9',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="confirmPassword"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#c9d1d9',
                fontSize: '0.875rem',
              }}
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Confirm your password"
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#c9d1d9',
                fontSize: '14px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: isLoading ? '#6c757d' : '#238636',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
