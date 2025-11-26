import React, { useState } from 'react';
import { Modal, Upload, Button, Table, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient'; 

const { Dragger } = Upload;

// customerName을 부모 컴포넌트(Dashboard)로부터 받아옵니다.
const ExcelUploadModal = ({ isOpen, onClose, onUploadSuccess, customerName }) => {
  const [fileList, setFileList] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // 1. 양식 다운로드 함수
  const handleDownloadTemplate = () => {
      // 고객사는 자동입력 되므로 엑셀 양식에서 제외
      const headers = ['바코드', '상품명', '수량', '수취인명', '연락처', '배송지 주소']; 
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "주문_양식");
      
      XLSX.writeFile(wb, "WMS_주문_대량등록_양식.xlsx");
      message.success('양식 파일 다운로드가 시작되었습니다!');
  };

  // 2. 엑셀 파일 읽기 함수
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
    return false; // 자동 업로드 방지
  };

  // 3. Supabase에 저장하기 함수
  const handleUpload = async () => {
    if (previewData.length === 0) {
      message.error('업로드할 데이터가 없습니다.');
      return;
    }
    
    // 로그인된 고객사 정보가 없으면 방어
    if (!customerName) {
        message.error('로그인된 고객사 정보가 없습니다. 관리자에게 문의하세요.');
        return;
    }

    setUploading(true);

    try {
      // 엑셀 데이터를 DB 컬럼명에 맞춰 변환
      const formattedData = previewData.map(item => ({
        // ★★★ [중요] DB 컬럼명 'customer'에 현재 로그인한 고객사 이름 주입
        customer: customerName, 
        
        // ★★★ [중요] DB 컬럼명 'product'에 엑셀의 '상품명' 매핑
        product: item['상품명'] || null, 
        
        barcode: item['바코드'] || null, 
        
        created_at: new Date(),
        status: '처리대기', 
        tracking_number: null 
      }));

      // Supabase 'orders' 테이블에 삽입
      const { error } = await supabase
        .from('orders')
        .insert(formattedData);

      if (error) throw error;

      message.success(`${previewData.length}건 등록 성공!`);
      setFileList([]);
      setPreviewData([]);
      onUploadSuccess(); // 목록 새로고침 트리거
      onClose(); // 모달 닫기
    } catch (error) {
      console.error(error);
      message.error('등록 실패: ' + error.message); 
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
      <Button 
          onClick={handleDownloadTemplate} 
          style={{ marginBottom: 15 }} 
          type="dashed"
      >
          주문 양식 다운로드
      </Button>

      <Dragger
        accept=".xlsx, .xls"
        beforeUpload={handleFileRead}
        fileList={fileList}
        onRemove={() => { setFileList([]); setPreviewData([]); }}
        maxCount={1}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">엑셀 파일을 여기로 드래그하세요</p>
        <p className="ant-upload-hint">업로드 전에 [주문 양식 다운로드] 버튼을 눌러 형식을 확인하세요.</p>
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

// ★★★ [중요] 이 부분이 없어서 에러가 났던 것입니다. 꼭 있어야 합니다!
export default ExcelUploadModal;