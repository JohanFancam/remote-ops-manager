import Budget from './pages/Budget';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Budget": Budget,
    "Dashboard": Dashboard,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Budget",
    Pages: PAGES,
    Layout: __Layout,
};