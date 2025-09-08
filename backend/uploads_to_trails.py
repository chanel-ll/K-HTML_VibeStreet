import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
import math


# 1. Firebase 서비스 계정 키 파일 경로
#    Firebase 콘솔에서 다운로드한 .json 파일의 이름을 입력하세요.
CRED_PATH = r"C:\cursor_chaniii\backend\khtml-a34cf-firebase-adminsdk-fbsvc-47f919b324.json"

# 2. Firestore에 업로드할 CSV 파일 경로
#    문자열 앞에 r을 붙여 경로 문제를 해결합니다.
CSV_PATH = r"C:\cursor_chaniii\backend\data\score_db_final.csv"

# 3. 데이터를 저장할 Firestore 컬렉션 이름
COLLECTION_NAME = "trails"

# 4. 문서 ID로 사용할 CSV 컬럼 이름
#    각 산책로를 구분하는 고유한 ID 역할을 하는 컬럼명을 지정합니다.
#    (예: 'INTEGRATED_NAME' 또는 '산책로 ID' 등)
DOCUMENT_ID_COLUMN = "INTEGRATED_NAME"

# ===============================================================
# ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ 설정 부분 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
# ===============================================================


def upload_csv_to_firestore(cred_path, csv_path, collection_name, doc_id_column):
    """
    CSV 파일을 읽어 Firestore 컬렉션에 업로드하는 함수.
    """
    try:
        # Firebase 앱 초기화 (이미 초기화되었다면 건너뜀)
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        print("✅ Firebase와 성공적으로 연결되었습니다.")

    except Exception as e:
        print(f"🔥 Firebase 연결 실패: {e}")
        print("🔥 서비스 계정 키 파일 경로를 확인하세요.")
        return

    try:
        # CSV 파일 읽기 (다양한 인코딩 시도)
        try:
            df = pd.read_csv(csv_path, encoding='utf-8-sig')
        except UnicodeDecodeError:
            df = pd.read_csv(csv_path, encoding='cp949')
        
        print(f"✅ '{csv_path}' 파일을 성공적으로 읽었습니다. (총 {len(df)}개 데이터)")
        
        if doc_id_column not in df.columns:
            print(f"🔥 오류: CSV 파일에 '{doc_id_column}' 컬럼이 없습니다.")
            print(f"🔥 사용 가능한 컬럼: {list(df.columns)}")
            return

    except FileNotFoundError:
        print(f"🔥 오류: '{csv_path}' 파일을 찾을 수 없습니다.")
        return
    except Exception as e:
        print(f"🔥 CSV 파일 읽기 중 오류 발생: {e}")
        return

    print(f"\nFirestore '{collection_name}' 컬렉션에 데이터 업로드를 시작합니다...")
    
    # 데이터프레임의 각 행을 순회하며 Firestore에 업로드
    batch = db.batch()
    count = 0
    for index, row in df.iterrows():
        # 각 행을 딕셔너리로 변환
        data = row.to_dict()
        
        # Firestore가 처리할 수 없는 NaN 값을 None으로 변환
        for key, value in data.items():
            if isinstance(value, float) and math.isnan(value):
                data[key] = None
        
        # 문서 ID 가져오기
        doc_id = str(data[doc_id_column])
        
        # 컬렉션 내 문서 참조 생성 및 배치에 추가
        doc_ref = db.collection(collection_name).document(doc_id)
        batch.set(doc_ref, data)
        
        count += 1
        # Firestore는 배치당 500개 쓰기를 권장
        if count % 500 == 0:
            batch.commit()
            print(f"... {count}개 데이터 업로드 완료.")
            batch = db.batch()

    # 남은 데이터가 있다면 커밋
    if count % 500 != 0:
        batch.commit()

    print(f"\n🎉 총 {count}개의 산책로 데이터를 Firestore에 성공적으로 업로드했습니다!")


if __name__ == "__main__":
    upload_csv_to_firestore(CRED_PATH, CSV_PATH, COLLECTION_NAME, DOCUMENT_ID_COLUMN)
