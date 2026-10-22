# NEURAL

> **Don't just use AI. See how it thinks.**

NEURAL은 인공신경망을 3D 공간에서 탐험하고, 직접 학습시키며, 내부 계산 과정을 확인할 수 있는 인터랙티브 AI 연구실이다. 화면의 모든 색·밝기·움직임은 브라우저에서 실제로 학습 중인 신경망의 값에서 나온다.

## 문서

| 문서 | 내용 |
|---|---|
| [00-concept.md](docs/00-concept.md) | 초기 기획안 (원본) |
| [01-product-spec.md](docs/01-product-spec.md) | 제품 명세: 원칙, 페르소나, 화면 구성, 기능별 수용 기준, 시각 인코딩 규칙, 릴리스 범위, 성공 지표 |
| [02-technical-design.md](docs/02-technical-design.md) | 기술 설계: 스택 결정, 아키텍처, 엔진·워커·렌더링 설계, 테스트 전략 |
| [03-development-plan.md](docs/03-development-plan.md) | 제작 계획: 마일스톤 M0~M8, 일정, 완료 조건, 리스크 관리 |

## 릴리스 계획 요약

- **v0.1 MVP** — 3D 구조 시각화, 선택·인스펙터, XOR 등 소형 데이터셋 학습, 학습 상태와 시각화 연동
- **v0.2 Lab** — 데이터 직접 편집, 뉴런 응답 맵, 신호 흐름, Time Travel
- **v1.0 Public** — 가이드 시나리오, 저장·공유, 역전파 인스펙터, 랜딩 완성

## 기술 스택 (예정)

Vite · React · TypeScript · Three.js / React Three Fiber · Zustand · Web Worker · Vitest · Playwright
