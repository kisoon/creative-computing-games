# Pause Pose — 손으로 연주하는 ml5.js 악기

[ml5.js HandPose 문서](https://docs.ml5js.org/#/reference/handpose)의 방식으로 손 키포인트를
감지하고, 그 위치를 **Web Audio 신시사이저**에 연결한 테레민형 악기입니다.

- 손을 **펴고 오므리는 크기**로 **음량**
- 손을 **위아래**로 움직이면 **음높이** (C 장조, 샵/플랫 없음)
- 손을 **좌우로 흔들면** **비브라토**
- 옆 패널에서 **옥타브(−/＋)** 와 **연주 시작/정지**를 조절
- 손 하나당 21개 키포인트와 뼈대를 화면에 표시

## 🦟 모기 잡기 게임 (mosquito.html)

같은 ml5.js HandPose로 만든 별도의 미니 게임입니다. 카메라 앞에서 모기를
손뼉으로 잡고, 많이 잡을수록 새 기술이 해금됩니다.

- **👏 두 손뼉**: 두 손을 마주치면 그 위치(손바닥 중점) 주변의 모기를 한 번에 제압
- **✋ 휘두르기**: 손을 빠르게 휘두르면 지나간 자리의 모기를 타격
- **✊ 주먹 스냅**: 모기 근처에서 주먹을 확 쥐면 즉시 타격
- 화면 상단에 **HAND TRACKING · 손 N**으로 인식 상태를 실시간 표시
- **✌️ 전기 파리채** (5마리 해금): 검지·중지를 편 채 유지하면 가까운 모기 감전
- **✊ 화염방사** (15마리 해금): 주먹을 쥔 채 유지하면 손끝에서 화염 분사
- 스킬은 공유 **에너지**를 소모하고, 쓰지 않으면 천천히 회복됩니다.
- 연속으로 잡으면 **콤보 배수**가 붙고, 황금 모기는 3배 점수입니다.

`mosquito.html` 하나만 있으면 됩니다. **웹캠 + ml5.js 손 인식이 기본 모드**입니다.
`게임 시작`을 누르면 브라우저가 카메라 권한을 요청하고, 손 21개 키포인트를
실시간으로 읽습니다. 두 손이 가까워지면 두 손바닥 사이에 **손뼉 판정 원**이
표시되고, 그 원 안에 모기가 있으면 손뼉 순간 모기가 잡힙니다.

카메라를 켤 수 없으면 이유를 안내하고, 패널의 **데모 모드**를 눌렀을 때만
마우스 연습 모드로 전환됩니다. `file://`로 열면 카메라가 차단되므로 반드시
로컬 서버(`http://localhost:8000/...`)로 접속하세요.

| 입력 | 동작 |
| --- | --- |
| 마우스 이동 / 클릭 | 데모 모드에서 손 이동 / 손뼉 |
| `1` / `2` (누르고 있기) | 데모 손모양 ✌️ / ✊ |
| `Space` | 데모에서 손뼉 |
| `R` | 라운드 다시 시작 |
| `M` | 사운드 켜기 / 끄기 |
| `U` | 모든 스킬 즉시 해금 (연습용) |

해금 기준·판정 반경·에너지 소모량은 `mosquito.html` 안의 `GAME` 객체에서
조절합니다.

## 실행 방법

### 1) 단일 파일 버전 (가장 간단)

`handpose.html` 을 더블클릭하면 브라우저에서 바로 열립니다.
CSS/JS가 모두 파일 안에 들어 있어 다른 파일이 필요 없습니다.
(인터넷 연결 필요 — p5.js/ml5.js와 모델을 CDN에서 받아옵니다.)

> Chrome/Safari는 `file://` 로 연 페이지의 카메라를 차단할 수 있습니다.
> 화면에 안내가 뜨면 아래 2) 방법으로 실행하세요.

### 2) 로컬 서버 (카메라 권한 필요 시)

웹캠(`getUserMedia`)과 ml5 모델은 `file://` 로 열면 동작하지 않는 경우가 많으므로
로컬 서버로 실행하세요.

```bash
cd "pause pose"
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

`npx serve .` 를 사용해도 됩니다. 서버로 열면 카메라 권한 요청이 정상적으로 뜹니다.

### 3) 웹에 올리기

`handpose.html` 한 파일만 GitHub Pages, Netlify, Vercel 등에 올려도 됩니다.
HTTPS 주소에서는 카메라 권한이 정상 동작합니다.

## 파일 구조

```
pause pose/
├── handpose.html     # 손 악기 단일 파일 실행 버전 (이것만 있으면 동작)
├── mosquito.html     # 모기 잡기 게임 단일 파일 실행 버전
├── index.html        # 손 악기 여러 파일 개발용 버전
├── css/
│   └── style.css     # 레이아웃 / 상태 배지 / 패널 스타일
├── js/
│   ├── config.js     # 해상도, handPose/악기 옵션, 색상, 연결 정보
│   ├── audio.js      # Web Audio 신시사이저 (오실레이터·필터·게인·비브라토 LFO)
│   ├── detector.js   # ml5.handPose 래퍼 (load / start / stop / detectOnce)
│   ├── drawer.js     # 키포인트·뼈대·라벨 렌더링 + 좌표 변환
│   ├── instrument.js # 손 크기→음량, 세로→음높이, 좌우 흔들기→비브라토 매핑
│   └── sketch.js     # p5.js 라이프사이클, 상태 관리, UI 동기화
├── build.py          # 단일 파일(handpose.html) 생성 스크립트
└── README.md
```

`handpose.html` 은 위 `css`/`js` 파일들을 그대로 합친 결과입니다. 코드를 수정할 때는
개발용 파일을 고친 뒤 아래처럼 다시 합치면 됩니다.

```bash
python3 build.py
```

로드 순서는 `config → audio → detector → drawer → instrument → sketch` 이며, 각 파일은
전역 객체(`CONFIG`, `AudioEngine`, `HandDetector`, `HandDrawer`, `Instrument`)로만 연결됩니다.

## 악기 사용법

1. **연주 시작** 버튼(또는 `P`)을 누릅니다. 브라우저 정책상 소리는 이 클릭 이후에만 납니다.
2. 손을 카메라에 보이면 손바닥에 포인터가 생기고, 손동작이 소리에 반영됩니다.
   - **손을 활짝 펴면 최대 음량, 주먹을 쥐면 무음** (음량)
   - **위 → 높은 음, 아래 → 낮은 음** (C 장조: C·D·E·F·G·A·B, 샵/플랫 없음)
   - **좌우로 빠르게 흔들면 비브라토**가 걸리고, 멈추면 사라집니다.
3. **옥타브 −/＋** 로 음역을 2~6옥타브 사이에서 바꿉니다.
4. 손을 화면에서 빼면 소리가 서서히 줄고, 다시 넣으면 이어서 연주됩니다.
5. **연주 정지**를 누르면 소리가 즉시 줄고 오디오 컨텍스트가 절전 상태가 됩니다.

악기 관련 값은 `js/config.js` 에서 조절합니다.

```js
instrument: {
  defaultOctave: 4,
  minOctave: 2,
  maxOctave: 6,
  scale: [0, 2, 4, 5, 7, 9, 11, 12], // C 장조 (샵/플랫 없음)
  pitchTop: 0.1,             // 이 높이 이상 = 최고음
  pitchBottom: 0.9,          // 이 높이 이하 = 최저음
  openness: { closed: 1.05, open: 2.15 }, // 손 오므림/펼침 비율 범위
  volumeCurve: 1.15,
  volumeMax: 0.28,
  vibrato: { rate: 5.4, maxCents: 32, sensitivity: 42, threshold: 0.3 },
  smoothing: 0.18
}
```

손의 펼침 정도는 `손끝 5개 ~ 손목 평균 거리 ÷ (손목 ~ 중지 뿌리 거리)` 로 계산해,
카메라와의 거리가 달라져도 음량이 일정하게 유지됩니다.

소리 구성은 `js/audio.js` 의 `ensureContext()` 에서 바꿀 수 있습니다(사인+트라이앵글 2voice,
로우패스 필터 2.6kHz, 마스터 게인 0.8, 비브라토 LFO → 두 오실레이터 detune).

> 참고: 자동재생 정책 때문에 화면을 열자마자 소리가 나지는 않습니다. 반드시 **연주 시작**
> 버튼을 먼저 눌러 주세요.

## 동작 흐름

1. `HandDetector.load()` 가 `ml5.handPose(CONFIG.handPose)` 로 모델을 불러옵니다.
2. `handPose.getConnections()` 로 손가락 연결 정보를 가져옵니다(없으면 `CONFIG.connections` 사용).
3. 웹캠 프레임이 준비되면 `handPose.detectStart(video, callback)` 로 연속 감지를 시작합니다.
4. 콜백 결과(`hands`)를 `draw()` 에서 매 프레임 그립니다.
5. 정지 시 `handPose.detectStop()` 을 호출합니다.

## 주요 API 사용 지점

| 문서 API | 코드 위치 |
| --- | --- |
| `ml5.handPose(options)` | `js/detector.js` → `load()` |
| `handPose.detectStart(media, cb)` | `js/detector.js` → `start()` |
| `handPose.detectStop()` | `js/detector.js` → `stop()` |
| `handPose.detect(media, cb)` | `js/detector.js` → `detectOnce()` |
| `handPose.getConnections()` | `js/detector.js` → `load()` |

감지 옵션은 `js/config.js` 에서 수정합니다.

```js
handPose: {
  maxHands: 2,      // 최대 감지 손 개수
  flipped: false,   // 결과 좌표 반전 (화면 반전은 mirror 로 처리)
  runtime: "tfjs",  // "tfjs" | "mediapipe"
  modelType: "full" // "full" | "lite"
}
```

## 단축키

- `Space` 감지 시작 / 정지
- `P` 연주 시작 / 정지
- `S` 뼈대 연결선 표시 전환
- `K` 키포인트 이름(손목 라벨) 표시 전환

## 확장 포인트

- **음계 바꾸기**: `CONFIG.instrument.scale` 을 펜타토닉 `[0, 2, 4, 7, 9, 12]`, 마이너 `[0, 2, 3, 5, 7, 8, 10, 12]` 등으로 변경.
- **비브라토 조절**: `CONFIG.instrument.vibrato` 의 `rate`(속도), `maxCents`(깊이), `sensitivity`(민감도) 수정.
- **음량 반응 조절**: `CONFIG.instrument.openness` 의 `closed`/`open` 값을 실제 손 크기 비율에 맞게 보정.
- **음색 바꾸기**: `js/audio.js` 의 `oscMain.type`(sine/square/sawtooth/triangle)과 필터 주파수 조정.
- **화음**: 오실레이터를 하나 더 추가하고 `frequencyFor(octave, semitone + 4)` 처럼 3도/5도를 겹치기.
- **제스처 판정**: 손가락을 모두 펴면 소리 on, 주먹을 쥐면 mute 같은 규칙을 `js/instrument.js` 에 추가.
- **3D 키포인트**: `keypoints3D` 의 `z` 로 카메라와의 거리를 재서 음량에 반영.
- **단일 이미지 처리**: `HandDetector.detectOnce(image)` 로 정지 이미지 분석.

## 참고

- ml5.js: <https://docs.ml5js.org/#/reference/handpose>
- 모델은 TensorFlow.js 기반 HandPose 구현을 사용합니다.
- p5.js 전역 모드에는 3D 모델 로더 `loadModel()` 이 이미 존재합니다. 같은 이름의 함수를
  만들면 p5가 덮어써서 `Cannot read properties of undefined (reading 'slice')` 오류가 나므로,
  이 프로젝트에서는 `initHandPose()` 라는 이름을 사용합니다.
- `ml5.handPose()` 는 p5 1.x 에서 인스턴스를 바로 반환하고 준비 상태를 `instance.ready`
  (Promise)로 알려 줍니다. `js/detector.js` 는 두 방식을 모두 처리합니다.

