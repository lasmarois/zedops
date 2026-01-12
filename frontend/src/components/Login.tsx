/**
 * Login Component
 *
 * Email and password login form for JWT-based authentication.
 */

import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function Login() {
  const { login } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Store token and user info
      login(data.token, data.user);

      // Reload page to reinitialize app with authenticated state
      window.location.href = '/';
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error - please try again');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#1a1a1a',
      }}
    >
      <div
        style={{
          backgroundColor: '#2d2d2d',
          padding: '2rem',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        }}
      >
        <h1
          style={{
            color: '#fff',
            fontSize: '1.5rem',
            marginBottom: '0.5rem',
            textAlign: 'center',
          }}
        >
          ZedOps Manager
        </h1>
        <p
          style={{
            color: '#888',
            fontSize: '0.875rem',
            marginBottom: '2rem',
            textAlign: 'center',
          }}
        >
          Sign in to your account
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                color: '#ccc',
                fontSize: '0.875rem',
                marginBottom: '0.5rem',
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                color: '#ccc',
                fontSize: '0.875rem',
                marginBottom: '0.5rem',
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
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                backgroundColor: '#dc3545',
                color: '#fff',
                padding: '0.75rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: loading ? '#555' : '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#0056b3';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#007bff';
              }
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #444',
            color: '#888',
            fontSize: '0.75rem',
            textAlign: 'center',
          }}
        >
          <p>
            First time? Contact your administrator for an invitation.
          </p>
        </div>
      </div>
    </div>
  );
}
