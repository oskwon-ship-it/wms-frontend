import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrderManagement from './pages/OrderManagement'; // 1. 이 줄 추가!

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/orders" element={<OrderManagement />} /> {/* 2. 이 줄 추가! */}
      </Routes>
    </Router>
  );
}

export default App;