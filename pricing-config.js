export const CONFIG = {
            INSPECTION: {
                'DESKTOP': { label: '桌上型電腦', price: 500 },
                'LAPTOP': { label: '筆記型電腦', price: 500 },
                'INKJET': { label: '噴墨印表機', price: 400 },
                'LASER': { label: '雷射印表機', price: 400 },
                'SERVER': { label: 'NAS/伺服器', price: 600 },
                'NETWORK': { label: '弱電監控/網路', price: 600 },
                'SOFTWARE': { label: '軟體及遠端', price: 500 },
                'OTHER_IT': { label: '其他資訊產品', price: 400 },
                'DELIVERY': { label: '設備代送費', price: 300 }
            },
            TRANSPORT: {
                'ZONE_A': { label: '市區 (5km內)', price: 300 },
                'ZONE_B': { label: '郊區 (5-15km)', price: 700 },
                'ZONE_C': { label: '偏遠地區 (15km+)', price: 1200 },
                'MOUNTAIN': { label: '特殊山區', price: 3000 },
                'ISLAND': { label: '離島地區', price: 8000 }
            },
            URGENCY: {
                'NORMAL': { label: '一般檢修（時限另約）', price: 0 },
                'EXPRESS': { label: '檢修急件（時限另約）', price: 500 },
                'EMERGENCY': { label: '假日檢修', price: 800 }
            },
            SOURCE: {
                'OWN': { label: '購於永捷', price: -200 },
                'OTHER': { label: '購於他處', price: 0 }
            }
        };
