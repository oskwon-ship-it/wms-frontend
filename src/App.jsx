import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrderManagement from './pages/OrderManagement';
import InventoryManagement from './pages/InventoryManagement';
import InventoryHistory from './pages/InventoryHistory'; // ★ 1. 추가

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/orders" element={<OrderManagement />} />
      <Route path="/inventory" element={<InventoryManagement />} />
      <Route path="/history" element={<InventoryHistory />} /> {/* ★ 2. 추가 */}
    </Routes>
  );
}

export default App;