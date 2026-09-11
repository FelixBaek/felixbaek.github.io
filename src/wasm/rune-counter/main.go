// rune-counter — TinyGo 로 컴파일해 브라우저에서 도는 문자열 카운터.
//
// 노출 함수(전역): __anvilRuneCount(text: string) -> string(JSON)
//   {"bytes":바이트수,"runes":룬개수}
//
// Go 의 len(string) 은 바이트 수, utf8.RuneCountInString 은 문자(룬) 수라는
// 차이를 그대로 보여주기 위한 최소 모듈이다.
//
//go:build wasm

package main

import (
	"fmt"
	"syscall/js"
	"unicode/utf8"
)

func main() {
	js.Global().Set("__anvilRuneCount", js.FuncOf(func(this js.Value, args []js.Value) any {
		text := ""
		if len(args) > 0 {
			text = args[0].String()
		}
		return fmt.Sprintf(`{"bytes":%d,"runes":%d}`, len(text), utf8.RuneCountInString(text))
	}))

	// 브라우저가 계속 함수를 호출할 수 있도록 런타임을 살려 둔다.
	select {}
}
