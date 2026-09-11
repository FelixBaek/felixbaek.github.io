---
name: "Rust"
status: "learning"
order: 20
since: "2026-09"
summary: "소유권·빌림·수명을 컴파일러 에러 메시지로 익히는 중입니다."
repo: "https://github.com/FelixBaek"
---

Rust는 "컴파일러가 화내니까" 외우는 대신, **어떤 에러가 나오는지**를 기록해 두는 쪽이 빨랐습니다.

## 이 언어에서 파는 것

1. 소유권 이동(move)과 `Copy` 의 경계
2. 빌림 규칙 — 가변 참조 하나 또는 불변 참조 여럿
3. NLL(Non-Lexical Lifetimes)이 빌림을 끝내는 지점
4. `wasm-bindgen` 으로 브라우저에서 돌리기

## 기록 방식

에러 메시지를 그대로 인용하고, 코드를 최소 재현으로 줄여서 남깁니다.
