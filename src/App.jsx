import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import Earnings from './pages/Earnings'
import TeamSchedule from './pages/TeamSchedule'
import OperatorAvailability from './pages/OperatorAvailability'
import RigsCheck from './pages/RigsCheck'
import ShootDuration from './pages/ShootDuration'
import RigTestLog from './pages/RigTestLog';
import AccountsDashboard from './pages/AccountsDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-7 h-7 border-2 border-zinc-200 border-t-teal-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated || authError?.type === 'auth_required') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/Earnings" element={<LayoutWrapper currentPageName="Earnings"><Earnings /></LayoutWrapper>} />
      <Route path="/TeamSchedule" element={<LayoutWrapper currentPageName="TeamSchedule"><TeamSchedule /></LayoutWrapper>} />
      <Route path="/OperatorAvailability" element={<LayoutWrapper currentPageName="OperatorAvailability"><OperatorAvailability /></LayoutWrapper>} />
      <Route path="/RigsCheck" element={<LayoutWrapper currentPageName="RigsCheck"><RigsCheck /></LayoutWrapper>} />
      <Route path="/ShootDuration" element={<LayoutWrapper currentPageName="ShootDuration"><ShootDuration /></LayoutWrapper>} />
      <Route path="/RigTestLog" element={<LayoutWrapper currentPageName="RigTestLog"><RigTestLog /></LayoutWrapper>} />
      <Route path="/AccountsDashboard" element={<LayoutWrapper currentPageName="AccountsDashboard"><AccountsDashboard /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
