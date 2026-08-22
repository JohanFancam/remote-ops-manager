/**
 * pages.config.js - Page routing configuration
 */
import Accounts from './pages/Accounts.jsx';
import Calendar from './pages/Calendar';
import Dashboard from './pages/Dashboard.jsx';
import Reports from './pages/Reports';
import Rigs from './pages/Rigs';
import Settings from './pages/Settings';
import Shoots from './pages/Shoots';
import Timesheets from './pages/Timesheets';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Accounts": Accounts,
    "Calendar": Calendar,
    "Dashboard": Dashboard,
    "Reports": Reports,
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