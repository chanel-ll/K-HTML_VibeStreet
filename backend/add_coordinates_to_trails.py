"""
Firebase trails 컬렉션에 있는 산책로 주소를 카카오맵 API로 좌표 변환하여 추가하는 스크립트
"""
import os
import time
import requests
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# Firebase 초기화
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
cred_path = os.path.join(BACKEND_DIR, "khtml-a34cf-firebase-adminsdk-fbsvc-47f919b324.json")

try:
    firebase_admin.get_app()
    print("[INFO] Firebase가 이미 초기화되어 있습니다.")
except ValueError:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    print("[INFO] Firebase를 초기화했습니다.")

db = firestore.client()

# 카카오맵 REST API 키
KAKAO_REST_API_KEY = os.getenv('KAKAO_REST_API_KEY')

if not KAKAO_REST_API_KEY:
    print("❌ KAKAO_REST_API_KEY가 .env 파일에 설정되지 않았습니다!")
    exit(1)

def get_coordinates_from_address(address):
    """
    카카오맵 REST API를 사용하여 주소를 좌표로 변환
    """
    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {
        "Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"
    }
    params = {
        "query": address
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            data = response.json()
            
            if data['documents']:
                # 첫 번째 결과 사용
                result = data['documents'][0]
                
                latitude = float(result['y'])
                longitude = float(result['x'])
                
                print(f"  ✅ 좌표 변환 성공: ({latitude}, {longitude})")
                return {
                    "latitude": latitude,
                    "longitude": longitude
                }
            else:
                print(f"  ❌ 주소를 찾을 수 없습니다: {address}")
                return None
        else:
            print(f"  ❌ API 요청 실패: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"  ❌ 예외 발생: {e}")
        return None

def add_coordinates_to_trails():
    """
    Firebase trails 컬렉션의 모든 문서에 coordinates 필드 추가
    """
    print("🗺️ Firebase trails 컬렉션에 좌표 정보를 추가합니다...")
    
    # trails 컬렉션의 모든 문서 가져오기
    trails_ref = db.collection('trails')
    docs = trails_ref.stream()
    
    processed = 0
    success = 0
    failed = 0
    
    for doc in docs:
        doc_data = doc.to_dict()
        trail_name = doc_data.get('INTEGRATED_NAME', '이름 없음')
        address = doc_data.get('ADDRESS', '')
        
        print(f"\n📍 처리 중: {trail_name}")
        print(f"   주소: {address}")
        
        # 이미 coordinates가 있는지 확인
        if 'coordinates' in doc_data:
            print(f"   ⏭️ 이미 좌표가 있습니다. 건너뜀.")
            processed += 1
            continue
        
        if not address:
            print(f"   ❌ 주소 정보가 없습니다.")
            failed += 1
            processed += 1
            continue
        
        # 주소를 좌표로 변환
        coordinates = get_coordinates_from_address(address)
        
        if coordinates:
            try:
                # Firestore 문서 업데이트
                doc.reference.update({
                    'coordinates': coordinates
                })
                print(f"   ✅ Firestore 업데이트 완료")
                success += 1
            except Exception as e:
                print(f"   ❌ Firestore 업데이트 실패: {e}")
                failed += 1
        else:
            failed += 1
        
        processed += 1
        
        # API 호출 제한을 위한 딜레이 (카카오맵 API는 초당 10회 제한)
        time.sleep(0.2)
        
        # 진행 상황 출력
        if processed % 10 == 0:
            print(f"\n📊 진행 상황: {processed}개 처리 완료 (성공: {success}, 실패: {failed})")
    
    print(f"\n🎉 모든 작업 완료!")
    print(f"   총 처리: {processed}개")
    print(f"   성공: {success}개")
    print(f"   실패: {failed}개")

if __name__ == "__main__":
    add_coordinates_to_trails()