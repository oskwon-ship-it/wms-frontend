import React from 'react';
import { Routes, Route } from 'react-router-dom';

// 페이지 파일들 불러오기
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrderManagement from './pages/OrderManagement';
import InventoryManagement from './pages/InventoryManagement'; // ★ 1. 이 줄이 꼭 있어야 합니다!

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/orders" element={<OrderManagement />} />
      
      {/* ★ 2. 이 줄이 있어야 화면이 나옵니다! */}
      <Route path="/inventory" element={<InventoryManagement />} /> 
    </Routes>
  );
}

export default App;