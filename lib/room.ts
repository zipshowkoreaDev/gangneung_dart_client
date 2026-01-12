const DEFAULT_ROOM = "zipshow";

//  URL 파라미터에서 room 값 가져오기
export function getRoomFromUrl(): string {
  if (typeof window === "undefined") return DEFAULT_ROOM;

  const params = new URLSearchParams(window.location.search);
  return params.get("room") || DEFAULT_ROOM;
}
