import os, logging
os.environ["GRPC_VERBOSITY"] = "ERROR"
os.environ.pop("HTTP_PROXY", None)
os.environ.pop("HTTPS_PROXY", None)
os.environ.pop("ALL_PROXY", None)
logging.getLogger("google").setLevel(logging.WARNING)
logging.getLogger("grpc").setLevel(logging.ERROR)
import json
from typing import Any, Dict, Optional, List

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import pandas as pd
from dotenv import load_dotenv
import google.generativeai as genai
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import threading
import time
import firebase_admin
from firebase_admin import credentials, auth, firestore

# .env 로딩 정책(우선순위: backend/.env > root/.env)
# 루트를 먼저 로드하고, 백엔드를 override=True로 다시 로드하여 백엔드 값이 최종적으로 우선되게 함
BACKEND_DIR = os.path.dirname(__file__)
ROOT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, os.pardir))
DOTENV_BACKEND = os.path.join(BACKEND_DIR, ".env")
DOTENV_ROOT = os.path.join(ROOT_DIR, ".env")

ROOT_ENV_LOADED = load_dotenv(dotenv_path=DOTENV_ROOT, override=True)
BACKEND_ENV_LOADED = load_dotenv(dotenv_path=DOTENV_BACKEND, override=True)


def get_env_str(name: str, default: Optional[str] = None) -> Optional[str]:
    # 일부 편집기/복붙 상황에서 키 이름 앞에 BOM(\ufeff)이나 보이지 않는 문자가 붙는 경우가 있어
    # 표준 키와 BOM 변형 키를 모두 조회한다.
    value = os.getenv(name)
    if value is None:
        value = os.getenv("\ufeff" + name)
    if value is None:
        value = os.getenv(name.lstrip("\ufeff"))
    if value is None or value.strip() == "":
        return default
    return value.strip()


def get_env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def _sanitize_api_key(raw: Optional[str]) -> Optional[str]:
    """환경변수에서 읽은 API 키를 gRPC 메타데이터 제약에 맞게 정제한다.

    - 앞뒤 공백/따옴표 제거
    - 개행/탭/BOM/제로폭 문자 제거
    - ASCII 검증(비-ASCII가 섞이면 None)
    - 내부 공백이 있으면 None (키 형식상 정상적이지 않음)
    """
    if raw is None:
        return None
    s = raw.strip()
    # 종종 복사-붙여넣기 시 양끝에 따옴표가 포함됨
    if (s.startswith("'") and s.endswith("'")) or (s.startswith('"') and s.endswith('"')):
        s = s[1:-1]
    # 숨은 제어문자/개행 제거
    s = (
        s.replace("\r", "")
         .replace("\n", "")
         .replace("\t", "")
         .replace("\u200b", "")  # zero width space
         .replace("\ufeff", "")  # BOM
    ).strip()
    # ASCII 이외 문자가 섞이면 gRPC 메타데이터 오류 발생
    try:
        s.encode("ascii")
    except UnicodeEncodeError:
        return None
    # 내부 공백은 정상 키 형식이 아님
    if any(ch.isspace() for ch in s):
        return None
    return s or None


RAW_GEMINI_API_KEY = get_env_str("GEMINI_API_KEY")
GEMINI_API_KEY = _sanitize_api_key(RAW_GEMINI_API_KEY)
def _explain_sanitization_failure(raw: str) -> str:
    # 정제 실패 원인을 사람이 읽기 쉬운 형태로 설명
    if raw is None:
        return "값이 비어 있음"
    s = raw
    # 1) 양끝 따옴표
    if (s.startswith("'") and s.endswith("'")) or (s.startswith('"') and s.endswith('"')):
        return "양끝 따옴표 포함"
    # 2) 숨은 제어문자/개행/탭/BOM/제로폭
    if any(ch in s for ch in ["\r", "\n", "\t", "\u200b", "\ufeff"]):
        return "개행/탭/BOM/제로폭 문자 포함"
    # 3) 비-ASCII 존재
    try:
        s.encode("ascii")
    except UnicodeEncodeError:
        return "비-ASCII 문자 포함(한글/특수문자 등)"
    # 4) 내부 공백
    if any(ch.isspace() for ch in s):
        return "내부 공백 포함"
    # 5) 비정상적으로 짧음
    if len(s.strip('"\'')) < 20:
        return "길이가 비정상적으로 짧음"
    return "알 수 없는 형식 오류"

if RAW_GEMINI_API_KEY and not GEMINI_API_KEY:
    logging.warning(
        "GEMINI_API_KEY 정제 실패: %s",
        _explain_sanitization_failure(RAW_GEMINI_API_KEY)
    )
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# 타임아웃(초)
GEMINI_TIMEOUT_SEC = get_env_int("GEMINI_TIMEOUT_SEC", 120)


# 감정 정의
POSITIVE_EMOTIONS = ["기쁨", "자유로움", "성취감", "편안함", "사랑", "감사", "흥미", "재미", "희망", "자부심"]
NEGATIVE_EMOTIONS = ["외로움", "우울감", "분노", "불안", "슬픔", "죄책감", "질투", "피로", "혐오", "실망"]

# 부정 → 긍정 감정 매핑
NEGATIVE_TO_POSITIVE = {
    "외로움": "사랑",
    "우울감": "희망", 
    "분노": "편안함",
    "불안": "자부심",
    "슬픔": "기쁨",
    "죄책감": "자부심", 
    "질투": "감사",
    "피로": "흥미",
    "혐오": "재미",
    "실망": "성취감"
}


SYSTEM_INSTRUCTION = f"""
너는 공감능력이 매우 뛰어난 심리 분석가이자 상대방 감정을 음악으로 치유해줄 수 있는 큐레이터야. 문장 속 상대방의 현재 감정 상태를 분석하고, 다음의 지침에 따라 사용자의 감정 상태에 맞춰 응답해줘.

[지침]
1. 사용자가 입력한 텍스트를 깊이 있게 읽고, 현재 느끼고 있을 핵심적인 감정을 정확히 1~2개 분석해.
2. 감정은 반드시 다음 20개 중에서만 선택해야 함:
   - 긍정 감정: {', '.join(POSITIVE_EMOTIONS)}
   - 부정 감정: {', '.join(NEGATIVE_EMOTIONS)}
3. 분석한 감정을 바탕으로, 사용자의 마음을 따뜻하게 위로하고 격려하는 '공감의 한마디'를 작성해.
4. 분석한 감정과 텍스트의 분위기에 어울리는 음악 3곡을 추천해.
5. 각 음악에 대해 추천하는 이유를 1~2 문장으로 간결하게 설명해.
6. 모든 결과는 반드시 아래의 JSON 형식에 맞춰서 출력해줘. 다른 설명은 절대 추가하지 마.

[JSON 출력 형식]
{{
  "emotions": ["감정1", "감정2"],
  "keywords": ["텍스트에서 추출한 주요 키워드 1", "키워드 2"],
  "comfort_message": "사용자를 위로하고 격려하는 공감의 한마디",
  "recommendations": [
    {{
      "artist": "가수명",
      "title": "노래 제목", 
      "reason": "이 노래를 추천하는 이유"
    }},
    {{
      "artist": "가수명",
      "title": "노래 제목",
      "reason": "이 노래를 추천하는 이유"
    }},
    {{
      "artist": "가수명", 
      "title": "노래 제목",
      "reason": "이 노래를 추천하는 이유"
    }}
  ]
}}
""".strip()


# ---- 모델 전역 재사용 ----
GEN_MODEL: Optional[genai.GenerativeModel] = None
READY: bool = False


def get_generative_model() -> genai.GenerativeModel:
    global GEN_MODEL
    if GEN_MODEL is None:
        GEN_MODEL = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=SYSTEM_INSTRUCTION,
            generation_config={"response_mime_type": "application/json"},
        )
    return GEN_MODEL


def _warmup_model() -> None:
    global READY
    if not GEMINI_API_KEY:
        READY = False
        return
    try:
        model = get_generative_model()
        # 짧은 웜업 호출(별도 짧은 타임아웃)
        with ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(lambda: model.generate_content("ping"))
            _ = fut.result(timeout=min(20, GEMINI_TIMEOUT_SEC))
        READY = True
    except Exception:
        READY = False


def parse_json_response(text: str) -> Dict[str, Any]:
    if not text:
        return {}
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    first = cleaned.find('{')
    last = cleaned.rfind('}')
    if first != -1 and last != -1 and last > first:
        cleaned = cleaned[first : last + 1]
    try:
        return json.loads(cleaned)
    except Exception:
        return {}


def _gemini_generate_once(prompt: str) -> Dict[str, Any]:
    model = get_generative_model()
    response = model.generate_content(prompt)
    parsed = parse_json_response(getattr(response, "text", ""))
    emotions = parsed.get("emotions")
    if not emotions:
        legacy = parsed.get("emotion")
        if isinstance(legacy, list):
            emotions = legacy
        elif isinstance(legacy, str) and legacy.strip():
            emotions = [e.strip() for e in legacy.split(',') if e.strip()]
        else:
            emotions = []
    if isinstance(emotions, list):
        emotions = [str(e).strip() for e in emotions if str(e).strip()][:2]
    emotion_str = ", ".join(emotions) if emotions else None
    return {
        "emotion": emotion_str,
        "emotions": emotions,
        "keywords": parsed.get("keywords", []),
        "comfort_message": parsed.get("comfort_message"),
        "recommendations": parsed.get("recommendations", []),
    }


def call_gemini_analysis(user_text: str) -> Dict[str, Any]:
    if not GEMINI_API_KEY:
        return {
            "error": "GEMINI_API_KEY 미설정",
            "message": "백엔드 .env 또는 루트 .env 파일에 GEMINI_API_KEY를 설정해주세요.",
        }
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_gemini_generate_once, user_text)
            result = future.result(timeout=GEMINI_TIMEOUT_SEC)
            if any(result.values()):
                return result
            return {"error": "empty_result", "message": "모델이 빈 결과를 반환했습니다."}
    except FuturesTimeoutError:
        return {
            "error": "gemini_timeout",
            "message": f"모델 응답이 {GEMINI_TIMEOUT_SEC}초를 초과했습니다.",
        }
    except Exception as exc:
        return {"error": "gemini_call_failed", "message": str(exc)}


app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False  # 한글이 유니코드로 변환되지 않도록 설정
CORS(app)


DEFAULT_SCORE_CSV_PATH = os.path.join(BACKEND_DIR, "data", "score_db_final.csv")
SCORE_CSV_PATH = get_env_str("SCORE_CSV_PATH", DEFAULT_SCORE_CSV_PATH)


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    print(f"[DEBUG] Raw columns before normalization: {list(df.columns)}")
    
    # 컬럼명 정규화
    normalized_columns = []
    for c in df.columns:
        col_str = str(c).strip()
        # BOM 제거
        col_str = col_str.lstrip("\ufeff")
        # 유니코드 대체 문자 제거
        col_str = col_str.replace("\ufffd", "")
        # 추가 정리
        col_str = col_str.strip()
        normalized_columns.append(col_str)
    
    df.columns = normalized_columns
    print(f"[DEBUG] Normalized columns: {list(df.columns)}")
    return df


def _load_score_df(path: str) -> Optional[pd.DataFrame]:
    print(f"[DEBUG] Attempting to load CSV from: {path}")
    exists = os.path.exists(path)
    print(f"[DEBUG] File exists: {exists}")
    if not exists:
        return None

    def has_valid_emotion_headers(df: pd.DataFrame) -> bool:
        cols = set([str(c).strip().lstrip("\ufeff") for c in df.columns])
        expected = set(POSITIVE_EMOTIONS)
        overlap = cols & expected
        print(f"[DEBUG] Header check overlap count: {len(overlap)} -> {sorted(list(overlap))[:5]}")
        # 감정 컬럼이 최소 5개 이상 맞아야 유효하다고 판단
        return len(overlap) >= 5

    # 후보 인코딩들. utf-8-sig가 잘못 디코드되어도 예외 없이 통과할 수 있으므로
    # 감정 컬럼 존재 여부로 유효성 검사를 하고, 실패 시 다음 인코딩을 시도한다.
    candidate_encodings = ["utf-8-sig", "cp949", "euc-kr"]
    errors: List[str] = []

    for enc in candidate_encodings:
        try:
            print(f"[DEBUG] Trying encoding: {enc}")
            df_try = pd.read_csv(path, encoding=enc)
            df_try = _normalize_columns(df_try)
            print(f"[DEBUG] Loaded shape={df_try.shape} with {enc}")
            print(f"[DEBUG] Columns sample: {list(df_try.columns)[:8]}")
            if has_valid_emotion_headers(df_try):
                print(f"[DEBUG] Selected encoding: {enc}")
                return df_try
            else:
                print(f"[DEBUG] Encoding {enc} failed header validation. Trying next...")
        except Exception as e:
            msg = f"encoding {enc} failed: {e}"
            print(f"[DEBUG] {msg}")
            errors.append(msg)
            continue

    # 마지막 시도로 판다스 기본 인코딩
    try:
        print("[DEBUG] Trying default encoding (pandas default)")
        df_default = pd.read_csv(path)
        df_default = _normalize_columns(df_default)
        if has_valid_emotion_headers(df_default):
            print("[DEBUG] Selected default encoding")
            return df_default
    except Exception as e:
        print(f"[DEBUG] default encoding failed: {e}")

    print("[DEBUG] All encoding attempts failed or invalid headers. Errors:")
    for em in errors:
        print(f"        - {em}")
    return None


# 데이터 로딩
score_df: Optional[pd.DataFrame] = _load_score_df(SCORE_CSV_PATH)

def get_emotion_based_trails(emotion: str) -> Dict[str, Any]:
    """감정 기반 산책로 추천 (장이소공원까지만)

    Returns a dict containing:
    - positive_emotions_used: List[str]
    - top: List[Dict[str, Any]] (top 3 trails)
    - more: List[Dict[str, Any]] (next top 10 trails)
    """
    if score_df is None or score_df.empty:
        print(f"[DEBUG] score_df is None or empty")
        return {"positive_emotions_used": [], "top": [], "more": []}
    
    print(f"[DEBUG] Input emotion: '{emotion}'")
    print(f"[DEBUG] Available columns: {list(score_df.columns)}")
    
    # 감정을 긍정 감정으로 매핑
    target_emotions = []
    
    # 입력된 감정이 쉼표로 구분된 경우 처리
    emotions = [e.strip() for e in emotion.split(',')]
    print(f"[DEBUG] Parsed emotions: {emotions}")
    
    for emo in emotions:
        if emo in POSITIVE_EMOTIONS:
            target_emotions.append(emo)
            print(f"[DEBUG] Added positive emotion: {emo}")
        elif emo in NEGATIVE_TO_POSITIVE:
            mapped_emotion = NEGATIVE_TO_POSITIVE[emo]
            target_emotions.append(mapped_emotion)
            print(f"[DEBUG] Mapped negative emotion '{emo}' -> '{mapped_emotion}'")
        else:
            print(f"[DEBUG] Unknown emotion: '{emo}'")
    
    print(f"[DEBUG] Final target emotions: {target_emotions}")
    
    if not target_emotions:
        print(f"[DEBUG] No target emotions found")
        return {"positive_emotions_used": [], "top": [], "more": []}
    
    # score_df에서 해당 감정 컬럼들의 평균 계산
    try:
        # 필요한 컬럼이 존재하는지 확인
        available_emotions = [emo for emo in target_emotions if emo in score_df.columns]
        print(f"[DEBUG] Available emotions in CSV: {available_emotions}")
        
        if not available_emotions:
            print(f"[DEBUG] No available emotions found in CSV columns")
            return {"positive_emotions_used": target_emotions, "top": [], "more": []}
        
        # 각 행에 대해 해당 감정들의 평균 점수 계산
        score_df_copy = score_df.copy()
        
        # 장이소공원까지만 필터링 (ㄱㄴㄷ순으로 장이소공원까지)
        print(f"[DEBUG] 필터링 전 총 산책로 수: {len(score_df_copy)}")
        
        # 산책로 이름이 '장이소공원'보다 사전순으로 앞서거나 같은 것들만 선택
        filtered_df = score_df_copy[
            score_df_copy['INTEGRATED_NAME'].str.strip() <= '장이소공원'
        ].copy()
        
        print(f"[DEBUG] 장이소공원까지 필터링 후 산책로 수: {len(filtered_df)}")
        print(f"[DEBUG] 필터링된 산책로 목록: {sorted(filtered_df['INTEGRATED_NAME'].tolist())}")
        
        if filtered_df.empty:
            print(f"[DEBUG] 필터링 후 산책로가 없습니다.")
            return {"positive_emotions_used": target_emotions, "top": [], "more": []}
        
        emotion_scores = filtered_df[available_emotions]
        print(f"[DEBUG] Emotion scores shape: {emotion_scores.shape}")
        print(f"[DEBUG] Sample emotion scores:\n{emotion_scores.head()}")
        
        filtered_df['avg_score'] = emotion_scores.mean(axis=1)
        print(f"[DEBUG] Average scores:\n{filtered_df[['INTEGRATED_NAME', 'avg_score']].head()}")
        
        # 점수가 높은 순으로 정렬
        ranked = filtered_df.sort_values('avg_score', ascending=False)
        # 상위 3개
        top_trails_df = ranked.head(3)
        print(f"[DEBUG] Top 3 trails:\n{top_trails_df[['INTEGRATED_NAME', 'avg_score']]}")
        # 그 다음 10개
        more_trails_df = ranked.iloc[3:13]
        
        def _row_to_trail(row: pd.Series) -> Dict[str, Any]:
            trail_data = {
                "name": str(row.get('INTEGRATED_NAME', '알 수 없음')),
                "address": str(row.get('ADDRESS', '주소 정보 없음')),
                "score": round(float(row['avg_score']), 2)
            }
            
            # 좌표 정보가 있다면 추가 (Firebase에서 가져오기)
            try:
                trail_name = str(row.get('INTEGRATED_NAME', ''))
                if trail_name:
                    trail_doc = db.collection('trails').document(trail_name).get()
                    if trail_doc.exists:
                        trail_firebase_data = trail_doc.to_dict()
                        
                        # 기본 마커 좌표
                        if 'coordinates' in trail_firebase_data:
                            trail_data['coordinates'] = trail_firebase_data['coordinates']
                            print(f"[DEBUG] Added coordinates for {trail_name}: {trail_firebase_data['coordinates']}")
                        
                        # 루트 경로 좌표 (객체 배열을 다시 배열로 변환)
                        if 'route_coordinates' in trail_firebase_data:
                            route_coords = trail_firebase_data['route_coordinates']
                            
                            # 객체 배열을 [lng, lat] 배열로 변환
                            if isinstance(route_coords, list) and len(route_coords) > 0:
                                if isinstance(route_coords[0], dict):
                                    # 객체 형태: [{lng: x, lat: y}, ...] → [[x, y], ...]
                                    converted_coords = []
                                    # order 필드로 정렬
                                    sorted_coords = sorted(route_coords, key=lambda x: x.get('order', 0))
                                    for coord_obj in sorted_coords:
                                        converted_coords.append([coord_obj['lng'], coord_obj['lat']])
                                    
                                    trail_data['route'] = {
                                        'type': trail_firebase_data.get('route_type', 'LineString'),
                                        'coordinates': converted_coords
                                    }
                                    print(f"[DEBUG] Added route for {trail_name}: {len(converted_coords)} points")
                                else:
                                    # 이미 배열 형태인 경우 (이전 버전)
                                    trail_data['route'] = {
                                        'type': trail_firebase_data.get('route_type', 'LineString'),
                                        'coordinates': route_coords
                                    }
                                    print(f"[DEBUG] Added route for {trail_name}: {len(route_coords)} points")
                            
            except Exception as e:
                print(f"[DEBUG] Failed to fetch trail data for {trail_name}: {e}")
            
            return trail_data

        top_results: List[Dict[str, Any]] = [
            _row_to_trail(row)
            for _, row in top_trails_df.iterrows()
        ]
        more_results: List[Dict[str, Any]] = [
            _row_to_trail(row)
            for _, row in more_trails_df.iterrows()
        ]

        print(f"[DEBUG] Final top results: {top_results}")
        print(f"[DEBUG] Final more results count: {len(more_results)}")
        return {
            "positive_emotions_used": target_emotions,
            "top": top_results,
            "more": more_results,
        }
    
    except Exception as e:
        print(f"[DEBUG] Error in get_emotion_based_trails: {e}")
        import traceback
        traceback.print_exc()
        return {"positive_emotions_used": [], "top": [], "more": []}

cred_path = os.path.join(BACKEND_DIR, "khtml-a34cf-firebase-adminsdk-fbsvc-47f919b324.json") 
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)

# Firestore 클라이언트 초기화
db = firestore.client()

# Firebase 인증 미들웨어
from functools import wraps

def check_token(f):
    """Firebase ID 토큰을 검증하고 사용자 UID를 전달하는 데코레이터"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Authorization 헤더에서 토큰 추출
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "unauthorized", "message": "로그인이 필요합니다."}), 401
        
        token = auth_header.split('Bearer ')[1]
        
        try:
            # Firebase Admin SDK로 토큰 검증
            decoded_token = auth.verify_id_token(token)
            uid = decoded_token['uid']
            # 함수에 uid 전달
            return f(uid, *args, **kwargs)
        except Exception as e:
            return jsonify({"error": "invalid_token", "message": "유효하지 않은 토큰입니다."}), 401
    
    return decorated_function

@app.route('/')
def home():
    return "Flask와 Firebase가 성공적으로 연결되었습니다!"

@app.route("/api/health", methods=["GET"])
def health() -> Any:
    def _mask(v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        if len(v) <= 8:
            return v
        return f"{v[:4]}...{v[-4:]}"

    return jsonify({
        "status": "ok",
        "ready": READY,
        "geminiConfigured": bool(GEMINI_API_KEY),
        "geminiDiag": {
            "rawPresent": bool(RAW_GEMINI_API_KEY),
            "sanitizedPresent": bool(GEMINI_API_KEY),
            "rawLen": (len(RAW_GEMINI_API_KEY) if RAW_GEMINI_API_KEY else 0),
            "sanitizedLen": (len(GEMINI_API_KEY) if GEMINI_API_KEY else 0),
            "rawPreview": _mask(RAW_GEMINI_API_KEY),
            "sanitizedPreview": _mask(GEMINI_API_KEY),
        },
        "dotenv": {
            "backendExists": os.path.exists(DOTENV_BACKEND),
            "rootExists": os.path.exists(DOTENV_ROOT),
            "backendLoaded": bool(BACKEND_ENV_LOADED),
            "rootLoaded": bool(ROOT_ENV_LOADED),
        },
        "scoreDbLoaded": bool(score_df is not None and not score_df.empty),
        "scoreDbInfo": {
            "loaded": bool(score_df is not None),
            "empty": bool(score_df is not None and score_df.empty),
            "rows": len(score_df) if score_df is not None else 0,
            "columns": [str(col) for col in (score_df.columns if score_df is not None else [])],
            "sampleColumns": [str(col) for col in (score_df.columns[:5] if score_df is not None and len(score_df.columns) > 0 else [])],
            "csvPath": SCORE_CSV_PATH,
            "csvExists": os.path.exists(SCORE_CSV_PATH),
        },
        "timeoutSec": GEMINI_TIMEOUT_SEC,
    })


@app.route("/api/diag", methods=["GET"])
def diag() -> Any:
    if not GEMINI_API_KEY:
        return jsonify({"ok": False, "error": "no_api_key"}), 400
    t0 = time.perf_counter()
    try:
        model = get_generative_model()
        t1 = time.perf_counter()
        with ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(lambda: model.generate_content("ping"))
            resp = fut.result(timeout=min(30, GEMINI_TIMEOUT_SEC))
        t2 = time.perf_counter()
        return jsonify({
            "ok": True,
            "init_ms": int((t1 - t0) * 1000),
            "call_ms": int((t2 - t1) * 1000),
            "text": getattr(resp, "text", "")[:120]
        })
    except FuturesTimeoutError:
        return jsonify({"ok": False, "error": "timeout"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/analyze", methods=["GET", "POST", "OPTIONS"])
@check_token
def analyze(uid) -> Any:
    if request.method == "OPTIONS":
        return ("", 204, {
            "Access-Control-Allow-Origin": request.headers.get("Origin", "*"),
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers", "Content-Type"),
        })
    if request.method == "GET":
        return jsonify({
            "message": "POST /api/analyze 로 { text: string } 형태의 JSON을 보내세요.",
            "example": {"text": "오늘 기분이 가라앉아요. 위로가 필요해요."}
        })

    data = request.get_json(silent=True) or {}
    user_text = (data.get("text") or "").strip()
    user_location = data.get("location")  # GPS 위치 정보 (latitude, longitude)
    
    if not user_text:
        return jsonify({"error": "invalid_input", "message": "text 필드가 필요합니다."}), 400
    
    print(f"[DEBUG] 분석 요청 - 텍스트: {user_text[:50]}...")
    if user_location:
        print(f"[DEBUG] 사용자 위치: {user_location['latitude']}, {user_location['longitude']}")

    # 사용자의 음악 취향 조회
    user_music_taste = ""
    try:
        user_doc = db.collection('users').document(uid).get()
        if user_doc.exists:
            user_data = user_doc.to_dict()
            user_music_taste = user_data.get('music_taste', '')
    except Exception as e:
        print(f"[DEBUG] Failed to fetch user music taste: {e}")

    t = time.perf_counter()
    
    # 음악 취향을 반영한 분석 호출
    if user_music_taste:
        # 시스템 프롬프트에 음악 취향 추가
        enhanced_prompt = f"사용자의 음악 취향: {user_music_taste}\n\n{user_text}"
        gemini_result = call_gemini_analysis(enhanced_prompt)
    else:
        gemini_result = call_gemini_analysis(user_text)
    
    print("gemini_sec=", round(time.perf_counter()-t, 2))

    # 감정 기반 산책로 추천
    trail_payload: Dict[str, Any] = {"trails": [], "more": [], "positive_emotions_used": []}
    
    if not gemini_result.get("error") and gemini_result.get("emotion"):
        emotion_trails = get_emotion_based_trails(gemini_result["emotion"])
        # 백엔드는 상위 3개를 기존 "trails"에, 나머지 10개는 "more"로 제공
        trail_payload["trails"] = emotion_trails.get("top", [])
        trail_payload["more"] = emotion_trails.get("more", [])
        trail_payload["positive_emotions_used"] = emotion_trails.get("positive_emotions_used", [])

    response_payload = {
        "analysis": gemini_result,
        "trail": trail_payload,
    }
    
    # 분석 결과를 history 컬렉션에 저장
    if not gemini_result.get("error"):
        try:
            history_data = {
                'user_id': uid,
                'prompt': user_text,
                'emotion': gemini_result.get('emotion', ''),
                'emotions': gemini_result.get('emotions', []),
                'keywords': gemini_result.get('keywords', []),
                'comfort_message': gemini_result.get('comfort_message', ''),
                'recommendations': gemini_result.get('recommendations', []),
                'trails': trail_payload.get('trails', []),
                'more_trails': trail_payload.get('more', []),
                'positive_emotions_used': trail_payload.get('positive_emotions_used', []),
                'timestamp': firestore.SERVER_TIMESTAMP
            }
            
            db.collection('history').add(history_data)
            print("[DEBUG] Analysis result saved to history")
            
        except Exception as e:
            print(f"[DEBUG] Failed to save history: {e}")
            # 히스토리 저장 실패해도 응답은 정상적으로 반환
    
    return jsonify(response_payload)


# 회원가입 시 프로필 정보 저장
@app.route("/api/register", methods=["POST"])
@check_token
def register_user(uid):
    """회원가입 시 사용자 프로필 정보를 Firestore에 저장 (upsert 방식)"""
    data = request.get_json(silent=True) or {}
    
    print(f"[DEBUG] Register API called for uid: {uid}")
    print(f"[DEBUG] Received data: {data}")
    
    # 필수 필드 검증
    required_fields = ['username', 'email', 'music_taste', 'residence']
    for field in required_fields:
        if not data.get(field, '').strip():
            print(f"[DEBUG] Missing or empty field: {field}")
            return jsonify({"error": "invalid_input", "message": f"{field} 필드가 필요합니다."}), 400
    
    try:
        user_ref = db.collection('users').document(uid)
        existing_doc = user_ref.get()
        
        # 사용자 정보 구성 (created_at 제거)
        user_data = {
            'username': data['username'].strip(),
            'email': data['email'].strip(),
            'music_taste': data['music_taste'].strip(),
            'residence': data['residence'].strip(),
        }
        
        print(f"[DEBUG] {'Creating' if not existing_doc.exists else 'Updating'} user document for {uid}")
        
        # upsert (merge=True로 기존 필드 보존하면서 업데이트)
        user_ref.set(user_data, merge=True)
        
        return jsonify({
            "message": "회원가입이 완료되었습니다.",
            "user": user_data
        })
    
    except Exception as e:
        print(f"[DEBUG] Registration failed: {e}")
        return jsonify({"error": "registration_failed", "message": str(e)}), 500


# 내 정보 조회
@app.route("/api/me", methods=["GET"])
@check_token
def get_my_info(uid):
    """로그인한 사용자의 프로필 정보 조회"""
    try:
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()

        # 문서가 없다면 기본 프로필을 자동 생성(bootstrap)
        if not user_doc.exists:
            try:
                fb_user = auth.get_user(uid)
                email = getattr(fb_user, 'email', None)
            except Exception:
                email = None
            bootstrap = {
                **({ 'email': email } if email else {}),
                'username': '',
                'music_taste': '',
                'residence': '',
            }
            user_ref.set(bootstrap, merge=True)
            user_doc = user_ref.get()

        user_data = user_doc.to_dict()
        return jsonify({"user": user_data})
    
    except Exception as e:
        return jsonify({"error": "fetch_failed", "message": str(e)}), 500


# 내 정보 수정
@app.route("/api/me", methods=["PUT"])
@check_token
def update_my_info(uid):
    """로그인한 사용자의 프로필 정보 수정"""
    data = request.get_json(silent=True) or {}
    
    try:
        # 사용자 문서 참조
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        # 수정 가능한 필드만 업데이트
        allowed_fields = ['username', 'music_taste', 'residence']
        update_data = {}
        
        for field in allowed_fields:
            if field in data and data[field].strip():
                update_data[field] = data[field].strip()
        
        if not update_data:
            return jsonify({"error": "no_data", "message": "수정할 데이터가 없습니다."}), 400

        # 문서가 없으면 생성(upsert). 이메일과 생성시각 포함
        if not user_doc.exists:
            try:
                fb_user = auth.get_user(uid)
                email = getattr(fb_user, 'email', None)
            except Exception:
                email = None
            create_payload = {
                **({ 'email': email } if email else {}),
                **update_data,
                'created_at': firestore.SERVER_TIMESTAMP,
            }
            user_ref.set(create_payload, merge=True)
        else:
            # 기존 문서 업데이트
            user_ref.update(update_data)
        
        return jsonify({
            "message": "프로필이 성공적으로 업데이트되었습니다.",
            "updated_fields": list(update_data.keys())
        })
    
    except Exception as e:
        return jsonify({"error": "update_failed", "message": str(e)}), 500


# 나의 이용 내역 조회
@app.route("/api/history", methods=["GET"])
@check_token
def get_my_history(uid):
    """로그인한 사용자의 이용 내역 조회"""
    try:
        # 인덱스 없이도 동작하도록 서버에서 정렬 처리
        history_ref = db.collection('history').where('user_id', '==', uid)
        history_docs = list(history_ref.stream())

        history_rows = []
        for doc in history_docs:
            data = doc.to_dict()
            data['id'] = doc.id
            history_rows.append(data)

        # 파이썬에서 timestamp 기준 내림차순 정렬(없으면 가장 뒤로)
        def _ts(v):
            t = v.get('timestamp')
            return t if t is not None else 0
        history_rows.sort(key=_ts, reverse=True)

        # 직렬화
        history_list = []
        for row in history_rows:
            if 'timestamp' in row and row['timestamp']:
                try:
                    row['timestamp'] = row['timestamp'].isoformat()
                except Exception:
                    pass
            history_list.append(row)
        
        return jsonify({"history": history_list})
    
    except Exception as e:
        return jsonify({"error": "fetch_failed", "message": str(e)}), 500


# 특정 이용 내역 삭제
@app.route("/api/history/<history_id>", methods=["DELETE"])
@check_token
def delete_my_history(uid, history_id):
    """특정 이용 내역 삭제 (본인 소유 내역만)"""
    try:
        # 내역 문서 조회
        history_doc = db.collection('history').document(history_id).get()
        
        if not history_doc.exists:
            return jsonify({"error": "history_not_found", "message": "해당 내역을 찾을 수 없습니다."}), 404
        
        history_data = history_doc.to_dict()
        
        # 소유권 확인
        if history_data.get('user_id') != uid:
            return jsonify({"error": "forbidden", "message": "삭제 권한이 없습니다."}), 403
        
        # 삭제 실행
        db.collection('history').document(history_id).delete()
        
        return jsonify({"message": "내역이 성공적으로 삭제되었습니다."})
    
    except Exception as e:
        return jsonify({"error": "delete_failed", "message": str(e)}), 500





# 서버 기동 시 웜업 실행(비차단)
if GEMINI_API_KEY:
    threading.Thread(target=_warmup_model, daemon=True).start()
    

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(get_env_str("PORT", "5000")), debug=False, use_reloader=False)
