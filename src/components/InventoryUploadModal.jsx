import React, { useState } from 'react';
import { Modal, Upload, Button, Table, message } from 'antd';
import { InboxOutlined, FileExcelOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient'; 

const { Dragger } = Upload;

const InventoryUploadModal = ({ isOpen, onClose, onUploadSuccess, customerName }) => {
  const [fileList, setFileList] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  const handleDownloadTemplate = () => {
      // ★ [수정] 양식에 '유통기한' 추가
      const headers = ['상품명', '바코드', '유통기한', '로케이션', '재고수량', '안전재고']; 
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "재고_등록_양식");
      XLSX.writeFile(wb, "WMS_재고_일괄등록_양식.xlsx");
      message.success('양식 파일 다운로드가 시작되었습니다!');
  };

  const handleFileRead = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // 날짜 형식을 읽기 위해 cellDates: true 옵션 추가 가능하나, 
      // 엑셀 날짜 서식 문제 방지를 위해 텍스트로 읽는 것을 권장합니다.
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false }); 
      setPreviewData(jsonData);
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const getValue = (item, headerName) => {
    if (!item) return null;
    const foundKey = Object.keys(item).find(key => key.trim() === headerName);
    return foundKey ? item[foundKey] : null;
  };

  const handleUpload = async () => {
    if (previewData.length === 0) {
      message.error('업로드할 데이터가 없습니다.');
      return;
    }
    
    if (!customerName) {
        message.error('로그인된 고객사 정보가 없습니다.');
        return;
    }

    setUploading(true);

    try {
      // 1. 엑셀 데이터 포맷팅
      const rawData = previewData.map(item => ({
        customer_name: customerName,
        product_name: getValue(item, '상품명'),
        barcode: String(getValue(item, '바코드')), 
        // ★ [추가] 유통기한 읽기 (없으면 null)
        expiration_date: getValue(item, '유통기한') || null,
        
        location: getValue(item, '로케이션'),
        quantity: Number(getValue(item, '재고수량')) || 0,
        safe_quantity: Number(getValue(item, '안전재고')) || 5,
        updated_at: new Date()
      })).filter(item => item.product_name && item.barcode);

      // 2. 중복 합치기 로직 수정 (바코드 + 유통기한 기준)
      const uniqueMap = new Map();

      rawData.forEach(item => {
          // ★ [수정] 키 생성: 고객사 + 바코드 + 유통기한
          // 유통기한이 없으면 'no-date'로 처리해서 묶음
          const expiryKey = item.expiration_date || 'no-date';
          const key = `${item.customer_name}_${item.barcode}_${expiryKey}`;

          if (uniqueMap.has(key)) {
              const existing = uniqueMap.get(key);
              existing.quantity += item.quantity;
              existing.location = item.location || existing.location;
          } else {
              uniqueMap.set(key, item);
          }
      });

      const finalData = Array.from(uniqueMap.values());

      // 3. DB 전송 (Upsert 기준 변경)
      // ★ [수정] onConflict 기준에 expiration_date 추가
      const { error } = await supabase
        .from('inventory')
        .upsert(finalData, { onConflict: 'customer_name,barcode,expiration_date' });

      if (error) throw error;

      message.success(`총 ${finalData.length}종(유통기한별)의 품목이 등록되었습니다.`);
      setFileList([]);
      setPreviewData([]);
      onUploadSuccess(); 
      onClose();
    } catch (error) {
      console.error(error);
      message.error('등록 실패: ' + error.message); 
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title="재고 엑셀 일괄 등록"
      open={isOpen}
      onCancel={onClose}
      width={900} // 모달 넓이 조금 더 넓힘
      footer={[
        <Button key="back" onClick={onClose}>취소</Button>,
        <Button key="submit" type="primary" loading={uploading} onClick={handleUpload} disabled={previewData.length === 0}>
            일괄 등록하기
        </Button>
      ]}
    >
      <Button onClick={handleDownloadTemplate} style={{ marginBottom: 15 }} icon={<FileExcelOutlined />}>
          재고 양식 다운로드 (유통기한 포함)
      </Button>
      
      <Dragger accept=".xlsx, .xls" beforeUpload={handleFileRead} fileList={fileList} onRemove={() => { setFileList([]); setPreviewData([]); }} maxCount={1}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">재고 엑셀 파일을 여기에 놓으세요</p>
        <p className="ant-upload-hint">상품명, 바코드 필수. (같은 바코드라도 유통기한이 다르면 따로 등록됩니다)</p>
      </Dragger>

      {previewData.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4>미리보기 (상위 5개)</h4>
          <Table 
            dataSource={previewData.slice(0, 5)} 
            columns={Object.keys(previewData[0]).map(key => ({ title: key, dataIndex: key }))} 
            pagination={false} 
            size="small" 
            rowKey={(r) => Math.random()} 
          />
        </div>
      )}
    </Modal>
  );
};

export default InventoryUploadModal;