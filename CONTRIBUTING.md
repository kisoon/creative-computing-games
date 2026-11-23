# 결과물 추가 안내

A·B반 × 첫 번째·두 번째·세 번째 바이브 코딩으로 관리합니다. 첫 번째는 9회차 p5.js 링크, 두 번째는 기존 1주차(10회차), 세 번째는 기존 2주차(11회차)입니다.

## 파일 배치

- 기존 A반 두 번째 바이브 코딩: 기존 실행 주소를 유지하도록 `games/game-01/` 등의 경로를 그대로 사용합니다.
- 신규 결과물: `games/a/week-02/team-01/index.html`처럼 반·차수·작품별로 저장합니다.
- 프리뷰: `assets/previews/a-week-02-team-01.jpg`처럼 중복되지 않는 이름으로 저장합니다.
- 결과물 문서: `collections/a/week-02/README.md`를 갱신합니다. 이미지 폭은 160px로 맞춥니다.

## 등록 순서

1. 작품 폴더에 HTML·CSS·JavaScript와 사용하는 이미지·음원을 모두 넣습니다. 상대 경로를 확인합니다.
2. 브라우저에서 실행해 첫 화면을 캡처하고 프리뷰 파일을 저장합니다.
3. `catalog.js`의 `window.GAMES` 배열에 아래 형식으로 항목을 추가합니다. ID는 전체 아카이브에서 유일해야 하며, 기존 ID는 바꾸지 않습니다.
4. 해당 반·차수 문서에 익명 작품 번호·소개·실행 링크·작은 프리뷰를 추가하고, 루트 README의 등록 상태와 개수를 갱신합니다.
5. 목록 필터, 실행 링크, 이미지 로딩, 모바일 배치를 확인한 후 main에 반영합니다. GitHub Pages가 자동 배포합니다.

```javascript
{
  id: "a-week-02-team-01",
  classroom: "A", // "A" 또는 "B"
  round: 3,       // 첫 번째=1, 두 번째=2, 세 번째=3
  title: "게임 제목",
  by: "작품 01", // 학생 실명·학번을 입력하지 않습니다.
  category: "퍼즐", // 기존 장르 사용 또는 index.html의 장르 버튼 추가
  description: "게임 소개",
  controls: "조작법",
  path: "games/a/week-02/team-01/index.html",
  art: "assets/previews/a-week-02-team-01.jpg",
  versions: [{
    label: "대표 버전",
    path: "games/a/week-02/team-01/index.html",
    preview: "assets/previews/a-week-02-team-01.jpg"
  }]
}
```

직접 실행 주소는 `https://kisoon.github.io/creative-computing-games/play.html?game=a-week-02-team-01`입니다. 반·차수 목록 주소는 `?class=A&round=3#collection`입니다. 홈페이지의 전체 개수와 반·차수별 개수는 등록 자료를 기준으로 자동 계산되며, 미등록 묶음은 등록 예정으로 표시됩니다.

## 공개본의 이름 표기

학생 실명과 학번은 목록, 문서, 경로와 프리뷰에 넣지 않습니다. `by`에는 해당 반·차수의 작품 번호만 기록합니다. 작품 안에 실명이 있다면 이름 표기만 익명화하고 그 변경을 검증 문서에 남깁니다. 제3자의 저작권·라이선스에 필요한 출처 및 브랜드·작품명은 학생 이름과 구분해 유지합니다.

## p5.js 외부 링크

첫 번째 바이브 코딩은 `external: true`, `round: 1`로 등록하고 `versions`에 p5.js 원본 실행 URL과 작은 스크린샷 경로를 넣습니다. 원본 코드를 복제하거나 표현을 고치지 않습니다. 링크는 항상 `target="_blank"`로 열며, 스크린샷은 종횡비를 유지합니다. 기존 `?week=1`과 `?week=2` 주소도 각각 두 번째·세 번째 바이브 코딩으로 연결됩니다.
