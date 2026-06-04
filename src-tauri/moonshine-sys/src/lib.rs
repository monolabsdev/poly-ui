use std::ffi::{c_char, c_float};

pub const MOONSHINE_HEADER_VERSION: i32 = 20000;
pub const MOONSHINE_MODEL_ARCH_BASE: u32 = 1;

#[repr(C)]
pub struct moonshine_option_t {
    pub name: *const c_char,
    pub value: *const c_char,
}

#[cfg(target_os = "windows")]
mod msvc_stl_shims {
    use std::ffi::{c_char, c_void};
    use std::ptr;

    #[no_mangle]
    pub unsafe extern "system" fn __std_search_1(
        first: *const c_void,
        last: *const c_void,
        needle: *const c_void,
        count: usize,
    ) -> *const c_void {
        let first = first.cast::<u8>();
        let last = last.cast::<u8>();
        let needle = needle.cast::<u8>();
        if count == 0 {
            return first.cast();
        }

        let len = last.offset_from(first) as usize;
        if count > len {
            return last.cast();
        }

        for i in 0..=len - count {
            let candidate = first.add(i);
            if ptr::eq(candidate, needle) || matches_bytes(candidate, needle, count) {
                return candidate.cast();
            }
        }

        last.cast()
    }

    #[no_mangle]
    pub unsafe extern "system" fn __std_find_end_1(
        first: *const c_void,
        last: *const c_void,
        needle: *const c_void,
        count: usize,
    ) -> *const c_void {
        let first = first.cast::<u8>();
        let last = last.cast::<u8>();
        let needle = needle.cast::<u8>();
        if count == 0 {
            return last.cast();
        }

        let len = last.offset_from(first) as usize;
        if count > len {
            return last.cast();
        }

        for i in (0..=len - count).rev() {
            let candidate = first.add(i);
            if ptr::eq(candidate, needle) || matches_bytes(candidate, needle, count) {
                return candidate.cast();
            }
        }

        last.cast()
    }

    #[no_mangle]
    pub unsafe extern "system" fn __std_find_first_not_of_trivial_pos_1(
        haystack: *const c_void,
        haystack_len: usize,
        needle: *const c_void,
        needle_len: usize,
    ) -> usize {
        let haystack = haystack.cast::<u8>();
        let needle = needle.cast::<u8>();
        for i in 0..haystack_len {
            if !contains_byte(needle, needle_len, *haystack.add(i)) {
                return i;
            }
        }
        haystack_len
    }

    #[no_mangle]
    pub unsafe extern "system" fn __std_find_last_not_of_trivial_pos_1(
        haystack: *const c_void,
        haystack_len: usize,
        needle: *const c_void,
        needle_len: usize,
    ) -> usize {
        let haystack = haystack.cast::<u8>();
        let needle = needle.cast::<u8>();
        for i in (0..haystack_len).rev() {
            if !contains_byte(needle, needle_len, *haystack.add(i)) {
                return i;
            }
        }
        haystack_len
    }

    #[no_mangle]
    pub unsafe extern "system" fn __std_remove_1(
        first: *mut c_void,
        last: *mut c_void,
        value: u8,
    ) -> *mut c_void {
        let first = first.cast::<u8>();
        let last = last.cast::<u8>();
        let len = last.offset_from(first) as usize;
        let mut out = first;
        for i in 0..len {
            let current = *first.add(i);
            if current != value {
                *out = current;
                out = out.add(1);
            }
        }
        out.cast()
    }

    #[no_mangle]
    pub unsafe extern "system" fn __std_unique_4(first: *mut c_void, last: *mut c_void) -> *mut c_void {
        let first = first.cast::<u32>();
        let last = last.cast::<u32>();
        let len = last.offset_from(first) as usize;
        if len == 0 {
            return last.cast();
        }

        let mut out = first.add(1);
        let mut previous = *first;
        for i in 1..len {
            let current = *first.add(i);
            if current != previous {
                *out = current;
                out = out.add(1);
                previous = current;
            }
        }
        out.cast()
    }

    #[no_mangle]
    pub unsafe extern "system" fn __std_regex_transform_primary_char(
        dst: *mut c_char,
        dst_end: *mut c_char,
        src: *const c_char,
        src_end: *const c_char,
        _locale: *const c_void,
    ) -> usize {
        let dst = dst.cast::<u8>();
        let dst_len = dst_end.offset_from(dst.cast()) as usize;
        let src = src.cast::<u8>();
        let src_len = src_end.offset_from(src.cast()) as usize;

        if src_len <= dst_len {
            ptr::copy_nonoverlapping(src, dst, src_len);
        }

        src_len
    }

    unsafe fn matches_bytes(left: *const u8, right: *const u8, len: usize) -> bool {
        for i in 0..len {
            if *left.add(i) != *right.add(i) {
                return false;
            }
        }
        true
    }

    unsafe fn contains_byte(ptr: *const u8, len: usize, value: u8) -> bool {
        for i in 0..len {
            if *ptr.add(i) == value {
                return true;
            }
        }
        false
    }
}

#[repr(C)]
pub struct transcript_word_t {
    pub text: *const c_char,
    pub start: c_float,
    pub end: c_float,
    pub confidence: c_float,
}

#[repr(C)]
pub struct transcript_line_t {
    pub text: *const c_char,
    pub audio_data: *const c_float,
    pub audio_data_count: usize,
    pub start_time: c_float,
    pub duration: c_float,
    pub id: u64,
    pub is_complete: i8,
    pub is_updated: i8,
    pub is_new: i8,
    pub has_text_changed: i8,
    pub has_speaker_id: i8,
    pub speaker_id: u64,
    pub speaker_index: u32,
    pub last_transcription_latency_ms: u32,
    pub words: *const transcript_word_t,
    pub word_count: u64,
}

#[repr(C)]
pub struct transcript_t {
    pub lines: *mut transcript_line_t,
    pub line_count: u64,
}

unsafe extern "C" {
    pub fn moonshine_get_version() -> i32;
    pub fn moonshine_error_to_string(error: i32) -> *const c_char;
    pub fn moonshine_load_transcriber_from_files(
        path: *const c_char,
        model_arch: u32,
        options: *const moonshine_option_t,
        options_count: u64,
        moonshine_version: i32,
    ) -> i32;
    pub fn moonshine_free_transcriber(transcriber_handle: i32);
    pub fn moonshine_transcribe_without_streaming(
        transcriber_handle: i32,
        audio_data: *mut c_float,
        audio_length: u64,
        sample_rate: i32,
        flags: u32,
        out_transcript: *mut *mut transcript_t,
    ) -> i32;
}

#[cfg(test)]
mod tests {
    use super::{moonshine_get_version, MOONSHINE_HEADER_VERSION};

    #[test]
    fn moonshine_version_matches_header() {
        assert_eq!(unsafe { moonshine_get_version() }, MOONSHINE_HEADER_VERSION);
    }
}
