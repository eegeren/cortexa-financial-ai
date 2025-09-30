import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Spinner from '@/components/Spinner';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';

// Public pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';

// App pages (protected)
import Dashboard from '@/pages/Dashboard';
import Signals from '@/pages/Signals';
import Portfolio from '@/pages/Portfolio';
import Forum from '@/pages/Forum';

function App() {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<Spinner />}> {/* global suspense fallback */}
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected application with shared Layout (Navbar, etc.) */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/forum" element={<Forum />} />
          </Route>

          {/* Fallback to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

export default App;
