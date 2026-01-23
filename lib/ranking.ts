const STORAGE_KEY = "dart-ranking";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24시간

export interface RankingEntry {
  name: string;
  score: number;
  timestamp: number;
}

interface RankingData {
  expiresAt: number;
  rankings: RankingEntry[];
}

function isExpired(data: RankingData): boolean {
  return Date.now() > data.expiresAt;
}

export function getRankings(): RankingEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data: RankingData = JSON.parse(raw);
    if (isExpired(data)) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    return data.rankings;
  } catch {
    return [];
  }
}

export function addRanking(name: string, score: number): RankingEntry[] {
  if (typeof window === "undefined") return [];

  const current = getRankings();
  const newEntry: RankingEntry = {
    name,
    score,
    timestamp: Date.now(),
  };

  // 기존 랭킹에 새 기록 추가
  const updated = [...current, newEntry];

  // 정렬: 점수 내림차순, 동점 시 최신 기록 우선
  updated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.timestamp - a.timestamp;
  });

  // Top 5만 유지
  const top5 = updated.slice(0, 5);

  const data: RankingData = {
    expiresAt: Date.now() + EXPIRY_MS,
    rankings: top5,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 저장 실패 시 무시
  }

  return top5;
}

export function clearRankings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
