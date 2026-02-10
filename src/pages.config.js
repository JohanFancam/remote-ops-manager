/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Budget from './pages/Budget';
import Dashboard from './pages/Dashboard';
import Debt from './pages/Debt';
import Projections from './pages/Projections';
import Purchases from './pages/Purchases';
import Settings from './pages/Settings';
import UserActivity from './pages/UserActivity';
import ShoppingList from './pages/ShoppingList';
import Calendar from './pages/Calendar';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Budget": Budget,
    "Dashboard": Dashboard,
    "Debt": Debt,
    "Projections": Projections,
    "Purchases": Purchases,
    "Settings": Settings,
    "UserActivity": UserActivity,
    "ShoppingList": ShoppingList,
    "Calendar": Calendar,
}

export const pagesConfig = {
    mainPage: "Budget",
    Pages: PAGES,
    Layout: __Layout,
};