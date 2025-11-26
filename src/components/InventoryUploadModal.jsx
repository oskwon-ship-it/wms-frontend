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
      const headers = ['상품명', '바코드', '로케이션', '재고수량', '안전재고']; 
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "재고_등록_양식");
      XLSX.writeFile(wb, "WMS_재고_일괄등록_양식.xlsx");
  };

  const handleFileRead = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
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
      const formattedData = previewData.map(item => ({
        customer_name: customerName,
        product_name: getValue(item, '상품명'),
        barcode: String(getValue(item, '바코드')), // 바코드는 문자로 변환
        location: getValue(item, '로케이션'),
        quantity: getValue(item, '재고수량') || 0,
        safe_quantity: getValue(item, '안전재고') || 5,
        updated_at: new Date()
      })).filter(item => item.product_name && item.barcode); // 필수값 없는 행 제거

      // upsert: 바코드+고객사가 같으면 업데이트, 없으면 추가
      const { error } = await supabase
        .from('inventory')
        .upsert(formattedData, { onConflict: 'customer_name, barcode' });

      if (error) throw error;

      message.success(`${formattedData.length}건의 재고가 등록/수정되었습니다.`);
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
      width={800}
      footer={[
        <Button key="back" onClick={onClose}>취소</Button>,
        <Button key="submit" type="primary" loading={uploading} onClick={handleUpload} disabled={previewData.length === 0}>
            일괄 등록하기
        </Button>
      ]}
    >
      <Button onClick={handleDownloadTemplate} style={{ marginBottom: 15 }} icon={<FileExcelOutlined />}>
          재고 양식 다운로드
      </Button>
      
      <Dragger accept=".xlsx, .xls" beforeUpload={handleFileRead} fileList={fileList} onRemove={() => { setFileList([]); setPreviewData([]); }} maxCount={1}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">재고 엑셀 파일을 여기에 놓으세요</p>
        <p className="ant-upload-hint">상품명, 바코드는 필수입니다. (중복 시 수량이 업데이트됩니다)</p>
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