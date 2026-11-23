
/*
  IMPRO SCRIPT 6.1
  신체 움직임 기반 희곡 창작 시스템

  p5.js 2.0.3
  ml5.js 1.x
  MoveNet MultiPose

  외부 생성형 AI API 사용하지 않음
*/

// =====================================
// 1. 기본 변수
// =====================================

let video;
let bodyPose;
let poses = [];
let connections = [];

let modelReady = false;
let recording = false;

let actors = [];
let events = [];
let scriptText = "";

let startTime = 0;
let lastAnalysis = 0;

let logBox;
let scriptBox;

let genreSelect;
let relationSelect;
let conflictSelect;
let lengthSelect;

let relationMemory = {};

const CONF = 0.3;
const ANALYSIS_MS = 180;

const JOINTS = [
  ["left_wrist", "왼손목"],
  ["right_wrist", "오른손목"],
  ["left_elbow", "왼팔꿈치"],
  ["right_elbow", "오른팔꿈치"],
  ["left_shoulder", "왼어깨"],
  ["right_shoulder", "오른어깨"],
  ["left_knee", "왼무릎"],
  ["right_knee", "오른무릎"],
  ["left_ankle", "왼발목"],
  ["right_ankle", "오른발목"],
  ["nose", "고개"]
];

// =====================================
// 2. 배우 데이터
// =====================================

function makeActor(name) {
  return {
    name: name,
    pose: null,
    x: null,
    y: null,

    previous: {},
    smooth: {},
    motions: {},
    states: {},

    centerHistory: null,
    stillSince: null,
    stillLogged: false
  };
}

function resetTracking() {
  actors = [
    makeActor("A"),
    makeActor("B")
  ];

  lastAnalysis = 0;

  relationMemory = {
    distance: null,
    time: 0,
    close: false,
    cooldowns: {}
  };
}

// =====================================
// 3. 초기 설정
// =====================================

async function setup() {
  let canvas = createCanvas(640, 480);
  canvas.parent("canvas-container");

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  buildUI();
  resetTracking();

  setStatus("두 배우 인식 모델을 불러오는 중...");

  try {
    bodyPose = await ml5.bodyPose("MoveNet", {
      modelType: "MULTIPOSE_LIGHTNING",
      enableTracking: true,
      maxPoses: 2,
      flipped: false
    });

    connections = bodyPose.getSkeleton();

    window.Ml5Runtime.start(bodyPose, video, gotPoses);

    modelReady = true;

    setStatus(
      "준비 완료! 두 배우가 카메라 앞에 서주세요."
    );

  } catch (error) {
    console.error(error);

    setStatus(
      "BodyPose 모델 로딩에 실패했습니다."
    );
  }
}

// =====================================
// 4. 사용자 인터페이스
// =====================================

function buildUI() {
  let root = select("#interface");

  let recordPanel = createDiv();
  recordPanel.class("panel");
  recordPanel.parent(root);

  createElement(
    "h2",
    "01. 신체 즉흥 기록"
  ).parent(recordPanel);

  let controls = createDiv();
  controls.class("controls");
  controls.parent(recordPanel);

  makeButton(
    "● 기록 시작",
    startRecording,
    controls
  );

  makeButton(
    "■ 기록 종료",
    stopRecording,
    controls
  );

  makeButton(
    "초기화",
    resetAll,
    controls
  );

  makeButton(
    "행동 기록 저장",
    downloadEvents,
    controls
  );

  let hint = createP(
    "두 배우가 팔, 어깨, 상체, 무릎, " +
    "고개를 움직여보세요. 움직임을 " +
    "마친 뒤 잠시 멈추면 기록하기 쉽습니다."
  );

  hint.class("hint");
  hint.parent(recordPanel);

  logBox = createDiv(
    "아직 기록된 행동이 없습니다."
  );

  logBox.class("output");
  logBox.parent(recordPanel);

  let storyPanel = createDiv();
  storyPanel.class("panel");
  storyPanel.parent(root);

  createElement(
    "h2",
    "02. 극적 조건 설정"
  ).parent(storyPanel);

  genreSelect = makeSelect(
    storyPanel,
    "장르",
    [
      ["리얼리즘", "realism"],
      ["스릴러", "thriller"],
      ["로맨스", "romance"],
      ["블랙코미디", "comedy"],
      ["부조리극", "absurd"]
    ]
  );

  relationSelect = makeSelect(
    storyPanel,
    "인물 관계",
    [
      ["무작위", "random"],
      ["연인", "lovers"],
      ["가족", "family"],
      ["친구", "friends"],
      ["경쟁자", "rivals"],
      ["낯선 사람", "strangers"],
      ["비밀을 공유한 동료", "partners"]
    ]
  );

  conflictSelect = makeSelect(
    storyPanel,
    "갈등",
    [
      ["무작위", "random"],
      ["숨겨진 비밀", "secret"],
      ["배신", "betrayal"],
      ["이별", "farewell"],
      ["잃어버린 물건", "missing"],
      ["오해", "misunderstanding"],
      ["선택의 순간", "choice"]
    ]
  );

  lengthSelect = makeSelect(
    storyPanel,
    "대본 길이",
    [
      ["짧게", "short"],
      ["보통", "medium"],
      ["길게", "long"]
    ]
  );

  lengthSelect.selected("medium");

  let scriptControls = createDiv();
  scriptControls.class("controls");
  scriptControls.parent(storyPanel);

  makeButton(
    "희곡 창작하기",
    generateScript,
    scriptControls
  );

  makeButton(
    "같은 움직임으로 재창작",
    generateScript,
    scriptControls
  );

  makeButton(
    "희곡 다운로드",
    downloadScript,
    scriptControls
  );

  createElement(
    "h2",
    "03. 완성된 희곡"
  ).parent(storyPanel);

  scriptBox = createDiv(
    "연기를 기록한 뒤 희곡을 생성하세요."
  );

  scriptBox.id("script-output");
  scriptBox.class("output");
  scriptBox.parent(storyPanel);
}

function makeButton(label, callback, parent) {
  let button = createButton(label);

  button.parent(parent);
  button.mousePressed(callback);

  return button;
}

function makeSelect(parent, label, options) {
  let field = createDiv();

  field.class("field");
  field.parent(parent);

  createElement(
    "label",
    label
  ).parent(field);

  let selectBox = createSelect();
  selectBox.parent(field);

  for (let item of options) {
    selectBox.option(item[0], item[1]);
  }

  return selectBox;
}

function setStatus(message) {
  let element = document.getElementById("status");

  if (element) {
    element.textContent = message;
  }
}

// =====================================
// 5. BodyPose 데이터
// =====================================

function gotPoses(results) {
  poses = results || [];
}

function draw() {
  background(18);

  if (video) {
    image(video, 0, 0, width, height);
  }

  updateActors();

  for (let actor of actors) {
    if (actor.pose) {
      drawSkeleton(actor);
    }
  }

  if (
    recording &&
    millis() - lastAnalysis >= ANALYSIS_MS
  ) {
    analyzeActors();
    analyzeRelationship();

    lastAnalysis = millis();
  }

  noStroke();

  fill(0, 0, 0, 190);
  rect(10, 10, 290, 76, 8);

  fill(
    recording ? "#ff6464" : "#ffffff"
  );

  textSize(16);
  textAlign(LEFT, TOP);

  text(
    recording ? "● REC 기록 중" : "○ 대기 중",
    20,
    19
  );

  fill(255);
  textSize(14);

  text(
    "인식된 사람: " + poses.length + "명",
    20,
    49
  );
}

// =====================================
// 6. 관절 좌표 가져오기
// 중요: p5.js point()와 충돌 방지
// =====================================

function getBodyPoint(pose, name) {
  if (!pose || !pose.keypoints) {
    return null;
  }

  let p = pose.keypoints.find(
    k => k.name === name
  );

  if (!p) {
    return null;
  }

  let confidence =
    p.confidence ?? p.score ?? 0;

  if (confidence < CONF) {
    return null;
  }

  return p;
}

function getBodyCenter(pose) {
  let left = getBodyPoint(
    pose,
    "left_shoulder"
  );

  let right = getBodyPoint(
    pose,
    "right_shoulder"
  );

  if (!left || !right) {
    return null;
  }

  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2
  };
}

// =====================================
// 7. 배우 A/B 추적
// =====================================

function updateActors() {
  let found = [];

  for (let pose of poses) {
    let center = getBodyCenter(pose);

    if (center) {
      found.push({
        pose: pose,
        x: center.x,
        y: center.y
      });
    }
  }

  found = found.slice(0, 2);

  for (let actor of actors) {
    actor.pose = null;
  }

  if (found.length === 0) {
    return;
  }

  if (actors.every(a => a.x === null)) {
    found.sort((a, b) => a.x - b.x);

    for (let i = 0; i < found.length; i++) {
      assignActor(actors[i], found[i]);
    }

    return;
  }

  if (found.length === 2) {
    if (actors.some(a => a.x === null)) {
      found.sort((a, b) => a.x - b.x);

      assignActor(actors[0], found[0]);
      assignActor(actors[1], found[1]);

      return;
    }

    let direct =
      dist(
        actors[0].x,
        actors[0].y,
        found[0].x,
        found[0].y
      ) +
      dist(
        actors[1].x,
        actors[1].y,
        found[1].x,
        found[1].y
      );

    let swapped =
      dist(
        actors[0].x,
        actors[0].y,
        found[1].x,
        found[1].y
      ) +
      dist(
        actors[1].x,
        actors[1].y,
        found[0].x,
        found[0].y
      );

    if (direct <= swapped) {
      assignActor(actors[0], found[0]);
      assignActor(actors[1], found[1]);
    } else {
      assignActor(actors[0], found[1]);
      assignActor(actors[1], found[0]);
    }

    return;
  }

  let f = found[0];

  let distanceA = actors[0].x === null
    ? Infinity
    : dist(
        actors[0].x,
        actors[0].y,
        f.x,
        f.y
      );

  let distanceB = actors[1].x === null
    ? Infinity
    : dist(
        actors[1].x,
        actors[1].y,
        f.x,
        f.y
      );

  assignActor(
    distanceA <= distanceB
      ? actors[0]
      : actors[1],
    f
  );
}

function assignActor(actor, found) {
  actor.pose = found.pose;
  actor.x = found.x;
  actor.y = found.y;
}

// =====================================
// 8. 관절 시각화
// =====================================

function drawSkeleton(actor) {
  let skeletonColor =
    actor.name === "A"
      ? color(0, 255, 160)
      : color(80, 175, 255);

  for (let pair of connections) {
    let a = actor.pose.keypoints[pair[0]];
    let b = actor.pose.keypoints[pair[1]];

    if (!a || !b) {
      continue;
    }

    let confidenceA =
      a.confidence ?? a.score ?? 0;

    let confidenceB =
      b.confidence ?? b.score ?? 0;

    if (
      confidenceA >= CONF &&
      confidenceB >= CONF
    ) {
      stroke(skeletonColor);
      strokeWeight(3);

      line(
        a.x,
        a.y,
        b.x,
        b.y
      );
    }
  }

  for (let p of actor.pose.keypoints) {
    let confidence =
      p.confidence ?? p.score ?? 0;

    if (confidence >= CONF) {
      noStroke();
      fill(255, 215, 0);

      circle(p.x, p.y, 7);
    }
  }

  noStroke();
  fill(skeletonColor);

  textSize(22);
  textAlign(CENTER, BOTTOM);

  text(
    "배우 " + actor.name,
    actor.x,
    actor.y - 32
  );
}

// =====================================
// 9. 움직임 보정
// =====================================

function smoothBodyPoint(actor, key, raw) {
  let old = actor.smooth[key];

  let next;

  if (old) {
    next = {
      x: old.x * 0.55 + raw.x * 0.45,
      y: old.y * 0.55 + raw.y * 0.45
    };
  } else {
    next = {
      x: raw.x,
      y: raw.y
    };
  }

  actor.smooth[key] = next;

  return next;
}

function getBodyScale(pose) {
  let ls = getBodyPoint(
    pose,
    "left_shoulder"
  );

  let rs = getBodyPoint(
    pose,
    "right_shoulder"
  );

  let lh = getBodyPoint(
    pose,
    "left_hip"
  );

  let rh = getBodyPoint(
    pose,
    "right_hip"
  );

  if (ls && rs && lh && rh) {
    let shoulderY = (ls.y + rs.y) / 2;
    let hipY = (lh.y + rh.y) / 2;

    return Math.max(
      55,
      Math.abs(hipY - shoulderY)
    );
  }

  return 100;
}

function getMotionDirection(dx, dy) {
  if (
    Math.abs(dx) >
    Math.abs(dy) * 1.4
  ) {
    return dx > 0
      ? "오른쪽"
      : "왼쪽";
  }

  if (
    Math.abs(dy) >
    Math.abs(dx) * 1.4
  ) {
    return dy > 0
      ? "아래쪽"
      : "위쪽";
  }

  let vertical =
    dy > 0 ? "아래" : "위";

  let horizontal =
    dx > 0 ? "오른쪽" : "왼쪽";

  return vertical +
    horizontal +
    " 대각선";
}

function getMotionQuality(speed) {
  if (speed > 1.4) {
    return "급하게";
  }

  if (speed > 0.55) {
    return "빠르게";
  }

  return "천천히";
}

// =====================================
// 10. 신체 움직임 분석
// =====================================

function analyzeActors() {
  let now = millis();

  for (let actor of actors) {
    if (!actor.pose) {
      actor.previous = {};
      actor.smooth = {};
      actor.motions = {};
      actor.centerHistory = null;
      actor.stillSince = null;

      continue;
    }

    let pose = actor.pose;
    let scale = getBodyScale(pose);

    let ls = getBodyPoint(
      pose,
      "left_shoulder"
    );

    let rs = getBodyPoint(
      pose,
      "right_shoulder"
    );

    let lh = getBodyPoint(
      pose,
      "left_hip"
    );

    let rh = getBodyPoint(
      pose,
      "right_hip"
    );

    let origin;

    if (ls && rs && lh && rh) {
      origin = {
        x: (
          ls.x + rs.x +
          lh.x + rh.x
        ) / 4,

        y: (
          ls.y + rs.y +
          lh.y + rh.y
        ) / 4
      };
    } else {
      origin = {
        x: actor.x,
        y: actor.y
      };
    }

    for (let item of JOINTS) {
      let key = item[0];
      let label = item[1];

      let raw = getBodyPoint(
        pose,
        key
      );

      if (!raw) {
        delete actor.previous[key];
        delete actor.motions[key];

        continue;
      }

      let p = smoothBodyPoint(
        actor,
        key,
        raw
      );

      let current = {
        x: (p.x - origin.x) / scale,
        y: (p.y - origin.y) / scale,
        time: now
      };

      let old = actor.previous[key];

      if (old) {
        let dt =
          (now - old.time) / 1000;

        if (dt > 0) {
          let dx = current.x - old.x;
          let dy = current.y - old.y;

          let speed =
            Math.hypot(dx, dy) / dt;

          updateJointMotion(
            actor,
            key,
            label,
            dx,
            dy,
            speed,
            now
          );
        }
      }

      actor.previous[key] = current;
    }

    analyzeJointAngles(actor);
    analyzeBodyPosture(actor);
    analyzeBodyTravel(actor, now);
  }
}

// =====================================
// 11. 관절 움직임 시작과 정지
// =====================================

function updateJointMotion(
  actor,
  key,
  label,
  dx,
  dy,
  speed,
  now
) {
  let motion = actor.motions[key];

  if (!motion) {
    if (speed > 0.18) {
      actor.motions[key] = {
        start: now,
        dx: dx,
        dy: dy,
        maxSpeed: speed,
        quietSince: null
      };
    }

    return;
  }

  if (speed > 0.09) {
    motion.dx += dx;
    motion.dy += dy;

    motion.maxSpeed = Math.max(
      motion.maxSpeed,
      speed
    );

    motion.quietSince = null;
  } else {
    if (motion.quietSince === null) {
      motion.quietSince = now;
    }

    if (
      now - motion.quietSince > 350
    ) {
      let distance = Math.hypot(
        motion.dx,
        motion.dy
      );

      let duration =
        now - motion.start;

      if (
        distance > 0.19 &&
        duration > 350
      ) {
        let direction =
          getMotionDirection(
            motion.dx,
            motion.dy
          );

        let quality =
          getMotionQuality(
            motion.maxSpeed
          );

        let sentence;

        if (key === "nose") {
          sentence =
            "고개를 " +
            direction +
            "으로 " +
            quality +
            " 움직인다.";
        } else {
          sentence =
            label +
            "을 " +
            direction +
            "으로 " +
            quality +
            " 움직인다.";
        }

        addEvent(
          actor.name,
          "joint",
          sentence,
          {
            key: key,
            direction: direction,
            quality: quality,
            duration: duration
          }
        );
      }

      delete actor.motions[key];
    }
  }
}

// =====================================
// 12. 관절 각도 계산
// =====================================

function getJointAngle(a, b, c) {
  if (!a || !b || !c) {
    return null;
  }

  let x1 = a.x - b.x;
  let y1 = a.y - b.y;

  let x2 = c.x - b.x;
  let y2 = c.y - b.y;

  let magnitude =
    Math.hypot(x1, y1) *
    Math.hypot(x2, y2);

  if (magnitude < 1) {
    return null;
  }

  let cosine =
    (x1 * x2 + y1 * y2) /
    magnitude;

  cosine = Math.max(
    -1,
    Math.min(1, cosine)
  );

  return Math.acos(cosine) *
    180 / Math.PI;
}

function analyzeJointAngles(actor) {
  let definitions = [
    [
      "leftArm",
      "왼팔",
      "left_shoulder",
      "left_elbow",
      "left_wrist"
    ],
    [
      "rightArm",
      "오른팔",
      "right_shoulder",
      "right_elbow",
      "right_wrist"
    ],
    [
      "leftKnee",
      "왼무릎",
      "left_hip",
      "left_knee",
      "left_ankle"
    ],
    [
      "rightKnee",
      "오른무릎",
      "right_hip",
      "right_knee",
      "right_ankle"
    ]
  ];

  for (let item of definitions) {
    let key = item[0];
    let label = item[1];

    let angle = getJointAngle(
      getBodyPoint(actor.pose, item[2]),
      getBodyPoint(actor.pose, item[3]),
      getBodyPoint(actor.pose, item[4])
    );

    if (angle === null) {
      continue;
    }

    let state;

    if (angle < 110) {
      state = "bend";
    } else if (angle > 155) {
      state = "extend";
    } else {
      state = "middle";
    }

    let previous =
      actor.states[key];

    if (
      previous !== undefined &&
      state !== previous &&
      state !== "middle"
    ) {
      let sentence =
        label +
        (state === "bend"
          ? "을 굽힌다."
          : "을 편다.");

      addEvent(
        actor.name,
        "angle",
        sentence,
        {
          key: key,
          state: state
        }
      );
    }

    actor.states[key] = state;
  }
}

// =====================================
// 13. 상체와 어깨 분석
// =====================================

function analyzeBodyPosture(actor) {
  let pose = actor.pose;

  let ls = getBodyPoint(
    pose,
    "left_shoulder"
  );

  let rs = getBodyPoint(
    pose,
    "right_shoulder"
  );

  let lh = getBodyPoint(
    pose,
    "left_hip"
  );

  let rh = getBodyPoint(
    pose,
    "right_hip"
  );

  if (!ls || !rs || !lh || !rh) {
    return;
  }

  let shoulderX =
    (ls.x + rs.x) / 2;

  let shoulderY =
    (ls.y + rs.y) / 2;

  let hipX =
    (lh.x + rh.x) / 2;

  let hipY =
    (lh.y + rh.y) / 2;

  let torso = Math.max(
    40,
    Math.abs(hipY - shoulderY)
  );

  let lean =
    (shoulderX - hipX) / torso;

  let leanState =
    lean > 0.3
      ? "right"
      : lean < -0.3
      ? "left"
      : "center";

  if (
    actor.states.lean !== undefined &&
    actor.states.lean !== leanState &&
    leanState !== "center"
  ) {
    let direction =
      leanState === "right"
        ? "오른쪽"
        : "왼쪽";

    addEvent(
      actor.name,
      "posture",
      "상체를 화면 " +
      direction +
      "으로 기울인다.",
      { state: leanState }
    );
  }

  actor.states.lean = leanState;

  let shoulderTilt =
    (ls.y - rs.y) /
    Math.max(
      40,
      Math.abs(ls.x - rs.x)
    );

  let shoulderState =
    shoulderTilt > 0.23
      ? "leftLow"
      : shoulderTilt < -0.23
      ? "rightLow"
      : "level";

  if (
    actor.states.shoulder !== undefined &&
    actor.states.shoulder !== shoulderState &&
    shoulderState !== "level"
  ) {
    let sentence =
      shoulderState === "leftLow"
        ? "왼어깨를 낮춘다."
        : "오른어깨를 낮춘다.";

    addEvent(
      actor.name,
      "shoulder",
      sentence,
      {
        state: shoulderState
      }
    );
  }

  actor.states.shoulder =
    shoulderState;
}

// =====================================
// 14. 전신 이동과 정지
// =====================================

function analyzeBodyTravel(actor, now) {
  let current = {
    x: actor.x / width,
    y: actor.y / height,
    time: now
  };

  let old = actor.centerHistory;

  if (old) {
    let dt =
      (now - old.time) / 1000;

    if (dt > 0) {
      let dx =
        current.x - old.x;

      let dy =
        current.y - old.y;

      let speed =
        Math.hypot(dx, dy) / dt;

      if (Math.abs(dx) > 0.045) {
        let direction =
          dx > 0
            ? "오른쪽"
            : "왼쪽";

        addEvent(
          actor.name,
          "travel",
          "화면 " +
          direction +
          "으로 이동한다.",
          { direction: direction }
        );
      }

      if (speed < 0.025) {
        if (actor.stillSince === null) {
          actor.stillSince = now;
        }

        if (
          now - actor.stillSince > 1500 &&
          !actor.stillLogged
        ) {
          addEvent(
            actor.name,
            "still",
            "몸의 중심 이동을 멈추고 잠시 서 있는다.",
            {}
          );

          actor.stillLogged = true;
        }
      } else {
        actor.stillSince = null;
        actor.stillLogged = false;
      }
    }
  }

  actor.centerHistory = current;
}

// =====================================
// 15. 두 배우의 거리 변화
// =====================================

function analyzeRelationship() {
  let a = actors[0];
  let b = actors[1];

  if (!a.pose || !b.pose) {
    relationMemory.distance = null;
    relationMemory.close = false;
    return;
  }

  let now = millis();

  let dx =
    (a.x - b.x) / width;

  let dy =
    (a.y - b.y) / height;

  let distance =
    Math.hypot(dx, dy);

  if (
    distance < 0.23 &&
    !relationMemory.close
  ) {
    addEvent(
      "AB",
      "close",
      "두 배우가 가까운 거리에 선다.",
      {}
    );
  }

  relationMemory.close =
    distance < 0.23;

  if (
    relationMemory.distance !== null &&
    now - relationMemory.time > 700
  ) {
    let change =
      distance -
      relationMemory.distance;

    if (change < -0.045) {
      addEvent(
        "AB",
        "approach",
        "두 배우 사이의 거리가 좁혀진다.",
        {}
      );
    } else if (change > 0.045) {
      addEvent(
        "AB",
        "separate",
        "두 배우 사이의 거리가 벌어진다.",
        {}
      );
    }
  }

  if (
    now - relationMemory.time > 700
  ) {
    relationMemory.distance = distance;
    relationMemory.time = now;
  }
}

// =====================================
// 16. 행동 기록
// =====================================

function addEvent(
  actor,
  type,
  sentence,
  details
) {
  if (!recording) {
    return;
  }

  let now = millis();

  let key =
    actor + "|" +
    type + "|" +
    sentence;

  let last =
    relationMemory.cooldowns[key];

  if (
    last !== undefined &&
    now - last < 1800
  ) {
    return;
  }

  relationMemory.cooldowns[key] = now;

  events.push({
    time: now - startTime,
    actor: actor,
    type: type,
    sentence: sentence,
    details: details
  });

  updateLog();
}

function formatTime(ms) {
  let seconds =
    Math.floor(ms / 1000);

  let minutes =
    Math.floor(seconds / 60);

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0")
  );
}

function updateLog() {
  let lines = events.map(event => {
    let who =
      event.actor === "AB"
        ? "두 배우"
        : "배우 " + event.actor;

    return (
      "[" +
      formatTime(event.time) +
      "] " +
      who +
      " — " +
      event.sentence
    );
  });

  logBox.elt.textContent =
    lines.length
      ? lines.join("\n")
      : "아직 기록된 행동이 없습니다.";

  logBox.elt.scrollTop =
    logBox.elt.scrollHeight;
}

// =====================================
// 17. 기록 제어
// =====================================

function startRecording() {
  if (!modelReady) {
    setStatus(
      "AI 모델이 준비될 때까지 기다려주세요."
    );
    return;
  }

  recording = true;

  events = [];
  scriptText = "";

  startTime = millis();

  resetTracking();
  updateLog();

  scriptBox.elt.textContent =
    "신체 움직임을 기록하고 있습니다.";

  setStatus(
    "● 신체 움직임 기록 중..."
  );
}

function stopRecording() {
  if (!recording) {
    return;
  }

  recording = false;

  setStatus(
    "기록 완료! " +
    events.length +
    "개의 행동을 기록했습니다."
  );
}

function resetAll() {
  recording = false;

  events = [];
  scriptText = "";

  resetTracking();
  updateLog();

  scriptBox.elt.textContent =
    "연기를 기록한 뒤 희곡을 생성하세요.";

  setStatus("초기화 완료");
}

function downloadEvents() {
  if (!events.length) {
    setStatus(
      "저장할 행동 기록이 없습니다."
    );
    return;
  }

  let lines = events.map(event => {
    return (
      "[" +
      formatTime(event.time) +
      "] " +
      event.actor +
      ": " +
      event.sentence
    );
  });

  saveStrings(
    [
      "IMPRO SCRIPT 행동 기록",
      ...lines
    ],
    "impro-actions",
    "txt"
  );
}

// =====================================
// 18. 인물 관계 데이터
// =====================================

const RELATIONS = {
  lovers: {
    name: "연인",
    roles: [
      "떠나려는 사람",
      "붙잡으려는 사람"
    ],
    history: [
      "오랫동안 서로에게 중요한 말을 숨겨왔다.",
      "한 사람은 이미 관계를 정리하기로 결심했다.",
      "둘은 같은 사건을 전혀 다르게 기억한다."
    ]
  },

  family: {
    name: "가족",
    roles: [
      "집을 떠났던 사람",
      "남아 있던 사람"
    ],
    history: [
      "오래전 가족의 선택이 아직도 상처로 남아 있다.",
      "서로를 위한다는 말이 갈등의 원인이 되었다.",
      "두 사람은 마지막으로 만난 날을 다르게 기억한다."
    ]
  },

  friends: {
    name: "친구",
    roles: [
      "진실을 확인하려는 사람",
      "말을 피하는 사람"
    ],
    history: [
      "오랜 우정이 단 한 번의 사건으로 흔들렸다.",
      "둘 중 한 사람만 알고 있는 사실이 있다.",
      "함께했던 약속을 서로 다르게 이해하고 있다."
    ]
  },

  rivals: {
    name: "경쟁자",
    roles: [
      "기회를 지키려는 사람",
      "기회를 빼앗긴 사람"
    ],
    history: [
      "같은 자리를 두고 오래 경쟁해 왔다.",
      "누군가의 성공에는 설명되지 않은 빈틈이 있다.",
      "둘은 서로를 인정하면서도 믿지 못한다."
    ]
  },

  strangers: {
    name: "낯선 사람",
    roles: [
      "질문하는 사람",
      "대답을 피하는 사람"
    ],
    history: [
      "두 사람은 오늘 처음 만났다고 주장한다.",
      "낯선 공간에서 서로의 존재를 의심한다.",
      "둘 중 한 사람은 상대를 이미 알고 있다."
    ]
  },

  partners: {
    name: "비밀을 공유한 동료",
    roles: [
      "비밀을 지키려는 사람",
      "고백하려는 사람"
    ],
    history: [
      "두 사람만 아는 사건이 있었다.",
      "오래전의 약속이 이제는 위협이 되었다.",
      "한 사람이 약속을 깨려고 한다."
    ]
  }
};

// =====================================
// 19. 갈등 데이터
// =====================================

const CONFLICTS = {
  secret: {
    name: "숨겨진 비밀",
    object: "봉인된 편지",
    stakes:
      "진실이 밝혀지면 두 사람의 관계가 무너진다.",

    questions: [
      "그날 네가 본 건 정확히 뭐였어?",
      "왜 지금까지 말하지 않았어?",
      "내가 모르는 이야기가 더 있는 거지?",
      "그 편지를 언제부터 가지고 있었어?"
    ],

    replies: [
      "네가 생각하는 것처럼 단순한 일이 아니야.",
      "말하지 않은 데에는 이유가 있었어.",
      "그때는 그게 최선이라고 믿었어.",
      "진실을 듣고도 같은 말을 할 수 있을까?"
    ],

    reveals: [
      "사실 그날 먼저 도착한 사람은 나였어.",
      "그 편지는 처음부터 네 앞으로 온 게 아니었어.",
      "내가 숨긴 건 사건이 아니라 네가 했던 말이야."
    ]
  },

  betrayal: {
    name: "배신",
    object: "삭제된 녹음 파일",
    stakes:
      "누구의 말을 믿느냐에 따라 모든 것이 달라진다.",

    questions: [
      "내가 널 얼마나 믿었는지 알아?",
      "그 말을 다른 사람에게 했어?",
      "나를 이용한 거야?",
      "처음부터 계획한 일이었어?"
    ],

    replies: [
      "그렇게밖에 할 수 없었어.",
      "넌 내 입장도 들어야 해.",
      "내가 선택할 수 있는 건 많지 않았어.",
      "네가 알던 이야기와는 달라."
    ],

    reveals: [
      "사실 내가 먼저 제안했어.",
      "그 녹음을 지운 사람은 나야.",
      "널 지키려다가 결국 널 배신했어."
    ]
  },

  farewell: {
    name: "이별",
    object: "돌려주지 못한 열쇠",
    stakes:
      "오늘이 마지막 만남일 수 있다.",

    questions: [
      "정말 오늘 떠나는 거야?",
      "언제부터 결정한 거야?",
      "나한테는 왜 아무 말도 안 했어?",
      "우리가 함께한 시간은 뭐였는데?"
    ],

    replies: [
      "쉽게 결정한 거 아니야.",
      "남아 있는 게 더 힘들었어.",
      "너한테 말하면 못 떠날 것 같았어.",
      "나도 끝까지 확신할 수 없었어."
    ],

    reveals: [
      "사실 표는 한 장이 아니라 두 장이었어.",
      "그 열쇠를 돌려주지 못한 이유가 있어.",
      "나는 네가 먼저 붙잡아주길 기다렸어."
    ]
  },

  missing: {
    name: "잃어버린 물건",
    object: "사라진 상자",
    stakes:
      "그 안에 있던 물건은 단순한 소지품이 아니다.",

    questions: [
      "상자를 마지막으로 본 게 언제야?",
      "그 안에 뭐가 있었는지 기억해?",
      "왜 아무한테도 말하지 않았어?",
      "정말 네가 가져간 거 아니야?"
    ],

    replies: [
      "나도 어디 있는지 몰라.",
      "그 안에 있던 걸 다 아는 건 아니잖아.",
      "상자가 중요한 게 아니야.",
      "내가 가져갔다고 해도 믿을 거야?"
    ],

    reveals: [
      "상자는 내가 숨겼어.",
      "사라진 건 상자가 아니라 안에 있던 사진이야.",
      "그 상자를 처음 만든 사람은 너였어."
    ]
  },

  misunderstanding: {
    name: "오해",
    object: "전달되지 않은 메시지",
    stakes:
      "오해를 풀지 못하면 관계가 끝난다.",

    questions: [
      "그 말을 정말 네가 한 거야?",
      "내 메시지를 읽고도 모른 척했어?",
      "왜 다른 사람한테 먼저 물어봤어?",
      "나한테 직접 확인할 생각은 없었어?"
    ],

    replies: [
      "그렇게 들릴 줄은 몰랐어.",
      "난 네가 이미 알고 있는 줄 알았어.",
      "누가 그렇게 말했는데?",
      "잠깐, 우리가 같은 이야기를 하는 게 맞아?"
    ],

    reveals: [
      "그 메시지는 내가 보낸 게 아니야.",
      "우리가 서로 다른 날을 이야기하고 있었어.",
      "네가 들었다는 말은 사실 내 이야기가 아니었어."
    ]
  },

  choice: {
    name: "선택의 순간",
    object: "서명되지 않은 계약서",
    stakes:
      "어느 쪽을 선택해도 누군가는 무언가를 잃는다.",

    questions: [
      "너라면 어떤 선택을 하겠어?",
      "왜 나 혼자 결정해야 하는데?",
      "정말 다른 방법은 없는 거야?",
      "이 선택을 후회하지 않을 자신 있어?"
    ],

    replies: [
      "내가 대신 결정할 수는 없어.",
      "우리 둘 다 원하는 걸 가질 수는 없어.",
      "시간이 없다는 건 나도 알아.",
      "틀린 선택이 아니라 어려운 선택인 거야."
    ],

    reveals: [
      "사실 계약서는 이미 한 번 수정됐어.",
      "네가 포기하면 내가 대신 책임져야 해.",
      "결정권은 처음부터 내게 없었어."
    ]
  }
};

// =====================================
// 20. 장르 데이터
// =====================================

const GENRES = {
  realism: {
    name: "리얼리즘",

    places: [
      "늦은 밤, 불이 꺼지지 않은 거실.",
      "오래된 건물의 복도.",
      "비가 그친 뒤의 작은 방."
    ],

    starts: [
      "A: 오늘은 그냥 넘어가지 않았으면 좋겠어.",
      "B: 나도 이 얘기 다시 꺼내고 싶지 않았어.",
      "A: 우리, 서로 솔직해질 수는 없을까?"
    ],

    ends: [
      "두 사람은 끝내 같은 대답에 도달하지 못한다.",
      "말하지 못한 이야기가 공간에 남는다.",
      "누구도 먼저 자리를 떠나지 않는다."
    ]
  },

  thriller: {
    name: "스릴러",

    places: [
      "잠긴 문 하나가 있는 어두운 방.",
      "사람의 발길이 끊긴 지하 복도.",
      "새벽 두 시, 불이 깜빡이는 사무실."
    ],

    starts: [
      "A: 문 잠갔어?",
      "B: 지금부터 내 말 잘 들어.",
      "A: 방금 누가 지나간 것 같았어."
    ],

    ends: [
      "문밖에서 세 번의 노크 소리가 들린다.",
      "불이 꺼지고, 누군가의 숨소리만 남는다.",
      "두 사람 중 누구도 문 쪽을 바라보지 않는다."
    ]
  },

  romance: {
    name: "로맨스",

    places: [
      "마지막 열차를 기다리는 플랫폼.",
      "추억이 남아 있는 작은 카페.",
      "늦가을, 비어 있는 공원 벤치 앞."
    ],

    starts: [
      "A: 네가 올 줄 몰랐어.",
      "B: 오늘은 그냥 지나칠 수가 없었어.",
      "A: 우리 예전에도 여기 왔었지?"
    ],

    ends: [
      "두 사람은 서로에게 건네지 못한 말을 남긴다.",
      "멀어지는 발소리 사이로 긴 침묵이 흐른다.",
      "두 사람의 손이 잠깐 가까워졌다가 멀어진다."
    ]
  },

  comedy: {
    name: "블랙코미디",

    places: [
      "고장 난 시계가 걸린 사무실.",
      "이상하게 조용한 대기실.",
      "누구도 책임자가 되려 하지 않는 회의실."
    ],

    starts: [
      "A: 이 상황에서 웃으면 안 되는 거지?",
      "B: 일단 우리가 잘못한 건 없다고 하자.",
      "A: 잠깐, 이거 원래 이렇게 되는 거야?"
    ],

    ends: [
      "두 사람은 아무 일도 없었다는 듯 자리를 정리한다.",
      "잠시 침묵이 흐른 뒤, 어이없는 웃음이 터진다.",
      "문제가 해결되기도 전에 다음 문제가 시작된다."
    ]
  },

  absurd: {
    name: "부조리극",

    places: [
      "문은 있지만 출구는 없는 공간.",
      "의자 두 개만 놓인 텅 빈 무대.",
      "시간을 알 수 없는 흰색 방."
    ],

    starts: [
      "A: 우리가 여기 오기로 한 적이 있었나?",
      "B: 오늘은 어제가 아닌 것 같아.",
      "A: 먼저 움직인 사람이 지는 거야?"
    ],

    ends: [
      "처음과 똑같은 자세로 두 사람이 다시 선다.",
      "아무도 대답하지 않았지만 질문은 끝난다.",
      "조명이 꺼진 뒤에도 두 사람의 대화는 계속된다."
    ]
  }
};

// =====================================
// 21. 행동동사와 대사 데이터
// =====================================

const ACTION_LINES = {
  "붙잡다": [
    "잠깐만. 아직 끝난 거 아니잖아.",
    "지금 가면 다시는 얘기할 수 없을지도 몰라.",
    "한 번만 내 말을 들어줘."
  ],

  "설득하다": [
    "내가 왜 이런 말을 하는지 생각해 봐.",
    "우리에게 아직 다른 방법이 있어.",
    "네가 조금만 생각을 바꾸면 돼."
  ],

  "압박하다": [
    "대답해. 더는 기다리지 않을 거야.",
    "지금 여기서 분명하게 말해.",
    "계속 피한다고 해결되는 건 아니야."
  ],

  "떠보다": [
    "이상하네. 넌 왜 그걸 먼저 물어봐?",
    "내가 뭘 알고 있는지 궁금해?",
    "정말 아무것도 기억 안 나?"
  ],

  "회피하다": [
    "지금 그 얘기를 꼭 해야 해?",
    "그 질문에는 대답하고 싶지 않아.",
    "다른 얘기 하면 안 될까?"
  ],

  "거절하다": [
    "아니. 이번에는 안 돼.",
    "그건 네가 결정할 일이 아니야.",
    "내 대답은 이미 정해졌어."
  ],

  "도망치다": [
    "나 이제 여기 있기 싫어.",
    "그만하자. 제발.",
    "여기서 나가야겠어."
  ],

  "밀어내다": [
    "더 가까이 오지 마.",
    "지금은 혼자 있고 싶어.",
    "네가 할 수 있는 일은 없어."
  ],

  "재촉하다": [
    "시간 없어. 빨리 결정해.",
    "지금 당장 움직여야 해.",
    "더 늦으면 돌이킬 수 없어."
  ],

  "위협하다": [
    "내가 어디까지 알고 있는지 궁금하지?",
    "계속 그렇게 나오면 나도 방법이 없어.",
    "마지막으로 묻는 거야."
  ],

  "막아서다": [
    "그쪽으로는 못 가.",
    "아직 내 얘기 안 끝났어.",
    "여기서 그냥 지나갈 수는 없어."
  ],

  "도발하다": [
    "왜? 자신 없어?",
    "그게 네가 할 수 있는 전부야?",
    "생각보다 쉽게 포기하네."
  ],

  "달래다": [
    "괜찮아. 천천히 얘기해.",
    "네가 어떤 마음인지 알아보려고 하는 거야.",
    "일단 진정하고 내 말 들어봐."
  ],

  "숨기다": [
    "그건 지금 중요한 게 아니야.",
    "모르는 게 나을 수도 있어.",
    "그냥 믿어주면 안 돼?"
  ],

  "망설이다": [
    "어떻게 말해야 할지 모르겠어.",
    "잠깐만. 생각할 시간이 필요해.",
    "내가 이 말을 해도 되는 걸까?"
  ],

  "회유하다": [
    "이번 한 번만 넘어가면 안 될까?",
    "우리 둘 다 손해 볼 필요는 없잖아.",
    "네가 원하는 걸 말해봐."
  ],

  "버티다": [
    "난 여기서 안 움직일 거야.",
    "네가 뭐라고 해도 달라지지 않아.",
    "끝까지 기다릴 수 있어."
  ],

  "침묵하다": [
    "…",
    "지금은 아무 말도 하고 싶지 않아.",
    "대답하지 않는 것도 대답이야."
  ],

  "외면하다": [
    "그건 내 문제가 아니야.",
    "나한테 그런 표정 짓지 마.",
    "네가 알아서 해야 할 일이야."
  ],

  "견디다": [
    "괜찮다고 말하면 괜찮아지는 거야?",
    "지금까지도 충분히 참았어.",
    "이 정도는 버틸 수 있어."
  ],

  "탐색하다": [
    "네 생각은 어때?",
    "우리가 놓친 게 있는 것 같아.",
    "처음부터 다시 생각해보자."
  ],

  "주장하다": [
    "내 생각은 달라.",
    "그건 분명히 잘못된 선택이야.",
    "이번에는 내 말을 들어."
  ],

  "시험하다": [
    "정말 그렇게 할 수 있어?",
    "그럼 한번 증명해 봐.",
    "네가 어디까지 할 수 있는지 보자."
  ]
};

// =====================================
// 22. 무작위 선택 도구
// =====================================

function pickRandom(items) {
  if (!items || !items.length) {
    return "";
  }

  return items[
    Math.floor(Math.random() * items.length)
  ];
}

function resolveChoice(value, dictionary) {
  if (value !== "random") {
    return value;
  }

  return pickRandom(
    Object.keys(dictionary)
  );
}

function freshPick(items, used) {
  let available = items.filter(
    item => !used.has(item)
  );

  if (!available.length) {
    used.clear();
    available = items;
  }

  let selected =
    pickRandom(available);

  used.add(selected);

  return selected;
}

// =====================================
// 23. 행동동사 해석
// =====================================

function interpretAction(group) {
  let types = group.map(
    event => event.type
  );

  let descriptions = group.map(
    event => event.sentence
  ).join(" ");

  let aMoves = group.filter(
    event => event.actor === "A"
  ).length;

  let bMoves = group.filter(
    event => event.actor === "B"
  ).length;

  let initiator =
    aMoves >= bMoves ? "A" : "B";

  let responder =
    initiator === "A" ? "B" : "A";

  let verbs;
  let mood;

  if (
    types.includes("approach") ||
    types.includes("close")
  ) {
    verbs = [
      "붙잡다",
      "설득하다",
      "압박하다",
      "떠보다"
    ];

    mood = "approach";

  } else if (
    types.includes("separate")
  ) {
    verbs = [
      "회피하다",
      "거절하다",
      "도망치다",
      "밀어내다"
    ];

    mood = "retreat";

  } else if (
    descriptions.includes("급하게")
  ) {
    verbs = [
      "재촉하다",
      "위협하다",
      "막아서다",
      "도발하다"
    ];

    mood = "urgent";

  } else if (
    descriptions.includes("굽힌다") ||
    descriptions.includes("낮춘다") ||
    descriptions.includes("고개")
  ) {
    verbs = [
      "달래다",
      "숨기다",
      "망설이다",
      "회유하다"
    ];

    mood = "hesitant";

  } else if (
    types.includes("still")
  ) {
    verbs = [
      "버티다",
      "침묵하다",
      "외면하다",
      "견디다"
    ];

    mood = "still";

  } else {
    verbs = [
      "탐색하다",
      "떠보다",
      "주장하다",
      "시험하다"
    ];

    mood = "neutral";
  }

  return {
    verb: pickRandom(verbs),
    initiator: initiator,
    responder: responder,
    mood: mood
  };
}

// =====================================
// 24. 행동 시간별 묶기
// =====================================

function groupEvents() {
  let sorted = [...events].sort(
    (a, b) => a.time - b.time
  );

  let groups = [];
  let current = [];

  for (let event of sorted) {
    if (
      current.length > 0 &&
      event.time -
      current[0].time > 3200
    ) {
      groups.push(current);
      current = [];
    }

    current.push(event);
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

// =====================================
// 25. 지문 생성
// =====================================

function createStageDirection(group) {
  let lines = [];

  for (let actorName of ["A", "B"]) {
    let own = group.filter(
      event => event.actor === actorName
    );

    if (!own.length) {
      continue;
    }

    let unique = [];
    let used = new Set();

    for (let event of own) {
      if (
        used.has(event.sentence)
      ) {
        continue;
      }

      used.add(event.sentence);
      unique.push(event.sentence);
    }

    let chosen =
      unique.slice(0, 3);

    if (chosen.length > 0) {
      lines.push(
        actorName +
        "는 " +
        chosen.join(" 이어서 ")
      );
    }
  }

  let relations = group.filter(
    event => event.actor === "AB"
  );

  for (
    let event of relations.slice(0, 2)
  ) {
    lines.push(event.sentence);
  }

  return lines.join("\n");
}

// =====================================
// 26. 행동동사 대사
// =====================================

function dialogueForVerb(verb) {
  let lines =
    ACTION_LINES[verb];

  if (!lines) {
    lines = [
      "네가 무슨 생각을 하는지 모르겠어."
    ];
  }

  return pickRandom(lines);
}

// =====================================
// 27. 갈등 단계별 대사
// =====================================

function createConflictBeat(
  stage,
  conflict,
  analysis,
  used
) {
  if (stage === 0) {
    return {
      speaker: "A",
      text: freshPick(
        conflict.questions,
        used
      )
    };
  }

  if (stage === 1) {
    return {
      speaker: "B",
      text: freshPick(
        conflict.replies,
        used
      )
    };
  }

  if (stage === 2) {
    return {
      speaker: "A",
      text: freshPick(
        conflict.questions,
        used
      )
    };
  }

  if (stage === 3) {
    return {
      speaker: "B",
      text: freshPick(
        conflict.reveals,
        used
      )
    };
  }

  return {
    speaker: analysis.initiator,
    text: dialogueForVerb(
      analysis.verb
    )
  };
}

// =====================================
// 28. 대본 길이 조절
// =====================================

function selectStoryGroups(
  groups,
  length
) {
  let maxGroups;

  if (length === "short") {
    maxGroups = 5;
  } else if (length === "medium") {
    maxGroups = 10;
  } else {
    maxGroups = 18;
  }

  if (groups.length <= maxGroups) {
    return groups;
  }

  let selected = [];

  for (
    let i = 0;
    i < maxGroups;
    i++
  ) {
    let index = Math.floor(
      i *
      (groups.length - 1) /
      Math.max(1, maxGroups - 1)
    );

    selected.push(groups[index]);
  }

  return selected;
}

// =====================================
// 29. 결말 대사
// =====================================

function createEnding() {
  return pickRandom([
    "A: 그럼 이제 어떻게 해야 하지?\n" +
    "B: 이번에는 네가 결정해.",

    "B: 아직 늦지 않았을까?\n" +
    "A: 그건 나도 모르겠어.",

    "A: 처음부터 다시 시작할 수 있을까?\n" +
    "B: 같은 일이 반복되지 않는다면.",

    "B: 이걸로 끝난 거야?\n" +
    "A: 끝났다고 믿고 싶은 거겠지."
  ]);
}

// =====================================
// 30. 희곡 생성
// =====================================

function generateScript() {
  if (recording) {
    setStatus(
      "먼저 기록 종료를 눌러주세요."
    );
    return;
  }

  if (!events.length) {
    setStatus(
      "먼저 신체 움직임을 기록해주세요."
    );
    return;
  }

  let genreKey =
    genreSelect.value();

  let relationKey =
    resolveChoice(
      relationSelect.value(),
      RELATIONS
    );

  let conflictKey =
    resolveChoice(
      conflictSelect.value(),
      CONFLICTS
    );

  let genre =
    GENRES[genreKey];

  let relation =
    RELATIONS[relationKey];

  let conflict =
    CONFLICTS[conflictKey];

  let groups =
    selectStoryGroups(
      groupEvents(),
      lengthSelect.value()
    );

  let used = new Set();
  let lines = [];

  let title = pickRandom([
    conflict.object,
    "아직 끝나지 않은 " +
    conflict.name,
    "두 사람 사이의 거리",
    "마지막으로 남은 말",
    "우리가 숨긴 것"
  ]);

  lines.push("IMPRO SCRIPT");
  lines.push("");

  lines.push(
    "제목: " + title
  );

  lines.push(
    "장르: " + genre.name
  );

  lines.push(
    "관계: " + relation.name
  );

  lines.push("");
  lines.push("등장인물");

  lines.push(
    "A — " + relation.roles[0]
  );

  lines.push(
    "B — " + relation.roles[1]
  );

  lines.push("");
  lines.push("극적 상황");

  lines.push(
    pickRandom(relation.history)
  );

  lines.push(conflict.stakes);

  lines.push("");
  lines.push(
    "※ 신체 행동은 관찰 기록에 기반하며,"
  );

  lines.push(
    "인물의 감정과 대사는 창작된 해석이다."
  );

  lines.push("");
  lines.push(
    "────────────────────────"
  );

  lines.push("");
  lines.push("장면 1");
  lines.push("");

  lines.push(
    "(" +
    pickRandom(genre.places) +
    ")"
  );

  lines.push(
    "(" +
    conflict.object +
    "이(가) 두 사람 사이에 놓여 있다.)"
  );

  lines.push("");
  lines.push(
    pickRandom(genre.starts)
  );

  lines.push("");

  let phases = [
    "도입",
    "갈등",
    "전환",
    "결말"
  ];

  let previousPhase = -1;

  for (
    let i = 0;
    i < groups.length;
    i++
  ) {
    let group = groups[i];

    let phase = Math.min(
      3,
      Math.floor(
        i / groups.length * 4
      )
    );

    if (phase !== previousPhase) {
      lines.push("");

      lines.push(
        "[" + phases[phase] + "]"
      );

      lines.push("");

      previousPhase = phase;
    }

    let analysis =
      interpretAction(group);

    let direction =
      createStageDirection(group);

    if (direction) {
      lines.push(
        "(" + direction + ")"
      );

      lines.push("");
    }

    lines.push(
      "[행동동사: " +
      analysis.initiator +
      " — " +
      analysis.verb +
      "]"
    );

    let beat =
      createConflictBeat(
        phase,
        conflict,
        analysis,
        used
      );

    lines.push(
      beat.speaker +
      ": " +
      beat.text
    );

    let actionLine =
      dialogueForVerb(
        analysis.verb
      );

    if (
      actionLine === beat.text
    ) {
      let alternatives =
        ACTION_LINES[analysis.verb] || [];

      actionLine =
        alternatives.find(
          line => line !== beat.text
        ) ||
        "네가 그렇게 생각하는 줄은 몰랐어.";
    }

    lines.push(
      analysis.initiator +
      ": " +
      actionLine
    );

    let response =
      freshPick(
        conflict.replies,
        used
      );

    lines.push(
      analysis.responder +
      ": " +
      response
    );

    if (
      phase === 2 &&
      i % 2 === 0
    ) {
      lines.push("");

      lines.push(
        "(" +
        pickRandom([
          "짧은 침묵이 흐른다.",
          "두 사람은 서로의 반응을 살핀다.",
          "누구도 먼저 대답하지 않는다."
        ]) +
        ")"
      );

      lines.push(
        "B: " +
        pickRandom(
          conflict.reveals
        )
      );
    }

    lines.push("");
  }

  lines.push(
    "────────────────────────"
  );

  lines.push("");
  lines.push("[마지막 선택]");
  lines.push("");

  lines.push(
    "(" +
    pickRandom(genre.ends) +
    ")"
  );

  lines.push("");
  lines.push(
    createEnding()
  );

  lines.push("");
  lines.push("암전.");
  lines.push("");
  lines.push("- 끝 -");

  scriptText =
    lines.join("\n");

  scriptBox.elt.textContent =
    scriptText;

  setStatus(
    "희곡 완성! 같은 기록으로 재창작할 수 있습니다."
  );
}

// =====================================
// 31. 희곡 다운로드
// =====================================

function downloadScript() {
  if (!scriptText) {
    setStatus(
      "먼저 희곡을 생성해주세요."
    );
    return;
  }

  saveStrings(
    scriptText.split("\n"),
    "impro-script-6-1",
    "txt"
  );

  setStatus(
    "희곡 다운로드 완료!"
  );
}
