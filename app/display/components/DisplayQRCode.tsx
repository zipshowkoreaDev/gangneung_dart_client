import { QRCodeSVG } from "qrcode.react";

interface DisplayQRCodeProps {
  url: string;
}

// 디스플레이 페이지 우측 하단 QR 코드
export default function DisplayQRCode({ url }: DisplayQRCodeProps) {
  if (!url) return null;

  return (
    <div className="absolute bottom-10 right-10 z-10 bg-white p-3 rounded-sm">
      <QRCodeSVG value={url} size={100} level="H" />
    </div>
  );
}
