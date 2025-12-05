import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Разрешить доступ с любых IP в dev режиме (для мобильного тестирования)
  allowedDevOrigins: ["*"],
  
  // Проксирование API запросов через Next.js
  // Это решает проблему CORS при доступе с мобильных устройств
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
