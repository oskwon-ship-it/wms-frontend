import React, { useState } from 'react';
import { Modal, Upload, Button, Table, message } from 'antd';
import { InboxOutlined, FileExcelOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient'; 

const { Dragger } = Upload;

const TrackingUploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const [fileList, setFileList] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [uploading, setUploading] = useState(false);
  
  // 1. 송장 등록용 양식 다운로드
  const handleDownloadTemplate = () => {
      const headers = ['주문번호', '송장번호']; 
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "송장_업데이트");
      XLSX.writeFile(wb, "WMS_송장_일괄등록_양식.xlsx");
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

  // 공백 제거 도우미 함수
  const getValue = (item, headerName) => {
    if (!item) return null;
    const foundKey = Object.keys(item).find(key => key.trim() === headerName);
    return foundKey ? item[foundKey] : null;
  };

  // 2. 송장번호 일괄 업데이트 (핵심 로직)
  const handleUpload = async () => {
    if (previewData.length === 0) {
      message.error('업로드할 데이터가 없습니다.');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      // 한 줄씩 업데이트를 수행합니다.
      // (주문번호가 일치하는 모든 상품의 송장번호와 상태를 변경)
      const updatePromises = previewData.map(async (item) => {
        const orderNo = getValue(item, '주문번호');
        const trackingNo = getValue(item, '송장번호');

        if (!orderNo || !trackingNo) {
            failCount++;
            return; // 필수값 없으면 스킵
        }

        // Supabase 업데이트 요청
        const { error } = await supabase
            .from('orders')
            .update({ 
                tracking_number: trackingNo,
                status: '출고완료' // 송장이 들어가면 자동으로 출고완료 처리
            })
            .eq('order_number', orderNo); // 주문번호가 같은 것들을 찾아서 업데이트

        if (error) {
            console.error(`주문번호 ${orderNo} 업데이트 실패:`, error);
            failCount++;
        } else {
            successCount++;
        }
      });

      // 모든 업데이트가 끝날 때까지 기다림
      await Promise.all(updatePromises);

      message.success(`완료: ${successCount}건 / 실패: ${failCount}건`);
      setFileList([]);
      setPreviewData([]);
      onUploadSuccess(); 
      onClose();
    } catch (error) {
      console.error(error);
      message.error('처리 중 오류가 발생했습니다.'); 
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title="송장번호 일괄 등록 (출고 처리)"
      open={isOpen}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="back" onClick={onClose}>취소</Button>,
        <Button key="submit" type="primary" loading={uploading} onClick={handleUpload} disabled={previewData.length === 0}>
            일괄 적용하기
        </Button>
      ]}
    >
      <Button onClick={handleDownloadTemplate} style={{ marginBottom: 15 }} icon={<FileExcelOutlined />}>
          송장 양식 다운로드
      </Button>
      
      <Dragger accept=".xlsx, .xls" beforeUpload={handleFileRead} fileList={fileList} onRemove={() => { setFileList([]); setPreviewData([]); }} maxCount={1}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">송장 엑셀 파일을 여기에 놓으세요</p>
        <p className="ant-upload-hint">'주문번호'와 '송장번호' 컬럼이 필수입니다.</p>
      </Dragger>

      {previewData.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4>미리보기 (상위 3개)</h4>
          <Table 
            dataSource={previewData.slice(0, 3)} 
            columns={Object.keys(previewData[0]).map(key => ({ title: key, dataIndex: key }))} 
            pagination={false} 
            size="small" 
            rowKey={(r) => Math.random()} 
          />
          <p style={{marginTop: 10, color: 'blue'}}>총 {previewData.length}건의 송장 정보를 업데이트할 준비가 되었습니다.</p>
        </div>
      )}
    </Modal>
  );
};

export default TrackingUploadModal;