// DOM 오버레이(시작/로딩/에러/힌트) 제어.

const screens = {
  start: document.getElementById("screen-start"),
  loading: document.getElementById("screen-loading"),
  error: document.getElementById("screen-error"),
};

const hintBar = document.getElementById("hintBar");
const loadingText = document.getElementById("loadingText");
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");

export function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle("hidden", key !== name);
  }
}

export function setLoading(text) {
  loadingText.textContent = text;
}

export function showError(title, message) {
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  showScreen("error");
}

export function setHint(text) {
  hintBar.textContent = text;
  hintBar.classList.toggle("hidden", !text);
}

export function describeCameraError(err) {
  const name = err?.name || "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return [
        "카메라 권한이 필요해요",
        "주소창의 카메라 아이콘을 눌러 허용한 뒤 다시 시도해 주세요.",
      ];
    case "NotFoundError":
    case "DevicesNotFoundError":
      return ["카메라를 찾을 수 없어요", "카메라가 연결되어 있는지 확인해 주세요."];
    case "NotReadableError":
    case "TrackStartError":
      return [
        "카메라를 켤 수 없어요",
        "다른 앱(화상회의 등)이 카메라를 쓰고 있다면 종료한 뒤 다시 시도해 주세요.",
      ];
    case "OverconstrainedError":
      return [
        "카메라 설정을 맞출 수 없어요",
        "다른 카메라를 선택하거나 브라우저를 다시 시작해 주세요.",
      ];
    case "SecurityError":
      return [
        "보안 연결이 필요해요",
        "https:// 주소이거나 http://localhost 에서 열어야 카메라를 쓸 수 있어요.",
      ];
    default:
      return [
        "카메라를 시작하지 못했어요",
        "브라우저를 최신 버전으로 업데이트하고 다시 시도해 주세요.",
      ];
  }
}
