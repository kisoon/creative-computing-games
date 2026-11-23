# 손끝 마법 — MVP

ml5.js `handPose`(MediaPipe Hands, 21 keypoints)로 손가락 제스처를 읽어 불꽃을 만들고, 조준하고, 발사하고, 방어막을 펼치는 최소 동작 버전입니다.

## 실행

```bash
cd "작품 폴더"
LANG=en_US.UTF-8 ruby -E UTF-8 -run -e httpd . -p 8000
```

브라우저에서 <http://localhost:8000> 을 열고 웹캠 권한을 허용하세요.
(`file://`로 열면 웹캠이 동작하지 않습니다.)

> 폴더 이름에 한글이 있어 macOS 기본 WEBrick이 500 에러를 냅니다. 위처럼 `LANG`/`-E UTF-8`을 붙이면 해결됩니다.
> Node가 있다면 `npx serve -l 8000` 도 됩니다.

## 조작

| 자세 / 키 | 의미 |
|---|---|
| 엄지+검지 (권총), 200ms 유지 | 불꽃 생성 + 조준 |
| 손을 움직임 | 조준 방향 갱신 (멈추면 유지) |
| **주먹 쥐기**, 120ms | 조준 방향으로 불꽃 발사 |
| 다섯 손가락 모두 펴기, 250ms | 방어막 (손을 따라옴) |

> 발사는 손가락 하나를 떼는 대신 **손 전체의 벌어짐(openness)** 으로 판정합니다.
> 주먹은 MediaPipe가 훨씬 안정적으로 잡아주고, 오인도 적습니다.

카메라가 없을 때: **K** 로 시뮬레이션 모드, 마우스로 손 위치를 조작하고 `F`/`L`/`S` 키로 자세를 흉내냅니다.

- `R` 재시작
- `D` 디버그 HUD 토글

## 테스트용 훅

콘솔에서 상태를 직접 볼 수 있습니다.

```js
__magic.gestures.state   // IDLE / CHARGE / LAUNCH / SHIELD
__magic.gestures.charge  // 0~1
__magic.game.score
__magic.feat             // 현재 손 피처 (openness, isFist, aim, ext ...)
```

## 게임 규칙 (테스트용)

- 떨어지는 불씨를 피해 불꽃을 쏴서 **촛불 3개**를 점화하면 클리어
- 촛불 점화 +100, 불씨 방어 +50, 촛불이 꺼지면 −50
- 어둡기 때문에 불꽃으로 시야를 밝혀야 한다

## 파일 구조

```
index.html
src/
  config.js     모든 임계값 (튜닝은 여기서)
  util.js       수학 유틸
  hand.js       21 keypoints → curl / openness / palm / speed / aim
  gestures.js   제스처 상태 머신 (IDLE/CHARGE/LAUNCH/SHIELD)
  game.js       촛불, 불씨, 방어막, 불꽃, 조명
  main.js       p5 루프, 렌더링, HUD, 키보드 시뮬
```

## 튜닝 포인트

디버그 HUD(`D`)의 `open` 값이 핵심입니다.

| 손 모양 | openness 대략 |
|---|---|
| 주먹 | 0.2 ~ 0.4 |
| 권총(불꽃) | 0.8 ~ 0.9 |
| 활짝 편 손 | 1.3 ~ 1.6 |

- **발사(주먹)가 너무 안 됨** → `fistOpenness` 올리기 (기본 0.55)
- **주먹 아닌데 발사됨** → `fistOpenness` 내리기 (기본 0.55 → 0.45)
- **방어막이 너무 안 됨** → `openOpenness` 내리기 (기본 1.15)
- **불꽃이 안 잡힘** → `thumbOpenDeg` 조정 (권총 자세에서 60~90°면 정상)
- **불꽃이 금방 사라짐** → `orbLifeMs` 올리기
- **발사가 너무 민감** → `fistHoldMs` 올리기 (기본 120ms)

## 알려진 한계 (MVP)

- 한 손만 사용
- 불꽃 자세는 여전히 엄지 각도에 의존 (발사/방어막은 손 전체 모양이라 안정적)
- 조명/배경에 따라 인식률 편차
