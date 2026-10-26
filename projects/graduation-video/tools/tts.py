"""Gemini TTS 로 장면별 나레이션을 만든다 → audio/tts/<key>.wav (24kHz mono)

scenes.js 의 narr 문장을 그대로 읽는다. 이미 있는 파일은 건너뛴다(다시 만들려면 지우기).
사용법: python3 tools/tts.py [--voice Sulafat]
"""
import base64, json, os, re, sys, time, urllib.error, urllib.request, wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = sys.argv[sys.argv.index('--voice') + 1] if '--voice' in sys.argv else 'Sulafat'
STYLE = '따뜻하고 다정한 동화 구연 선생님의 목소리로, 천천히 읽어 주세요: '
MODEL = 'gemini-2.5-flash-preview-tts'

src = open(os.path.join(ROOT, 'scenes.js'), encoding='utf-8').read()
items = re.findall(r"key: '(\w+)', dur: [\d.]+,\s*narr: (['\"])(.*?)\2,", src, re.S)
os.makedirs(os.path.join(ROOT, 'audio', 'tts'), exist_ok=True)

for key, _, text in items:
    if not text:
        continue
    out = os.path.join(ROOT, 'audio', 'tts', f'{key}.wav')
    if os.path.exists(out):
        print('있음', key); continue
    body = {"contents": [{"parts": [{"text": STYLE + text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
    for attempt in range(8):
        try:
            req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                                         data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json", "x-goog-api-key": os.environ['GEMINI_API_KEY']})
            r = json.load(urllib.request.urlopen(req, timeout=180))
            pcm = base64.b64decode(r['candidates'][0]['content']['parts'][0]['inlineData']['data'])
            with wave.open(out, 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
            print('완료', key, f'{len(pcm) / 48000:.1f}초'); break
        except urllib.error.HTTPError as e:
            wait = 20 * (attempt + 1)
            print(key, e.code, f'{wait}초 뒤 다시'); time.sleep(wait)
    time.sleep(6)
