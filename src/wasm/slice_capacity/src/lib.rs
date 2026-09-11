//! SliceSim — 슬라이스의 len/cap 규칙과 재할당 시점을 그대로 재현한다.
//!
//! 글에서 설명한 규칙:
//!   * len < cap  에서 append  → 같은 배열을 수정
//!   * len == cap 에서 append  → 더 큰 배열로 재할당(보통 2배)
//!
//! 여기서는 `Vec<i32>` 의 capacity 변화를 관찰해 "재할당이 일어났는가"를 판정한다.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SliceSim {
    data: Vec<i32>,
    initial_len: usize,
    initial_cap: usize,
    reallocs: u32,
}

#[wasm_bindgen]
impl SliceSim {
    /// len 과 cap 을 따로 지정해 시작한다 (Go 의 make([]int, len, cap) 과 같은 상황).
    #[wasm_bindgen(constructor)]
    pub fn new(len: usize, cap: usize) -> SliceSim {
        let cap = cap.max(len).max(1);
        let mut data: Vec<i32> = Vec::with_capacity(cap);
        for i in 0..len {
            data.push((i + 1) as i32);
        }
        SliceSim {
            data,
            initial_len: len,
            initial_cap: cap,
            reallocs: 0,
        }
    }

    /// append 한 칸. 재할당이 일어났으면 true 를 돌려준다.
    pub fn push(&mut self, value: i32) -> bool {
        let before = self.data.capacity();
        self.data.push(value);
        let after = self.data.capacity();
        if after != before {
            self.reallocs += 1;
            true
        } else {
            false
        }
    }

    #[wasm_bindgen(js_name = len)]
    pub fn len_(&self) -> usize {
        self.data.len()
    }

    #[wasm_bindgen(js_name = cap)]
    pub fn cap_(&self) -> usize {
        self.data.capacity()
    }

    pub fn reallocs(&self) -> u32 {
        self.reallocs
    }

    /// 현재 상태를 사람이 읽는 문자열로 (로컬 실험과 브라우저 결과를 비교하기 쉽게)
    pub fn report(&self) -> String {
        format!(
            "len={} cap={} realloc={}",
            self.data.len(),
            self.data.capacity(),
            self.reallocs
        )
    }

    /// 초기 상태(len, cap)로 되돌린다.
    pub fn reset(&mut self) {
        self.data.clear();
        self.data = Vec::with_capacity(self.initial_cap);
        for i in 0..self.initial_len {
            self.data.push((i + 1) as i32);
        }
        self.reallocs = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_within_capacity_does_not_realloc() {
        let mut sim = SliceSim::new(2, 4);
        assert!(!sim.push(9));
        assert_eq!(sim.len_(), 3);
        assert_eq!(sim.cap_(), 4);
        assert_eq!(sim.reallocs(), 0);
    }

    #[test]
    fn push_at_capacity_reallocates() {
        let mut sim = SliceSim::new(4, 4);
        let initial_cap = sim.cap_();
        assert_eq!(sim.len_(), initial_cap);
        assert!(sim.push(5));
        assert_eq!(sim.reallocs(), 1);
        assert!(sim.cap_() > initial_cap);
    }

    #[test]
    fn reset_restores_initial_state() {
        let mut sim = SliceSim::new(2, 2);
        sim.push(3);
        sim.push(4);
        sim.reset();
        assert_eq!(sim.len_(), 2);
        assert_eq!(sim.cap_(), 2);
        assert_eq!(sim.reallocs(), 0);
    }
}
