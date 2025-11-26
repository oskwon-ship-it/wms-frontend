import React from 'react';
import { Routes, Route } from 'react-router-dom';
// BrowserRouter(Router)는 main.jsx에 이미 있으므로 여기서 뺍니다.

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrderManagement from './pages/OrderManagement';

function App() {
  return (
    // <Router> 태그 제거됨
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/orders" element={<OrderManagement />} />
    </Routes>
    // </Router> 태그 제거됨
  );
}

export default App;