import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserList } from '@/components/UserList';
import { RoleAssignmentsManager } from '@/components/RoleAssignmentsManager';
import type { UserAccount } from '@/lib/api';

export function UsersPage() {
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  const handleManagePermissions = (user: UserAccount) => {
    setSelectedUser(user);
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (selectedUser) {
    return (
      <RoleAssignmentsManager
        user={selectedUser}
        onBack={handleBackToUsers}
      />
    );
  }

  return (
    <UserList
      onBack={handleBack}
      onManagePermissions={handleManagePermissions}
    />
  );
}
