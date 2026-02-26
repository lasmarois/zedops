import { useState } from 'react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Check, Palette, Lock, Bell, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { THEMES, getTheme, applyTheme } from '@/lib/theme';
import {
  changePassword,
  fetchNotificationPreferences,
  updateNotificationPreferences,
  fetchAgentNotificationOverrides,
  setAgentNotificationOverride,
  removeAgentNotificationOverride,
  type NotificationPreferences,
} from '@/lib/api';
import { useAgents } from '@/hooks/useAgents';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function SettingsPage() {
  const [activeTheme, setActiveTheme] = useState(getTheme);

  const handleThemeSelect = (themeId: string) => {
    applyTheme(themeId);
    setActiveTheme(themeId);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Settings' },
      ]} />

      {/* Appearance */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Appearance</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {THEMES.map((theme) => {
            const isActive = theme.id === activeTheme;
            return (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                className={cn(
                  'relative rounded-lg border-2 p-4 text-left transition-all duration-200',
                  'hover:scale-[1.02] hover:shadow-lg',
                  isActive
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border bg-card hover:border-muted-foreground/30'
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute top-2.5 right-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-primary">
                    <Check className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}

                {/* Color preview strip */}
                <div className="flex gap-2 mb-3">
                  {[theme.preview.background, theme.preview.primary, theme.preview.info, theme.preview.success].map((color, i) => (
                    <div
                      key={i}
                      className="h-8 flex-1 rounded-md border border-white/10"
                      style={{ backgroundColor: `hsl(${color})` }}
                    />
                  ))}
                </div>

                {/* Theme name & description */}
                <div className="font-medium text-sm text-card-foreground">{theme.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{theme.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <Separator />

      {/* Notifications */}
      <NotificationsSection />

      <Separator />

      {/* Account - Change Password */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Account</h2>
        </div>

        <Card className="max-w-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function NotificationsSection() {
  const queryClient = useQueryClient();
  const { data: agentsData } = useAgents();
  const agents = agentsData?.agents || [];

  const { data: prefs } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
  });

  const { data: overrides } = useQuery({
    queryKey: ['notification-overrides'],
    queryFn: fetchAgentNotificationOverrides,
  });

  const updateGlobal = useMutation({
    mutationFn: (update: Partial<NotificationPreferences>) =>
      updateNotificationPreferences(update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });

  const setOverride = useMutation({
    mutationFn: ({ agentId, prefs }: { agentId: string; prefs: { alertOffline: boolean; alertRecovery: boolean; alertUpdate: boolean } }) =>
      setAgentNotificationOverride(agentId, prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-overrides'] }),
  });

  const removeOverride = useMutation({
    mutationFn: (agentId: string) => removeAgentNotificationOverride(agentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-overrides'] }),
  });

  const overrideMap = new Map(
    (overrides || []).map(o => [o.agentId, o])
  );

  const isAgentMuted = (agentId: string) => {
    const override = overrideMap.get(agentId);
    if (override) return !override.alertOffline && !override.alertRecovery && !override.alertUpdate;
    return false;
  };

  const toggleAgentMute = (agentId: string) => {
    const muted = isAgentMuted(agentId);
    if (muted) {
      removeOverride.mutate(agentId);
    } else {
      setOverride.mutate({ agentId, prefs: { alertOffline: false, alertRecovery: false, alertUpdate: false } });
    }
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Notifications</h2>
      </div>

      <Card className="max-w-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Global Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Agent offline alerts</Label>
              <p className="text-xs text-muted-foreground">Email when an agent goes offline</p>
            </div>
            <Switch
              checked={prefs?.alertOffline ?? true}
              onCheckedChange={(checked) => updateGlobal.mutate({ alertOffline: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Recovery alerts</Label>
              <p className="text-xs text-muted-foreground">Email when an agent comes back online</p>
            </div>
            <Switch
              checked={prefs?.alertRecovery ?? true}
              onCheckedChange={(checked) => updateGlobal.mutate({ alertRecovery: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Agent update alerts</Label>
              <p className="text-xs text-muted-foreground">Email when an agent auto-updates to a new version</p>
            </div>
            <Switch
              checked={prefs?.alertUpdate ?? true}
              onCheckedChange={(checked) => updateGlobal.mutate({ alertUpdate: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {agents.length > 0 && (
        <Card className="max-w-lg mt-4">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Per-Agent Overrides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agents.map((agent) => {
              const muted = isAgentMuted(agent.id);
              return (
                <div key={agent.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'h-2 w-2 rounded-full',
                      agent.status === 'online' ? 'bg-green-500' : 'bg-muted-foreground/30'
                    )} />
                    <span className="text-sm">{agent.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAgentMute(agent.id)}
                    className={cn(muted && 'text-muted-foreground')}
                  >
                    {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </Button>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground pt-1">
              Muted agents will not send you any alert emails.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to change password',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'destructive'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="current-password">Current Password</Label>
        <Input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">
          Min 8 characters, 1 uppercase, 1 lowercase, 1 number
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Changing...' : 'Change Password'}
      </Button>
    </form>
  );
}
