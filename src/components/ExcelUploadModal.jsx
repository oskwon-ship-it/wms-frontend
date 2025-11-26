// handleUpload 함수 부분만 찾아서 아래처럼 수정하거나, 파일 전체를 다시 붙여넣으세요.
// (customer_name -> customer, product_name -> product 로 변경됨)

      const formattedData = previewData.map(item => ({
        customer: customerName, // ★ DB 컬럼명: customer
        barcode: item['바코드'] || null, 
        product: item['상품명'] || null, // ★ DB 컬럼명: product
        
        created_at: new Date(),
        status: '처리대기', 
        tracking_number: null 
      }));