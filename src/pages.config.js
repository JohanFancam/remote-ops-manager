import Budget from './pages/Budget';
import Dashboard from './pages/Dashboard';
import Projections from './pages/Projections';
import Purchases from './pages/Purchases';
import Settings from './pages/Settings';
import UserActivity from './pages/UserActivity';
import Debt from './pages/Debt';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Budget": Budget,
    "Dashboard": Dashboard,
    "Projections": Projections,
    "Purchases": Purchases,
    "Settings": Settings,
    "UserActivity": UserActivity,
    "Debt": Debt,
}

export const pagesConfig = {
    mainPage: "Budget",
    Pages: PAGES,
    Layout: __Layout,
};