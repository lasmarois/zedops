import { useNavigate } from 'react-router-dom';
import { AuditLogViewer } from '@/components/AuditLogViewer';

export function AuditLogsPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/dashboard');
  };

  return <AuditLogViewer onBack={handleBack} />;
}
