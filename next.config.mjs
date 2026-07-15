/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The pure engine in src/ uses NodeNext-style ".js" specifiers that actually point at ".ts"
  // sources. Teach the bundler to resolve them so the app can import the engine directly.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json", ".mjs"],
  },
};

export default nextConfig;
