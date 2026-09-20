import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './styles/global.css';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ReportPage from './pages/ReportPage';
import MapPage from './pages/MapPage';
import MunicipalityPage from './pages/MunicipalityPage';
import SustainabilityPage from './pages/SustainabilityPage';
import ReportDetailPage from './pages/ReportDetailPage';
import Layout from './components/common/Layout';

const ProtectedRoute = ({ children, roles }) => {
  const { isAuth, user, loading } = useAuth();
  if (loading) return <div className="fullscreen-loader"><div className="spinner" /></div>;
  if (!isAuth) return <Navigate to="/login" />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" />;
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<Layout />}>
              <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
              <Route path="report/:id" element={<ProtectedRoute><ReportDetailPage /></ProtectedRoute>} />
              <Route path="map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
              <Route path="municipality" element={<ProtectedRoute roles={['municipality','admin']}><MunicipalityPage /></ProtectedRoute>} />
              <Route path="sustainability" element={<ProtectedRoute><SustainabilityPage /></ProtectedRoute>} />
            </Route>
          </Routes>
          <ToastContainer position="top-right" theme="colored" autoClose={3000} />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
