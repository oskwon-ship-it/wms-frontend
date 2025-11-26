import React, { useState } from 'react';
import { Modal, Upload, Button, Table, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient'; 

const { Dragger } = Upload;

const ExcelUploadModal = ({ isOpen, onClose, onUploadSuccess, customerName }) => {
  const [fileList, setFileList] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  const handleDownloadTemplate = () => {
      const headers = ['주문번호', '송장번호', '바코드', '상품명', '수량', '수취인명', '연락처', '배송지 주소']; 
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "주문_양식");
      XLSX.writeFile(wb, "WMS_주문_대량등록_양식.xlsx");
      message.success('양식 파일 다운로드가 시작되었습니다!');
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

  // 공백 제거하고 값 찾는 함수
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
        message.error('로그인된 고객사 정보가 없습니다. 관리자에게 문의하세요.');
        return;
    }

    setUploading(true);

    try {
      // 1. 데이터 변환
      let formattedData = previewData.map(item => ({
        customer: customerName, 
        order_number: getValue(item, '주문번호'),
        tracking_number: getValue(item, '송장번호'),
        product: getValue(item, '상품명'), 
        barcode: getValue(item, '바코드'), 
        quantity: getValue(item, '수량') || 1,
        created_at: new Date(),
        status: '처리대기', 
      }));

      // ★★★ [수정됨] 빈 줄(상품명과 바코드가 둘 다 없는 행)은 자동으로 삭제
      formattedData = formattedData.filter(d => d.product || d.barcode);

      if (formattedData.length === 0) {
          throw new Error("유효한 데이터가 없습니다. 엑셀 내용을 확인해주세요.");
      }

      // 2. 유효성 검사 (실수로 하나만 빠뜨린 경우 체크)
      // 상품명은 있는데 바코드가 없거나, 바코드는 있는데 상품명이 없는 경우 에러
      const invalidData = formattedData.find(d => !d.product || !d.barcode);
      
      if (invalidData) {
          console.error("문제 데이터:", invalidData);
          throw new Error(`데이터 오류: 상품명이나 바코드가 빠진 행이 있습니다. (확인용: ${invalidData.product || '상품명없음'} / ${invalidData.barcode || '바코드없음'})`);
      }

      // 3. DB 전송
      const { error } = await supabase.from('orders').insert(formattedData);

      if (error) throw error;

      message.success(`${formattedData.length}건 등록 성공!`);
      setFileList([]);
      setPreviewData([]);
      onUploadSuccess(); 
      onClose();
    } catch (error) {
      console.error(error);
      message.error(error.message); // 에러 메시지를 그대로 보여줌
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal title="주문 엑셀 일괄 등록" open={isOpen} onCancel={onClose} width={800}
      footer={[
        <Button key="back" onClick={onClose}>취소</Button>,
        <Button key="submit" type="primary" loading={uploading} onClick={handleUpload} disabled={previewData.length === 0}>등록하기</Button>
      ]}
    >
      <Button onClick={handleDownloadTemplate} style={{ marginBottom: 15 }} type="dashed">주문 양식 다운로드</Button>
      <Dragger accept=".xlsx, .xls" beforeUpload={handleFileRead} fileList={fileList} onRemove={() => { setFileList([]); setPreviewData([]); }} maxCount={1}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">엑셀 파일을 여기로 드래그하세요</p>
        <p className="ant-upload-hint">주문번호, 바코드, 상품명, 수량은 필수입니다.</p>
      </Dragger>
      {previewData.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4>미리보기 (상위 5개)</h4>
          <Table dataSource={previewData.slice(0, 5)} columns={Object.keys(previewData[0]).map(key => ({ title: key, dataIndex: key }))} pagination={false} size="small" rowKey={(r) => Math.random()} />
        </div>
      )}
    </Modal>
  );
};

export default ExcelUploadModal;