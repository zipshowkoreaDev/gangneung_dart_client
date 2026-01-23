// Core profanity checker (framework-agnostic, Node-friendly)

// 유사 문자 매핑 (숫자, 특수문자 -> 알파벳/한글)
const SIMILAR_CHARS = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "!": "i",
  "$": "s",
  "&": "and",
  "+": "t",
  "ⓐ": "a",
  "ⓑ": "b",
  "ⓒ": "c",
  "ⓓ": "d",
  "ⓔ": "e",
  "ⓕ": "f",
  "ⓖ": "g",
  "ⓗ": "h",
  "ⓘ": "i",
  "ⓙ": "j",
  "ⓚ": "k",
  "ⓛ": "l",
  "ⓜ": "m",
  "ⓝ": "n",
  "ⓞ": "o",
  "ⓟ": "p",
  "ⓠ": "q",
  "ⓡ": "r",
  "ⓢ": "s",
  "ⓣ": "t",
  "ⓤ": "u",
  "ⓥ": "v",
  "ⓦ": "w",
  "ⓧ": "x",
  "ⓨ": "y",
  "ⓩ": "z",
};

// 한글 자모 분리 상수
const CHO = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];
const JONG = [
  "",
  "ㄱ",
  "ㄲ",
  "ㄳ",
  "ㄴ",
  "ㄵ",
  "ㄶ",
  "ㄷ",
  "ㄹ",
  "ㄺ",
  "ㄻ",
  "ㄼ",
  "ㄽ",
  "ㄾ",
  "ㄿ",
  "ㅀ",
  "ㅁ",
  "ㅂ",
  "ㅄ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

// 한글 음절을 자모로 분리
const decomposeHangul = (char) => {
  const code = char.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const offset = code - 0xac00;
    const cho = CHO[Math.floor(offset / 588)];
    const jung = String.fromCharCode(0x1161 + Math.floor((offset % 588) / 28));
    const jongIdx = offset % 28;
    return cho + jung + JONG[jongIdx];
  }
  return char;
};

// 텍스트 전체를 자모로 분리
const decomposeText = (text) => text.split("").map(decomposeHangul).join("");

// 초성만 추출
const extractChosung = (text) =>
  text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        return CHO[Math.floor((code - 0xac00) / 588)];
      }
      return CHO.includes(char) ? char : "";
    })
    .join("");

// 보이지 않는 문자/결합 문자 제거
const removeInvisibleChars = (text) =>
  text.replace(/[\u200B-\u200D\uFEFF\u2060\u0300-\u036F]/g, "");

// 공백 및 특수문자 제거
const removeSpecialChars = (text) =>
  text.replace(/[\s\-_.,:;!?@#$%^&*()+=\[\]{}<>\/\\|`~'"]/g, "");

// 유사 문자 변환
const replaceSimilarChars = (text) =>
  text
    .split("")
    .map((char) => SIMILAR_CHARS[char] || char)
    .join("");

// 반복 문자 축소
const reduceRepeatedChars = (text) => text.replace(/(.)\1{1,}/g, "$1");

// 종합 정규화 함수 - 단일 문자열 반환 (최적화)
const normalizeForCheck = (text) => {
  const lower = text.toLowerCase();
  const nfkc = lower.normalize("NFKC");
  const noInvisible = removeInvisibleChars(nfkc);
  const similarReplaced = replaceSimilarChars(noInvisible);
  const noSpecial = removeSpecialChars(similarReplaced);
  return reduceRepeatedChars(noSpecial);
};

// ============================================
// Trie 자료구조 (메모리 효율 + 빠른 검색)
// ============================================
class TrieNode {
  children = new Map();
  isEnd = false;
}

class ProfanityTrie {
  root = new TrieNode();

  insert(word) {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
    }
    node.isEnd = true;
  }

  // 텍스트 내에 비속어가 포함되어 있는지 검사
  containsAny(text) {
    for (let i = 0; i < text.length; i++) {
      if (this.searchFrom(text, i)) return true;
    }
    return false;
  }

  // 특정 위치부터 비속어 검색
  searchFrom(text, start) {
    let node = this.root;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (!node.children.has(char)) return false;
      node = node.children.get(char);
      if (node.isEnd) return true;
    }
    return false;
  }

  // 텍스트에서 발견된 모든 비속어 반환
  findAll(text) {
    const found = [];
    for (let i = 0; i < text.length; i++) {
      let node = this.root;
      let word = "";
      for (let j = i; j < text.length; j++) {
        const char = text[j];
        if (!node.children.has(char)) break;
        node = node.children.get(char);
        word += char;
        if (node.isEnd) found.push(word);
      }
    }
    return [...new Set(found)];
  }
}

const SPECIAL_CHARS_REGEX_SOURCE =
  "[\\s\\-_.,:;!?@#$%^&*()+=\\[\\]{}<>\\/\\\\|`~'\"\\u200B-\\u200D\\uFEFF\\u2060\\u0300-\\u036F]*";

const buildFuzzyPattern = (word, getSimilarVariants) => {
  const parts = [];
  for (const char of word) {
    const variants = [...getSimilarVariants(char)].map((c) =>
      c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    const group =
      variants.length === 1 ? variants[0] : `(?:${variants.join("|")})`;
    parts.push(group);
  }
  return parts.join(SPECIAL_CHARS_REGEX_SOURCE);
};

export const createProfanityChecker = (profanityList) => {
  const profanityTrie = new ProfanityTrie();
  const chosungSet = new Set();
  const similarVariantMap = new Map();

  const getSimilarVariants = (char) => {
    if (!similarVariantMap.has(char)) {
      const variants = new Set([char]);
      Object.entries(SIMILAR_CHARS).forEach(([key, value]) => {
        if (value === char) variants.add(key);
      });
      similarVariantMap.set(char, variants);
    }
    return similarVariantMap.get(char);
  };

  // 비속어 목록을 Trie와 초성 Set에 등록
  profanityList.forEach((word) => {
    const lower = String(word).toLowerCase();
    const normalized = normalizeForCheck(lower);
    const decomposed = decomposeText(normalized);

    profanityTrie.insert(lower);
    profanityTrie.insert(normalized);
    profanityTrie.insert(decomposed);

    // 초성만으로 이루어진 비속어는 별도 Set에 저장
    if (/^[ㄱ-ㅎ]+$/.test(word)) {
      chosungSet.add(word);
    }
  });

  // 정규화된 비속어 목록 (replaceProfanity용)
  const normalizedProfanityList = [
    ...new Set(profanityList.map((w) => String(w).toLowerCase())),
  ];

  const containsProfanity = (text) => {
    if (!text) return false;

    const normalizedOriginal = normalizeForCheck(text);

    // 정규화된 텍스트로 Trie 검색
    const normalized = normalizeForCheck(text);
    if (profanityTrie.containsAny(normalized)) return true;

    // 자모 분리 후 검사
    const decomposed = decomposeText(normalized);
    if (profanityTrie.containsAny(decomposed)) {
      const found = profanityTrie.findAll(decomposed);
      const singleJamo = found.filter((w) => w.length === 1);
      if (singleJamo.length === 0) return true;
      const hasSingleJamoInOriginal = singleJamo.some((jamo) =>
        normalizedOriginal.includes(jamo)
      );
      if (hasSingleJamoInOriginal) return true;
    }

    // 초성 검사 (ㅅㅂ, ㅆㅂ 등)
    const chosung = extractChosung(text);
    if (chosung.length >= 2) {
      for (const profanity of chosungSet) {
        if (chosung.includes(profanity)) return true;
      }
    }

    return false;
  };

  const findProfanities = (text) => {
    if (!text) return [];

    const normalized = normalizeForCheck(text);
    const decomposed = decomposeText(normalized);

    const fromNormalized = profanityTrie.findAll(normalized);
    const fromDecomposed = profanityTrie.findAll(decomposed);

    const chosungMatches = [];
    const chosung = extractChosung(text);
    if (chosung.length >= 2) {
      for (const profanity of chosungSet) {
        if (chosung.includes(profanity)) chosungMatches.push(profanity);
      }
    }

    return [...new Set([...fromNormalized, ...fromDecomposed, ...chosungMatches])];
  };

  const replaceProfanity = (text, replaceChar = "*") => {
    if (!text) return "";

    let result = text;
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    normalizedProfanityList.forEach((word) => {
      const normalizedWord = normalizeForCheck(word);
      const pattern = buildFuzzyPattern(normalizedWord, getSimilarVariants);
      const regex = new RegExp(pattern, "gi");
      result = result.replace(regex, (match) =>
        replaceChar.repeat(match.length)
      );

      const exactRegex = new RegExp(escapeRegExp(word), "gi");
      result = result.replace(exactRegex, replaceChar.repeat(word.length));
    });

    return result;
  };

  const validateInput = (text) => {
    if (!text) {
      return { isValid: true, message: "" };
    }

    if (containsProfanity(text)) {
      return {
        isValid: false,
        message: "부적절한 표현이 포함되어 있습니다.",
      };
    }

    return { isValid: true, message: "" };
  };

  return {
    containsProfanity,
    findProfanities,
    replaceProfanity,
    validateInput,
  };
};
