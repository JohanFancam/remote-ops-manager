/**
 * pages.config.js - Page routing configuration
 */
import Accounts from './pages/Accounts.jsx';
import AppFaults from './pages/AppFaults.jsx';
import Calendar from './pages/Calendar';
import Dashboard from './pages/Dashboard.jsx';
import Notifications from './pages/Notifications.jsx';
import OperatorGuide from './pages/OperatorGuide.jsx';
import Reports from './pages/Reports';
import RigChecks from './pages/RigChecks';
import Rigs from './pages/Rigs';
import Settings from './pages/Settings';
import Shoots from './pages/Shoots';
import Timesheets from './pages/Timesheets';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Accounts": Accounts,
    "AppFaults": AppFaults,
    "Calendar": Calendar,
    "Dashboard": Dashboard,
    "Notifications": Notifications,
    "OperatorGuide": OperatorGuide,
    "Reports": Reports,
    "RigChecks": RigChecks,
    "Rigs": Rigs,
    "Settings": Settings,
    "Shoots": Shoots,
    "Timesheets": Timesheets,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};