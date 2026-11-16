/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Anexos até 15 MB por ficheiro, 25 MB por envio (validado no servidor).
    serverActions: { bodySizeLimit: "30mb" },
    serverComponentsExternalPackages: ["postgres"],
  },
};

export default nextConfig;
