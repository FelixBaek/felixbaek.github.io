---
name: "BULTUK"
status: "active"
summary: "개인 에이전트·워크스페이스를 묶는 자체 도구. Go 백엔드 + Windows/WSL 크로스플랫폼 계약을 다룹니다."
stack: ["Go", "SQLite", "Wasm", "Astro"]
started: "2026-08"
order: 10
---

## 무엇인가

개인 작업(에이전트·워크스페이스·기록)을 한 곳에서 다루기 위해 만드는 도구입니다. 서버는 Go, 클라이언트 계약은 플랫폼별로 분리합니다.

## 이 프로젝트에서 배운 것

- 플랫폼별 계약(UDS/pipe, ConPTY, DPAPI, JobObject)을 문서로 먼저 고정하면 이식 비용이 줄어듭니다.
- Linux에서 검증할 수 없는 부분(실제 Windows 네이티브 빌드)은 **미검증으로 표시**해 두는 게 안전합니다.

## 기록

진행 상황과 판단은 [회고](/harness/retrospective/)와 [트러블슈팅](/harness/troubleshooting/)으로 남깁니다.
