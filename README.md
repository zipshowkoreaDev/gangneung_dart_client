# Gangneung Dart

실시간 다트 룰렛 게임 (모바일 컨트롤러 + 대형 디스플레이)

## 개요
- 모바일에서 이름 입력 후 대기열에 들어가고, 자이로 센서로 조준/던짐을 수행
- 디스플레이는 모든 플레이어의 조준/던짐을 실시간으로 표시하고 점수를 집계
- 소켓 기반 실시간 동기화 + Three.js 3D 룰렛/다트 연출

## 구조
- `app/mobile`: 모바일 UI (이름 입력, 대기열, 게임 진행)
- `app/display`: 디스플레이 UI (점수판, 조준 오버레이, 3D 룰렛)
- `hooks`: 소켓/센서/입력 검증 로직
- `three`: Three.js 씬 및 룰렛 모델 처리
- `shared`: 공통 소켓 인스턴스
- `constants`: 비속어 목록 등 정적 데이터
- `public`: 3D 모델/이미지/사운드

## 실행
```bash
npm install
npm run dev
```

## 핵심 플로우
1) 모바일
   - 이름 입력 → 대기열(`join-queue`) → 슬롯 배정 → 게임 방 입장(`joinRoom`)
   - 조준(`aim-update`), 던짐(`throw-dart`), 종료(`aim-off`)

2) 디스플레이
   - 디스플레이 방 + 모든 플레이어 방 구독
   - 조준/던짐/결과 수신 및 실시간 렌더링

## 점수 계산
- 모바일에서 aim 좌표를 3D로 변환해 구역(Bull/Triple/Double/Single/Miss)을 판정
- 디스플레이는 서버 점수 대신 aim 기반으로 재계산하여 누적
- 룰렛 반지름은 디스플레이에서 자동 산출 → QR URL 파라미터로 모바일에 전달

## 안정화 처리 (클라이언트)
- 새로고침/오프라인/백그라운드 이탈 시 `leave-queue` 최대 전송
- 재연결 시 큐 재정합(`leave-queue` → `join-queue`)
- 하트비트로 `status-queue` 주기 요청
- 대기열 타임아웃(기본 2분) 자동 이탈

## 주요 파일
- `shared/socket.ts`: 소켓 싱글톤
- `hooks/useMobileSocket.ts`: 모바일 소켓 송신
- `hooks/useDisplaySocket.ts`: 디스플레이 소켓 수신/집계
- `hooks/useGyroscope.ts`: 자이로 조준/던짐/점수 계산
- `three/Scene.tsx`: 룰렛 모델 반지름 계산, 3D 연출

## 환경 변수
- `NEXT_PUBLIC_SOCKET_URL`: 소켓 서버 URL

## 개발 메모
- 서버가 name을 키로 쓰는 문제 대응: 모바일은 `name#랜덤`으로 전송, 디스플레이는 `#` 이전만 표시
- 디스플레이는 `aim-off` 후 다트를 3초 뒤 제거하여 결과 연출 유지
