import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import Toast from './Toast';
const DashboardContext = createContext(null);
export function useDashboard() {
    const context = useContext(DashboardContext);
    if (!context)
        throw new Error('useDashboard must be used inside DashboardFrame');
    return context;
}
export default function DashboardFrame({ children }) {
    const [darkMode, setDarkMode] = useState(false);
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((toast) => {
        setToasts((current) => [...current, { ...toast, id: crypto.randomUUID() }]);
    }, []);
    const removeToast = useCallback((id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);
    const value = useMemo(() => ({ darkMode, addToast }), [darkMode, addToast]);
    const background = darkMode ? '#0F1117' : '#FAFAFA';
    return (<DashboardContext.Provider value={value}>
      <div className={darkMode ? 'dashboard-root dark' : 'dashboard-root'} style={{ minHeight: '100%', background }}>
        <div className="dashboard-toolbar">
          <div>
            <strong>VSN Builder</strong>
            <span> Shopify app dashboard</span>
          </div>
          <button type="button" className="dashboard-icon-button" onClick={() => setDarkMode((current) => !current)} aria-label={darkMode ? 'Use light mode' : 'Use dark mode'}>
            {darkMode ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
        </div>
        <main>{children}</main>
      </div>
      <Toast toasts={toasts} onRemove={removeToast} darkMode={darkMode}/>
    </DashboardContext.Provider>);
}
