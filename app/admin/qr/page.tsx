"use client";

import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { generateAuthUrl } from "@/lib/url";

const FIXED_ROOM = "zipshow";

// QR 코드 생성 관리자 페이지
// 현장 체험용 QR 코드를 생성하고 관리
export default function AdminQRPage() {
  // lazy initialization으로 클라이언트에서만 QR 생성
  const [currentQR, setCurrentQR] = useState<{
    url: string;
    createdAt: number;
  } | null>(() => {
    if (typeof window === "undefined") return null;

    const url = generateAuthUrl(FIXED_ROOM);
    console.log("Admin QR URL:", url); // 디버깅
    return {
      url,
      createdAt: Date.now(),
    };
  });

  const generateQRCode = useCallback(() => {
    const url = generateAuthUrl(FIXED_ROOM);
    console.log("Regenerated QR URL:", url); // 디버깅
    setCurrentQR({
      url,
      createdAt: Date.now(),
    });
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("클립보드에 복사되었습니다!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            현장 체험 QR 코드
          </h1>
          <p className="text-gray-400">
            &quot;{FIXED_ROOM}&quot; 체험을 위한 현장 한정 QR 코드
          </p>
        </div>

        {currentQR ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="flex flex-col lg:flex-row gap-8 items-center">
              {/* QR 코드 섹션 */}
              <div className="flex-shrink-0">
                <div className="bg-white p-6 rounded-2xl shadow-2xl">
                  <QRCodeSVG
                    value={currentQR.url}
                    size={300}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <div className="mt-4 text-center">
                  <button
                    onClick={() => generateQRCode()}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    새 QR 코드 생성
                  </button>
                </div>
              </div>

              {/* 정보 섹션 */}
              <div className="flex-1 space-y-4 w-full">
                <div>
                  <div className="text-sm font-medium text-blue-300 mb-2">
                    Room ID
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {FIXED_ROOM}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-400 mb-2">
                    접속 URL
                  </div>
                  <div className="text-sm text-white bg-black/30 p-3 rounded-lg break-all">
                    {currentQR.url}
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  생성 시각:{" "}
                  {new Date(currentQR.createdAt).toLocaleString("ko-KR")}
                </div>

                <button
                  onClick={() => copyToClipboard(currentQR.url)}
                  className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                >
                  URL 복사
                </button>
              </div>
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
            <li>위의 QR 코드를 현장에 배치합니다 (인쇄 또는 디스플레이)</li>
            <li>사용자가 QR 코드를 스캔하면 세션이 발급됩니다</li>
            <li>
              세션이 있는 사용자만 &quot;{FIXED_ROOM}&quot; 체험에 접근할 수
              있습니다
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
              • 세션은 <strong>sessionStorage</strong>에 저장되어 브라우저 탭
              단위로 격리됩니다
            </li>
            <li>
              • 세션은 <strong>24시간</strong> 동안 유효합니다
            </li>
            <li>
              • URL을 직접 입력하여 접속한 사용자는 세션이 없어 체험에 접근할 수
              없습니다
            </li>
            <li>• 탭을 닫으면 세션이 자동으로 삭제됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
