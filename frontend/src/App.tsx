/**
 * Main ZedOps application
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { Login } from './components/Login';
import { AgentList } from './components/AgentList';

const queryClient = new QueryClient();

function App() {
  const password = useAuthStore((state) => state.password);

  return (
    <QueryClientProvider client={queryClient}>
      {password ? <AgentList /> : <Login />}
    </QueryClientProvider>
  );
}

export default App;
