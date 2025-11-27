import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrderEntry from './pages/OrderEntry'; // 신규
import OrderProcessing from './pages/OrderProcessing'; // 신규
import InventoryManagement from './pages/InventoryManagement';
import InventoryHistory from './pages/InventoryHistory';
import InboundManagement from './pages/InboundManagement';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/order-entry" element={<OrderEntry />} /> 
      <Route path="/order-process" element={<OrderProcessing />} />
      <Route path="/inventory" element={<InventoryManagement />} />
      <Route path="/history" element={<InventoryHistory />} />
      <Route path="/inbound" element={<InboundManagement />} />
    </Routes>
  );
}

export default App;