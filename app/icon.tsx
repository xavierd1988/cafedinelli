// Favicon dynamique généré côté serveur via ImageResponse de Next.js.
// "D" doré sur fond noir profond — match avec le style éditorial du café
// (gold #D4AF37 utilisé partout dans la palette : NeonSign, masthead,
// DINELLI'S sur le Pixoo).

import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0806",
          borderRadius: 8
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: "#D4AF37",
            fontFamily: "Georgia, serif",
            lineHeight: 1,
            // Léger décalage optique pour centrer visuellement le D
            marginTop: -4
          }}
        >
          D
        </div>
      </div>
    ),
    { ...size }
  );
}
