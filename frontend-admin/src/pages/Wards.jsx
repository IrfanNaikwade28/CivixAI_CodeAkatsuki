import { useState, useEffect } from 'react';
import { Card } from '../components/ui/index.jsx';
import { apiGetWardAnalytics } from '../services/api';
import { Map } from 'lucide-react';

export default function Wards() {
  const [wards, setWards] = useState([]);

  useEffect(() => {
    apiGetWardAnalytics()
      .then(data => setWards(Array.isArray(data) ? data : (data.results || [])))
      .catch(e => console.error('Wards analytics error', e));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Ward Analytics</h2>
        <p className="text-gray-500 text-sm mt-1">Issue distribution and resolution across wards</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {wards.map(ward => {
          const resRate = ward.totalIssues > 0 ? Math.round((ward.resolved / ward.totalIssues) * 100) : 0;
          return (
            <Card key={ward.id} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Map size={18} className="text-blue-700" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{ward.id}</p>
                    <p className="text-xs text-gray-500">Ichalkaranji Municipal</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${resRate >= 70 ? 'text-green-600' : resRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {resRate}% resolved
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-gray-900">{ward.totalIssues}</p>
                  <p className="text-xs text-gray-400">Total</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-green-700">{ward.resolved}</p>
                  <p className="text-xs text-green-600">Resolved</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-red-600">{ward.pending}</p>
                  <p className="text-xs text-red-500">Pending</p>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Resolution Rate</span>
                  <span>{resRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${resRate >= 70 ? 'bg-green-500' : resRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${resRate}%` }}
                  />
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Avg Resolution</span>
                <span className="font-medium text-gray-800">{ward.avgResolutionHours ?? '—'}h</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Summary table */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Ward Performance Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Ward', 'Total Issues', 'Resolved', 'Pending', 'Resolution Rate', 'Avg Time'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...wards].sort((a, b) => b.pending - a.pending).map(ward => {
                const rate = ward.totalIssues > 0 ? Math.round((ward.resolved / ward.totalIssues) * 100) : 0;
                return (
                  <tr key={ward.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-800">{ward.id}</td>
                    <td className="px-5 py-3 text-gray-700">{ward.totalIssues}</td>
                    <td className="px-5 py-3 text-green-600 font-medium">{ward.resolved}</td>
                    <td className="px-5 py-3 text-red-600 font-medium">{ward.pending}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${rate >= 70 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{rate}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{ward.avgResolutionHours ?? '—'}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
