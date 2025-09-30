import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';

// Public pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';

// Protected pages
import Dashboard from '@/pages/Dashboard';
import Signals from '@/pages/Signals';
import Portfolio from '@/pages/Portfolio';
import Forum from '@/pages/Forum';

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes inside layout */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="signals" element={<Signals />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="forum" element={<Forum />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
} 