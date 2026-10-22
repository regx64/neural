# NEURAL

> **Don't just use AI. See how it thinks.**

NEURAL은 인공신경망을 3D 공간에서 탐험하고, 직접 학습시키며, 내부 계산 과정을 확인할 수 있는 인터랙티브 AI 연구실이다. 화면의 모든 색·밝기·움직임은 브라우저에서 실제로 학습 중인 신경망의 값에서 나온다.

## 문서

| 문서                                                  | 내용                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [00-concept.md](docs/00-concept.md)                   | 초기 기획안 (원본)                                                                               |
| [01-product-spec.md](docs/01-product-spec.md)         | 제품 명세: 원칙, 페르소나, 화면 구성, 기능별 수용 기준, 시각 인코딩 규칙, 릴리스 범위, 성공 지표 |
| [02-technical-design.md](docs/02-technical-design.md) | 기술 설계: 스택 결정, 아키텍처, 엔진·워커·렌더링 설계, 테스트 전략                               |
| [03-development-plan.md](docs/03-development-plan.md) | 제작 계획: 마일스톤 M0~M8, 일정, 완료 조건, 리스크 관리                                          |

## 실행

```bash
npm install
npm run dev          # http://localhost:5173 (랜딩) · /learn/ (배우기) · /lab/ (연구실)
```

| 명령                                                          | 설명                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run build`                                               | 타입 검사 후 정적 빌드(`dist/`). `BASE_PATH=/neural/`로 하위 경로 배포 |
| `npm test`                                                    | 단위 테스트 (엔진 기울기 검사·결정론·수렴, 시각 인코딩, 레이아웃)      |
| `npm run test:e2e`                                            | Playwright E2E (빌드 후 미리보기 서버에서 실행)                        |
| `npm run lint` · `npm run typecheck` · `npm run format:check` | 정적 검사                                                              |

브라우저를 내려받을 수 없는 환경에서는 `PW_CHROMIUM_PATH=/path/to/chromium npm run test:e2e`로 설치된 Chromium을 사용한다.

## 배포

- **GitHub Pages:** `.github/workflows/deploy.yml`이 `main` 푸시 때 배포한다. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정해야 한다.
- **Vercel:** 저장소를 가져오면 Vite 프로젝트로 자동 인식되어 별도 설정 없이 배포된다.

## 구조

```
src/
  core/      순수 TS 신경망 엔진 (MLP, 옵티마이저, 데이터셋) — DOM·React 의존 금지
  worker/    학습 워커와 메시지 프로토콜
  state/     Zustand 스토어, 메인 스레드 추론(derived), 지표 기록
  viz/       시각 인코딩 기준표(encoding.ts), 3D 씬(three/), 2D 캔버스(canvas2d/)
  ui/        패널·컨트롤·인스펙터·레슨 카드·용어 툴팁
  content/   입문자용 콘텐츠: 레슨, 용어 사전, 상태 문장
  pages/     랜딩, 배우기(learn/), 연구실
```

## 진행 상황

- [x] **v0.1 MVP** (M0~M4) — 3D 구조 시각화, 선택·툴팁·인스펙터, 학습 워커, 결정 경계, 손실/정확도 차트
- [x] **입문자 경험** — 배우기 페이지(뉴런 놀이터·손실 골짜기), 가이드 레슨 5종, 첫 방문 투어, 용어 툴팁, 상태 문장
- [ ] **v0.2 Lab** — ~~데이터 직접 편집~~, ~~뉴런 응답 맵~~, ~~자동 저장~~, 신호 흐름, 기울기 모드, Time Travel
- [ ] **v1.0 Public** — 가이드 시나리오, 저장·공유, 역전파 인스펙터, 랜딩 완성

자세한 진행 기록은 [03-development-plan.md §6](docs/03-development-plan.md#6-진행-기록)을 참고한다.

## 기술 스택

Vite · React · TypeScript · Three.js / React Three Fiber · Zustand · Web Worker · Vitest · Playwright
