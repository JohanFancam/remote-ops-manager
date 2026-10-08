import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import Earnings from './pages/Earnings'
import TeamSchedule from './pages/TeamSchedule'
import OperatorAvailability from './pages/OperatorAvailability'
import RigsCheck from './pages/RigsCheck'
import AccountsDashboard from './pages/AccountsDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import ChangePassword from './pages/ChangePassword';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { TimezoneProvider } from '@/components/TimezoneContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppSplash from '@/components/brand/AppSplash';
import { parseTheme } from '@/utils/theme';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

function mustChangePassword(user) {
  return user?.must_change_password === true || user?.must_change_password === 'true';
}

function SplashFromAuth() {
  const { appPublicSettings } = useAuth();
  const theme = parseTheme(appPublicSettings?.public_settings || {});
  return <AppSplash logoUrl={theme.logo} canvas={theme.canvas} />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <SplashFromAuth />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (!isAuthenticated || authError?.type === 'auth_required') {
    return <Navigate to="/login" replace />;
  }

  if (mustChangePassword(user)) {
    return <ChangePassword />;
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
      <Route path="/AccountsDashboard" element={<LayoutWrapper currentPageName="AccountsDashboard"><AccountsDashboard /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function BootGate({ children }) {
  const { isLoadingPublicSettings, isLoadingAuth } = useAuth();
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <SplashFromAuth />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <TimezoneProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <BootGate>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/*" element={<AuthenticatedApp />} />
            </Routes>
          </BootGate>
          <Toaster />
          <SonnerToaster />
        </Router>
      </QueryClientProvider>
      </TimezoneProvider>
    </AuthProvider>
  )
}

export default App
