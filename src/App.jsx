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
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Lightweight inline loading indicator while checking app public settings or auth — no full-screen overlay
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="flex items-center justify-center pt-24">
        <div className="w-6 h-6 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
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
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App