import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';

// Public pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';

// Protected pages
import Dashboard from '@/pages/Dashboard';
import Signals from '@/pages/Signals';
import Portfolio from '@/pages/Portfolio';

// ⛑ Forum importunu her iki export şekline dayanıklı yap
import * as ForumMod from '@/pages/Forum';
const Forum = (ForumMod as any).default ?? (ForumMod as any).Forum;

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected alan:
            1) ProtectedRoute → Outlet (auth kontrolü burada)
            2) Layout → Outlet (Navbar + içerik burada)
        */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/forum" element={<Forum />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;