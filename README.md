<!-- GitHub Pages: main branch / root -->
# 창의컴퓨팅 II : 바이브 코딩 결과물

## 바로 플레이하기

**[🎮 게임 실행 페이지 열기](https://kisoon.github.io/creative-computing-games/)**

게임 카드의 **플레이**를 누르세요. 여러 버전이 있는 게임은 실행 화면 상단에서 버전을 선택할 수 있습니다. 키보드 게임은 PC에서 이용하고, 소리가 나오지 않으면 게임 화면을 클릭하거나 시작 버튼을 눌러 주세요.

## 반·바이브 코딩별 결과물

| 구분 | 첫 번째 바이브 코딩 | 두 번째 바이브 코딩 | 세 번째 바이브 코딩 |
| --- | --- | --- | --- |
| A반 | [p5.js Pong 실험 13묶음 · 24링크](collections/a/vibe-01/README.md) | [기존 1주차 · 10회차](collections/a/week-01/README.md) | [기존 2주차 · 11회차](collections/a/week-02/README.md) |
| B반 | [p5.js Pong 실험 5묶음 · 12링크](collections/b/vibe-01/README.md) | [8개 실행 작품 · 1건 파일 보완 대기](collections/b/week-01/README.md) | [8개 작품 · MD 실행 보완 포함](collections/b/week-02/README.md) |

슬라이드의 p5.js 링크는 첫 번째 바이브 코딩으로, 기존 1·2주차는 각각 두 번째·세 번째 바이브 코딩으로 표시합니다. 기존 로컬 작품의 파일 경로와 실행 주소는 유지합니다. 웹 아카이브에서 작은 스크린샷이나 실행 링크를 누르면 새 창에서 열립니다.

2026학년도 2학기 창의컴퓨팅 II · A·B반. [결과물 추가 방법](CONTRIBUTING.md)

## 이 아카이브에 대해

서울예술대학 2026년도 2학기 「창의컴퓨팅2」 수업에서 AI와 대화하며 만들어 본 바이브코딩 작품들입니다. 학생들의 아이디어가 게임으로 이어지는 과정과 작은 실험들을 함께 나누고자 모았습니다.

완성도보다는 직접 만들고 배우는 과정에 의미를 둔 수업 결과물입니다. 익숙한 게임이나 콘텐츠에서 영감을 받은 부분이 있을 수 있으며, 원작을 존중하는 마음으로 학습과 실험을 위해 제작했습니다.

작품에서 참고하거나 사용한 이미지·음원·캐릭터 등의 권리는 원저작자에게 있습니다. 출처나 사용과 관련해 살펴볼 부분이 있다면 편하게 알려 주세요. 확인 후 필요한 내용을 보완하겠습니다. [문의·의견 남기기](https://github.com/kisoon/creative-computing-games/issues/new)

p5.js 작품 18묶음(36링크)과 로컬 작품 40개(44개 실행 화면)를 하나의 대표 페이지에서 연결합니다. 별도 서버, 데이터베이스, API 키, 설치 과정이 없는 HTML/CSS/JavaScript 정적 웹사이트입니다.

## 파일 구성

- `index.html`: 대표 페이지
- `style.css`: 반응형 디자인
- `catalog.js`: 반·차수 설정, 게임 제목, 익명 작품 번호, 소개, 조작법, 경로, 버전 목록
- `collections/`: A·B반 × 세 번의 바이브 코딩 결과물 문서
- `CONTRIBUTING.md`: 새 결과물 등록 방법
- `play.html`, `player.js`: 게임 실행 화면
- `games/`: 원본 게임 HTML, 스크립트, 이미지, 음원
- `assets/`: `assets/previews/`는 실제 게임 첫 화면 캡처입니다. 기존 SVG 주제 일러스트도 보관합니다.

학생 학번을 디렉터리명에 사용하지 않았고, 수업 대화 로그 JSON, macOS 메타데이터, 게임 실행과 무관한 별도 제출 이미지는 포함하지 않았습니다. 리듬게임의 두 제출 버전은 버전 선택으로 함께 제공합니다. 합성음 버전에서 사용하지 않는 중복 음원 파일은 배포본에서 제외했습니다. 원본 업로드 ZIP은 수정하지 않았습니다.

## 무료 공개: Cloudflare Pages (간편 업로드)

1. 제공된 `creative-computing-games.zip`을 압축 해제합니다.
2. Cloudflare 계정으로 로그인합니다.
3. Workers & Pages에서 Pages 프로젝트 생성 / Direct Upload를 선택합니다. 공식 안내의 메뉴는 Create application → Get started → Drag and drop your files입니다.
4. `index.html`이 바로 들어 있는 폴더 전체를 업로드합니다. ZIP 안의 `website` 폴더가 해당 폴더입니다. 게임 폴더도 모두 함께 올립니다.
5. 프로젝트 이름을 정하고 Deploy site를 누릅니다.
6. 발급된 `프로젝트명.pages.dev` 주소를 공유합니다.

빌드 명령이나 환경변수는 필요하지 않습니다. 현재 구성은 드래그 업로드 한도 1,000개 파일, 파일당 25 MiB 이내입니다. Direct Upload 프로젝트는 나중에 Git 연동 방식으로 직접 전환할 수 없으므로 Git 자동 배포가 필요하면 새 프로젝트를 만듭니다.

공식 안내: https://developers.cloudflare.com/pages/get-started/direct-upload/
무료 플랜 한도: https://developers.cloudflare.com/pages/platform/limits/

## 무료 공개: GitHub Pages (기존 GitHub 활용)

1. GitHub에 새 공개 저장소를 만듭니다. 예: `creative-computing-games`.
2. ZIP의 `website` 폴더 **내용물**을 저장소 최상위에 업로드합니다. 저장소 최상위에 `index.html`, `games`, `assets`가 있어야 합니다.
3. Settings → Pages → Build and deployment에서 Deploy from a branch를 선택합니다.
4. Branch는 main, 폴더는 /(root)로 설정하고 Save를 누릅니다.
5. 배포 후 Pages 설정에 표시되는 주소를 공유합니다.

GitHub Free에서는 공개 저장소를 사용합니다. 브라우저 업로드 시에는 압축파일 자체가 아니라 압축 해제된 파일들을 올려야 합니다.
공식 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 로컬 실행

저장소 최상위 폴더에서 `python3 -m http.server 8000` 실행 후 `http://localhost:8000`을 엽니다. 일부 게임은 모듈/음원 불러오기가 필요하므로 HTML 더블클릭보다 HTTP 실행을 권장합니다.

## 사용 및 유지보수

- 카드의 플레이 버튼을 누르면 상단에 목록 복귀, 버전 선택, 다시 시작, 전체 화면, 새 탭 실행이 표시됩니다.
- 검색은 게임 제목·작품 번호·소개를 대상으로 동작합니다.
- 새 게임은 반·차수별 폴더에 넣고 `catalog.js`에 반·차수 정보와 함께 등록합니다. 홈페이지 개수는 자동 계산합니다. 자세한 절차는 [추가 안내](CONTRIBUTING.md)를 참고하세요.
- 학생 실명은 공개하지 않고 반·차수별 작품 번호로 표시합니다. 학번과 실명을 새 자료의 파일명·경로·소개에도 넣지 않습니다.
- 대표 페이지는 모바일에 대응하지만 원본 게임의 모바일 조작 지원 여부는 서로 다릅니다. 키보드 게임은 PC를 사용하세요.
- 물불 크로싱 3D와 호랑이 게임은 WebGL2가 필요합니다. 물불 크로싱은 WebGL2 미지원 시 화면에서 2D 버전으로 이동할 수 있습니다.
- 호랑이 게임은 Three.js를 jsDelivr CDN에서 불러옵니다. 달콤 옷장은 Google Fonts를 사용하며 폰트 연결 실패 시 시스템 글꼴을 사용합니다.
- 게임의 기록은 각 브라우저에 저장되며 학생별 서버 저장·로그 수집 기능은 추가하지 않았습니다.
- 게임과 음원에 기존 표기된 출처 및 라이선스는 유지했습니다. 교육 목적 안내는 별도의 이용 허락을 대신하지 않습니다.

## 점검 범위

40개 스크립트 문법과 HTML 상대 경로를 확인했습니다. 대표 페이지 검색·장르 필터, 게임 진입과 버전 선택을 브라우저에서 확인했습니다. 클라우드 점검 브라우저는 WebGL2를 지원하지 않아 3D 게임의 실제 플레이는 검증할 수 없었습니다. 모든 게임의 전체 스테이지와 모든 기기의 호환성 검증은 포함하지 않습니다.

검토일: 2026-11-20.

### 실행 링크 및 프리뷰 갱신 · 2026-11-23

Chrome에서 16개 실행 화면을 직접 열어 첫 화면을 캡처했습니다. 첫 화면 로딩 중 JavaScript 오류가 없음을 확인했고, 12개 카드 이미지 로딩, 검색·장르 필터, 버전별 실행 링크, 모바일 가로 넘침을 점검했습니다. 3D 게임도 첫 화면 렌더링을 확인했습니다. 게임 전체 스테이지 플레이 검증은 포함하지 않습니다.
