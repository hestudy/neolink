import { HealthCheck } from '../components/HealthCheck';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to NeoLink
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            AI-Powered Link Management Platform
          </p>

          <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              System Status
            </h2>
            <HealthCheck />
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                🤖 AI-Powered
              </h3>
              <p className="text-gray-600">
                Automatically categorize and tag your links with advanced AI
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                🔗 Smart Organization
              </h3>
              <p className="text-gray-600">
                Intelligent link management with powerful search capabilities
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                🚀 Fast & Reliable
              </h3>
              <p className="text-gray-600">
                Built with modern technologies for optimal performance
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
