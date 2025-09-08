# 파일: backend\gemini_smoke_test.py
import os, time, json, google.generativeai as genai
assert os.getenv("GEMINI_API_KEY"), "GEMINI_API_KEY 필요"
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
m = genai.GenerativeModel(
  model_name="gemini-2.5-flash",
  system_instruction='항상 {"ok":true} 만 JSON으로',
  generation_config={"response_mime_type":"application/json"},
)
t0=time.perf_counter()
try:
  r=m.start_chat(history=[]).send_message("ping")
  print("elapsed_sec:", round(time.perf_counter()-t0,2))
  print("raw:", r.text)
  print("json:", json.loads(r.text))
except Exception as e:
  print("elapsed_sec:", round(time.perf_counter()-t0,2))
  print("ERROR:", repr(e))