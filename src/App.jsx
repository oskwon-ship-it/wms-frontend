import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// ★ 파일 경로가 다르면 이 부분을 수정해야 합니다. 
// (보통 src/pages 폴더 안에 파일들이 있습니다)
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrderEntry from './pages/OrderEntry';
import OrderProcessing from './pages/OrderProcessing';
import InventoryManagement from './pages/InventoryManagement';
import InventoryHistory from './pages/InventoryHistory';
import InboundManagement from './pages/InboundManagement';

const App = () => {
  return (
    <Routes>
      {/* 1. 기본 주소(/)로 들어오면 로그인 페이지로 이동 */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* 2. 로그인 페이지 */}
      <Route path="/login" element={<Login />} />

      {/* 3. 대시보드 */}
      <Route path="/dashboard" element={<Dashboard />} />

      {/* 4. 주문 접수 (에러 해결 핵심!) */}
      {/* 메뉴에서 /orders로 가든, /order-entry로 가든 에러 없이 페이지를 보여줍니다 */}
      <Route path="/order-entry" element={<OrderEntry />} />
      <Route path="/orders" element={<OrderEntry />} />

      {/* 5. 송장/출고 관리 (관리자용) */}
      <Route path="/order-process" element={<OrderProcessing />} />

      {/* 6. 재고 관리 */}
      <Route path="/inventory" element={<InventoryManagement />} />
      <Route path="/history" element={<InventoryHistory />} />

      {/* 7. 입고 관리 */}
      <Route path="/inbound" element={<InboundManagement />} />

      {/* 8. 없는 페이지 처리 (404) */}
      <Route path="*" element={<div style={{ padding: '50px', textAlign: 'center' }}><h2>🚫 페이지를 찾을 수 없습니다.</h2><p>주소를 확인해주세요.</p></div>} />
    </Routes>
  );
};

export default App;