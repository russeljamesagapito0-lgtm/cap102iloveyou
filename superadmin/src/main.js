import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import ToastContainer from './components/ToastContainer';
import './index.css';
import './styles/colors.css';
import './styles/components.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
            <ToastContainer />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </ThemeProvider>
);