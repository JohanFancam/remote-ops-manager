import Budget from './pages/Budget';
import Dashboard from './pages/Dashboard';
import Purchases from './pages/Purchases';
import Settings from './pages/Settings';
import Projections from './pages/Projections';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Budget": Budget,
    "Dashboard": Dashboard,
    "Purchases": Purchases,
    "Settings": Settings,
    "Projections": Projections,
}

export const pagesConfig = {
    mainPage: "Budget",
    Pages: PAGES,
    Layout: __Layout,
};