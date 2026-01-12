"use client";

import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { generateAuthUrl } from "@/lib/url";

const FIXED_ROOM = "zipshow";

interface QRData {
  url: string;
  createdAt: number;
  slot: 1 | 2;
}

export default function AdminQRPage() {
  const buildQrCodes = (createdAt: number): [QRData, QRData] => {
    const player1Url = generateAuthUrl(FIXED_ROOM, 1);
    const player2Url = generateAuthUrl(FIXED_ROOM, 2);
    return [
      { url: player1Url, createdAt, slot: 1 },
      { url: player2Url, createdAt, slot: 2 },
    ];
  };

  const [qrCodes, setQrCodes] = useState<[QRData, QRData] | null>(() => {
    if (typeof window === "undefined") return null;
    return buildQrCodes(Date.now());
  });

  const generateQRCodes = useCallback(() => {
    setQrCodes(buildQrCodes(Date.now()));
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("클립보드에 복사되었습니다!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            현장 체험 QR 코드
          </h1>
          <p className="text-gray-400">
            &quot;{FIXED_ROOM}&quot; 체험을 위한 현장 한정 QR 코드 (플레이어 슬롯 1, 2)
          </p>
        </div>

        {qrCodes ? (
          <div className="space-y-6">
            <div className="flex justify-center mb-6">
              <button
                onClick={() => generateQRCodes()}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg transition-colors shadow-lg"
              >
                새 QR 코드 생성
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {qrCodes.map((qr) => (
                <div
                  key={qr.slot}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20"
                >
                  <div className="flex flex-col gap-6">
                    <div className="text-center">
                      <div className="inline-block px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-4">
                        <span className="text-2xl font-bold text-white">
                          플레이어 {qr.slot}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="bg-white p-6 rounded-2xl shadow-2xl">
                        <QRCodeSVG
                          value={qr.url}
                          size={280}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-medium text-blue-300 mb-2">
                          Room ID
                        </div>
                        <div className="text-xl font-bold text-white">
                          game-{FIXED_ROOM}-player{qr.slot}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-400 mb-2">
                          접속 URL
                        </div>
                        <div className="text-xs text-white bg-black/30 p-3 rounded-lg break-all">
                          {qr.url}
                        </div>
                      </div>

                      <div className="text-sm text-gray-500">
                        생성 시각:{" "}
                        {new Date(qr.createdAt).toLocaleString("ko-KR")}
                      </div>

                      <button
                        onClick={() => copyToClipboard(qr.url)}
                        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        URL 복사
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
            <div className="text-gray-400 text-lg">
              QR 코드를 로딩 중입니다...
            </div>
          </div>
        )}

        <div className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-300 mb-2">
            사용 방법
          </h3>
          <ol className="text-yellow-100 text-sm space-y-2 list-decimal list-inside">
            <li>위의 2개 QR 코드를 현장에 배치합니다 (플레이어 1, 2용)</li>
            <li>각 플레이어가 자신의 슬롯 QR 코드를 스캔하면 세션이 발급됩니다</li>
            <li>
              플레이어 1은 game-{FIXED_ROOM}-player1 룸에, 플레이어 2는 game-{FIXED_ROOM}-player2 룸에 입장합니다
            </li>
            <li>
              Display는 양쪽 플레이어 룸을 모두 구독하여 게임을 표시합니다
            </li>
            <li>
              새로운 QR 코드가 필요하면 &quot;새 QR 코드 생성&quot; 버튼을
              클릭하세요
            </li>
          </ol>
        </div>

        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-300 mb-2">
            보안 정보
          </h3>
          <ul className="text-blue-100 text-sm space-y-2">
            <li>
              세션은 <strong>sessionStorage</strong>에 저장되어 브라우저 탭
              단위로 격리됩니다
            </li>
            <li>
              세션은 <strong>24시간</strong> 동안 유효합니다
            </li>
            <li>
              URL을 직접 입력하여 접속한 사용자는 세션이 없어 체험에 접근할 수
              없습니다
            </li>
            <li>탭을 닫으면 세션이 자동으로 삭제됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
