import React, { useState } from 'react';
import { Modal, Upload, Button, Table, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient'; // ★ 여기 중괄호 { } 추가됨!

const { Dragger } = Upload;

const ExcelUploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const [fileList, setFileList] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [uploading, setUploading] = useState(false);

  // 1. 엑셀 파일 읽기
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

  // 2. Supabase에 저장하기
  const handleUpload = async () => {
    if (previewData.length === 0) {
      message.error('업로드할 데이터가 없습니다.');
      return;
    }

    setUploading(true);

    try {
      // 엑셀 한글 제목 -> DB 영어 컬럼명 변환
      const formattedData = previewData.map(item => ({
        customer_name: item['고객사'],
        barcode: item['바코드'],
        product_name: item['상품명'],
        created_at: new Date()
      }));

      const { error } = await supabase
        .from('orders')
        .insert(formattedData);

      if (error) throw error;

      message.success(`${previewData.length}건 등록 성공!`);
      setFileList([]);
      setPreviewData([]);
      onUploadSuccess(); 
      onClose();
    } catch (error) {
      console.error(error);
      message.error('에러 발생: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title="주문 엑셀 일괄 등록"
      open={isOpen}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="back" onClick={onClose}>취소</Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={uploading} 
          onClick={handleUpload}
          disabled={previewData.length === 0}
        >
          등록하기
        </Button>
      ]}
    >
      <Dragger
        accept=".xlsx, .xls"
        beforeUpload={handleFileRead}
        fileList={fileList}
        onRemove={() => { setFileList([]); setPreviewData([]); }}
        maxCount={1}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">파일을 여기로 드래그하세요</p>
        <p className="ant-upload-hint">필수 컬럼: 고객사, 바코드, 상품명</p>
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

export default ExcelUploadModal;